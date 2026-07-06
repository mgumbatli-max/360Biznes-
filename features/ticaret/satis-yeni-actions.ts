"use server";

import { revalidatePath, revalidateTag } from "next/cache";
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
import { requireTicaretActionPerm, bustTicaretCache } from "./access-guard";
import { getRiskRules } from "@/features/ayarlar/risk-rules";

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
  /** Ödənilən hissə hansı maliyə hesabına düşür (nağd/kart/bank) */
  hesab_id: z.string().uuid().nullish(),
  /**
   * Hissəvi ödəniş: müştəri 100 AZN-lik satışa 30 AZN nağd verə bilər.
   * - boş/null: tam ödəniş (odenis_nov=nisye olarsa, 0 borc)
   * - 0: tam borc
   * - 0 < N < sonMebleg: hissəvi — N kassaya/hesaba düşür, qalıq nisyəyə
   */
  odenilen_mebleg: z.coerce.number().min(0).nullish(),
  /**
   * Idempotentlik açarı (POS sale-action pattern-i) — double-submit /
   * təkrar göndərişdə dublikat satış yaratmamaq üçün. DB-də partial unique
   * index `satis_client_op_uniq (sahibkar_id, client_op_id)` race-i bağlayır.
   */
  client_op_id: z.string().max(80).nullish(),
  /** Müştəri kredit limitini menecer override etdi (nisyə/hissəvi-borc) */
  override_credit_limit: z.coerce.boolean().optional(),
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
  // Redaktə-mi yarat-mı — id varsa duzelt icazəsi, yoxsa yarat
  const inputId = (input as { id?: string } | undefined)?.id;
  const inputQaralamaId = (input as { qaralama_id?: string } | undefined)?.qaralama_id;
  const permCheck = await requireTicaretActionPerm(inputId ? "satis.duzelt" : "satis.yarat");
  if (!permCheck.ok) return { ok: false, error: permCheck.error };

  // QA-major: `id` ötürülübsə bu "redaktə" niyyətidir, lakin bu action yalnız
  // qaralama-nı `qaralama_id` ilə yenidən saxlaya bilir; əsl finalize olunmuş
  // satışı düzəltmir. Əvvəl `id` icazə üçün oxunub, sonra Zod tərəfindən strip
  // edilirdi → CREATE branch-ına düşüb DUBLİKAT satış (qoşa stok azalması +
  // qoşa ödəniş) yaranırdı. Açıq xəta qaytar ki, səssiz dublikat olmasın.
  if (inputId && !inputQaralamaId) {
    return {
      ok: false,
      error: "Mövcud satışın redaktəsi bu axında dəstəklənmir — yalnız qaralama yenidən saxlanıla bilər. Düzəliş üçün satışı ləğv edib yenidən yaradın.",
    };
  }

  const parsed = CreateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Forma yanlışdır" };
  }
  const data = parsed.data;

  // 📅 Real-time tarix məcburiyyəti — köhnə tarix yalnız `tarix.geri` icazəsi ilə.
  const { validateOperationDate } = await import("@/lib/operation-date-guard");
  const dateCheck = await validateOperationDate(data.tarix, { fieldLabel: "Satış tarixi" });
  if (!dateCheck.ok) return { ok: false, error: dateCheck.error };
  const isBackdated = dateCheck.isBackdated;
  const backdatedDays = dateCheck.daysAgo;

  // 💸 Endirim limiti enforce — qaralama olmayan satışlar üçün
  if (!data.qaralama) {
    const subtotal = data.lines.reduce(
      (s, l) => s + l.miqdar * l.qiymet * (1 - l.endirim_faiz / 100),
      0,
    );
    const effectivePercent = subtotal > 0
      ? Math.min(100, Math.max(0, (data.endirim_mebleg / subtotal) * 100))
      : 0;
    if (effectivePercent > 0) {
      const dc = await checkDiscountLimit(effectivePercent);
      if (!dc.ok) {
        return {
          ok: false,
          error: `Endirim limiti aşılır (${effectivePercent.toFixed(1)}% > ${dc.limit}%). ${dc.userRole ? `Rol: ${dc.userRole}` : ""} — yüksək rol və ya təsdiq tələb olunur. requestSaleApprovalAction istifadə edin.`.trim(),
        };
      }
    }
  }

  // 4-eyes təsdiqi: yalnız aktiv satış (qaralama yox) üçün
  const needsApproval = !data.qaralama && (await shouldRequireDocApproval("satis_qaime"));

  // 📉 Maya altı (below-cost) yoxlaması — qaralama olmayan satışlar üçün
  let mayaAltiBlocked = false;
  let mayaAltiNeedsApproval = false;
  const mayaAltiLines: { mehsul_id: string; satis: number; maya: number }[] = [];
  if (!data.qaralama) {
    try {
      const rules = await getRiskRules();
      if (rules.maya_alti_action !== "warn") {
        const mehsulIds = data.lines.map((l) => l.mehsul_id);
        const mayaMap = await withTenant(async () => {
          const rows = await prisma.mehsullar.findMany({
            where: { id: { in: mehsulIds } },
            select: { id: true, alish_qiymeti: true },
          });
          return new Map(rows.map((r) => [r.id, Number(r.alish_qiymeti ?? 0)]));
        });
        for (const line of data.lines) {
          const maya = mayaMap.get(line.mehsul_id) ?? 0;
          const netSatis = line.qiymet * (1 - line.endirim_faiz / 100);
          if (maya > 0 && netSatis < maya) {
            mayaAltiLines.push({ mehsul_id: line.mehsul_id, satis: netSatis, maya });
          }
        }
        if (mayaAltiLines.length > 0) {
          if (rules.maya_alti_action === "block") mayaAltiBlocked = true;
          else mayaAltiNeedsApproval = true;
        }
      }
    } catch (e) {
      console.error("[satis-yeni maya-altı check]", e);
    }
  }
  if (mayaAltiBlocked) {
    return {
      ok: false,
      error: `Maya altı satış qadağandır. ${mayaAltiLines.length} sətir maya qiymətindən aşağıdır.`,
    };
  }

  // 💳 Kredit limiti enforce (server-side) — POS sale-action pattern-i.
  // Nisyə / hissəvi-borc satışda müştərinin açıq borcuna qalıq əlavə olunanda
  // limit aşılırsa bloklanır (menecer override edə bilər). Əvvəl yalnız
  // read-only getCustomerCreditStatus var idi, backend enforce yox idi.
  if (!data.qaralama && data.musteri_id && !data.override_credit_limit) {
    const subtotalRaw = data.lines.reduce(
      (s, l) => s + l.miqdar * l.qiymet * (1 - l.endirim_faiz / 100),
      0,
    );
    const afterDiscountRaw = Math.max(0, subtotalRaw - data.endirim_mebleg);
    const preSonMebleg = afterDiscountRaw + afterDiscountRaw * (data.vat_faiz / 100) + data.catdirma_xerc;
    // Bu satışdan müştəri borcuna qalan hissə (nisyə → tam, hissəvi → qalıq).
    const defaultOdenilen = data.odenis_nov === "nisye" ? 0 : preSonMebleg;
    const odenilenPre = Math.max(0, Math.min(preSonMebleg,
      data.odenilen_mebleg == null ? defaultOdenilen : Number(data.odenilen_mebleg),
    ));
    const borcaQalan = Math.max(0, preSonMebleg - odenilenPre);
    if (borcaQalan > 0.001) {
      const { checkCustomerCreditLimit } = await import("./customer-tier");
      const credit = await checkCustomerCreditLimit(data.musteri_id, borcaQalan);
      if (!credit.ok) {
        return {
          ok: false,
          error: `Müştəri kredit limiti aşılır (${credit.current.toFixed(2)} + ${credit.addAmount.toFixed(2)} > ${credit.limit.toFixed(2)} AZN). Menecer override edə bilər.`,
        };
      }
    }
  }

  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    try {
      const result = await prisma.$transaction(async (tx) => {
        // Idempotentlik (POS sale-action pattern-i): eyni client_op_id ilə satış
        // artıq varsa dublikat yaratma — mövcudu qaytar (double-submit / təkrar
        // göndəriş). DB-də partial-unique `satis_client_op_uniq` race-i bağlayır.
        // Yalnız yeni yaratmada — qaralama yenidən saxlamada (qaralama_id) tətbiq olunmur.
        if (data.client_op_id && !data.qaralama_id) {
          const dup = await tx.satis_sifarisleri.findFirst({
            where: { sahibkar_id: sahibkarId, client_op_id: data.client_op_id },
            select: { id: true, nomre: true },
          });
          if (dup) {
            return { id: dup.id, nomre: dup.nomre, affectedMehsulIds: [] as string[], isDuplicate: true };
          }
        }

        // Compute totals
        let umumi = 0;
        for (const line of data.lines) {
          umumi += line.miqdar * line.qiymet * (1 - line.endirim_faiz / 100);
        }
        const afterDiscount = Math.max(0, umumi - data.endirim_mebleg);
        const vat = afterDiscount * (data.vat_faiz / 100);
        const sonMebleg = afterDiscount + vat + data.catdirma_xerc;
        const effectiveNeedsApproval = needsApproval || mayaAltiNeedsApproval;
        const initialStatus = data.qaralama ? "qaralama" : effectiveNeedsApproval ? "tesdiq_gozleyir" : "yeni";

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
          // QA-orta: yalnız həqiqi qaralama yenidən saxlana bilər — əks halda finalize
          // olunmuş satış təkrar finalize olub stoku ikinci dəfə azaldardı (köhnə
          // mexaric hərəkətləri geri alınmadığından ledgerdə qoşa məxaric qalardı).
          if (!existing.qaralama && existing.status !== "qaralama") {
            throw new Error("Bu sənəd qaralama deyil — üzərinə yazmaq olmaz");
          }
          // Wipe old lines and bron — explicit sahibkar_id qoruması
          await tx.satis_sifaris_satirlari.deleteMany({ where: { sahibkar_id: sahibkarId, sifaris_id: existing.id } });
          await tx.stok_bron.deleteMany({
            where: { sahibkar_id: sahibkarId, satis_id: existing.id, status: "aktiv" },
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
              client_op_id: data.client_op_id ?? null,
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
        if (!data.qaralama && !effectiveNeedsApproval) {
          // 1. Stock decrement + anbar_hereketleri (mexaric) per line
          for (const line of data.lines) {
            // Atomic check-and-decrement: race-safe, refuse if insufficient
            const dec = await safeStockDecrement(tx, {
              mehsulId: line.mehsul_id,
              anbarId: line.anbar_id,
              miqdar: line.miqdar,
              // QA-orta: aktiv bron satışı bloklasın; satışın öz bronu istisna
              rezervNezereAl: true,
              excludeSatisId: saleId,
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

          // 2. HYBRID payment məntiqi:
          //    - tam ödəniş: odenilen >= sonMebleg → status=tamamlandi
          //    - tam borc: odenilen=0 (və ya kassa yoxdursa) → status=yeni, nisyə
          //    - hissəvi: 0 < odenilen < sonMebleg → status=yeni, kassaya odenilen,
          //      qalıq borca; odenis_nov="nisye" (FIFO ilə bağlana bilsin)
          if (sonMebleg > 0) {
            const odenilenRaw = data.odenilen_mebleg;
            // Defaultlar: nisyə-də 0; nağd/kart/köçürmədə tam
            const defaultOdenilen = data.odenis_nov === "nisye" ? 0 : sonMebleg;
            const odenilen = Math.max(0, Math.min(sonMebleg,
              odenilenRaw == null ? defaultOdenilen : Number(odenilenRaw),
            ));
            const isFullPaid = odenilen >= sonMebleg - 0.001;
            const isPartial = odenilen > 0 && !isFullPaid;
            // Hissəvi və ya tam borc → odenis_nov="nisye" (FIFO ilə bağlana bilsin)
            const finalOdenisNov = isFullPaid ? data.odenis_nov : "nisye";
            const finalStatus = isFullPaid ? "tamamlandi" : "yeni";

            await tx.satis_sifarisleri.update({
              where: { id: saleId },
              data: {
                odenis_nov: finalOdenisNov,
                kassa_id: data.kassa_id ?? null,
                odenilmis: new Prisma.Decimal(odenilen.toFixed(2)),
                status: finalStatus,
              },
            });

            // Kassa/hesab əməliyyatı — yalnız ödənilən hissə üçün.
            // QA-kritik: əvvəl bütün blok `data.kassa_id` ilə gate olunurdu.
            // Adi satış UI-si `hesab_id` göndərir (kassa_id YOX) → ödənilən
            // hissə HEÇ YERƏ DÜŞMÜRDÜ, amma satış "tamamlandi" görünürdü (pul
            // yox olurdu). İndi gate yalnız `odenilen > 0`-dır; pulun gedəcəyi
            // maliye hesabı (hesab_id → kassa hesabı → ödəniş növünə default)
            // MƏCBURİ həll olunur, tapılmazsa satış rədd edilir.
            if (odenilen > 0) {
              // Hesab seçimi prioriteti:
              // 1) İstifadəçi formada konkret hesab seçibsə — o
              // 2) Kassanın bağlı olduğu maliye hesabı (varsa)
              // 3) Ödəniş növünə görə default (nağd/kart/bank)
              let hesabIdForOp: string | null = data.hesab_id ?? null;
              if (!hesabIdForOp && data.kassa_id) {
                const kassaRow = await tx.kassalar.findFirst({
                  where: { id: data.kassa_id, sahibkar_id: sahibkarId },
                  select: { maliye_hesab_id: true },
                });
                hesabIdForOp = kassaRow?.maliye_hesab_id ?? null;
              }
              if (!hesabIdForOp) {
                const fallbackNov =
                  data.odenis_nov === "kart" ? "kart" :
                  data.odenis_nov === "kecirme" ? "bank" : "negd";
                const def = await tx.maliye_hesablari.findFirst({
                  where: { sahibkar_id: sahibkarId, aktiv: true, nov: fallbackNov },
                  orderBy: { yaradildi: "asc" },
                  select: { id: true },
                });
                hesabIdForOp = def?.id ?? null;
              }
              // QA-kritik/minor: pulun gedəcəyi hesab tapılmasa finance_op
              // hesab_id=null ilə yazılardı (kassa hesabatı vs hesab balansı
              // uyğunsuzluğu) — ya da ümumiyyətlə yazılmazdı. İkisi də pul
              // itkisidir. Hesab tapılmazsa satışı RƏDD et.
              if (!hesabIdForOp) {
                // SELF-HEAL: sıfır-data tenant (yeni sahibkar) üçün bu ödəniş
                // növünə default maliyə hesabı yarat ki, nağd/kart satış
                // bloklanmasın (signup default hesab yaratmadığı halda).
                const novForAccount =
                  data.odenis_nov === "kart" ? "kart" :
                  data.odenis_nov === "kecirme" ? "bank" : "negd";
                const adForNov = novForAccount === "kart" ? "Kart / POS terminal"
                  : novForAccount === "bank" ? "Bank hesabı" : "Nağd kassa";
                const createdHesab = await tx.maliye_hesablari.create({
                  data: { sahibkar_id: sahibkarId, ad: adForNov, nov: novForAccount, qaliq: 0, valyuta: "AZN", aktiv: true },
                  select: { id: true },
                });
                hesabIdForOp = createdHesab.id;
              }

              // Kassa əməliyyatı yalnız real kassa sessiyası varsa (kassa_id
              // gerçək kassa FK-sıdır; hesab_id deyil).
              if (data.kassa_id) {
                try {
                  await tx.kassa_emeliyyatlari.create({
                    data: {
                      sahibkar_id: sahibkarId,
                      kassa_id: data.kassa_id,
                      emeliyyat_nov: "satis",
                      odenis_nov: data.odenis_nov === "nisye" ? "negd" : data.odenis_nov,
                      mebleg: new Prisma.Decimal(odenilen.toFixed(2)),
                      ref_nov: "satis_sifarisi",
                      ref_id: saleId,
                      istifadeci_id: istifadeciId,
                      qeyd: isPartial
                        ? `Satış #${nomre} — hissəvi (${odenilen.toFixed(2)} / ${sonMebleg.toFixed(2)})`
                        : `Satış #${nomre}`,
                    },
                  });
                } catch (e) {
                  console.warn("[createOrUpdateSatisYeni] kassa_emeliyyati skipped:", e);
                }
              }

              // finance_operations — ödənilən hissə daxil + hesab balansı sinxron.
              // Best-effort DEYİL: hesab həll olunub, yazılmalıdır; xəta olarsa
              // satış rollback olunsun (pul yox olmasın).
              let type = await tx.finance_operation_types
                .findUnique({ where: { kod: "qaime" } })
                .catch(() => null);
              if (!type) {
                type = await tx.finance_operation_types.create({
                  data: { kod: "qaime", ad: "Qaimə", qrup: "qaime", y_n: "daxil", link_satish: true },
                });
              }
              await tx.finance_operations.create({
                data: {
                  sahibkar_id: sahibkarId,
                  type_id: type.id,
                  type_kod: type.kod,
                  y_n: "daxil",
                  tarix: parseSaleDate(data.tarix),
                  meblegh: new Prisma.Decimal(odenilen.toFixed(2)),
                  valyuta: "AZN",
                  mezenne: 1,
                  azn_meblegh: new Prisma.Decimal(odenilen.toFixed(2)),
                  hesab_id: hesabIdForOp,
                  kontragent_id: data.musteri_id ?? null,
                  satis_id: saleId,
                  sened_nomresi: nomre,
                  qeyd: isPartial
                    ? `Satış #${nomre} hissəvi (qalıq: ${(sonMebleg - odenilen).toFixed(2)} ₼ borc)`
                    : `Satış #${nomre} — ${data.odenis_nov}`,
                  yaradan_id: istifadeciId,
                },
              });
              // Source-of-truth-dan hesab qaliqını yenilə
              const { recalculateAccountBalance } = await import("@/lib/balance/account-balance");
              await recalculateAccountBalance(hesabIdForOp, tx);
            }
          }

          // Müştəri balansını yenidən hesabla — istənilən ödəniş növündə
          // (qaralama -> aktiv keçidi, nisyə yaradılması, redaktə zamanı
          // ödəniş növü dəyişikliyi). Müştəri varsa, balans drift olmasın.
          if (data.musteri_id) {
            const { recalculateCustomerBalance } = await import("@/lib/balance/customer-balance");
            await recalculateCustomerBalance(data.musteri_id, tx);
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
              ...(isBackdated ? { backdated: true, backdated_days: backdatedDays } : {}),
            },
            sebeb: isBackdated
              ? `Köhnə tarixlə satış (${backdatedDays} gün əvvəl)`
              : undefined,
            status: "ugur",
          });
        }

        return { id: saleId, nomre, affectedMehsulIds, isDuplicate: false };
      });

      // 4. Stock-alert check (post-commit so it can read fresh stok totals)
      if (result.affectedMehsulIds.length > 0) {
        await checkAndCreateStockAlertBatch(result.affectedMehsulIds);
      }

      // 5. Təsdiq tələbi yarat — yalnız yeni satışlar (qaralama yox + təsdiq aktiv)
      // Idempotent dublikatda təkrar təsdiq sorğusu YARATMA.
      const effectiveApprovalNeeded = !result.isDuplicate && (needsApproval || mayaAltiNeedsApproval);
      if (effectiveApprovalNeeded) {
        const sonMebleg = await prisma.satis_sifarisleri.findUnique({
          where: { id: result.id },
          select: { son_mebleg: true },
        });
        const mebleg = Number(sonMebleg?.son_mebleg ?? 0);
        const approvalResult = await createApprovalRequest({
          emeliyyat_nov: "satis_qaime",
          resurs_nov: "satis_sifarisi",
          resurs_id: result.id,
          basliq: `Satış qaiməsi ${result.nomre}${mayaAltiNeedsApproval ? " — maya altı" : ""}`,
          risk_sebeb: mayaAltiNeedsApproval
            ? `Maya altı satış: ${mayaAltiLines.length} sətir maya qiymətindən aşağıdır`
            : "Satış qaiməsi yaradanda təsdiq tələb olunur",
          mebleg,
          prioritet: mayaAltiNeedsApproval || mebleg > 5000 ? "yuxsek" : "orta",
          detay_json: {
            line_count: data.lines.length,
            musteri_id: data.musteri_id ?? null,
            odenis_nov: data.odenis_nov,
            maya_alti_lines: mayaAltiLines,
          },
        });
        // Satış artıq commit olunub və istifadəçiyə uğur bildirilir; təsdiq
        // sorğusunun yaradılması uğursuz olarsa kənar əməliyyatı SINDIRMA,
        // sadəcə xəbərdarlıq logla (satış tesdiq_gozleyir-də qalır).
        if (!approvalResult.ok) {
          console.warn(
            "[createOrUpdateSatisYeni] Approval request creation failed for sale",
            result.id,
            approvalResult.error,
          );
        } else if (approvalResult.auto_approved) {
          // QA-audit KRİTİK: auto-təsdiq (kiçik məbləğ/qayda söndürülüb) halında satış 'tesdiq_gozleyir'-də
          // İLİŞİB QALIRDI — stok azalmır, kassa/finance yazılmır (materializeApprovedSale çağırılmırdı).
          // alis-actions.ts:293 auto-approve materiallaşdırma pattern-inin satış qarşılığı.
          try {
            const { materializeApprovedSale } = await import("@/features/ticaret/satis-materialize");
            await materializeApprovedSale(result.id);
          } catch (e) {
            console.warn("[createOrUpdateSatisYeni] auto-approve materialize skipped:", e);
          }
        }
      }

      revalidatePath("/ticaret/satislar");
      revalidatePath("/ticaret/satis-yeni");
      revalidatePath("/ticaret");
      revalidatePath("/anbar");
      revalidatePath("/xeberdarliqlar");
      if (effectiveApprovalNeeded) revalidatePath("/tesdiq");
      // Dashboard cache invalidate
      revalidateTag(`dashboard:${sahibkarId}`, "max");
      revalidateTag(`stok:${sahibkarId}`, "max");
      bustTicaretCache();

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
        pending_approval: needsApproval || mayaAltiNeedsApproval,
      };
    } catch (e) {
      const { logAndFriendly } = await import("@/lib/error/user-message");
      return { ok: false, error: logAndFriendly("createOrUpdateSatisYeni", e, "Satış yaradılmadı") };
    }
  });
}

