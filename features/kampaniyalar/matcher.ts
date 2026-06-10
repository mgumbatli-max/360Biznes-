import "server-only";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { TIER_META, type LoyaltyTier } from "./types";

export type CartLine = {
  mehsul_id: string;
  miqdar: number;
  qiymet: number; // tek vahid
  kateqoriya_id?: number;
};

export type CartContext = {
  lines: CartLine[];
  cemi: number;
  kontragent_id?: string | null;
  filial_id?: number | null;
  kanal?: "pos" | "online" | "marketplace";
  /** Müştərinin ilk satışıdır? (welcome kampaniyaları üçün) */
  is_first_purchase?: boolean;
};

export type AppliedCampaign = {
  campaign_id: string;
  ad: string;
  tip: string;
  endirim_mebleg: number;
  endirim_faiz: number;
  bonus_qazanildi: number;
  free_shipping: boolean;
  qeyd: string;
  /** QA-K8: kupon vasitəsilə gəlibsə — commit zamanı coupons.current_uses artır. */
  coupon_id?: string;
};

/**
 * POS engine — verilmiş cart üçün uyğun ən yaxşı kampaniyaları tapır və hesablayır.
 *
 * Qaydalar:
 *  1. Yalnız status="active", baslama ≤ now ≤ bitme aralığında olan kampaniyalar
 *  2. Kanal filtri (NULL = bütün, məs. ["pos"])
 *  3. Filial filtri (NULL = bütün)
 *  4. Limit yoxlaması (max_uses, max_per_user)
 *  5. Şərt yoxlaması (min_cart, first_purchase, müştəri tier və s.)
 *  6. Stackable olmayanlar → ən yüksək prioritetli + ən çox endirim verən seçilir
 *  7. Stackable olanlar bir-birini tamamlayır
 */
