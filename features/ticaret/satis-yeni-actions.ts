"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma, prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { suggestDiscountForCustomer } from "./satis-yeni-queries";
import { checkDiscountLimit, requestDiscountApproval } from "./discount-approval";
import { checkAndCreateStockAlertBatch } from "@/features/anbar/alert-helpers";
import { parseLocalDate } from "@/lib/utils";
import { createApprovalRequest, shouldRequireDocApproval } from "@/features/tesdiq/create";
import { safeStockDecrement } from "@/lib/db/stock-guards";
import { nextDocNumber } from "@/lib/db/sened-nomre";
import { safeAuditLog } from "@/lib/audit/safe-log";

/**
 * Sale-date helper: if user typed only YYYY-MM-DD use parseLocalDate (local noon)
 * to avoid timezone off-by-one. If the value also includes a time component,
 * parse natively.
 */
function parseSaleDate(s: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return parseLocalDate(s) ?? new Date();
  return new Date(s);
}

const SABLON_QRUP = "satis_sablon";

const LineSchema = z.object({
  mehsul_id: z.string().uuid(),
  anbar_id: z.coerce.number().int().positive(),
  miqdar: z.coerce.number().positive(),
  qiymet: z.coerce.number().min(0),
  endirim_faiz: z.coerce.number().min(0).max(100).default(0),
});

const HeaderSchema = z.object({
  musteri_id: z.string().uuid().nullish(),
  tarix: z.string().min(1),
  /** AZN totals — multi-currency converted client-side before submit */
  endirim_mebleg: z.coerce.number().min(0).default(0),
  catdirma_xerc: z.coerce.number().min(0).default(0),
  vat_faiz: z.coerce.number().min(0).max(50).default(0),
  daxili_qeyd: z.string().max(2000).nullish(),
  musteri_qeyd: z.string().max(2000).nullish(),
  qaralama: z.coerce.boolean().default(false),
  reserve_stock: z.coerce.boolean().default(false),
  satis_meneceri_id: z.string().uuid().nullish(),
  /** odeniş cədvəli: list of {tarix, mebleg} */
  odenis_cedveli: z
    .array(z.object({ tarix: z.string(), mebleg: z.coerce.number().min(0) }))
    .nullish(),
  /** valyuta info — informational only (stored in qeyd) */
  valyuta: z.string().max(4).nullish(),
  valyuta_kurs: z.coerce.number().min(0).nullish(),
  /** existing draft id (when re-saving) */
  qaralama_id: z.string().uuid().nullish(),
  /**
   * Ödəniş üsulu — finalize zamanı: nağd / kart / köçürmə kassaya
   * yazılır (mədaxil), nisye/borc isə kontragent borcunu artırır.
   */
  odenis_nov: z.enum(["negd", "kart", "kecirme", "nisye"]).default("negd"),
  /** seçilmiş kassa/maliyye hesabı — finalize üçün */
  kassa_id: z.string().uuid().nullish(),
});

const CreateSchema = HeaderSchema.extend({
  lines: z.array(LineSchema).min(1, "Ən az 1 məhsul olmalıdır"),
});

export type CreateSatisInput = z.input<typeof CreateSchema>;
export type CreateSatisResult =
  | { ok: true; satis_id: string; nomre: string; qaralama: boolean; pending_approval?: boolean }
  | { ok: false; error: string };

const PREFIX = "SAT";

/**
 * Function 1 — Sale draft (Qaralama).
 * Function 2 — Multi-warehouse split: each line has its own anbar_id.
 * Function 3 — Currency conversion: client converts to AZN before submit; we record meta in qeyd JSON.
 * Function 4 — Çatdırılma xərci: added on top of totals.
 * Function 5 — Notlar: internal + customer-visible (joined into qeyd).
 * Function 7 — Ödəniş cədvəli: snapshot of plan stored in qeyd JSON.
 * Function 9 — Stok rezerv: when qaralama=true & reserve_stock, create stok_bron 48h.
 */
