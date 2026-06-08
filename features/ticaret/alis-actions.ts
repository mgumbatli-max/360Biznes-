"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { prisma, Prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { checkAndCreateStockAlertBatch } from "@/features/anbar/alert-helpers";
import { createApprovalRequest, shouldRequireDocApproval } from "@/features/tesdiq/create";
import { nextDocNumber } from "@/lib/db/sened-nomre";
import { requireTicaretActionPerm, bustTicaretCache } from "./access-guard";
import { audit } from "@/lib/audit/log";
import { stockIncrement } from "@/lib/db/stock-guards";

const LineSchema = z.object({
  mehsul_id: z.string().uuid(),
  miqdar: z.coerce.number().positive(),
  qiymet: z.coerce.number().min(0),
});

const CreatePurchaseSchema = z.object({
  techizatci_id: z.string().uuid(),
  anbar_id: z.coerce.number().int().positive(),
  qaime_nomre: z.string().max(50).optional().or(z.literal("")),
  qeyd: z.string().max(2000).optional().or(z.literal("")),
  receive_now: z.coerce.boolean().default(false), // if true, increment stock immediately
  // Əlavə xərclər — proporsional olaraq sətir mayasına paylanır
  gomruk: z.coerce.number().min(0).default(0),
  catdirilma: z.coerce.number().min(0).default(0),
  diger_xerc: z.coerce.number().min(0).default(0),
  // Ödəniş — true olarsa təchizatçı borcu yaranmır, kassadan/bankdan məxariç olur
  pay_now: z.coerce.boolean().default(false),
  hesab_id: z.string().uuid().optional().or(z.literal("").transform(() => undefined)),
  lines: z.array(LineSchema).min(1),
});

export type CreatePurchaseInput = z.input<typeof CreatePurchaseSchema>;
export type CreatePurchaseResult =
  | { ok: true; id: string; nomre: string; warning?: string }
  | { ok: false; error: string };

const PURCHASE_PREFIX = "ALS";