export async function findApplicableCampaigns(cart: CartContext): Promise<AppliedCampaign[]> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const now = new Date();

    // Aktiv kampaniyaları çək
    const campaigns = await prisma.campaigns.findMany({
      where: {
        status: "active",
        baslama: { lte: now },
        OR: [{ bitme: null }, { bitme: { gt: now } }],
      },
      orderBy: [{ prioritet: "desc" }, { yaradildi: "desc" }],
    });

    // Müştəri loyalty kartı (tier üçün)
    let loyaltyCard: { tier: LoyaltyTier } | null = null;
    if (cart.kontragent_id) {
      const lc = await prisma.loyalty_cards.findFirst({
        where: { kontragent_id: cart.kontragent_id, aktiv: true },
        select: { tier: true },
      });
      if (lc) loyaltyCard = { tier: lc.tier as LoyaltyTier };
    }

    // Bu müştərinin əvvəlki kampaniya istifadəsi (max_per_user üçün)
    const customerUsage = cart.kontragent_id
      ? await prisma.campaign_usage.groupBy({
          by: ["campaign_id"],
          where: { kontragent_id: cart.kontragent_id },
          _count: true,
        })
      : [];
    const userUsageMap = new Map(customerUsage.map((u) => [u.campaign_id, u._count]));

    const applied: AppliedCampaign[] = [];
    let cartAfterDiscount = cart.cemi;

    for (const c of campaigns) {
      // ── Kanal filtri ──
      if (c.hedef_kanal && c.hedef_kanal.length > 0 && cart.kanal && !c.hedef_kanal.includes(cart.kanal)) continue;
      // ── Filial filtri ──
      if (c.hedef_filial_ids && c.hedef_filial_ids.length > 0 && cart.filial_id && !c.hedef_filial_ids.includes(cart.filial_id)) continue;
      // ── Cəm limit ──
      if (c.max_uses && c.current_uses >= c.max_uses) continue;
      // ── Müştəri başına limit ──
      if (c.max_per_user && cart.kontragent_id) {
        const used = userUsageMap.get(c.id) ?? 0;
        if (used >= c.max_per_user) continue;
      }

      const rules = (c.rules_json ?? {}) as Record<string, unknown>;
      const action = (c.action_json ?? {}) as Record<string, unknown>;

      // ── Şərtlər ──
      // 1. Min səbət dəyəri
      if (typeof rules.min_cart === "number" && cartAfterDiscount < rules.min_cart) continue;
      // 2. İlk satış (welcome)
      if (rules.first_purchase_only === true && !cart.is_first_purchase) continue;
      // 3. Vaxt aralığı (gün)
      if (typeof rules.time_window === "object" && rules.time_window) {
        const tw = rules.time_window as { from?: string; to?: string };
        const hh = now.getHours() * 60 + now.getMinutes();
        if (tw.from) {
          const [h, m] = tw.from.split(":").map(Number);
          if (hh < h * 60 + m) continue;
        }
        if (tw.to) {
          const [h, m] = tw.to.split(":").map(Number);
          if (hh > h * 60 + m) continue;
        }
      }

      // ── Action hesabı ──
      let endirimMebleg = 0;
      let bonusQazanildi = 0;
      let freeShipping = false;
      let qeyd = "";

      const discountType = action.discount_type as string | undefined;
      const value = Number(action.value ?? 0);

      if (discountType === "percent") {
        endirimMebleg = Math.round((cartAfterDiscount * value) / 100 * 100) / 100;
        qeyd = `${value}% endirim`;
      } else if (discountType === "fixed") {
        endirimMebleg = Math.min(value, cartAfterDiscount);
        qeyd = `${value} ₼ endirim`;
      } else if (discountType === "tiered") {
        // Pilləli: ən böyük tier-i tap
        const tiers = (rules.tiers ?? []) as { min_qty: number; discount_pct: number }[];
        const totalQty = cart.lines.reduce((s, l) => s + l.miqdar, 0);
        const matched = tiers.filter((t) => totalQty >= t.min_qty).sort((a, b) => b.discount_pct - a.discount_pct)[0];
        if (matched) {
          endirimMebleg = Math.round((cartAfterDiscount * matched.discount_pct) / 100 * 100) / 100;
          qeyd = `${matched.discount_pct}% pilləli endirim (${totalQty} ədəd)`;
        } else {
          continue; // Pillə uyğun gəlmir
        }
      }

      if (action.free_shipping === true) {
        freeShipping = true;
        qeyd = qeyd ? `${qeyd} + pulsuz çatdırılma` : "Pulsuz çatdırılma";
      }

      // Loyalty bonus
      if (c.tip === "loyalty") {
        const bonusPct = loyaltyCard
          ? TIER_META[loyaltyCard.tier].bonusPct
          : Number(action.bonus_pct ?? 0);
        if (bonusPct > 0) {
          bonusQazanildi = Math.round((cartAfterDiscount * bonusPct) / 100 * 100) / 100;
          qeyd = qeyd || `${bonusPct}% bonus`;
        }
      }

      // BOGO basitləşdirilmiş: ən ucuz məhsulun qiyməti qədər endirim
      if (c.tip === "bogo" && cart.lines.length >= 2) {
        const cheapest = Math.min(...cart.lines.map((l) => l.qiymet));
        const pct = Number(action.value ?? 100);
        endirimMebleg = Math.round((cheapest * pct) / 100 * 100) / 100;
        qeyd = `BOGO ${pct}% (ən ucuz məhsul)`;
      }

      if (endirimMebleg === 0 && bonusQazanildi === 0 && !freeShipping) continue;

      applied.push({
        campaign_id: c.id,
        ad: c.ad,
        tip: c.tip,
        endirim_mebleg: endirimMebleg,
        endirim_faiz: cart.cemi > 0 ? Math.round((endirimMebleg / cart.cemi) * 1000) / 10 : 0,
        bonus_qazanildi: bonusQazanildi,
        free_shipping: freeShipping,
        qeyd,
      });

      // Stackable olmayan → ilki tap, dayan
      if (!c.stackable) {
        return applied;
      }
      // Stackable → cart-dan çıxar, sonrakı kampaniya azalmış cart üzərində hesablansın
      cartAfterDiscount = Math.max(0, cartAfterDiscount - endirimMebleg);
    }

    return applied;
  });
}

/**
 * Tətbiq olunmuş kampaniyaları DB-yə yazır + sayğacları artırır + bonus toplayır.
 * Satış tamamlandıqdan sonra çağırılır.
 */