export async function createOrUpdateSatisYeni(
  input: CreateSatisInput,
): Promise<CreateSatisResult> {
  const parsed = CreateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Forma yanlışdır" };
  }
  const data = parsed.data;

  // 4-eyes təsdiqi: yalnız aktiv satış (qaralama yox) üçün
  const needsApproval = !data.qaralama && (await shouldRequireDocApproval("satis_qaime"));

  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    try {
      const result = await prisma.$transaction(async (tx) => {
        // Compute totals
        let umumi = 0;
        for (const line of data.lines) {
          umumi += line.miqdar * line.qiymet * (1 - line.endirim_faiz / 100);
        }
        const afterDiscount = Math.max(0, umumi - data.endirim_mebleg);
        const vat = afterDiscount * (data.vat_faiz / 100);
        const sonMebleg = afterDiscount + vat + data.catdirma_xerc;
        const initialStatus = data.qaralama ? "qaralama" : needsApproval ? "tesdiq_gozleyir" : "yeni";

        // Embed meta in qeyd as a JSON block + plain notes
        const meta = {
          valyuta: data.valyuta ?? null,
          valyuta_kurs: data.valyuta_kurs ?? null,
          catdirma_xerc: data.catdirma_xerc,
          vat_faiz: data.vat_faiz,
          odenis_cedveli: data.odenis_cedveli ?? null,
        };
        const qeydParts: string[] = [];
        if (data.daxili_qeyd) qeydParts.push(`[Daxili] ${data.daxili_qeyd}`);
        if (data.musteri_qeyd) qeydParts.push(`[Müştəri] ${data.musteri_qeyd}`);
        qeydParts.push(`[META] ${JSON.stringify(meta)}`);
        const qeyd = qeydParts.join("\n");

        let saleId: string;
        let nomre: string;

        if (data.qaralama_id) {
          // Update existing draft
          const existing = await tx.satis_sifarisleri.findUnique({
            where: { id: data.qaralama_id },
          });
          if (!existing) throw new Error("Qaralama tapılmadı");
          if (existing.sahibkar_id !== sahibkarId) throw new Error("İcazə yoxdur");
          // Wipe old lines and bron
          await tx.satis_sifaris_satirlari.deleteMany({ where: { sifaris_id: existing.id } });
          await tx.stok_bron.deleteMany({
            where: { satis_id: existing.id, status: "aktiv" },
          });
          await tx.satis_sifarisleri.update({
            where: { id: existing.id },
            data: {
              musteri_id: data.musteri_id ?? null,
              tarix: parseSaleDate(data.tarix),
              umumi_mebleg: umumi,
              endirim_mebleg: data.endirim_mebleg,
              son_mebleg: sonMebleg,
              qaralama: data.qaralama,
              status: initialStatus,
              odenilmis: data.qaralama ? 0 : 0,
              qeyd,
              satis_meneceri_id: data.satis_meneceri_id ?? istifadeciId,
              yenilendi: new Date(),
            },
          });
          saleId = existing.id;
          nomre = existing.nomre;
        } else {
          // Create new
          const year = new Date().getFullYear();
          nomre = await nextDocNumber(tx, sahibkarId, "satis");

          // Use first line's anbar as the "primary" anbar on the sale header
          const primaryAnbar = data.lines[0].anbar_id;

          const sale = await tx.satis_sifarisleri.create({
            data: {
              sahibkar_id: sahibkarId,
              nomre,
              musteri_id: data.musteri_id ?? null,
              anbar_id: primaryAnbar,
              tarix: parseSaleDate(data.tarix),
              status: initialStatus,
              odenis_nov: "negd",
              umumi_mebleg: umumi,
              endirim_mebleg: data.endirim_mebleg,
              son_mebleg: sonMebleg,
              odenilmis: 0,
              qeyd,
              yaradan_id: istifadeciId,
              satis_meneceri_id: data.satis_meneceri_id ?? istifadeciId,
              qaralama: data.qaralama,
            },
          });
          saleId = sale.id;
        }

        // Insert lines (multi-warehouse-aware)
        for (const line of data.lines) {
          await tx.satis_sifaris_satirlari.create({
            data: {
              sahibkar_id: sahibkarId,
              sifaris_id: saleId,
              mehsul_id: line.mehsul_id,
              miqdar: line.miqdar,
              vahid_qiymet: line.qiymet,
              endirim_faiz: line.endirim_faiz,
            },
          });

          // Stock reservation (function 9) — only for drafts where reservation requested
          if (data.qaralama && data.reserve_stock) {
            const bitme = new Date(Date.now() + 48 * 60 * 60 * 1000);
            await tx.stok_bron.create({
              data: {
                sahibkar_id: sahibkarId,
                mehsul_id: line.mehsul_id,
                anbar_id: line.anbar_id,
                musteri_id: data.musteri_id ?? null,
                sayi: new Prisma.Decimal(line.miqdar),
                bitme_tarixi: bitme,
                qiymet: new Prisma.Decimal(line.qiymet),
                satis_id: saleId,
                status: "aktiv",
                qeyd: `Qaralama #${nomre} üçün 48 saatlıq rezerv`,
                yaradan_id: istifadeciId,
              },
            });
          }
        }

        /* ====================================================== */
        /* FINALIZE SYNC — only when sale is NOT a draft AND       */
        /* təsdiq tələbi olmadıqda                                 */
        /* Təsdiqdən sonra "Tamamla" düyməsi ilə əl ilə            */
        /* finalize edilir (changeSaleStatus action).              */
        /* ====================================================== */
        const affectedMehsulIds: string[] = [];
        if (!data.qaralama && !needsApproval) {
          // 1. Stock decrement + anbar_hereketleri (mexaric) per line
          for (const line of data.lines) {
            // Atomic check-and-decrement: race-safe, refuse if insufficient
            const dec = await safeStockDecrement(tx, {
              mehsulId: line.mehsul_id,
              anbarId: line.anbar_id,
              miqdar: line.miqdar,
            });
            if (!dec.ok) {
              throw new Error(dec.error);
            }
            await tx.anbar_hereketleri.create({
              data: {
                sahibkar_id: sahibkarId,
                anbar_id: line.anbar_id,
                mehsul_id: line.mehsul_id,
                nov: "mexaric",
                miqdar: new Prisma.Decimal(line.miqdar),
                qiymet: new Prisma.Decimal(line.qiymet),
                ref_nov: "satis_sifarisi",
                ref_id: saleId,
                edilen_id: istifadeciId,
                qeyd: `Satış #${nomre}`,
              },
            });
            affectedMehsulIds.push(line.mehsul_id);
          }

          // 2. Apply payment method side-effects (kassa/finance vs borc)
          const isCashOrCard = data.odenis_nov !== "nisye";
          if (isCashOrCard && sonMebleg > 0) {
            // (a) Persist payment metadata on the sale itself
            await tx.satis_sifarisleri.update({
              where: { id: saleId },
              data: {
                odenis_nov: data.odenis_nov,
                kassa_id: data.kassa_id ?? null,
                odenilmis: new Prisma.Decimal(sonMebleg),
                status: "tamamlandi",
              },
            });
            // (b) Kassa emeliyyatı (if cash register selected)
            if (data.kassa_id) {
              try {
                await tx.kassa_emeliyyatlari.create({
                  data: {
                    sahibkar_id: sahibkarId,
                    kassa_id: data.kassa_id,
                    emeliyyat_nov: "satis",
                    odenis_nov: data.odenis_nov,
                    mebleg: new Prisma.Decimal(sonMebleg),
                    ref_nov: "satis_sifarisi",
                    ref_id: saleId,
                    istifadeci_id: istifadeciId,
                    qeyd: `Satış #${nomre}`,
                  },
                });
              } catch (e) {
                console.warn("[createOrUpdateSatisYeni] kassa_emeliyyati skipped:", e);
              }
            }
            // (c) finance_operations — "qaime" income (best-effort, won't rollback)
            try {
              let type = await tx.finance_operation_types
                .findUnique({ where: { kod: "qaime" } })
                .catch(() => null);
              if (!type) {
                type = await tx.finance_operation_types.create({
                  data: { kod: "qaime", ad: "Qaimə", qrup: "qaime", y_n: "daxil", link_satish: true },
                });
              }
              if (type) {
                await tx.finance_operations.create({
                  data: {
                    sahibkar_id: sahibkarId,
                    type_id: type.id,
                    type_kod: type.kod,
                    y_n: "daxil",
                    tarix: parseSaleDate(data.tarix),
                    meblegh: new Prisma.Decimal(sonMebleg),
                    valyuta: "AZN",
                    mezenne: 1,
                    azn_meblegh: new Prisma.Decimal(sonMebleg),
                    kontragent_id: data.musteri_id ?? null,
                    satis_id: saleId,
                    sened_nomresi: nomre,
                    qeyd: `Satış #${nomre} — ${data.odenis_nov}`,
                    yaradan_id: istifadeciId,
                  },
                });
              }
            } catch (e) {
              console.warn("[createOrUpdateSatisYeni] finance_operations skipped:", e);
            }
          } else if (data.odenis_nov === "nisye" && sonMebleg > 0) {
            // Borc — increment kontragent.borc, keep status=yeni / odenilmis=0
            await tx.satis_sifarisleri.update({
              where: { id: saleId },
              data: {
                odenis_nov: "borc",
                odenilmis: new Prisma.Decimal(0),
                status: "yeni",
              },
            });
            if (data.musteri_id) {
              // Satış nisyə → müştəri bizə borclu (alacaq artır)
              await tx.kontragentler.update({
                where: { id: data.musteri_id },
                data: { alacaq: { increment: new Prisma.Decimal(sonMebleg) } },
              });
            }
          }

          // 3. Audit log — outbox-safe (transaksiya bitdikdən sonra çağırılır,
          // ona görə tx yox prismaUnscoped istifadə edir).
          await safeAuditLog({
            sahibkar_id: sahibkarId,
            istifadeci_id: istifadeciId,
            emeliyyat: "yarad",
            resurs_nov: "satis_sifarisi",
            resurs_id: saleId,
            yeni_data: {
              nomre,
              son_mebleg: sonMebleg,
              odenis_nov: data.odenis_nov,
              lines: data.lines.length,
            },
            status: "ugur",
          });
        }

        return { id: saleId, nomre, affectedMehsulIds };
      });

      // 4. Stock-alert check (post-commit so it can read fresh stok totals)
      if (result.affectedMehsulIds.length > 0) {
        await checkAndCreateStockAlertBatch(result.affectedMehsulIds);
      }

      // 5. Təsdiq tələbi yarat — yalnız yeni satışlar (qaralama yox + təsdiq aktiv)
      if (needsApproval) {
        const sonMebleg = await prisma.satis_sifarisleri.findUnique({
          where: { id: result.id },
          select: { son_mebleg: true },
        });
        const mebleg = Number(sonMebleg?.son_mebleg ?? 0);
        await createApprovalRequest({
          emeliyyat_nov: "satis_qaime",
          resurs_nov: "satis_sifarisi",
          resurs_id: result.id,
          basliq: `Satış qaiməsi ${result.nomre}`,
          risk_sebeb: "Satış qaiməsi yaradanda təsdiq tələb olunur",
          mebleg,
          prioritet: mebleg > 5000 ? "yuxsek" : "orta",
          detay_json: {
            line_count: data.lines.length,
            musteri_id: data.musteri_id ?? null,
            odenis_nov: data.odenis_nov,
          },
        });
      }

      revalidatePath("/ticaret/satislar");
      revalidatePath("/ticaret/satis-yeni");
      revalidatePath("/ticaret");
      revalidatePath("/anbar");
      revalidatePath("/xeberdarliqlar");
      if (needsApproval) revalidatePath("/tesdiq");

      // Yeni satış (B2B sənəd) stoku azalır — kanal-larına sync
      try {
        const { emitStockChange } = await import("@/lib/stock-change-emitter");
        emitStockChange(result.affectedMehsulIds);
      } catch (e) {
        console.error("[createSatisYeni.emitStockChange]", e);
      }

      return {
        ok: true,
        satis_id: result.id,
        nomre: result.nomre,
        qaralama: data.qaralama,
        pending_approval: needsApproval,
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Xəta";
      console.error("[createOrUpdateSatisYeni]", e);
      return { ok: false, error: msg };
    }
  });
}