export async function createPurchase(input: CreatePurchaseInput): Promise<CreatePurchaseResult> {
  const permCheck = await requireTicaretActionPerm("alis.yarat");
  if (!permCheck.ok) return { ok: false, error: permCheck.error };

  const parsed = CreatePurchaseSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Forma yanlışdır" };
  const d = parsed.data;

  // 4-eyes təsdiqi yoxla — admin "alış qaiməsi təsdiq tələbi" funksiyasını aktiv
  // edibsə, qaimə "tesdiq_gozleyir" statusunda yaradılır və receive_now ignore
  // olunur (təsdiqdən əvvəl stoka tıxılmamalıdır).
  const needsApproval = await shouldRequireDocApproval("alis_qaime");

  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    try {
      const result = await prisma.$transaction(async (tx) => {
        const subtotal = d.lines.reduce((s, l) => s + l.miqdar * l.qiymet, 0);
        const elaveXerc = d.gomruk + d.catdirilma + d.diger_xerc;
        const umumi = subtotal + elaveXerc;

        // Əlavə xərc izahı (xerc_qeyd-də saxlanılır)
        const xercParts: string[] = [];
        if (d.gomruk > 0) xercParts.push(`Gömrük: ${d.gomruk.toFixed(2)} ₼`);
        if (d.catdirilma > 0) xercParts.push(`Çatdırılma: ${d.catdirilma.toFixed(2)} ₼`);
        if (d.diger_xerc > 0) xercParts.push(`Digər: ${d.diger_xerc.toFixed(2)} ₼`);
        const xercQeyd = xercParts.length > 0 ? xercParts.join(" · ") : null;

        const year = new Date().getFullYear();
        const last = await tx.alis_sifarisleri.findFirst({
          where: { nomre: { startsWith: `${PURCHASE_PREFIX}-${year}-` } },
          orderBy: { nomre: "desc" },
          select: { nomre: true },
        });
        const lastNum = last ? Number(last.nomre.split("-").pop()) || 0 : 0;
        const nomre = `${PURCHASE_PREFIX}-${year}-${String(lastNum + 1).padStart(5, "0")}`;

        const purchase = await tx.alis_sifarisleri.create({
          data: {
            sahibkar_id: sahibkarId,
            nomre,
            techiazatci_id: d.techizatci_id,
            anbar_id: d.anbar_id,
            tarix: new Date(),
            status: needsApproval
              ? "tesdiq_gozleyir"
              : d.receive_now
                ? "qebul_edildi"
                : "gozlemede",
            umumi_mebleg: umumi,
            elave_xerc: elaveXerc,
            xerc_qeyd: xercQeyd,
            // ÖNƏMLİ: odenilmis sıfır ilə başlayır. Aşağıdakı blok kassa qaliqı
            // kifayət etdikdə pay_now=true halında onu artırır. Əgər kassa boşdursa,
            // odenilmis 0 qalır — borc kimi qeydə alınır.
            odenilmis: 0,
            qaime_nomre: d.qaime_nomre || null,
            qeyd: d.qeyd || null,
            yaradan_id: istifadeciId,
            menecer_id: istifadeciId,
          },
        });

        for (const line of d.lines) {
          // Proporsional əlavə xərc paylanması — line subtotal ÷ ümumi subtotal × elave_xerc
          const lineSubtotal = line.miqdar * line.qiymet;
          const paylananXerc = subtotal > 0 ? (lineSubtotal / subtotal) * elaveXerc : 0;
          const realMayaEded = line.qiymet + paylananXerc / line.miqdar;

          await tx.alis_sifaris_satirlari.create({
            data: {
              sahibkar_id: sahibkarId,
              sifaris_id: purchase.id,
              mehsul_id: line.mehsul_id,
              miqdar: line.miqdar,
              vahid_qiymet: line.qiymet,
              endirim_faiz: 0,
              paylanan_xerc: paylananXerc,
              real_maya_eded: realMayaEded,
            },
          });

          // Təsdiq gözləyirsə, stoka heç bir hərəkət yoxdur — təsdiqdən sonra
          // approveRequest helper-i receivePurchase çağıracaq.
          if (d.receive_now && !needsApproval) {
            // Race-safe upsert — paralel alış qəbulları unique constraint-ə düşmür
            await stockIncrement(tx, {
              sahibkarId,
              mehsulId: line.mehsul_id,
              anbarId: d.anbar_id,
              miqdar: line.miqdar,
              sonQiymet: line.qiymet,
            });

            await tx.anbar_hereketleri.create({
              data: {
                sahibkar_id: sahibkarId,
                anbar_id: d.anbar_id,
                mehsul_id: line.mehsul_id,
                nov: "medaxil",
                miqdar: line.miqdar,
                qiymet: line.qiymet,
                ref_nov: "alis_sifarisi",
                ref_id: purchase.id,
                edilen_id: istifadeciId,
              },
            });
          }
        }

        // Təchizatçı borcu vs ani ödəniş — qarşılıqlı seçim.
        // - pay_now=true && hesab var → kassadan/bankdan məxariç + finance_operations
        // - əks halda kontragent.borc artırılır (təchizatçıya borcumuz)
        // Təsdiq gözləyən sənəddə heç biri tətbiq olunmur.
        let paidNow = false;
        let usedHesabId: string | null = null;
        if (!needsApproval) {
          // Explicit flow control — borca yazılma yalnız ödəniş icra olunmasa
          let shouldCreateDebt = false;
          if (d.pay_now && umumi > 0) {
            usedHesabId = d.hesab_id ?? null;
            if (!usedHesabId) {
              const def = await tx.maliye_hesablari.findFirst({
                where: { sahibkar_id: sahibkarId, aktiv: true, nov: "nagd" },
                orderBy: { yaradildi: "asc" },
                select: { id: true },
              });
              usedHesabId = def?.id ?? null;
            }
            const alisType = await tx.finance_operation_types.findUnique({
              where: { kod: "alis_odenis" },
              select: { id: true },
            });
            if (usedHesabId && alisType) {
              // 🛡️ Source-of-truth yetərlilik yoxlaması
              const { checkAccountSufficient } = await import("@/lib/balance/account-balance");
              const sufficient = await checkAccountSufficient(usedHesabId, umumi, tx);
              if (!sufficient.ok) {
                // Hesab qaliği kifayət deyil — borc yaranır
                shouldCreateDebt = true;
                paidNow = false;
                usedHesabId = null;
              } else {
                paidNow = true;
              }
            }
            if (usedHesabId && alisType && paidNow) {
              await tx.finance_operations.create({
                data: {
                  sahibkar_id: sahibkarId,
                  type_id: alisType.id,
                  type_kod: "alis_odenis",
                  y_n: "mexaric",
                  meblegh: umumi,
                  azn_meblegh: umumi,
                  hesab_id: usedHesabId,
                  kontragent_id: d.techizatci_id,
                  alish_id: purchase.id,
                  status: "aktiv",
                  qeyd: `Alış qaiməsi #${nomre} ödənişi`,
                  yaradan_id: istifadeciId,
                  sened_nomresi: nomre,
                },
              });
              // Pul real olaraq çıxdı → alış qaiməsində ödənilmiş kimi qeyd et
              await tx.alis_sifarisleri.update({
                where: { id: purchase.id },
                data: { odenilmis: umumi },
              });
              // Source-of-truth-dan hesab qaliqını yenilə
              const { recalculateAccountBalance } = await import("@/lib/balance/account-balance");
              await recalculateAccountBalance(usedHesabId, tx);
              paidNow = true;
            } else {
              // Hesab/type tapılmadı — borc kimi qeyd et (graceful fallback)
              shouldCreateDebt = true;
            }
          } else {
            // pay_now=false → birbaşa borc
            shouldCreateDebt = true;
          }
          if (shouldCreateDebt) {
            // alis_sifarisleri.odenilmis already reflects what was paid.
            // Source-of-truth-dan recalc → drift olmaz.
            const { recalculateSupplierBalance } = await import("@/lib/balance/supplier-balance");
            await recalculateSupplierBalance(d.techizatci_id, tx);
          }
        }

        return { id: purchase.id, nomre, umumi, paidNow, usedHesabId };
      });

      // Təsdiq tələbini yarat (sənəd artıq DB-də var, yalnız tesdiq_gozleyir
      // statusundadır). approveRequest sonra status-u aktivə çevirəcək.
      if (needsApproval) {
        await createApprovalRequest({
          emeliyyat_nov: "alis_qaime",
          resurs_nov: "alis_sifarisi",
          resurs_id: result.id,
          basliq: `Alış qaiməsi ${result.nomre}`,
          risk_sebeb: "Alış qaiməsi yaradanda təsdiq tələb olunur",
          mebleg: Number(result.umumi),
          prioritet: Number(result.umumi) > 5000 ? "yuxsek" : "orta",
          detay_json: {
            qaime_nomre: d.qaime_nomre,
            anbar_id: d.anbar_id,
            techizatci_id: d.techizatci_id,
            line_count: d.lines.length,
          },
        });
      }

      revalidatePath("/ticaret/alislar");
      revalidatePath("/tesdiq");
      revalidateTag(`dashboard:${sahibkarId}`, "max");
      revalidateTag(`stok:${sahibkarId}`, "max");

      // Audit: alış yaradılması — təchizatçı, məbləğ, sətir sayı, təsdiq tələbi
      await audit("yarat", "alis_sifarisi", result.id, {
        yeni_data: {
          nomre: result.nomre,
          techizatci_id: d.techizatci_id,
          anbar_id: d.anbar_id,
          umumi_mebleg: Number(result.umumi),
          elave_xerc: d.gomruk + d.catdirilma + d.diger_xerc,
          gomruk: d.gomruk,
          catdirilma: d.catdirilma,
          diger_xerc: d.diger_xerc,
          line_count: d.lines.length,
          receive_now: d.receive_now,
          paid_now: result.paidNow,
          hesab_id: result.usedHesabId,
          needs_approval: needsApproval,
        },
        sebeb: needsApproval ? "Alış qaiməsi təsdiq gözləyir" : (d.receive_now ? "Alış qaiməsi yaradıldı və qəbul edildi" : "Alış qaiməsi yaradıldı (gözləmədə)"),
      });

      // Alış qəbul edildikdə stok artır — auto-push kanal-larına yenilik göndər
      const { emitStockChange } = await import("@/lib/stock-change-emitter");
      emitStockChange(d.lines.map((l) => l.mehsul_id));

      // Nağd seçilmişdi amma kassada pul kifayət etmədi → istifadəçiyə xəbər ver
      const fallbackToDebt = d.pay_now && umumi > 0 && !result.paidNow;
      return {
        ok: true,
        id: result.id,
        nomre: result.nomre,
        warning: fallbackToDebt
          ? "Kassa/hesab qaliqı kifayət etmədi — qaimə borc kimi qeydə alındı. Maliyyə > Kreditor səhifəsindən gör."
          : undefined,
      };
    } catch (e) {
      const { logAndFriendly } = await import("@/lib/error/user-message");
      return { ok: false, error: logAndFriendly("createPurchase", e, "Alış qaiməsi yaradılmadı") };
    }
  });
}