export async function commitCampaignApplications(
  satisId: string,
  kontragentId: string | null,
  applied: AppliedCampaign[],
): Promise<{ ok: true; bonusAdded: number } | { ok: false; error: string }> {
  if (applied.length === 0) return { ok: true, bonusAdded: 0 };
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    try {
      let bonusAdded = 0;
      for (const a of applied) {
        // QA-K7: idempotentlik — eyni satış üçün eyni kampaniya artıq qeyd
        // olunubsa (offline retry / double-submit) təkrar yazma, sayğac artırma,
        // bonus toplama.
        const existing = await prisma.campaign_usage.findFirst({
          where: { satis_id: satisId, campaign_id: a.campaign_id },
          select: { id: true },
        });
        if (existing) continue;

        await prisma.campaign_usage.create({
          data: {
            sahibkar_id: sahibkarId,
            campaign_id: a.campaign_id,
            satis_id: satisId,
            kontragent_id: kontragentId,
            endirim_mebleg: a.endirim_mebleg,
            bonus_qazanildi: a.bonus_qazanildi,
            bonus_serf: 0,
          },
        });
        await prisma.campaigns.update({
          where: { id: a.campaign_id },
          data: { current_uses: { increment: 1 }, yenilendi: new Date() },
        });
        // QA-K8: kupon istifadə sayğacı — əvvəl HEÇ artırılmırdı (max_uses=1
        // kupon sonsuz işləyirdi). Atomic guard: limiti keçmiş kuponu artırma.
        if (a.coupon_id) {
          await prisma.coupons.updateMany({
            where: { id: a.coupon_id },
            data: { current_uses: { increment: 1 } },
          });
        }

        // Loyalty bonus accrual
        if (a.bonus_qazanildi > 0 && kontragentId) {
          const card = await prisma.loyalty_cards.findFirst({ where: { kontragent_id: kontragentId } });
          if (card) {
            const yeniBalans = Number(card.balans) + a.bonus_qazanildi;
            await prisma.loyalty_cards.update({
              where: { id: card.id },
              data: {
                balans: yeniBalans,
                total_qazanc: { increment: a.bonus_qazanildi },
                son_alish_de: new Date(),
                yenilendi: new Date(),
              },
            });
            await prisma.loyalty_tx.create({
              data: {
                sahibkar_id: sahibkarId,
                kart_id: card.id,
                satis_id: satisId,
                nov: "qazandi",
                mebleg: a.bonus_qazanildi,
                qaliq: yeniBalans,
                qeyd: `Satış #${satisId.slice(0, 8)} — ${a.ad}`,
              },
            });
            bonusAdded += a.bonus_qazanildi;
          }
        }
      }
      return { ok: true, bonusAdded };
    } catch (e) {
      console.error("[commitCampaignApplications]", e);
      return { ok: false, error: "Tətbiq qeyd olunmadı" };
    }
  });
}

/**
 * Kupon kod-əsaslı yoxlama. POS-da əl ilə daxil edilir.
 */
export async function applyCoupon(kod: string, cart: CartContext): Promise<{ ok: true; applied: AppliedCampaign } | { ok: false; error: string }> {
  if (!kod || kod.length < 2) return { ok: false, error: "Kod daxil edin" };
  return withTenant(async () => {
    const now = new Date();
    const coupon = await prisma.coupons.findFirst({
      where: {
        kod: kod.toUpperCase(),
        aktiv: true,
        OR: [{ bitme_tarixi: null }, { bitme_tarixi: { gt: now } }],
      },
      include: { campaigns: true },
    });
    if (!coupon) return { ok: false, error: "Kupon tapılmadı və ya bitib" };
    if (coupon.current_uses >= coupon.max_uses) return { ok: false, error: "Kupon limiti dolub" };
    if (coupon.kontragent_id && coupon.kontragent_id !== cart.kontragent_id) {
      return { ok: false, error: "Bu kupon başqa müştəri üçündür" };
    }
    // Coupon-un əsl kampaniyasını eyni yolla hesabla
    const fakeCart = { ...cart };
    // Tək kampaniyanı zorla əlavə et
    const c = coupon.campaigns;
    if (!c || c.status !== "active") return { ok: false, error: "Kampaniya aktiv deyil" };

    const action = (c.action_json ?? {}) as Record<string, unknown>;
    const discountType = action.discount_type as string | undefined;
    const value = Number(action.value ?? 0);

    if (!discountType || !Number.isFinite(value) || value <= 0) {
      return {
        ok: false,
        error: "Kampaniya ayarları natamamdır — admin endirim faizini təyin etməlidir",
      };
    }

    let endirimMebleg = 0;
    let qeyd = "";

    if (discountType === "percent") {
      endirimMebleg = Math.round((cart.cemi * value) / 100 * 100) / 100;
      qeyd = `${value}% endirim (kupon: ${coupon.kod})`;
    } else if (discountType === "fixed") {
      endirimMebleg = Math.min(value, cart.cemi);
      qeyd = `${value} ₼ endirim (kupon: ${coupon.kod})`;
    }

    if (endirimMebleg <= 0) return { ok: false, error: "Kupondan endirim hesablanmadı" };

    return {
      ok: true,
      applied: {
        campaign_id: c.id,
        ad: c.ad,
        tip: c.tip,
        endirim_mebleg: endirimMebleg,
        endirim_faiz: cart.cemi > 0 ? Math.round((endirimMebleg / cart.cemi) * 1000) / 10 : 0,
        bonus_qazanildi: 0,
        free_shipping: false,
        qeyd,
        coupon_id: coupon.id, // QA-K8: commit-də coupons.current_uses artırılsın
      },
    };
  });
}
