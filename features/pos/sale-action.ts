"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { Prisma, prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { checkDiscountLimit, requestDiscountApproval } from "@/features/ticaret/discount-approval";
import { checkCustomerCreditLimit } from "@/features/ticaret/customer-tier";
import { safeStockDecrement } from "@/lib/db/stock-guards";
import { nextDocNumber } from "@/lib/db/sened-nomre";
import { emitStockChange } from "@/lib/stock-change-emitter";
import { audit } from "@/lib/audit/log";
import { safeAuditLog } from "@/lib/audit/safe-log";

const LineSchema = z.object({
  mehsul_id: z.string().uuid(),
  miqdar: z.coerce.number().positive(),
  qiymet: z.coerce.number().min(0),
  endirim_faiz: z.coerce.number().min(0).max(100).default(0),
});

const CreateSaleSchema = z.object({
  kassa_id: z.string().uuid(),
  anbar_id: z.coerce.number().int().positive(),
  musteri_id: z.string().uuid().nullish(),
  satis_meneceri_id: z.string().uuid().nullish(),
  // POS-da default Nağd (sürətli satış). Nisyə də qəbul olunur — standartdır.
  odenis_nov: z.enum(["negd", "kart", "kecirme", "nisye"]),
  endirim_mebleg: z.coerce.number().min(0).default(0),
  // QA-orta: müştərinin öz loyalty bonus sərfi — limit yoxlamasında kassir endirimindən çıxarılır
  bonus_mebleg: z.coerce.number().min(0).default(0),
  qeyd: z.string().max(2000).nullish(),
  lines: z.array(LineSchema).min(1, "Ən az 1 məhsul olmalıdır"),
  override_credit_limit: z.coerce.boolean().optional(),
  override_discount_limit: z.coerce.boolean().optional(),
  // Offline növbə / double-submit idempotentliyi (audit #3) — klient tərəfdə
  // bir dəfə generasiya olunan açar; eyni açarla təkrar göndəriş dublikat yaratmır.
  client_op_id: z.string().max(80).optional(),
  // QA-K6: qarışıq ödənişin bölgüsü — hər metod ayrıca kassa sətri kimi yazılır
  // (əvvəl tam məbləğ tək 'negd' sətrində idi, kart/bank hissələri itirdi).
  split: z
    .object({
      negd: z.coerce.number().min(0).default(0),
      kart: z.coerce.number().min(0).default(0),
      kecirme: z.coerce.number().min(0).default(0),
    })
    .optional(),
  // Tətbiq olunan kampaniya/kupon (audit #10) — satışdan sonra campaign_usage-ə
  // yazılır və kupon/kampaniya istifadə sayğacı artırılır.
  applied_campaigns: z
    .array(
      z.object({
        campaign_id: z.string(),
        ad: z.string(),
        tip: z.string(),
        endirim_mebleg: z.coerce.number(),
        endirim_faiz: z.coerce.number(),
        bonus_qazanildi: z.coerce.number(),
        free_shipping: z.coerce.boolean(),
        qeyd: z.string(),
        coupon_id: z.string().optional(), // QA-K8
      }),
    )
    .optional(),
});

export type CreateSaleInput = z.input<typeof CreateSaleSchema>;
export type CreateSaleResult =
  | {
      ok: true;
      satis_id: string;
      nomre: string;
      son_mebleg: number;
      pos_cek_nomresi: string;
    }
  | { ok: false; error: string };

const SALE_PREFIX = "SAT";

export async function createSale(input: CreateSaleInput): Promise<CreateSaleResult> {
  const parsed = CreateSaleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Forma yanlışdır" };
  const data = parsed.data;

  const { requireTicaretActionPerm } = await import("@/features/ticaret/access-guard");
  const permCheck = await requireTicaretActionPerm(["pos.satis"]);
  if (!permCheck.ok) return { ok: false, error: permCheck.error };

  return runCreateSale(data);
}

/**
 * POS satışının auth-suz çəyirdəyi. Web `createSale` (NextAuth permCheck) və
 * mobil route (Bearer token + mobilePerm) hər ikisi bunu çağırır. Çağıran
 * İCAZƏ yoxlamasını ÖZÜ etməlidir (bu funksiya icazə yoxlamır). Tenant
 * konteksti aktiv olmalıdır — withTenant aktiv kontekti reuse edir.
 */