export async function receivePurchase(purchaseId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const permCheck = await requireTicaretActionPerm(["alis.qebul", "alis.idare", "anbar.medaxil"]);
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    const receivedMehsulIds: string[] = [];
    try {
      await prisma.$transaction(async (tx) => {
        // 🔒 FOR UPDATE LOCK — paralel "Qəbul et" basışlarında double mədaxil önlənir
        const lockedRows = await tx.$queryRaw<Array<{ id: string; status: string }>>`
          SELECT id, status FROM alis_sifarisleri WHERE id = ${purchaseId}::uuid FOR UPDATE
        `;
        if (lockedRows.length === 0) throw new Error("Alış tapılmadı");
        if (lockedRows[0].status !== "gozlemede") {
          throw new Error("Alış artıq qəbul edilib və ya paralel əməliyyat icra olunur");
        }

        const purchase = await tx.alis_sifarisleri.findUnique({
          where: { id: purchaseId },
          include: { alis_sifaris_satirlari: true },
        });
        if (!purchase) throw new Error("Alış tapılmadı");
        if (!purchase.anbar_id) throw new Error("Anbar göstərilməyib");

        for (const line of purchase.alis_sifaris_satirlari) {
          if (line.mehsul_id) receivedMehsulIds.push(line.mehsul_id);
          if (!line.mehsul_id) continue;
          // ÖNƏMLİ: stoka real maya yazılır (vahid_qiymet + proporsional gömrük/çatdırılma/xərc),
          // xam vahid_qiymet yox. Bu COGS hesabının düzgün olmasını təmin edir.
          const realMaya = Number(line.real_maya_eded ?? line.vahid_qiymet);
          await stockIncrement(tx, {
            sahibkarId,
            mehsulId: line.mehsul_id,
            anbarId: purchase.anbar_id,
            miqdar: Number(line.miqdar),
            sonQiymet: realMaya,
          });

          // Məhsulun "son alış qiyməti" və "son alış tarixi" sahələrini yenilə.
          // Bu, məhsul kartında və hesabatda göstərilən mayanı sinxronlaşdırır.
          await tx.mehsullar.updateMany({
            where: { id: line.mehsul_id, sahibkar_id: sahibkarId },
            data: {
              alish_qiymeti: new Prisma.Decimal(realMaya.toFixed(4)),
              son_alish_de: new Date(),
            },
          });

          await tx.anbar_hereketleri.create({
            data: {
              sahibkar_id: sahibkarId,
              anbar_id: purchase.anbar_id,
              mehsul_id: line.mehsul_id,
              nov: "medaxil",
              miqdar: Number(line.miqdar),
              qiymet: realMaya,
              ref_nov: "alis_sifarisi",
              ref_id: purchase.id,
              edilen_id: istifadeciId,
            },
          });
        }
        await tx.alis_sifarisleri.update({
          where: { id: purchase.id },
          data: { status: "qebul_edildi" },
        });
      });
      // Stock alert auto-clear (stock increased → may resolve open kritik alerts)
      if (receivedMehsulIds.length > 0) {
        await checkAndCreateStockAlertBatch(receivedMehsulIds);
      }
      revalidatePath("/ticaret/alislar");
      revalidatePath("/anbar");
      revalidatePath("/xeberdarliqlar");
      bustTicaretCache();
      // Audit: alış qəbulu — stok artımı və status keçidi
      await audit("yenile", "alis_sifarisi", purchaseId, {
        yeni_data: { status: "qebul_edildi", mehsul_count: receivedMehsulIds.length },
        sebeb: "Alış qaiməsi qəbul edildi — stoka medaxil",
      });
      return { ok: true };
    } catch (e) {
      const { logAndFriendly } = await import("@/lib/error/user-message");
      return { ok: false, error: logAndFriendly("receivePurchase", e, "Qəbul tamamlanmadı") };
    }
  });
}