/* ----------------- Function 6: Şablonlar (save/load) -------------------- */

export async function saveSatisSablon(
  ad: string,
  payload: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!ad.trim() || ad.length > 100) return { ok: false, error: "Şablon adı yanlışdır" };
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    try {
      await prisma.ayarlar.upsert({
        where: {
          sahibkar_id_qrup_acar: {
            sahibkar_id: sahibkarId,
            qrup: SABLON_QRUP,
            acar: ad,
          },
        },
        update: { deyer: payload, yenilendi: new Date(), nov: "json" },
        create: {
          sahibkar_id: sahibkarId,
          qrup: SABLON_QRUP,
          acar: ad,
          deyer: payload,
          nov: "json",
          tesvir: "Satış şablonu",
        },
      });
      revalidatePath("/ticaret/satis-yeni");
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Xəta" };
    }
  });
}

export async function deleteSatisSablon(id: number): Promise<{ ok: boolean }> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    await prisma.ayarlar.deleteMany({
      where: { id, sahibkar_id: sahibkarId, qrup: SABLON_QRUP },
    });
    revalidatePath("/ticaret/satis-yeni");
    return { ok: true };
  });
}

/* ----------------- Function 8: AI discount suggestion ------------------- */
export async function suggestDiscountAction(musteriId: string) {
  return suggestDiscountForCustomer(musteriId);
}

