import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { requireTenant } from "@/lib/db/tenant-context";
import { safeStockDecrement } from "@/lib/db/stock-guards";

/**
 * QA-K16: Təsdiq tələb edən satışın MATERİALLAŞMASI.
 *
 * `tesdiq_gozleyir` satış yaradılanda finalize bloku (stok mexarici, kassa,
 * finance, müştəri balansı) qəsdən atlanır. Əvvəllər təsdiqdən sonra HEÇ KİM
 * bunu icra etmirdi — satış siyahıda görünür, amma stok azalmır, pul/borc
 * yaranmırdı. Bu funksiya approveRequest → propagateDocumentApproval-dan
 * çağırılır və satışı real dünyaya bağlayır.
 *
 * İdempotentdir: orijinal mexaric hərəkəti artıq varsa heç nə etmir.
 * Qeyd: sətir-səviyyə anbar saxlanmadığı üçün (sxem məhdudiyyəti) bütün
 * sətirlər başlıqdakı anbara mexaric olunur.
 */
export async function materializeApprovedSale(
  saleId: string,
): Promise<{ ok: true; already?: boolean } | { ok: false; error: string }> {
  const { sahibkarId, istifadeciId } = requireTenant();
  try {
    await prisma.$transaction(
      async (tx) => {
        const sale = await tx.satis_sifarisleri.findUnique({
          where: { id: saleId },
          include: { satis_sifaris_satirlari: true },
        });
        if (!sale) throw new Error("Satış tapılmadı");

        // İdempotentlik — artıq materiallaşıbsa (mexaric var) təkrar etmə.
        const had = await tx.anbar_hereketleri.findFirst({
          where: { sahibkar_id: sahibkarId, ref_nov: "satis_sifarisi", ref_id: saleId, nov: "mexaric" },
          select: { id: true },
        });
        if (had) return;

        const anbarId = sale.anbar_id;
        if (!anbarId) throw new Error("Satışın anbarı təyin olunmayıb");

        // 1) Stok mexarici — race-safe decrement + hərəkət qeydi
        for (const line of sale.satis_sifaris_satirlari) {
          if (!line.mehsul_id) continue;
          const miqdar = Number(line.miqdar ?? 0);
          if (miqdar <= 0) continue;
          const dec = await safeStockDecrement(tx, {
            mehsulId: line.mehsul_id,
            anbarId,
            miqdar,
            // QA-orta: aktiv bron materiallaşmanı da bloklasın (öz bronu istisna)
            rezervNezereAl: true,
            excludeSatisId: saleId,
          });
          if (!dec.ok) throw new Error(dec.error);
          await tx.anbar_hereketleri.create({
            data: {
              sahibkar_id: sahibkarId,
              anbar_id: anbarId,
              mehsul_id: line.mehsul_id,
              nov: "mexaric",
              miqdar: new Prisma.Decimal(miqdar),
              qiymet: new Prisma.Decimal(Number(line.vahid_qiymet ?? 0)),
              ref_nov: "satis_sifarisi",
              ref_id: saleId,
              edilen_id: istifadeciId,
              qeyd: `Satış #${sale.nomre} (təsdiqdən sonra materiallaşma)`,
            },
          });
        }

        // 2) Ödəniş/borc — yaradılışdakı defaultlarla: nisyə→0 (tam borc),
        //    digər → tam ödəniş (orijinal "odenilen" inputu təsdiq axınında itir).
        const sonMebleg = Number(sale.son_mebleg ?? 0);
        const odenisNov = sale.odenis_nov ?? "negd";
        const odenilen = odenisNov === "nisye" ? 0 : sonMebleg;
        const isFullPaid = odenilen >= sonMebleg - 0.001 && sonMebleg > 0;

        await tx.satis_sifarisleri.update({
          where: { id: saleId },
          data: {
            odenilmis: new Prisma.Decimal(odenilen.toFixed(2)),
            status: isFullPaid ? "tamamlandi" : "yeni",
            ...(odenilen < sonMebleg - 0.001 ? { odenis_nov: "nisye" } : {}),
          },
        });

        if (odenilen > 0 && sale.kassa_id) {
          await tx.kassa_emeliyyatlari.create({
            data: {
              sahibkar_id: sahibkarId,
              kassa_id: sale.kassa_id,
              emeliyyat_nov: "satis",
              odenis_nov: odenisNov === "nisye" ? "negd" : odenisNov,
              mebleg: new Prisma.Decimal(odenilen.toFixed(2)),
              ref_nov: "satis_sifarisi",
              ref_id: saleId,
              istifadeci_id: istifadeciId,
              qeyd: `Satış #${sale.nomre} (təsdiqdən sonra)`,
            },
          });
        }

        if (odenilen > 0) {
          // finance_operations + hesab balansı (best-effort, satışı bloklamasın)
          try {
            let type = await tx.finance_operation_types
              .findUnique({ where: { kod: "qaime" } })
              .catch(() => null);
            if (!type) {
              type = await tx.finance_operation_types.create({
                data: { kod: "qaime", ad: "Qaimə", qrup: "qaime", y_n: "daxil", link_satish: true },
              });
            }
            let hesabIdForOp: string | null = null;
            if (sale.kassa_id) {
              const kassaRow = await tx.kassalar.findFirst({
                where: { id: sale.kassa_id, sahibkar_id: sahibkarId },
                select: { maliye_hesab_id: true },
              });
              hesabIdForOp = kassaRow?.maliye_hesab_id ?? null;
            }
            if (!hesabIdForOp) {
              const fallbackNov =
                odenisNov === "kart" ? "kart" : odenisNov === "kecirme" ? "bank" : "negd";
              const def = await tx.maliye_hesablari.findFirst({
                where: { sahibkar_id: sahibkarId, aktiv: true, nov: fallbackNov },
                orderBy: { yaradildi: "asc" },
                select: { id: true },
              });
              hesabIdForOp = def?.id ?? null;
            }
            await tx.finance_operations.create({
              data: {
                sahibkar_id: sahibkarId,
                type_id: type.id,
                type_kod: type.kod,
                y_n: "daxil",
                // QA-fix: maliyyə qeydi satışın öz tarixini almalıdır (bugün yox) — auto-approve/gec-təsdiq
                // halında sənəd yanlış dövrə düşürdü.
                tarix: sale.tarix ?? new Date(),
                meblegh: new Prisma.Decimal(odenilen.toFixed(2)),
                valyuta: "AZN",
                mezenne: 1,
                azn_meblegh: new Prisma.Decimal(odenilen.toFixed(2)),
                hesab_id: hesabIdForOp,
                kontragent_id: sale.musteri_id ?? null,
                satis_id: saleId,
                sened_nomresi: sale.nomre,
                qeyd: `Satış #${sale.nomre} — təsdiqdən sonra materiallaşma`,
                yaradan_id: istifadeciId,
              },
            });
            if (hesabIdForOp) {
              const { recalculateAccountBalance } = await import("@/lib/balance/account-balance");
              await recalculateAccountBalance(hesabIdForOp, tx);
            }
          } catch (e) {
            console.warn("[materializeApprovedSale] finance skipped:", e);
          }
        }

        // 3) Müştəri balansı
        if (sale.musteri_id) {
          const { recalculateCustomerBalance } = await import("@/lib/balance/customer-balance");
          await recalculateCustomerBalance(sale.musteri_id, tx);
        }
      },
      { timeout: 20_000 },
    );
    return { ok: true };
  } catch (e) {
    console.error("[materializeApprovedSale]", e);
    return { ok: false, error: e instanceof Error ? e.message : "Materiallaşma alınmadı" };
  }
}