/**
 * Cancel a purchase — reverse stock (if received), reverse finance op
 * (if paid_now was used), reverse supplier debt (if was nisye).
 * Allowed for status in {gozlemede, qebul_edildi, aktiv}; not for legv.
 * Sets status='legv' and writes audit log.
 */
export async function cancelPurchase(
  purchaseId: string,
  reason: string,
): Promise<
  | { ok: true }
  | {
      ok: false;
      error: string;
      blockers?: import("@/lib/blockers/types").Blocker[];
      hint?: string;
    }
> {
  const permCheck = await requireTicaretActionPerm(["alis.legv", "alis.idare"]);
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  if (!reason.trim()) return { ok: false, error: "Səbəb göstərilməlidir" };
  if (reason.length > 1000) return { ok: false, error: "Səbəb çox uzundur" };

  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    const reversedMehsulIds: string[] = [];
    try {
      await prisma.$transaction(async (tx) => {
        // İdempotency: paralel cancel basışlarda hər ikisi pass edə bilməsin.
        // SELECT ilə FOR UPDATE-bənzər kilid almaq üçün $queryRaw.
        const lockedRows = await tx.$queryRaw<
          { id: string; status: string | null }[]
        >`SELECT id, status FROM alis_sifarisleri WHERE id = ${purchaseId}::uuid FOR UPDATE`;
        const locked = lockedRows[0];
        if (!locked) throw new Error("Alış tapılmadı");
        if (locked.status === "legv") throw new Error("Bu alış artıq ləğv edilib");
        if (locked.status === "tesdiq_gozleyir") {
          const { findPurchaseBlockers } = await import("@/lib/blockers/find-purchase-blockers");
          const blockers = await findPurchaseBlockers(purchaseId, tx);
          const err = new Error("__BLOCKED_TESDIQ__") as Error & {
            blockers?: import("@/lib/blockers/types").Blocker[];
          };
          err.blockers = blockers;
          throw err;
        }

        const purchase = await tx.alis_sifarisleri.findUnique({
          where: { id: purchaseId },
          include: { alis_sifaris_satirlari: true },
        });
        if (!purchase) throw new Error("Alış tapılmadı");

        const wasReceived = purchase.status === "qebul_edildi";
        const umumi = Number(purchase.umumi_mebleg ?? 0);

        // 1. Stoku geri al (yalnız qəbul edilmişdisə)
        if (wasReceived && purchase.anbar_id) {
          for (const line of purchase.alis_sifaris_satirlari) {
            if (!line.mehsul_id) continue;
            reversedMehsulIds.push(line.mehsul_id);
            // 🛡️ Race-safe + negative-stock guard — yalnız kifayət qədər stok varsa
            const miqdarToReverse = Number(line.miqdar);
            const updated = await tx.stok.updateMany({
              where: {
                sahibkar_id: sahibkarId,
                mehsul_id: line.mehsul_id,
                anbar_id: purchase.anbar_id,
                miqdar: { gte: miqdarToReverse },
              },
              data: { miqdar: { decrement: miqdarToReverse } },
            });
            if (updated.count === 0) {
              const { findSalesUsingProducts } = await import("@/lib/blockers/find-purchase-blockers");
              const blockers = await findSalesUsingProducts(
                [line.mehsul_id],
                purchase.anbar_id,
                tx,
              );
              const err = new Error("__BLOCKED_STOCK__") as Error & {
                blockers?: import("@/lib/blockers/types").Blocker[];
              };
              err.blockers = blockers;
              throw err;
            }
            await tx.anbar_hereketleri.create({
              data: {
                sahibkar_id: sahibkarId,
                anbar_id: purchase.anbar_id,
                mehsul_id: line.mehsul_id,
                nov: "mexaric",
                miqdar: Number(line.miqdar),
                qiymet: Number(line.vahid_qiymet),
                ref_nov: "alis_legv",
                ref_id: purchase.id,
                edilen_id: istifadeciId,
                qeyd: `Alış ləğv: ${reason}`,
              },
            });
          }
        }

        // 2. Bağlı maliye əməliyyatlarını ləğv et — qaliq source-of-truth-dan
        //    avtomatik düzələcək (manual reverse YOX).
        const finOps = await tx.finance_operations.findMany({
          where: {
            sahibkar_id: sahibkarId,
            alish_id: purchase.id,
            status: "aktiv",
          },
          select: { id: true, hesab_id: true },
        });
        const touchedHesabIds = new Set<string>();
        for (const op of finOps) {
          if (op.hesab_id) touchedHesabIds.add(op.hesab_id);
          await tx.finance_operations.update({
            where: { id: op.id },
            data: { status: "legv", qeyd: `Alış ləğv: ${reason}` },
          });
        }
        // Hər təsirlənmiş hesab üçün source-of-truth-dan recalc
        if (touchedHesabIds.size > 0) {
          const { recalculateAccountBalance } = await import("@/lib/balance/account-balance");
          for (const hid of touchedHesabIds) {
            await recalculateAccountBalance(hid, tx);
          }
        }

        // 3. Statusu legv et — sonra recalc balansı düzəldəcək
        // 4. Statusu legv et + STANDART soft-delete sahələri
        await tx.alis_sifarisleri.update({
          where: { id: purchase.id },
          data: {
            status: "legv",
            qeyd: `Ləğv səbəbi: ${reason}\n${purchase.qeyd ?? ""}`.trim(),
            deleted_at: new Date(),
            deleted_by: istifadeciId,
            delete_reason: reason,
          },
        });

        // Təchizatçı balansını source-of-truth-dan recalc
        // (status=legv + deleted_at olduğu üçün source-of-truth-da exclude olur)
        if (purchase.techiazatci_id) {
          const { recalculateSupplierBalance } = await import("@/lib/balance/supplier-balance");
          await recalculateSupplierBalance(purchase.techiazatci_id, tx);
        }
      });

      if (reversedMehsulIds.length > 0) {
        await checkAndCreateStockAlertBatch(reversedMehsulIds);
      }

      await audit("legv", "alis_sifarisi", purchaseId, {
        yeni_data: { sebeb: reason, reversed_lines: reversedMehsulIds.length },
        sebeb: reason,
      });

      revalidatePath("/ticaret/alislar");
      revalidatePath("/anbar");
      revalidatePath("/maliyye");
      revalidatePath("/xeberdarliqlar");
      bustTicaretCache();
      return { ok: true };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Xəta";
      console.error("[cancelPurchase]", e);

      // 🛑 Strukturlu BLOCKER cavabı
      if (e instanceof Error && (e.message === "__BLOCKED_TESDIQ__" || e.message === "__BLOCKED_STOCK__")) {
        const err = e as Error & { blockers?: import("@/lib/blockers/types").Blocker[] };
        const isTesdiq = e.message === "__BLOCKED_TESDIQ__";
        try {
          await audit("legv", "alis_sifarisi", purchaseId, {
            yeni_data: { sebeb: reason, blocked: true, kind: e.message },
          });
        } catch {/* non-fatal */}
        return {
          ok: false,
          error: isTesdiq
            ? "Bu alış təsdiq gözləyir — əvvəlcə təsdiq sorğusunu rədd edin."
            : "Bu alışın məhsulları artıq satılıb — stok kifayət etmir.",
          blockers: err.blockers ?? [],
          hint: isTesdiq
            ? "Təsdiq sorğusuna keçib rədd edin, sonra yenidən cəhd edin."
            : "Aşağıdakı satışları əvvəlcə ləğv edin və ya hissəvi ləğv tətbiq edin.",
        };
      }

      try {
        await audit("legv", "alis_sifarisi", purchaseId, {
          yeni_data: { sebeb: reason, error: msg },
        });
      } catch {/* non-fatal */}
      return { ok: false, error: msg };
    }
  });
}

