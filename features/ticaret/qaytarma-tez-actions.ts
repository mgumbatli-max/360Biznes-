"use server";

import { revalidatePath } from "next/cache";
import { Prisma, prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { findSaleByCode, type SaleByCodeResult } from "./sale-lookup";
import { requireTicaretActionPerm, bustTicaretCache } from "./access-guard";
import { audit } from "@/lib/audit/log";
import { stockIncrement } from "@/lib/db/stock-guards";

export type ScanLookupResult =
  | {
      ok: true;
      mehsul: { id: string; ad: string; kod: string | null; barkod: string | null; satis_qiymeti: number };
      recent_sale: {
        id: string;
        nomre: string;
        tarix: Date;
        musteri_ad: string | null;
        anbar_id: number | null;
        anbar_ad: string | null;
        vahid_qiymet: number;
        miqdar_qaliq: number;
      } | null;
    }
  | { ok: false; error: string };

/**
 * Look up a product by its barcode (or kod) and find the most recent sale
 * that includes it. Used by the quick return scan page.
 */
export async function scanLookup(query: string): Promise<ScanLookupResult> {
  const q = query.trim();
  if (!q) return { ok: false, error: "Skan/kod boşdur" };

  return withTenant(async () => {
    try {
      const mehsul = await prisma.mehsullar.findFirst({
        where: {
          OR: [{ barkod: q }, { kod: q }, { ad: { contains: q, mode: "insensitive" } }],
          aktiv: { not: false },
        },
        select: { id: true, ad: true, kod: true, barkod: true, satis_qiymeti: true },
      });
      if (!mehsul) return { ok: false, error: "Bu barkod/koda uyğun məhsul tapılmadı" };

      const recent = await prisma.satis_sifaris_satirlari.findFirst({
        where: {
          mehsul_id: mehsul.id,
          satis_sifarisleri: {
            qaralama: { not: true },
            status: { not: "legv" },
          },
        },
        orderBy: { satis_sifarisleri: { tarix: "desc" } },
        include: {
          satis_sifarisleri: {
            include: {
              kontragentler: { select: { ad: true } },
              anbarlar: { select: { ad: true } },
            },
          },
        },
      });

      return {
        ok: true,
        mehsul: {
          id: mehsul.id,
          ad: mehsul.ad,
          kod: mehsul.kod,
          barkod: mehsul.barkod,
          satis_qiymeti: Number(mehsul.satis_qiymeti ?? 0),
        },
        recent_sale: recent
          ? {
              id: recent.satis_sifarisleri!.id,
              nomre: recent.satis_sifarisleri!.nomre,
              tarix: recent.satis_sifarisleri!.tarix,
              musteri_ad: recent.satis_sifarisleri!.kontragentler?.ad ?? null,
              anbar_id: recent.satis_sifarisleri!.anbar_id,
              anbar_ad: recent.satis_sifarisleri!.anbarlar?.ad ?? null,
              vahid_qiymet: Number(recent.vahid_qiymet),
              miqdar_qaliq: Number(recent.miqdar),
            }
          : null,
      };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Xəta baş verdi" };
    }
  });
}

type FastReturnInput = {
  mehsul_id: string;
  miqdar: number;
  vahid_qiymet: number;
  anbar_id?: number | null;
  original_sale_id?: string | null;
  musteri_id?: string | null;
  sebeb: string;
  qeyd?: string;
};

type ActionResult = { ok: true; id: string; nomre: string } | { ok: false; error: string };

/**
 * Create a quick (one-line) customer return for a scanned product.
 * Increments stock for the chosen warehouse, writes anbar_hereketleri.
 */
export async function fastReturn(input: FastReturnInput): Promise<ActionResult> {
  const permCheck = await requireTicaretActionPerm("qaytarma.yarat");
  if (!permCheck.ok) return { ok: false, error: permCheck.error };

  if (!input.mehsul_id) return { ok: false, error: "Məhsul seçilməyib" };
  if (!Number.isFinite(input.miqdar) || input.miqdar <= 0) return { ok: false, error: "Miqdar düzgün deyil" };
  if (!input.sebeb?.trim()) return { ok: false, error: "Səbəb göstərilməlidir" };

  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    try {
      const result = await prisma.$transaction(async (tx) => {
        // Resolve anbar
        let anbarId = input.anbar_id ?? null;
        if (!anbarId) {
          if (input.original_sale_id) {
            const orig = await tx.satis_sifarisleri.findUnique({
              where: { id: input.original_sale_id },
              select: { anbar_id: true },
            });
            anbarId = orig?.anbar_id ?? null;
          }
        }
        if (!anbarId) {
          const first = await tx.anbarlar.findFirst({
            where: { sahibkar_id: sahibkarId },
            select: { id: true },
            orderBy: { id: "asc" },
          });
          anbarId = first?.id ?? null;
        }
        if (!anbarId) throw new Error("Anbar tapılmadı (heç bir anbar yoxdur)");

        // Generate return number
        const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
        const suffix = Math.random().toString(16).slice(2, 6).toUpperCase();
        const nomre = `QT-${dateStr}-${suffix}`;

        const total = input.miqdar * input.vahid_qiymet;

        const ret = await tx.qaytarma_sifarisleri.create({
          data: {
            sahibkar_id: sahibkarId,
            nomre,
            nov: "musteri",
            anbar_id: anbarId,
            tarix: new Date(),
            status: "tamamlandi",
            umumi_mebleg: total,
            geri_qaytarildi: total,
            sebeb: input.sebeb,
            qeyd: input.qeyd ?? null,
            yaradan_id: istifadeciId,
            kontragent_id: input.musteri_id ?? null,
            original_id: input.original_sale_id ?? null,
          },
        });

        await tx.qaytarma_satirlari.create({
          data: {
            sahibkar_id: sahibkarId,
            qaytarma_id: ret.id,
            mehsul_id: input.mehsul_id,
            miqdar: input.miqdar,
            vahid_qiymet: input.vahid_qiymet,
          },
        });

        // Increment stock — upsert pattern via stockIncrement
        // (updateMany silent skip-i qarşısı alır)
        await stockIncrement(tx, {
          sahibkarId,
          mehsulId: input.mehsul_id,
          anbarId,
          miqdar: input.miqdar,
          sonQiymet: input.vahid_qiymet,
        });

        await tx.anbar_hereketleri.create({
          data: {
            sahibkar_id: sahibkarId,
            anbar_id: anbarId,
            mehsul_id: input.mehsul_id,
            nov: "medaxil",
            miqdar: input.miqdar,
            qiymet: input.vahid_qiymet,
            ref_nov: "qaytarma_tez",
            ref_id: ret.id,
            edilen_id: istifadeciId,
            qeyd: `Tez qaytarma: ${input.sebeb}`,
          },
        });

        // 💰 ORIJİNAL SATIŞA TƏSİR — qaytarma satışın açıq borcunu azaltmalıdır.
        // Nisyə satış olarsa: satış.odenilmis artırılır → satışın qalığı azalır →
        // müştəri balansı source-of-truth ilə avtomatik düzəlir.
        // Nəğd satış olarsa: kassadan refund + müştəriyə avans və ya pul qaytarmaq.
        if (input.original_sale_id) {
          const origSale = await tx.satis_sifarisleri.findUnique({
            where: { id: input.original_sale_id },
            select: {
              id: true,
              son_mebleg: true,
              odenilmis: true,
              musteri_id: true,
              odenis_nov: true,
              status: true,
              kassa_id: true,
            },
          });
          if (origSale) {
            const son = Number(origSale.son_mebleg ?? 0);
            const odenilmis = Number(origSale.odenilmis ?? 0);
            const qalig = son - odenilmis;
            const isNisye = origSale.odenis_nov === "nisye" || origSale.odenis_nov === "borc";

            if (isNisye && qalig > 0) {
              // Nisyə: qaytarma açıq borcu azaldır (odenilmis tipində virtual payment)
              const apply = Math.min(total, qalig);
              await tx.satis_sifarisleri.update({
                where: { id: origSale.id },
                data: {
                  odenilmis: { increment: apply },
                  ...(odenilmis + apply >= son - 0.001 ? { status: "tamamlandi" } : {}),
                  yenilendi: new Date(),
                },
              });
            } else if (!isNisye && origSale.kassa_id) {
              // Nəğd/kart: kassaya mənfi əməliyyat (refund)
              await tx.kassa_emeliyyatlari.create({
                data: {
                  sahibkar_id: sahibkarId,
                  kassa_id: origSale.kassa_id,
                  emeliyyat_nov: "qaytarma",
                  odenis_nov: origSale.odenis_nov ?? "negd",
                  mebleg: new Prisma.Decimal(-total),
                  ref_nov: "qaytarma_tez",
                  ref_id: ret.id,
                  istifadeci_id: istifadeciId,
                  qeyd: `Tez qaytarma refund: ${input.sebeb}`,
                },
              });
            }

            // Müştəri balansını source-of-truth-dan recalc
            if (origSale.musteri_id) {
              const { recalculateCustomerBalance } = await import("@/lib/balance/customer-balance");
              await recalculateCustomerBalance(origSale.musteri_id, tx);
            }
          }
        } else if (input.musteri_id) {
          // Original satış bağlanmayıbsa, sadəcə müştəri balansını yenidən hesabla
          const { recalculateCustomerBalance } = await import("@/lib/balance/customer-balance");
          await recalculateCustomerBalance(input.musteri_id, tx);
        }

        return { id: ret.id, nomre: ret.nomre };
      });

      revalidatePath("/ticaret/qaytarma");
      revalidatePath("/ticaret/qaytarma/tez");
      revalidatePath("/ticaret");
      bustTicaretCache();

      // Sürətli qaytarma — stok artar, kanal-larına sync
      try {
        const { emitStockChange } = await import("@/lib/stock-change-emitter");
        emitStockChange([input.mehsul_id]);
      } catch (e) {
        console.error("[fastReturn.emitStockChange]", e);
      }

      await audit("yarat", "qaytarma_sifarisi", result.id, {
        yeni_data: {
          nomre: result.nomre,
          nov: "musteri",
          mehsul_id: input.mehsul_id,
          miqdar: input.miqdar,
          vahid_qiymet: input.vahid_qiymet,
          musteri_id: input.musteri_id ?? null,
          original_sale_id: input.original_sale_id ?? null,
        },
        sebeb: `Tez qaytarma: ${input.sebeb}`,
      });

      return { ok: true, id: result.id, nomre: result.nomre };
    } catch (e) {
      const { logAndFriendly } = await import("@/lib/error/user-message");
      return { ok: false, error: logAndFriendly("fastReturn", e, "Qaytarma yaradılmadı") };
    }
  });
}

