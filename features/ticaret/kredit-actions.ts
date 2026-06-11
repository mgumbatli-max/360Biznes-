"use server";

import { revalidatePath } from "next/cache";
import { Prisma, prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { parseLocalDate } from "@/lib/utils";
import { audit } from "@/lib/audit/log";
import { requireTicaretActionPerm, bustTicaretCache } from "./access-guard";

type ActionResult = { ok: true } | { ok: false; error: string };

/**
 * Record a payment against a credit sale. Increments `odenilmis` on the
 * sale, capped at `son_mebleg`. Also writes a finance_operations row
 * if available; falls back gracefully if model differs.
 */
export async function acceptKreditPayment(saleId: string, amount: number): Promise<ActionResult> {
  const permCheck = await requireTicaretActionPerm(["kredit.odenis", "kredit.idare", "satis.odenis"]);
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  if (!Number.isFinite(amount) || amount <= 0) return { ok: false, error: "Məbləğ düzgün deyil" };

  return withTenant(async () => {
    let appliedAmount = 0;
    let prevOdenilmis = 0;
    try {
      await prisma.$transaction(async (tx) => {
        const sale = await tx.satis_sifarisleri.findUnique({
          where: { id: saleId },
          select: { id: true, son_mebleg: true, odenilmis: true, status: true, odenis_nov: true },
        });
        if (!sale) throw new Error("Satış tapılmadı");
        if (sale.status === "legv") throw new Error("Ləğv edilmiş satışa ödəniş edilə bilməz");

        const son = Number(sale.son_mebleg ?? 0);
        const cari = Number(sale.odenilmis ?? 0);
        const qaliq = son - cari;
        const tutulan = Math.min(amount, qaliq);
        if (tutulan <= 0) throw new Error("Bu satışda qalıq yoxdur");
        prevOdenilmis = cari;
        appliedAmount = tutulan;

        await tx.satis_sifarisleri.update({
          where: { id: saleId },
          data: { odenilmis: cari + tutulan, yenilendi: new Date() },
        });
      });

      revalidatePath("/ticaret/kredit");
      revalidatePath("/ticaret/satislar");
      revalidatePath(`/ticaret/satislar/${saleId}`);
      revalidatePath("/ticaret");
      bustTicaretCache();
      await audit("yenile", "kredit_satis_odenis", saleId, {
        evvelki_data: { odenilmis: prevOdenilmis },
        yeni_data: { odenis: appliedAmount, yeni_odenilmis: prevOdenilmis + appliedAmount },
        sebeb: "Kredit satışı ödənişi qəbul edildi",
      });
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Xəta baş verdi" };
    }
  });
}

/**
 * Record a bank/credit institution payment against a credit "qeyd".
 * Creates a finance_operations row (qaimə-type / mədaxil) linked to
 * the credit record, updates kredit_satislari.pul_alindi and
 * advances satis_sifarisleri (lifts qaralama, increments odenilmis).
 */
export async function recordKreditPayment(
  kreditId: string,
  mebleg: number,
  hesabId: string,
  tarix?: string,
): Promise<ActionResult> {
  const permCheck = await requireTicaretActionPerm(["kredit.odenis", "kredit.idare", "maliyye.idare"]);
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  if (!Number.isFinite(mebleg) || mebleg <= 0) return { ok: false, error: "Məbləğ düzgün deyil" };
  if (!hesabId) return { ok: false, error: "Hesab seçilməlidir" };

  return withTenant(async () => {
    const { sahibkarId, istifadeciId: userId } = requireTenant();
    try {
      await prisma.$transaction(async (tx) => {
        // 🔒 FOR UPDATE LOCK — paralel kredit ödənişlərində duplikat-i önləyir
        const lockedKredit = await tx.$queryRaw<Array<{ id: string; satis_id: string | null; status: string }>>`
          SELECT id, satis_id::text AS satis_id, status FROM kredit_satislari
          WHERE id = ${kreditId}::uuid AND sahibkar_id = ${sahibkarId}::uuid FOR UPDATE
        `;
        if (lockedKredit.length === 0) throw new Error("Kredit qeydi tapılmadı");

        const k = await tx.kredit_satislari.findFirst({
          where: { id: kreditId, sahibkar_id: sahibkarId },
          select: {
            id: true,
            satis_id: true,
            magaza_net: true,
            bank: true,
            status: true,
          },
        });
        if (!k) throw new Error("Kredit qeydi tapılmadı");

        // satış məlumatı + lock
        if (k.satis_id) {
          await tx.$queryRaw`
            SELECT id FROM satis_sifarisleri WHERE id = ${k.satis_id}::uuid FOR UPDATE
          `;
        }
        const sale = k.satis_id
          ? await tx.satis_sifarisleri.findUnique({
              where: { id: k.satis_id },
              select: { id: true, son_mebleg: true, odenilmis: true, qaralama: true, musteri_id: true, status: true },
            })
          : null;

        const magazaNet = Number(k.magaza_net ?? 0);
        const odenilmisIndi = Number(sale?.odenilmis ?? 0);
        const qaliqNet = Math.max(0, magazaNet - odenilmisIndi);
        const tutulan = Math.min(mebleg, qaliqNet > 0 ? qaliqNet : mebleg);

        // Find or create operation type "qaime"
        let type = await tx.finance_operation_types
          .findUnique({ where: { kod: "qaime" } })
          .catch(() => null);
        if (!type) {
          type = await tx.finance_operation_types
            .create({
              data: { kod: "qaime", ad: "Qaimə", qrup: "qaime", y_n: "daxil" },
            })
            .catch(() => null);
        }

        if (type) {
          await tx.finance_operations.create({
            data: {
              sahibkar_id: sahibkarId,
              type_id: type.id,
              type_kod: type.kod,
              y_n: "daxil",
              tarix: tarix
                ? (/^\d{4}-\d{2}-\d{2}$/.test(String(tarix)) ? (parseLocalDate(String(tarix)) ?? new Date()) : new Date(tarix))
                : new Date(),
              meblegh: tutulan,
              valyuta: "AZN",
              mezenne: 1,
              azn_meblegh: tutulan,
              hesab_id: hesabId,
              satis_id: k.satis_id ?? null,
              kontragent_id: sale?.musteri_id ?? null,
              qeyd: `[KREDIT_GELISH:${kreditId}] Bank: ${k.bank ?? "—"}`,
              yaradan_id: userId ?? null,
            },
          });
          // Hesab balansı artımı — əvvəl yox idi, bu kassa/bank sapmasına səbəb olurdu
          await tx.maliye_hesablari.updateMany({
            where: { id: hesabId, sahibkar_id: sahibkarId },
            data: { qaliq: { increment: tutulan } },
          });
        }

        // Update credit record
        const yeniOdenilmisCem = odenilmisIndi + tutulan;
        const tamOdendi = yeniOdenilmisCem >= magazaNet - 0.001;
        await tx.kredit_satislari.update({
          where: { id: kreditId },
          data: {
            pul_alindi: tamOdendi,
            pul_alinma_tarixi: tamOdendi ? new Date() : null,
            hesab_id: hesabId,
            status: tamOdendi ? "tamamlandi" : "qismen",
            yenilendi: new Date(),
          },
        });

        // Update sales — stok artıq createKreditSatis-də düşürülüb, indi yalnız
        // ödənilmiş məbləği və statusu yeniləyirik.
        if (sale) {
          await tx.satis_sifarisleri.update({
            where: { id: sale.id },
            data: {
              // QA-orta: tam ödənişdə bank komissiya fərqi (son_mebleg − magaza_net)
              // fantom açıq qalıq kimi qalmasın — odenilmis son_mebleg-ə bərabərləşdirilir.
              // Real daxilolma finance_operations-da `tutulan` (net) ilə düzgün qalır.
              odenilmis:
                tamOdendi && sale.son_mebleg != null
                  ? sale.son_mebleg
                  : new Prisma.Decimal(yeniOdenilmisCem.toFixed(2)),
              qaralama: false,
              status: tamOdendi ? "tamamlandi" : "yeni",
              yenilendi: new Date(),
            },
          });
        }
      });

      revalidatePath("/ticaret/kredit");
      revalidatePath("/maliyye/emeliyyat");
      revalidatePath("/maliyye");
      bustTicaretCache();
      // Audit: bank/kredit ödənişi qəbul edildi — maliyyəyə daxil olan vəsait
      await audit("yarat", "kredit_bank_odenis", kreditId, {
        yeni_data: { mebleg, hesab_id: hesabId, tarix: tarix ?? null },
        sebeb: "Bank/kredit qurumundan pul daxil oldu",
      });
      return { ok: true };
    } catch (e) {
      console.error("[recordKreditPayment]", e);
      return { ok: false, error: e instanceof Error ? e.message : "Xəta baş verdi" };
    }
  });
}