/* ====================================================================== */
/* Task linking — used by /ticaret/alislar/[id] detail page               */
/* ====================================================================== */

/**
 * Create a follow-up task linked to a purchase (təchizatçı kontaktı,
 * gömrük sənədi, qaimə təsdiqi və s.) Link stored in `tapshiriq_obyektleri`
 * with obyekt_nov="alis_sifarisi".
 */
export async function createTaskForPurchase(
  purchaseId: string,
  basliq: string,
  deadline: string | null,
  prioritet: "asagi" | "normal" | "yuksek" | "tecili",
): Promise<{ ok: true; data: { id: string } } | { ok: false; error: string }> {
  const permCheck = await requireTicaretActionPerm(["tapshiriq.yarat", "alis.idare"]);
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  const title = basliq.trim();
  if (title.length < 3) return { ok: false, error: "Başlıq ən az 3 simvol olmalıdır" };
  if (!["asagi", "normal", "yuksek", "tecili"].includes(prioritet))
    return { ok: false, error: "Prioritet yanlışdır" };

  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    try {
      const purchase = await prisma.alis_sifarisleri.findUnique({
        where: { id: purchaseId },
        select: { nomre: true, sahibkar_id: true },
      });
      if (!purchase || purchase.sahibkar_id !== sahibkarId)
        return { ok: false, error: "Alış tapılmadı" };

      const task = await prisma.tapshiriqlar.create({
        data: {
          sahibkar_id: sahibkarId,
          basliq: title,
          tesvir: `Alışla bağlı: ${purchase.nomre}`,
          prioritet,
          status: "yeni",
          deadline: deadline ? new Date(deadline) : null,
          yaradan_id: istifadeciId,
          mesul_id: istifadeciId,
        },
        select: { id: true },
      });
      await prisma.tapshiriq_obyektleri.create({
        data: {
          sahibkar_id: sahibkarId,
          tapshiriq_id: task.id,
          obyekt_nov: "alis_sifarisi",
          obyekt_id: purchaseId,
          obyekt_basliq: purchase.nomre,
        },
      });
      revalidatePath(`/ticaret/alislar/${purchaseId}`);
      revalidatePath("/tapshiriqlar");
      return { ok: true, data: { id: task.id } };
    } catch (e) {
      console.error("[createTaskForPurchase]", e);
      return { ok: false, error: "Tapşırıq yaradılmadı" };
    }
  });
}