/* ====================================================================== */
/* ERP-1: Real-time stock validation                                       */
/* ====================================================================== */

export type StockCheckLine = {
  uid: string;
  mehsul_id: string;
  anbar_id: number;
  miqdar: number;
};

export type StockCheckRow = {
  uid: string;
  mehsul_id: string;
  anbar_id: number;
  requested: number;
  available: number;
  ok: boolean;
};

export type ValidateCartStockResult = {
  ok: boolean;
  rows: StockCheckRow[];
  problem_count: number;
};

/**
 * Real-time stock validation: for each cart line, look up the current stok
 * row for (mehsul_id, anbar_id) and return whether `miqdar <= miqdar_stok`.
 * Pure read — never writes. Used by /ticaret/satis-yeni and /pos clients to
 * surface "stok çatışmır" status badges before submit.
 */
export async function validateCartStock(
  items: StockCheckLine[],
): Promise<ValidateCartStockResult> {
  if (!Array.isArray(items) || items.length === 0) {
    return { ok: true, rows: [], problem_count: 0 };
  }
  return withTenant(async () => {
    const rows: StockCheckRow[] = [];
    let problems = 0;
    // Aggregate identical (mehsul, anbar) pairs so over-the-line repeated
    // additions are counted against the same available pool.
    const totalsByKey = new Map<string, number>();
    for (const it of items) {
      const k = `${it.mehsul_id}::${it.anbar_id}`;
      totalsByKey.set(k, (totalsByKey.get(k) ?? 0) + Number(it.miqdar || 0));
    }
    const keys = Array.from(totalsByKey.keys());
    // Fetch one stok row per unique pair in parallel.
    const stockRows = await Promise.all(
      keys.map((k) => {
        const [mehsul_id, anbar_id] = k.split("::");
        return prisma.stok.findFirst({
          where: { mehsul_id, anbar_id: Number(anbar_id) },
          select: { miqdar: true },
        });
      }),
    );
    const availableByKey = new Map<string, number>();
    keys.forEach((k, i) => {
      availableByKey.set(k, Number(stockRows[i]?.miqdar ?? 0));
    });

    for (const it of items) {
      const k = `${it.mehsul_id}::${it.anbar_id}`;
      const available = availableByKey.get(k) ?? 0;
      // For multiple lines of the same pair, charge each against the running
      // pool so the first lines pass and later ones fail clearly.
      const totalRequested = totalsByKey.get(k) ?? 0;
      const ok = totalRequested <= available + 1e-6;
      if (!ok) problems += 1;
      rows.push({
        uid: it.uid,
        mehsul_id: it.mehsul_id,
        anbar_id: it.anbar_id,
        requested: Number(it.miqdar || 0),
        available,
        ok,
      });
    }
    return { ok: problems === 0, rows, problem_count: problems };
  });
}