export async function createSaleCore(input: CreateSaleInput): Promise<CreateSaleResult> {
  const parsed = CreateSaleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Forma yanlışdır" };
  return runCreateSale(parsed.data);
}

async function runCreateSale(data: z.infer<typeof CreateSaleSchema>): Promise<CreateSaleResult> {
  return withTenant(async () => {
    const { sahibkarId, istifadeciId, rolAd, icazeler } = requireTenant();

    // 🔒 Kassir icazə enforce (server) — client gating server-i bağlamır; mobil
    // API/body birbaşa çağırıla bilər, ona görə bütün enforce SERVER-də olmalıdır.
    const _r = (rolAd ?? "").toLowerCase();
    const _isPriv = _r.includes("sahibkar") || _r.includes("admin") || _r.includes("owner");
    // override_* bayraqları yalnız privileged/menecer üçün hörmət olunur.
    const canOverrideLimits = _isPriv || _r.includes("menecer") || _r.includes("direktor") || _r.includes("director");
    const overrideCredit = !!data.override_credit_limit && canOverrideLimits;
    const overrideDiscount = !!data.override_discount_limit && canOverrideLimits;
    // change_price / sell_below_min — icazə kodu VƏ YA tenant POS settings ilə.
    const _icz = icazeler ?? [];
    const { getPosPriceSettings } = await import("@/features/ayarlar/pos-qiymet");
    const _posSet = await getPosPriceSettings();
    const canChangePrice = _isPriv || _icz.includes("pos.change_price") || _posSet.cashier_can_change_price;
    const canSellBelowMin = _isPriv || _icz.includes("pos.sell_below_min_price") || _posSet.cashier_can_sell_below_min;

    // Cross-tenant qoruması: kliyentdən gələn FK-lər (müştəri, satış meneceri)
    // CARI tenantə aid olmalıdır. FK constraint qlobaldır (yalnız UUID-in
    // mövcudluğunu yoxlayır) — başqa tenantın müştərisi/işçisi göndərilsə
    // sahibkar_id=cari, lakin musteri_id=özgə tenant satışı yaranardı.
    if (data.musteri_id) {
      const m = await prisma.kontragentler.findFirst({
        where: { id: data.musteri_id, sahibkar_id: sahibkarId },
        select: { id: true },
      });
      if (!m) return { ok: false as const, error: "Müştəri bu hesaba aid deyil" };
    }
    if (data.satis_meneceri_id) {
      const sm = await prisma.istifadeciler.findFirst({
        where: { id: data.satis_meneceri_id, sahibkar_id: sahibkarId, aktiv: true },
        select: { id: true },
      });
      if (!sm) return { ok: false as const, error: "Satış meneceri bu hesaba aid deyil" };
    }

    try {
      // Pre-flight: compute totals first to check credit and discount limits.
      let preUmumi = 0;
      let maxLineDiscount = 0;
      for (const line of data.lines) {
        preUmumi += line.miqdar * line.qiymet * (1 - line.endirim_faiz / 100);
        if (line.endirim_faiz > maxLineDiscount) maxLineDiscount = line.endirim_faiz;
      }
      // 🔒 KAMPANIYA/KUPON/BONUS SERVER-AVTORİTATİV YENİDƏN HESABLANMASI (audit K1/K2/K6).
      // Client `applied_campaigns` və `bonus_mebleg` dəyərlərinə ETİBAR ETMƏ — DB-dən
      // yenidən validasiya et. Fabrik kampaniya/bonus ilə endirim uydurma və kassir
      // endirim-limitini bypass vektorunu bağlayır (əvvəl bu dəyərlər limitdən çıxılırdı).
      const { validateAppliedCampaigns, validateBonusSpend } = await import("@/features/kampaniyalar/matcher");
      const cartForCampaigns = {
        lines: data.lines.map((l) => ({ mehsul_id: l.mehsul_id, miqdar: l.miqdar, qiymet: l.qiymet * (1 - l.endirim_faiz / 100) })),
        cemi: Math.round(preUmumi * 100) / 100,
        kontragent_id: data.musteri_id ?? null,
        filial_id: null as number | null,
        kanal: "pos" as const,
      };
      const validatedCampaigns = await validateAppliedCampaigns(data.applied_campaigns, cartForCampaigns);
      const serverCampaignEndirim = validatedCampaigns.reduce((s, c) => s + Math.max(0, c.endirim_mebleg), 0);
      let serverBonus: { mebleg: number; kartId: string } | null = null;
      if (data.bonus_mebleg > 0 && data.musteri_id) {
        // QA-audit: bonus limiti kampaniya endirimindən ƏVVƏLki cart üzərində hesablanırdı →
        // endirim+bonus səbəti aşdıqda bonus tam sərf olunub sonMebleg 0-a düşürdü (bal dəyər vermir).
        // İndi kampaniya endirimindən SONRAKI qalıq üzərində cap olunur.
        const remainingAfterCampaign = Math.max(0, Math.round((cartForCampaigns.cemi - serverCampaignEndirim) * 100) / 100);
        serverBonus = await validateBonusSpend(data.musteri_id, data.bonus_mebleg, remainingAfterCampaign);
      }
      const serverBonusSpend = serverBonus?.mebleg ?? 0;
      // Client-in bildirdiyi kampaniya endirimi — kassirin öz əl-endirimini ayırmaq üçün.
      const clientCampaignEndirim = (data.applied_campaigns ?? []).reduce((s, c) => s + Math.max(0, c.endirim_mebleg), 0);
      const manualEndirim = Math.max(0, data.endirim_mebleg - clientCampaignEndirim - data.bonus_mebleg);
      // Faktiki endirim = server-təsdiqli kampaniya + server-təsdiqli bonus + kassir
      // əl-endirimi. Uydurma kampaniya/bonus BURADA düşür (sonMebleg-ə təsir etmir).
      const effectiveEndirim = Math.round((serverCampaignEndirim + serverBonusSpend + manualEndirim) * 100) / 100;

      const preSonMebleg = Math.max(0, preUmumi - effectiveEndirim);
      // Endirim limiti YALNIZ kassir əl-endirimini saymalıdır (kampaniya/bonus yox).
      const kassirEndirim = Math.min(preUmumi, manualEndirim);
      const overallDiscountPct =
        preUmumi > 0 ? Math.round((kassirEndirim / preUmumi) * 1000) / 10 : 0;
      const effectiveMaxPct = Math.max(maxLineDiscount, overallDiscountPct);

      // Credit-limit check for nisye sales (POS-da nisyə qəbul olunur).
      if (data.odenis_nov === "nisye" && data.musteri_id && !overrideCredit) {
        const check = await checkCustomerCreditLimit(data.musteri_id, preSonMebleg);
        if (!check.ok) {
          return {
            ok: false as const,
            error: `Borc limiti aşılır (${check.current.toFixed(2)} + ${check.addAmount.toFixed(2)} > ${check.limit.toFixed(2)} AZN). Menecer override edə bilər.`,
          };
        }
      }

      // Discount-limit check: if user is over their role's cap and didn't
      // explicitly override, create a tesdiq_telep and refuse for now.
      if (effectiveMaxPct > 0 && !overrideDiscount) {
        const dCheck = await checkDiscountLimit(effectiveMaxPct);
        if (!dCheck.ok) {
          // Create an approval request (no sale yet — uses a placeholder ref).
          await requestDiscountApproval(
            "pending-sale",
            effectiveMaxPct,
            `Endirim: ${effectiveMaxPct.toFixed(1)}% (limit ${dCheck.limit}%)`,
            preSonMebleg
          );
          return {
            ok: false as const,
            error: `Endirim limit aşılır (${effectiveMaxPct.toFixed(1)}% > ${dCheck.limit}%). Sahibkar təsdiqi tələb olunur.`,
          };
        }
      }

      let financeOpSkipped: string | null = null;
      const result = await prisma.$transaction(async (tx) => {
        // 1. Verify kassa is open
        const kassa = await tx.kassalar.findFirst({
          where: { id: data.kassa_id, status: "acig" },
        });
        if (!kassa) throw new Error("Kassa sessiyası açıq deyil");

        // Idempotentlik (audit #3): eyni client_op_id ilə satış artıq varsa,
        // dublikat yaratma — mövcudu qaytar (offline növbə təkrar göndərişi /
        // double-click). DB-də partial-unique index race-ləri də bağlayır.
        if (data.client_op_id) {
          const dup = await tx.satis_sifarisleri.findFirst({
            where: { sahibkar_id: sahibkarId, client_op_id: data.client_op_id },
            select: { id: true, nomre: true, son_mebleg: true, qaime_nomresi: true },
          });
          if (dup) {
            return {
              id: dup.id,
              nomre: dup.nomre,
              sonMebleg: Number(dup.son_mebleg ?? 0),
              posCekNomresi: dup.qaime_nomresi ?? "",
              // QA-K7: post-commit yan-təsirlər (kampaniya/kupon/bonus) dup-da
              // TƏKRARLANMASIN deyə bayraq.
              isDuplicate: true,
            };
          }
        }

        // 2. Compute totals + load product costs
        let umumi = 0;
        for (const line of data.lines) {
          umumi += line.miqdar * line.qiymet * (1 - line.endirim_faiz / 100);
        }
        // Server-avtoritativ endirim (client dəyəri yox — yuxarıda validasiya olundu).
        const sonMebleg = Math.max(0, umumi - effectiveEndirim);

        // 3. Lock stok rows and verify availability
        const stokRows = await tx.$queryRaw<{ id: number; mehsul_id: string; miqdar: number }[]>(
          Prisma.sql`
            SELECT id, mehsul_id::text, COALESCE(miqdar, 0)::float AS miqdar
              FROM stok
             WHERE sahibkar_id = ${sahibkarId}::uuid
               AND anbar_id = ${data.anbar_id}::int
               AND mehsul_id IN (${Prisma.join(data.lines.map((l) => Prisma.sql`${l.mehsul_id}::uuid`))})
             FOR UPDATE
          `
        );
        const stokByMehsul = new Map(stokRows.map((r) => [r.mehsul_id, r]));
        for (const line of data.lines) {
          const row = stokByMehsul.get(line.mehsul_id);
          if (!row) throw new Error(`Stok qeydi tapılmadı (məhsul ID ${line.mehsul_id})`);
          if (row.miqdar < line.miqdar) {
            throw new Error(`Stok kifayət etmir (mövcud: ${row.miqdar}, tələb: ${line.miqdar})`);
          }
        }

        // 4. Load product cost info for maya_alti flag
        const products = await tx.mehsullar.findMany({
          where: { id: { in: data.lines.map((l) => l.mehsul_id) } },
          select: {
            id: true, alish_qiymeti: true, min_satis_qiymeti: true,
            satis_qiymeti: true, topdan_qiymeti: true, partnyor_qiymeti: true,
            vip_qiymeti: true, endirimli_qiymet: true,
          },
        });
        const productById = new Map(products.map((p) => [p.id, p]));
        let mayaAlti = false;
        let minQiymetAlti = false;
        for (const line of data.lines) {
          const p = productById.get(line.mehsul_id);
          if (!p) continue;
          const effective = line.qiymet * (1 - line.endirim_faiz / 100);
          if (effective < Number(p.alish_qiymeti ?? 0)) mayaAlti = true;
          if (Number(p.min_satis_qiymeti ?? 0) > 0 && effective < Number(p.min_satis_qiymeti ?? 0)) {
            minQiymetAlti = true;
          }
        }

        // 🔒 SERVER ENFORCE — kassir qiymət/min-altı icazəsi:
        // change_price yoxdursa, line.qiymet məhsulun təyin edilmiş qiymətlərindən
        // (tier) biri olmalıdır — kassir ixtiyari qiymət yaza bilməz.
        if (!canChangePrice) {
          for (const line of data.lines) {
            const p = productById.get(line.mehsul_id);
            if (!p) continue;
            const allowed = [
              p.satis_qiymeti, p.topdan_qiymeti, p.partnyor_qiymeti,
              p.vip_qiymeti, p.endirimli_qiymet, p.min_satis_qiymeti,
            ].map((v) => Number(v ?? 0)).filter((v) => v > 0);
            if (allowed.length && !allowed.some((v) => Math.abs(v - line.qiymet) < 0.01)) {
              throw new Error("Qiyməti dəyişmək icazəniz yoxdur — sistem qiymətindən istifadə edin.");
            }
          }
        }
        // min-altı satış icazəsi yoxdursa rədd et.
        if (minQiymetAlti && !canSellBelowMin) {
          throw new Error("Minimum qiymətdən aşağı satış icazəniz yoxdur.");
        }

        // 5. Sale number (race-safe inside transaction)
        const year = new Date().getFullYear();
        const nomre = await nextDocNumber(tx, sahibkarId, "satis");

        // 5b. POS receipt number sequence per kassa session
        // Format: POS-{year}-{kassa_short}-{seq} where kassa_short = last 4 chars of kassa.id
        const kassaShort = kassa.id.replace(/-/g, "").slice(-4).toUpperCase();
        const posPrefix = `POS-${year}-${kassaShort}-`;
        const lastPos = await tx.satis_sifarisleri.findFirst({
          where: {
            kassa_id: data.kassa_id,
            qaime_nomresi: { startsWith: posPrefix },
          },
          orderBy: { qaime_nomresi: "desc" },
          select: { qaime_nomresi: true },
        });
        const lastPosNum = lastPos?.qaime_nomresi
          ? Number(lastPos.qaime_nomresi.split("-").pop()) || 0
          : 0;
        // QA-orta: max+1 findFirst race-unsafe idi (paralel satışda dublikat POS çek
        // nömrəsi) — sened_nomre_counter UPSERT atomikdir (nextDocNumber pattern-i);
        // GREATEST mövcud max-dan seed edir ki, köhnə nömrələrlə toqquşma olmasın.
        const posRows = await tx.$queryRaw<{ son_nomre: number }[]>`
          INSERT INTO sened_nomre_counter (sahibkar_id, prefix, il, son_nomre, yenilendi)
          VALUES (${sahibkarId}::uuid, ${`pos-${kassaShort}`}::varchar, ${year}::integer, ${lastPosNum + 1}::integer, NOW())
          ON CONFLICT (sahibkar_id, prefix, il) DO UPDATE
            SET son_nomre = GREATEST(sened_nomre_counter.son_nomre, ${lastPosNum}::integer) + 1,
                yenilendi = NOW()
          RETURNING son_nomre
        `;
        const posCekNomresi = `${posPrefix}${String(posRows[0]?.son_nomre ?? lastPosNum + 1).padStart(5, "0")}`;

        // 6. Sale header
        const sale = await tx.satis_sifarisleri.create({
          data: {
            sahibkar_id: sahibkarId,
            nomre,
            client_op_id: data.client_op_id ?? null,
            musteri_id: data.musteri_id ?? null,
            anbar_id: data.anbar_id,
            kassa_id: data.kassa_id,
            tarix: new Date(),
            status: "tamamlandi",
            odenis_nov: data.odenis_nov,
            umumi_mebleg: umumi,
            endirim_mebleg: effectiveEndirim,
            son_mebleg: sonMebleg,
            odenilmis: data.odenis_nov === "nisye" ? 0 : sonMebleg,
            filial_id: kassa.filial_id,
            satis_meneceri_id: data.satis_meneceri_id ?? istifadeciId,
            yaradan_id: istifadeciId,
            qaralama: false,
            maya_alti: mayaAlti,
            min_qiymet_alti: minQiymetAlti,
            qeyd: data.qeyd ?? null,
            qaime_nomresi: posCekNomresi,
          },
        });

        // 7. Sale lines + stock decrement + warehouse movement
        for (const line of data.lines) {
          await tx.satis_sifaris_satirlari.create({
            data: {
              sahibkar_id: sahibkarId,
              sifaris_id: sale.id,
              mehsul_id: line.mehsul_id,
              miqdar: line.miqdar,
              vahid_qiymet: line.qiymet,
              endirim_faiz: line.endirim_faiz,
              // `cemi` is GENERATED — do not set
            },
          });

          const dec = await safeStockDecrement(tx, {
            mehsulId: line.mehsul_id,
            anbarId: data.anbar_id,
            miqdar: line.miqdar,
            // QA-orta: aktiv bron POS satışını bloklasın (oversell qoruması)
            rezervNezereAl: true,
          });
          if (!dec.ok) throw new Error(dec.error);

          await tx.anbar_hereketleri.create({
            data: {
              sahibkar_id: sahibkarId,
              anbar_id: data.anbar_id,
              mehsul_id: line.mehsul_id,
              nov: "mexaric", // CHECK constraint allows: medaxil/mexaric/transfer_*/inventar/qaytarma_*
              miqdar: line.miqdar,
              qiymet: line.qiymet,
              ref_nov: "satis_sifarisi",
              ref_id: sale.id,
              edilen_id: istifadeciId,
            },
          });
        }

        // 8. Cash register operation — nisye olarsa kassaya pul düşmür
        if (data.odenis_nov !== "nisye") {
          // QA-K6: qarışıq ödənişdə hər metod AYRICA sətir — kassa hesabatı və
          // gün-sonu nağd/kart/bank bölgüsü düzgün olsun. Split cəmi satış
          // məbləği ilə üst-üstə düşmürsə (drift/köhnə client) nağd hissə
          // fərqi ilə korreksiya edilir; split etibarsızdırsa tək sətir fallback.
          let parts: { nov: "negd" | "kart" | "kecirme"; mebleg: number }[] | null = null;
          if (data.split) {
            const kart = Math.max(0, data.split.kart || 0);
            const kecirme = Math.max(0, data.split.kecirme || 0);
            const negd = +(sonMebleg - kart - kecirme).toFixed(2);
            if (negd >= -0.01 && kart + kecirme > 0.001) {
              parts = [
                { nov: "negd" as const, mebleg: Math.max(0, negd) },
                { nov: "kart" as const, mebleg: kart },
                { nov: "kecirme" as const, mebleg: kecirme },
              ].filter((p) => p.mebleg > 0.001);
            }
          }
          if (!parts || parts.length === 0) {
            parts = [{ nov: data.odenis_nov as "negd" | "kart" | "kecirme", mebleg: sonMebleg }];
          }
          for (const part of parts) {
            await tx.kassa_emeliyyatlari.create({
              data: {
                sahibkar_id: sahibkarId,
                kassa_id: data.kassa_id,
                emeliyyat_nov: "satis",
                odenis_nov: part.nov,
                mebleg: part.mebleg,
                ref_nov: "satis_sifarisi",
                ref_id: sale.id,
                istifadeci_id: istifadeciId,
              },
            });
          }

          // 8b. finance_operations — maliyyə hesabatlarında POS satışları görünsün
          // Hesabatlar (P&L, cashflow) finance_operations üzərindən hesablanır,
          // ona görə POS satışları da bura yazılır. Best-effort: type yoxdursa yarad,
          // səhv olsa rollback etmə (satışı bağlamasın).
          try {
            let type = await tx.finance_operation_types
              .findUnique({ where: { kod: "qaime" } })
              .catch(() => null);
            if (!type) {
              type = await tx.finance_operation_types
                .create({
                  data: { kod: "qaime", ad: "Qaimə", qrup: "qaime", y_n: "daxil", link_satish: true },
                })
                .catch(() => null);
            }
            if (type) {
              // Kassanın bağlı olduğu maliye hesabını tap — finance_op-a yazmaq üçün.
              // Bu hesab POS açılış zamanı seçilmişdir; əgər yoxdursa sahibkar-ın
              // ilk aktiv nağd hesabına fallback.
              // QA-orta: kart/köçürmə pulu nağd kassa hesabına yazılmasın deyə
              // ödəniş növünə uyğun hesab (kart→kart, kecirme→bank) üstün tutulur
              // (satis-actions.ts fallbackNov pattern-i); tapılmasa kassa hesabı.
              // QA-M14: qarışıq ödənişdə finance_operations də HƏR metod üçün AYRICA
              // sətir + öz hesabına yazılsın (əvvəl tam məbləğ tək hesaba düşürdü →
              // kassa split-i düzgün, maliyyə hesabı drift edirdi). `parts` kassa ilə eynidir;
              // non-split satışda tək element → geriyə uyğun.
              const { recalculateAccountBalance } = await import("@/lib/balance/account-balance");
              const touchedAccs = new Set<string>();
              for (const part of parts) {
                let hesabIdForOp: string | null = null;
                if (part.nov === "kart" || part.nov === "kecirme") {
                  const novHesab = await tx.maliye_hesablari.findFirst({
                    where: {
                      sahibkar_id: sahibkarId,
                      aktiv: true,
                      nov: part.nov === "kart" ? "kart" : "bank",
                    },
                    orderBy: { yaradildi: "asc" },
                    select: { id: true },
                  });
                  hesabIdForOp = novHesab?.id ?? null;
                }
                if (!hesabIdForOp) hesabIdForOp = kassa.maliye_hesab_id ?? null;
                if (!hesabIdForOp) {
                  const def = await tx.maliye_hesablari.findFirst({
                    where: { sahibkar_id: sahibkarId, aktiv: true, nov: "negd" },
                    orderBy: { yaradildi: "asc" },
                    select: { id: true },
                  });
                  hesabIdForOp = def?.id ?? null;
                }
                if (!hesabIdForOp) {
                  // SELF-HEAL: heç bir hesab yoxdursa default nağd hesab yarat ki,
                  // pul finance_operations-da hesaba attribute olunsun (drift önlənir).
                  const createdAcc = await tx.maliye_hesablari.create({
                    data: { sahibkar_id: sahibkarId, ad: "Nağd kassa", nov: "negd", qaliq: 0, valyuta: "AZN", aktiv: true },
                    select: { id: true },
                  });
                  hesabIdForOp = createdAcc.id;
                }
                await tx.finance_operations.create({
                  data: {
                    sahibkar_id: sahibkarId,
                    type_id: type.id,
                    type_kod: type.kod,
                    y_n: "daxil",
                    tarix: new Date(),
                    meblegh: new Prisma.Decimal(part.mebleg),
                    valyuta: "AZN",
                    mezenne: 1,
                    azn_meblegh: new Prisma.Decimal(part.mebleg),
                    hesab_id: hesabIdForOp,
                    kontragent_id: data.musteri_id ?? null,
                    satis_id: sale.id,
                    sened_nomresi: posCekNomresi,
                    qeyd: `POS satış #${posCekNomresi} — ${part.nov}`,
                    yaradan_id: istifadeciId,
                  },
                });
                if (hesabIdForOp) touchedAccs.add(hesabIdForOp);
              }
              // Source-of-truth-dan hər toxunulan hesabın qaliqını yenilə
              for (const acc of touchedAccs) {
                await recalculateAccountBalance(acc, tx);
              }
            }
          } catch (e) {
            console.warn("[createSale] finance_operations skipped:", e);
            // Audit — maliyyə hesabatı bu satışı görməyəcək, biri buna baxsın
            financeOpSkipped = e instanceof Error ? e.message : String(e);
          }
        }

        // 9. Müştəri balansı — source-of-truth recalc
        if (data.musteri_id) {
          const { recalculateCustomerBalance } = await import("@/lib/balance/customer-balance");
          await recalculateCustomerBalance(data.musteri_id, tx);
        }

        // 10. 🔒 Loyalty bonus sərfi — SATIŞ TRANSACTION-ında atomik debit (audit K3).
        // Əvvəl bu satışdan SONRA client-dən (fire-and-forget) çağırılırdı: balans
        // çatmayanda/offline-replay-də səssizcə keçirdi → pulsuz endirim. İndi eyni
        // transaction-da guard-lı decrement — balans çatmasa bütün satış geri qayıdır.
        if (serverBonus && serverBonus.mebleg > 0) {
          const dec = await tx.loyalty_cards.updateMany({
            where: { id: serverBonus.kartId, balans: { gte: serverBonus.mebleg } },
            data: {
              balans: { decrement: serverBonus.mebleg },
              total_serf: { increment: serverBonus.mebleg },
              son_alish_de: new Date(),
              yenilendi: new Date(),
            },
          });
          if (dec.count === 0) throw new Error("Loyalty bonus balansı kifayət deyil");
          const afterCard = await tx.loyalty_cards.findUnique({ where: { id: serverBonus.kartId }, select: { balans: true } });
          await tx.loyalty_tx.create({
            data: {
              sahibkar_id: sahibkarId,
              kart_id: serverBonus.kartId,
              satis_id: sale.id,
              nov: "serf",
              mebleg: -serverBonus.mebleg,
              qaliq: Number(afterCard?.balans ?? 0),
              qeyd: `Satış #${posCekNomresi}`,
            },
          });
        }

        return { id: sale.id, nomre, sonMebleg, posCekNomresi, isDuplicate: false };
      }, { timeout: 20_000 });

      revalidatePath("/pos");
      revalidatePath("/dashboard");
      // Dashboard widget cache-i invalidate — KPI, top5, recent activity dərhal yenilənsin
      revalidateTag(`dashboard:${sahibkarId}`, "max");
      revalidateTag(`stok:${sahibkarId}`, "max");

      // Stoku dəyişən məhsulları kanal-larda avtomatik sync — arxa fonda
      emitStockChange(data.lines.map((l) => l.mehsul_id));

      // Kampaniya/kupon istifadəsini qeydə al (audit #10: əvvəl commit olunmurdu —
      // campaign_usage yazılmırdı, kupon/kampaniya sayğacı artmırdı, dead code idi).
      // QA-K7: dup (idempotent təkrar) halında kampaniya/kupon/bonus yan-təsirləri
      // TƏKRARLANMIR — yalnız satış həqiqətən bu çağırışda yarananda işlədilir.
      // DİQQƏT: server-VALİDASİYA olunmuş kampaniyalar yazılır (client dəyəri yox) —
      // uydurma bonus_qazanildi / endirim_mebleg mint bağlanır (audit K1).
      if (!result.isDuplicate && validatedCampaigns.length > 0) {
        try {
          const { commitCampaignApplications } = await import("@/features/kampaniyalar/matcher");
          await commitCampaignApplications(result.id, data.musteri_id ?? null, validatedCampaigns);
        } catch (e) {
          console.warn("[createSale] commitCampaignApplications skipped:", e);
        }
      }

      // Audit: POS satışı — kanal, kassa, ödəniş, məbləğ
      await audit("yarat", "pos_satis", result.id, {
        yeni_data: {
          nomre: result.nomre,
          pos_cek_nomresi: result.posCekNomresi,
          kassa_id: data.kassa_id,
          anbar_id: data.anbar_id,
          musteri_id: data.musteri_id ?? null,
          odenis_nov: data.odenis_nov,
          son_mebleg: result.sonMebleg,
          line_count: data.lines.length,
          endirim_mebleg: effectiveEndirim,
        },
        sebeb: data.odenis_nov === "nisye" ? "POS borca satış" : "POS satış",
      });

      // Əgər finance_operations yaranmadısa — ayrıca xəta auditi ki, biri
      // baxsın və əl ilə düzəltsin (yoxsa hesabatda görünməyəcək).
      if (financeOpSkipped) {
        await safeAuditLog({
          sahibkar_id: sahibkarId,
          istifadeci_id: istifadeciId,
          emeliyyat: "yarat",
          resurs_nov: "finance_operation_skip",
          resurs_id: result.id,
          yeni_data: { error: financeOpSkipped, satis_id: result.id },
          sebeb: "POS satışında finance_operations yaranmadı — hesabat sinxron deyil",
          status: "xeta",
        });
      }

      return {
        ok: true as const,
        satis_id: result.id,
        nomre: result.nomre,
        son_mebleg: result.sonMebleg,
        pos_cek_nomresi: result.posCekNomresi,
      };
    } catch (e) {
      const { logAndFriendly } = await import("@/lib/error/user-message");
      return { ok: false as const, error: logAndFriendly("createSale (POS)", e, "Satış tamamlanmadı") };
    }
  });
}