/**
 * Get tasks linked to a purchase order via tapshiriq_obyektleri.
 */
export async function getLinkedTasksForPurchase(purchaseId: string) {
  return withTenant(async () => {
    const links = await prisma.tapshiriq_obyektleri.findMany({
      where: { obyekt_nov: "alis_sifarisi", obyekt_id: purchaseId },
      orderBy: { yaradildi: "desc" },
      select: {
        tapshiriqlar: {
          select: {
            id: true,
            basliq: true,
            status: true,
            prioritet: true,
            deadline: true,
            yaradildi: true,
          },
        },
      },
    });
    return links
      .map((l) => l.tapshiriqlar)
      .filter((t): t is NonNullable<typeof t> => t !== null);
  });
}

/* ====================================================================== */
/* Task linking — used by /maliyye/emeliyyat drawer                       */
/* ====================================================================== */

/**
 * Create a follow-up task linked to a finance operation. Link stored in
 * `tapshiriq_obyektleri` with obyekt_nov="finance_operations".
 */
export async function createTaskForFinanceOp(
  opId: string,
  basliq: string,
  deadline: string | null,
  prioritet: "asagi" | "normal" | "yuksek" | "tecili",
): Promise<{ ok: true; data: { id: string } } | { ok: false; error: string }> {
  const permCheck = await requireTicaretActionPerm(["tapshiriq.yarat", "maliyye.idare"]);
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  const title = basliq.trim();
  if (title.length < 3) return { ok: false, error: "Başlıq ən az 3 simvol olmalıdır" };
  if (!["asagi", "normal", "yuksek", "tecili"].includes(prioritet))
    return { ok: false, error: "Prioritet yanlışdır" };

  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    try {
      const op = await prisma.finance_operations.findFirst({
        where: { id: opId, sahibkar_id: sahibkarId },
        select: { id: true, type_kod: true, sened_nomresi: true },
      });
      if (!op) return { ok: false, error: "Əməliyyat tapılmadı" };
      const label = op.sened_nomresi ?? op.type_kod ?? "Əməliyyat";

      const task = await prisma.tapshiriqlar.create({
        data: {
          sahibkar_id: sahibkarId,
          basliq: title,
          tesvir: `Maliyyə əməliyyatı ilə bağlı: ${label}`,
          prioritet,
          status: "yeni",
          deadline: deadline ? new Date(deadline) : null,
          yaradan_id: istifadeciId,
          mesul_id: istifadeciId,
        },
        select: { id: true },
      });
      await prisma.tapshiriq_obyektleri.create({
        data: {
          sahibkar_id: sahibkarId,
          tapshiriq_id: task.id,
          obyekt_nov: "finance_operations",
          obyekt_id: opId,
          obyekt_basliq: label,
        },
      });
      revalidatePath("/maliyye/emeliyyat");
      revalidatePath("/tapshiriqlar");
      return { ok: true, data: { id: task.id } };
    } catch (e) {
      console.error("[createTaskForFinanceOp]", e);
      return { ok: false, error: "Tapşırıq yaradılmadı" };
    }
  });
}

/**
 * Get tasks linked to a finance operation via tapshiriq_obyektleri.
 */
export async function getLinkedTasksForFinanceOp(opId: string) {
  return withTenant(async () => {
    const links = await prisma.tapshiriq_obyektleri.findMany({
      where: { obyekt_nov: "finance_operations", obyekt_id: opId },
      orderBy: { yaradildi: "desc" },
      select: {
        tapshiriqlar: {
          select: {
            id: true,
            basliq: true,
            status: true,
            prioritet: true,
            deadline: true,
            yaradildi: true,
          },
        },
      },
    });
    return links
      .map((l) => l.tapshiriqlar)
      .filter((t): t is NonNullable<typeof t> => t !== null);
  });
}
