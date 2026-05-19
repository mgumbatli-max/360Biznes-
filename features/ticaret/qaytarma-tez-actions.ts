"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { findSaleByCode, type SaleByCodeResult } from "./sale-lookup";

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

        // Increment stock for that anbar (medaxil)
        await tx.stok.updateMany({
          where: { sahibkar_id: sahibkarId, mehsul_id: input.mehsul_id, anbar_id: anbarId },
          data: { miqdar: { increment: input.miqdar } },
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

        return { id: ret.id, nomre: ret.nomre };
      });

      revalidatePath("/ticaret/qaytarma");
      revalidatePath("/ticaret/qaytarma/tez");
      revalidatePath("/ticaret");
      return { ok: true, id: result.id, nomre: result.nomre };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Xəta baş verdi" };
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

        for (const l of lines) {
          if (!l.mehsul_id) continue;
          const miqdar = Number(l.miqdar ?? 0);
          const qiymet = Number(l.vahid_qiymet ?? 0);
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
              anbar_id: sale.anbar_id,
            },
            data: { miqdar: { increment: miqdar } },
          });
          await tx.anbar_hereketleri.create({
            data: {
              sahibkar_id: sahibkarId,
              anbar_id: sale.anbar_id,
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
        let reversedFinance = false;
        const komisyon = Number(sale.komisyon_meblegh ?? 0);
        if (fullReturn && sale.marketplace_platform && komisyon > 0) {
          try {
            const origOp = await tx.finance_operations.findFirst({
              where: {
                sahibkar_id: sahibkarId,
                satis_id: sale.id,
                type_kod: "marketplace_payout",
              },
              orderBy: { tarix: "desc" },
            });
            if (origOp) {
              const netReverse = Number(origOp.azn_meblegh ?? origOp.meblegh ?? 0);
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
                  komissiya: -Math.abs(komisyon),
                  hesab_id: origOp.hesab_id,
                  satis_id: sale.id,
                  sened_nomresi: `${origOp.sened_nomresi ?? sale.nomre}-RET`,
                  qarsi_teref_ad: origOp.qarsi_teref_ad,
                  qeyd: `Qaytarma əksinə əməliyyat — ${ret.nomre}`,
                  yaradan_id: istifadeciId,
                },
              });
              reversedFinance = true;
            }
          } catch (err) {
            console.error("[returnFullSale] finance reverse skipped:", err);
          }
        }

        if (fullReturn) {
          await tx.satis_sifarisleri.update({
            where: { id: sale.id },
            data: { status: "qaytarilib" },
          });
        }

        return { id: ret.id, nomre: ret.nomre, reversedFinance };
      });

      revalidatePath("/ticaret/qaytarma");
      revalidatePath("/ticaret/qaytarma/tez");
      revalidatePath("/ticaret/satislar");
      revalidatePath("/ticaret");
      return {
        ok: true,
        id: result.id,
        nomre: result.nomre,
        reversed_finance: result.reversedFinance,
      };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Xəta baş verdi" };
    }
  });
}