/* ====================================================================== */
/* ERP-2: Customer credit status                                            */
/* ====================================================================== */

export type CustomerCreditStatus = {
  musteri_id: string;
  musteri_ad: string;
  borc: number;
  borc_limiti: number | null;
  available: number | null;
  overdue_90: number;
  overdue_count: number;
};

/**
 * Lightweight credit overview for a single customer — current borc, configured
 * limit and overdue (>=90d) exposure. Used by the new-sale UI to surface a
 * credit panel and to block "Borc" payment when over limit.
 */
export async function getCustomerCreditStatus(
  musteriId: string,
): Promise<CustomerCreditStatus | null> {
  if (!musteriId) return null;
  return withTenant(async () => {
    const c = await prisma.kontragentler.findUnique({
      where: { id: musteriId },
      select: { id: true, ad: true, borc: true, borc_limiti: true },
    });
    if (!c) return null;
    const borc = Number(c.borc ?? 0);
    const limit =
      c.borc_limiti === null || c.borc_limiti === undefined
        ? null
        : Number(c.borc_limiti);

    // Overdue exposure: sum unpaid balance on sales older than 90 days.
    const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const overdueAgg = await prisma.$queryRaw<
      { total: number | string | null; cnt: number | string | null }[]
    >(Prisma.sql`
        SELECT COALESCE(SUM(son_mebleg - COALESCE(odenilmis, 0)), 0)::float AS total,
               COUNT(*)::int AS cnt
          FROM satis_sifarisleri
         WHERE musteri_id = ${c.id}::uuid
           AND status <> 'legv'
           AND COALESCE(qaralama, false) = false
           AND tarix < ${cutoff}
           AND son_mebleg - COALESCE(odenilmis, 0) > 0
    `);
    const overdue90 = Number(overdueAgg[0]?.total ?? 0);
    const overdueCount = Number(overdueAgg[0]?.cnt ?? 0);

    return {
      musteri_id: c.id,
      musteri_ad: c.ad,
      borc,
      borc_limiti: limit,
      available: limit === null ? null : Math.max(0, limit - borc),
      overdue_90: overdue90,
      overdue_count: overdueCount,
    };
  });
}