/**
 * Look up a sale by external order code (marketplace sifariş kodu,
 * qaimə nömrəsi, internal nomre, or legacy sifaris_no tag).
 *
 * Thin server-action wrapper around `findSaleByCode` so the qaytarma-tez
 * client can call it without importing the lookup module directly.
 */
export async function findSaleByCodeAction(
  code: string,
): Promise<SaleByCodeResult | null> {
  return findSaleByCode(code);
}

type ReturnFullSaleInput = {
  satis_id: string;
  sebeb: string;
  qeyd?: string;
  /** When omitted (or empty), all lines of the sale are returned. */
  satir_ids?: string[];
};

type ReturnFullSaleResult =
  | { ok: true; id: string; nomre: string; reversed_finance: boolean }
  | { ok: false; error: string };

/**
 * Bulk return for a previously-completed sale.
 *
 * - Creates a `qaytarma_sifarisleri` header linked back via `original_id`.
 * - Writes a `qaytarma_satirlari` row per chosen line (or all lines when
 *   `satir_ids` is empty / undefined → "Tam qaytar").
 * - Restocks each line into the original anbar.
 * - Writes `anbar_hereketleri` medaxil rows for each line.
 * - If the source sale was a marketplace sale with a `komisyon_meblegh`,
 *   it also writes a reversing `finance_operations` row (negative AZN)
 *   so the original payout is unwound.
 * - Updates the source sale status to "qaytarilib" when fully returned.
 */