/* ----------------- Function 6: Şablonlar (save/load) -------------------- */

export async function saveSatisSablon(
  ad: string,
  payload: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  // İcazə: satış şablonu yarat — `satis.yarat` və ya `satis.idare`
  const permCheck = await requireTicaretActionPerm(["satis.yarat", "satis.idare"]);
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
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
      // QA-orta: raw DB mesajı UI-ya sızmasın — fayldakı mövcud logAndFriendly pattern-i
      const { logAndFriendly } = await import("@/lib/error/user-message");
      return { ok: false, error: logAndFriendly("saveSatisSablon", e, "Şablon yadda saxlanmadı") };
    }
  });
}

export async function deleteSatisSablon(id: number): Promise<{ ok: boolean; error?: string }> {
  const permCheck = await requireTicaretActionPerm(["satis.idare", "satis.yarat"]);
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
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
    const { sahibkarId } = requireTenant();
    const keys = Array.from(totalsByKey.keys());
    // Fetch one stok row per unique pair in parallel — explicit sahibkar_id qoruması.
    const stockRows = await Promise.all(
      keys.map((k) => {
        const [mehsul_id, anbar_id] = k.split("::");
        return prisma.stok.findFirst({
          where: { sahibkar_id: sahibkarId, mehsul_id, anbar_id: Number(anbar_id) },
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
    const { sahibkarId } = requireTenant();
    // Yeni model üzrə:
    //   alacaq = müştəri bizdən almalı (debitor — müştərinin bizə borcu)
    //   borc   = bizim təchizatçıya verməli (kreditor)
    // Köhnə model üzrə isə `borc` müsbət/mənfi qarışıq idi — legacy fallback.
    const c = await prisma.kontragentler.findFirst({
      where: { id: musteriId, sahibkar_id: sahibkarId },
      select: { id: true, ad: true, borc: true, alacaq: true, borc_limiti: true },
    });
    if (!c) return null;

    // Müştərinin bizə qalan borcu — əsas mənbə: alacaq (yeni model).
    // Əgər alacaq 0-dırsa, faktiki açıq satışlardan hesabla (data uyğunlaşdırma üçün).
    const alacaq = Number(c.alacaq ?? 0);
    const legacyBorc = Math.max(0, Number(c.borc ?? 0));

    // Cari açıq borcu satışlardan hesabla — alacaq field-i sinxron olmasa belə düzgün cavab versin.
    const openAgg = await prisma.$queryRaw<{ total: number | string | null }[]>(
      Prisma.sql`
        SELECT COALESCE(SUM(son_mebleg - COALESCE(odenilmis, 0)), 0)::float AS total
          FROM satis_sifarisleri
         WHERE sahibkar_id = ${sahibkarId}::uuid
           AND musteri_id = ${c.id}::uuid
           AND status NOT IN ('legv', 'qaytarilib')
           AND COALESCE(qaralama, false) = false
           AND odenis_nov IN ('nisye', 'borc')
           AND son_mebleg - COALESCE(odenilmis, 0) > 0
      `,
    );
    const openFromSales = Number(openAgg[0]?.total ?? 0);

    // Ən etibarlı dəyər: alacaq vs satışlardan hesablanan açıq borc — daha böyüyünü götür
    // (data drift halında belə doğru göstərilir).
    const borc = Math.max(alacaq, legacyBorc, openFromSales);

    const limit =
      c.borc_limiti === null || c.borc_limiti === undefined
        ? null
        : Number(c.borc_limiti);

    // Overdue exposure: sum unpaid balance on sales older than 90 days
    const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const overdueAgg = await prisma.$queryRaw<
      { total: number | string | null; cnt: number | string | null }[]
    >(Prisma.sql`
        SELECT COALESCE(SUM(son_mebleg - COALESCE(odenilmis, 0)), 0)::float AS total,
               COUNT(*)::int AS cnt
          FROM satis_sifarisleri
         WHERE sahibkar_id = ${sahibkarId}::uuid
           AND musteri_id = ${c.id}::uuid
           AND status NOT IN ('legv', 'qaytarilib')
           AND COALESCE(qaralama, false) = false
           AND odenis_nov IN ('nisye', 'borc')
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
  // İcazə: təsdiq sorğusu yarat — satışı yarada bilən hər kəs bunu da edə bilər
  const permCheck = await requireTicaretActionPerm(["satis.yarat", "satis.duzelt", "satis.idare"]);
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
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