/* ====================================================================== */
/* ERP-3: Discount approval pre-check                                       */
/* ====================================================================== */

export type DiscountApprovalCheck = {
  effective_pct: number;
  limit_pct: number;
  user_role: string | null;
  needs_approval: boolean;
};

/**
 * Pre-check from the new-sale UI: returns whether the current overall
 * discount percent would exceed the user's role limit. Lets the form show
 * a "təsdiq tələb olunur" banner before submitting.
 */
export async function precheckDiscountApproval(
  effectivePercent: number,
): Promise<DiscountApprovalCheck> {
  const r = await checkDiscountLimit(effectivePercent);
  return {
    effective_pct: effectivePercent,
    limit_pct: r.limit,
    user_role: r.userRole,
    needs_approval: !r.ok,
  };
}

/* ====================================================================== */
/* ERP-3 helper used by createOrUpdateSatisYeni (server-side enforcement)  */
/* ====================================================================== */

/**
 * Server action to request approval for a saved (draft) sale that exceeds
 * the role discount limit. Sets sale status to 'tesdiq_gozleyir' and
 * inserts a tesdiq_telep row. Idempotent — re-calling is safe.
 */
export async function requestSaleApprovalAction(
  saleId: string,
  effectivePercent: number,
): Promise<{ ok: true; telep_id: number } | { ok: false; error: string }> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const sale = await prisma.satis_sifarisleri.findFirst({
      where: { id: saleId, sahibkar_id: sahibkarId },
      select: { id: true, nomre: true, son_mebleg: true },
    });
    if (!sale) return { ok: false, error: "Satış tapılmadı" };
    const r = await requestDiscountApproval(
      sale.id,
      effectivePercent,
      `Endirim təsdiqi: ${sale.nomre} (${effectivePercent.toFixed(1)}%)`,
      Number(sale.son_mebleg ?? 0),
    );
    if (!r.ok) return r;
    await prisma.satis_sifarisleri.update({
      where: { id: sale.id },
      data: { status: "tesdiq_gozleyir", yenilendi: new Date() },
    });
    revalidatePath("/ticaret/satislar");
    return { ok: true, telep_id: r.telep_id };
  });
}