export async function returnFullSale(
  input: ReturnFullSaleInput,
): Promise<ReturnFullSaleResult> {
  const permCheck = await requireTicaretActionPerm("qaytarma.yarat");
  if (!permCheck.ok) return { ok: false, error: permCheck.error };

  if (!input.satis_id) return { ok: false, error: "Satış ID göstərilməyib" };
  if (!input.sebeb?.trim()) return { ok: false, error: "Səbəb göstərilməlidir" };

  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    try {
      const result = await prisma.$transaction(async (tx) => {
        const sale = await tx.satis_sifarisleri.findFirst({
          where: { id: input.satis_id, sahibkar_id: sahibkarId },
          include: {
            satis_sifaris_satirlari: true,
          },
        });
        if (!sale) throw new Error("Satış tapılmadı");
        if (sale.status === "qaytarilib") {
          throw new Error("Bu satış artıq qaytarılıb");
        }
        if (sale.status === "legv") {
          throw new Error("Ləğv edilmiş satışı qaytarmaq olmaz");
        }
        if (!sale.anbar_id) throw new Error("Satışda anbar göstərilməyib");

        const wantedIds = (input.satir_ids ?? []).filter(Boolean).map(String);
        const lines =
          wantedIds.length > 0
            ? sale.satis_sifaris_satirlari.filter((l) =>
                wantedIds.includes(String(l.id)),
              )
            : sale.satis_sifaris_satirlari;
        if (lines.length === 0) throw new Error("Qaytarılacaq sətir tapılmadı");
        const fullReturn = lines.length === sale.satis_sifaris_satirlari.length;

        const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
        const suffix = Math.random().toString(16).slice(2, 6).toUpperCase();
        const nomre = `QF-${dateStr}-${suffix}`;

        let total = 0;
        for (const l of lines) {
          const miqdar = Number(l.miqdar ?? 0);
          const qiymet = Number(l.vahid_qiymet ?? 0);
          const endirim = Number(l.endirim_faiz ?? 0);
          total += miqdar * qiymet * (1 - endirim / 100);
        }

        const qeydParts: string[] = [];
        qeydParts.push(
          fullReturn
            ? `[FULL-RETURN] satis=${sale.nomre}`
            : `[PART-RETURN] satis=${sale.nomre}`,
        );
        if (input.qeyd) qeydParts.push(input.qeyd);

        const ret = await tx.qaytarma_sifarisleri.create({
          data: {
            sahibkar_id: sahibkarId,
            nomre,
            nov: "musteri",
            anbar_id: sale.anbar_id,
            tarix: new Date(),
            status: "tamamlandi",
            umumi_mebleg: total,
            geri_qaytarildi: total,
            sebeb: input.sebeb,
            qeyd: qeydParts.join("\n"),
            yaradan_id: istifadeciId,
            kontragent_id: sale.musteri_id,
            original_id: sale.id,
          },
        });

        // QA-K17: çox-anbarlı satışda hər məhsul ÖZ anbarına qayıtsın —
        // orijinal mexaric hərəkətlərindən mehsul→anbar xəritəsi qurulur
        // (əvvəl hamısı sale.anbar_id-ə yazılırdı).
        const origMoves = await tx.anbar_hereketleri.findMany({
          where: {
            sahibkar_id: sahibkarId,
            ref_nov: "satis_sifarisi",
            ref_id: sale.id,
            nov: "mexaric",
          },
          select: { mehsul_id: true, anbar_id: true },
        });
        const anbarByMehsul = new Map<string, number>();
        for (const mv of origMoves) {
          if (mv.mehsul_id && mv.anbar_id && !anbarByMehsul.has(mv.mehsul_id)) {
            anbarByMehsul.set(mv.mehsul_id, mv.anbar_id);
          }
        }

        for (const l of lines) {
          if (!l.mehsul_id) continue;
          const miqdar = Number(l.miqdar ?? 0);
          const qiymet = Number(l.vahid_qiymet ?? 0);
          const targetAnbar = anbarByMehsul.get(l.mehsul_id) ?? sale.anbar_id;
          await tx.qaytarma_satirlari.create({
            data: {
              sahibkar_id: sahibkarId,
              qaytarma_id: ret.id,
              mehsul_id: l.mehsul_id,
              miqdar,
              vahid_qiymet: qiymet,
            },
          });
          await tx.stok.updateMany({
            where: {
              sahibkar_id: sahibkarId,
              mehsul_id: l.mehsul_id,
              anbar_id: targetAnbar,
            },
            data: { miqdar: { increment: miqdar } },
          });
          await tx.anbar_hereketleri.create({
            data: {
              sahibkar_id: sahibkarId,
              anbar_id: targetAnbar,
              mehsul_id: l.mehsul_id,
              nov: "medaxil",
              miqdar,
              qiymet,
              ref_nov: "qaytarma",
              ref_id: ret.id,
              edilen_id: istifadeciId,
              qeyd: `Qaytarma: ${input.sebeb} (satis #${sale.nomre})`,
            },
          });
        }

        // Reverse marketplace payout (negative finance_operations row).
        // Hissəvi qaytarmada da proporsional əks əməliyyat yaradılır —
        // əvvəlcə yalnız tam qaytarmada işləyirdi, gross/net drift qalırdı.
        let reversedFinance = false;
        const komisyon = Number(sale.komisyon_meblegh ?? 0);
        if (sale.marketplace_platform && komisyon > 0) {
          try {
            const saleTotal = Number(sale.son_mebleg ?? 0);
            const ratio = fullReturn || saleTotal <= 0 ? 1 : Math.min(1, total / saleTotal);
            const origOp = await tx.finance_operations.findFirst({
              where: {
                sahibkar_id: sahibkarId,
                satis_id: sale.id,
                type_kod: "marketplace_payout",
              },
              orderBy: { tarix: "desc" },
            });
            if (origOp) {
              const netOrig = Number(origOp.azn_meblegh ?? origOp.meblegh ?? 0);
              const netReverse = +(netOrig * ratio).toFixed(2);
              const komisyonReverse = +(komisyon * ratio).toFixed(2);
              await tx.finance_operations.create({
                data: {
                  sahibkar_id: sahibkarId,
                  type_id: origOp.type_id,
                  type_kod: origOp.type_kod,
                  y_n: "xaric",
                  tarix: new Date(),
                  meblegh: -Math.abs(netReverse),
                  valyuta: origOp.valyuta,
                  mezenne: origOp.mezenne,
                  azn_meblegh: -Math.abs(netReverse),
                  komissiya: -Math.abs(komisyonReverse),
                  hesab_id: origOp.hesab_id,
                  satis_id: sale.id,
                  sened_nomresi: `${origOp.sened_nomresi ?? sale.nomre}-RET`,
                  qarsi_teref_ad: origOp.qarsi_teref_ad,
                  qeyd: fullReturn
                    ? `Qaytarma əksinə əməliyyat — ${ret.nomre}`
                    : `Hissəvi qaytarma əksinə (${(ratio * 100).toFixed(1)}%) — ${ret.nomre}`,
                  yaradan_id: istifadeciId,
                },
              });
              reversedFinance = true;
            } else {
              // QA-orta: payout hələ GÖZLƏYİRSƏ (marketplace_payout op-u yoxdur) pending
              // qeyd korreksiya olunur — əvvəl gozlenen_meblegh/komissiya dəyişmirdi və
              // markPayoutReceived qaytarılmış satışı nəzərə almadan tam kreditləyirdi.
              const pending = await tx.finance_marketplace_payments.findFirst({
                where: {
                  sahibkar_id: sahibkarId,
                  status: "gozleyir",
                  qeyd: { contains: `Satış #${sale.id}` },
                },
                select: { id: true },
              });
              if (pending) {
                // Orijinal satış net-indən hesabla — ardıcıl hissəvi qaytarmalarda düzgün qalır
                const saleNet = Math.max(0, saleTotal - komisyon);
                const netReverse = +(saleNet * ratio).toFixed(2);
                const komisyonReverse = +(komisyon * ratio).toFixed(2);
                await tx.finance_marketplace_payments.update({
                  where: { id: pending.id },
                  data: {
                    gozlenen_meblegh: { decrement: netReverse },
                    komissiya: { decrement: komisyonReverse },
                    qaytarma_meblegh: { increment: total },
                  },
                });
                reversedFinance = true;
              }
            }
          } catch (err) {
            console.error("[returnFullSale] finance reverse skipped:", err);
          }
        }

        // QA-K11: adi NƏĞD/KART satışın qaytarılmasında kassadan pul çıxışı —
        // fastReturn-da var idi, burada YOX idi (iki qaytarma yolu uyğunsuz).
        // Marketplace satışda kassaya pul düşməyib (payout axını), ona toxunmuruq.
        {
          const isNisyeSale = sale.odenis_nov === "nisye" || sale.odenis_nov === "borc";
          if (!isNisyeSale && !sale.marketplace_platform && sale.kassa_id) {
            // Yalnız real daxil olmuş pul qədər geri çıx (hissəvi ödəniş müdafiəsi)
            const odenilmisSale = Number(sale.odenilmis ?? 0);
            const refund = Math.min(total, odenilmisSale > 0 ? odenilmisSale : total);
            if (refund > 0.001) {
              await tx.kassa_emeliyyatlari.create({
                data: {
                  sahibkar_id: sahibkarId,
                  kassa_id: sale.kassa_id,
                  emeliyyat_nov: "qaytarma",
                  odenis_nov: sale.odenis_nov ?? "negd",
                  mebleg: new Prisma.Decimal(-refund),
                  ref_nov: "qaytarma",
                  ref_id: ret.id,
                  istifadeci_id: istifadeciId,
                  qeyd: `Qaytarma refund: ${input.sebeb} (satis #${sale.nomre})`,
                },
              });
            }
          }
        }

        if (fullReturn) {
          await tx.satis_sifarisleri.update({
            where: { id: sale.id },
            data: { status: "qaytarilib" },
          });
        } else {
          // Hissəvi qaytarma — nisyə satış olubsa odenilmis-ə virtual payment əlavə et
          const isNisye = sale.odenis_nov === "nisye" || sale.odenis_nov === "borc";
          if (isNisye) {
            const sonMebleg = Number(sale.son_mebleg ?? 0);
            const odenilmis = Number(sale.odenilmis ?? 0);
            const qalig = sonMebleg - odenilmis;
            const apply = Math.min(total, qalig);
            if (apply > 0) {
              await tx.satis_sifarisleri.update({
                where: { id: sale.id },
                data: {
                  odenilmis: { increment: apply },
                  ...(odenilmis + apply >= sonMebleg - 0.001 ? { status: "tamamlandi" } : {}),
                  yenilendi: new Date(),
                },
              });
            }
          }
        }

        // Müştəri balansı source-of-truth recalc
        if (sale.musteri_id) {
          const { recalculateCustomerBalance } = await import("@/lib/balance/customer-balance");
          await recalculateCustomerBalance(sale.musteri_id, tx);
        }

        return { id: ret.id, nomre: ret.nomre, reversedFinance };
      });

      revalidatePath("/ticaret/qaytarma");
      revalidatePath("/ticaret/qaytarma/tez");
      revalidatePath("/ticaret/satislar");
      revalidatePath("/ticaret");
      bustTicaretCache();
      await audit("yarat", "qaytarma_sifarisi", result.id, {
        yeni_data: {
          nomre: result.nomre,
          satis_id: input.satis_id,
          reversed_finance: result.reversedFinance,
          satir_count: input.satir_ids?.length ?? 0,
        },
        sebeb: input.satir_ids?.length
          ? `Hissəvi qaytarma: ${input.sebeb}`
          : `Tam qaytarma: ${input.sebeb}`,
      });
      return {
        ok: true,
        id: result.id,
        nomre: result.nomre,
        reversed_finance: result.reversedFinance,
      };
    } catch (e) {
      const { logAndFriendly } = await import("@/lib/error/user-message");
      return { ok: false, error: logAndFriendly("returnFullSale", e, "Qaytarma yaradılmadı") };
    }
  });
}

