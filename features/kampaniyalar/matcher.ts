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

// Prisma campaigns modelinin yüngül tipi (validate + engine paylaşımı üçün).
type CampaignRow = {
  id: string;
  ad: string;
  tip: string;
  status: string;
  baslama: Date;
  bitme: Date | null;
  prioritet: number;
  stackable: boolean;
  max_uses: number | null;
  current_uses: number;
  max_per_user: number | null;
  hedef_kanal: string[] | null;
  hedef_filial_ids: number[] | null;
  rules_json: unknown;
  action_json: unknown;
};

/**
 * Kampaniya şərt yoxlaması (min_cart, ilk-satış, vaxt-aralığı, kanal, filial).
 * findApplicableCampaigns, applyCoupon və validateAppliedCampaigns arasında
 * paylaşılır ki, kupon yolu normal engine ilə eyni şərtlərdən keçsin (audit #7).
 * max_uses/max_per_user ayrıca yoxlanır (userUsageMap/current_uses lazımdır).
 */
function passesCampaignConditions(c: CampaignRow, cart: CartContext, cartBase: number): boolean {
  const now = new Date();
  // ── Tarix aralığı ──
  if (!(c.baslama instanceof Date) || c.baslama.getTime() > now.getTime()) return false;
  if (c.bitme && c.bitme.getTime() <= now.getTime()) return false;
  // ── Kanal filtri ──
  if (c.hedef_kanal && c.hedef_kanal.length > 0 && cart.kanal && !c.hedef_kanal.includes(cart.kanal)) return false;
  // ── Filial filtri ──
  if (c.hedef_filial_ids && c.hedef_filial_ids.length > 0 && cart.filial_id && !c.hedef_filial_ids.includes(cart.filial_id)) return false;

  const rules = (c.rules_json ?? {}) as Record<string, unknown>;
  // 1. Min səbət dəyəri
  if (typeof rules.min_cart === "number" && cartBase < rules.min_cart) return false;
  // 2. İlk satış (welcome)
  if (rules.first_purchase_only === true && !cart.is_first_purchase) return false;
  // 3. Vaxt aralığı (gün ərzində saat)
  if (typeof rules.time_window === "object" && rules.time_window) {
    const tw = rules.time_window as { from?: string; to?: string };
    const hh = now.getHours() * 60 + now.getMinutes();
    if (tw.from) {
      const [h, m] = tw.from.split(":").map(Number);
      if (hh < h * 60 + m) return false;
    }
    if (tw.to) {
      const [h, m] = tw.to.split(":").map(Number);
      if (hh > h * 60 + m) return false;
    }
  }
  return true;
}

/**
 * Action hesabı — bir kampaniya üçün endirim/bonus/free-shipping.
 * cartBase = (stackable üçün) əvvəlki endirimlərdən sonra qalan səbət dəyəri.
 */
function computeCampaignAmounts(
  c: CampaignRow,
  cart: CartContext,
  cartBase: number,
  loyaltyTier: LoyaltyTier | null,
): { endirimMebleg: number; bonusQazanildi: number; freeShipping: boolean; qeyd: string } {
  let endirimMebleg = 0;
  let bonusQazanildi = 0;
  let freeShipping = false;
  let qeyd = "";

  const rules = (c.rules_json ?? {}) as Record<string, unknown>;
  const action = (c.action_json ?? {}) as Record<string, unknown>;
  const discountType = action.discount_type as string | undefined;
  const value = Number(action.value ?? 0);

  if (discountType === "percent") {
    endirimMebleg = Math.round((cartBase * value) / 100 * 100) / 100;
    qeyd = `${value}% endirim`;
  } else if (discountType === "fixed") {
    endirimMebleg = Math.min(value, cartBase);
    qeyd = `${value} ₼ endirim`;
  } else if (discountType === "tiered") {
    const tiers = (rules.tiers ?? []) as { min_qty: number; discount_pct: number }[];
    const totalQty = cart.lines.reduce((s, l) => s + l.miqdar, 0);
    const matched = tiers.filter((t) => totalQty >= t.min_qty).sort((a, b) => b.discount_pct - a.discount_pct)[0];
    if (matched) {
      endirimMebleg = Math.round((cartBase * matched.discount_pct) / 100 * 100) / 100;
      qeyd = `${matched.discount_pct}% pilləli endirim (${totalQty} ədəd)`;
    }
  }

  if (action.free_shipping === true) {
    freeShipping = true;
    qeyd = qeyd ? `${qeyd} + pulsuz çatdırılma` : "Pulsuz çatdırılma";
  }

  // Loyalty bonus
  if (c.tip === "loyalty") {
    const bonusPct = loyaltyTier ? TIER_META[loyaltyTier].bonusPct : Number(action.bonus_pct ?? 0);
    if (bonusPct > 0) {
      bonusQazanildi = Math.round((cartBase * bonusPct) / 100 * 100) / 100;
      qeyd = qeyd || `${bonusPct}% bonus`;
    }
  }

  // BOGO sadələşdirilmiş: ən ucuz məhsulun qiyməti qədər endirim
  if (c.tip === "bogo" && cart.lines.length >= 2) {
    const cheapest = Math.min(...cart.lines.map((l) => l.qiymet));
    const pct = Number(action.value ?? 100);
    endirimMebleg = Math.round((cheapest * pct) / 100 * 100) / 100;
    qeyd = `BOGO ${pct}% (ən ucuz məhsul)`;
  }

  return { endirimMebleg, bonusQazanildi, freeShipping, qeyd };
}

async function loadLoyaltyTier(kontragentId: string | null | undefined): Promise<LoyaltyTier | null> {
  if (!kontragentId) return null;
  const lc = await prisma.loyalty_cards.findFirst({
    where: { kontragent_id: kontragentId, aktiv: true },
    select: { tier: true },
  });
  return lc ? (lc.tier as LoyaltyTier) : null;
}

/**
 * POS engine — verilmiş cart üçün uyğun ən yaxşı kampaniyaları tapır və hesablayır.
 */
export async function findApplicableCampaigns(cart: CartContext): Promise<AppliedCampaign[]> {
  return withTenant(async () => {
    const now = new Date();

    const campaigns = (await prisma.campaigns.findMany({
      where: {
        status: "active",
        baslama: { lte: now },
        OR: [{ bitme: null }, { bitme: { gt: now } }],
      },
      orderBy: [{ prioritet: "desc" }, { yaradildi: "desc" }],
    })) as unknown as CampaignRow[];

    const loyaltyTier = await loadLoyaltyTier(cart.kontragent_id);

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
      // ── Cəm limit ──
      if (c.max_uses && c.current_uses >= c.max_uses) continue;
      // ── Müştəri başına limit ──
      if (c.max_per_user && cart.kontragent_id) {
        const used = userUsageMap.get(c.id) ?? 0;
        if (used >= c.max_per_user) continue;
      }
      // ── Şərtlər (kanal, filial, min_cart, first_purchase, time_window, tarix) ──
      if (!passesCampaignConditions(c, cart, cartAfterDiscount)) continue;

      const { endirimMebleg, bonusQazanildi, freeShipping, qeyd } = computeCampaignAmounts(c, cart, cartAfterDiscount, loyaltyTier);
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
      if (!c.stackable) return applied;
      // Stackable → azalmış cart üzərində sonrakılar
      cartAfterDiscount = Math.max(0, cartAfterDiscount - endirimMebleg);
    }

    return applied;
  });
}

/**
 * 🔒 SERVER-AVTORİTATİV YENİDƏN VALİDASİYA (audit K1/K2 kritik).
 *
 * POS satışında client `applied_campaigns` massivi (endirim_mebleg, bonus_qazanildi,
 * campaign_id, coupon_id) tamamilə client-dən gəlir. Bu funksiya HƏR girişi DB-dən
 * yenidən yoxlayır (aktiv, tarix-daxili, limit-daxili, tenant-daxili) və məbləğləri
 * SERVER hesabından götürür — client dəyərlərinə ETİBAR ETMİR. Yanlış/keçərsiz
 * girişlər atılır. Nəticə həm endirim-limit yoxlamasında, həm də commit-də istifadə
 * olunmalıdır. Beləcə fabrik kampaniya ilə endirim uydurma / bonus mint bağlanır.
 */
export async function validateAppliedCampaigns(
  clientApplied: { campaign_id?: string; coupon_id?: string }[] | undefined,
  cart: CartContext,
): Promise<AppliedCampaign[]> {
  if (!clientApplied || clientApplied.length === 0) return [];
  return withTenant(async () => {
    try {
    const loyaltyTier = await loadLoyaltyTier(cart.kontragent_id);
    const customerUsage = cart.kontragent_id
      ? await prisma.campaign_usage.groupBy({
          by: ["campaign_id"],
          where: { kontragent_id: cart.kontragent_id },
          _count: true,
        })
      : [];
    const userUsageMap = new Map(customerUsage.map((u) => [u.campaign_id, u._count]));

    const out: AppliedCampaign[] = [];
    const seenCoupons = new Set<string>();
    const seenCampaigns = new Set<string>();
    let cartBase = cart.cemi;

    for (const entry of clientApplied) {
      // ── KUPON YOLU ──
      if (entry.coupon_id) {
        if (seenCoupons.has(entry.coupon_id)) continue;
        const now = new Date();
        const coupon = await prisma.coupons.findFirst({
          where: {
            id: entry.coupon_id,
            aktiv: true,
            OR: [{ bitme_tarixi: null }, { bitme_tarixi: { gt: now } }],
          },
          include: { campaigns: true },
        });
        if (!coupon) continue;
        if (coupon.current_uses >= coupon.max_uses) continue;
        if (coupon.kontragent_id && coupon.kontragent_id !== cart.kontragent_id) continue;
        const c = coupon.campaigns as unknown as CampaignRow | null;
        if (!c || c.status !== "active") continue;
        if (!passesCampaignConditions(c, cart, cartBase)) continue;
        const amt = computeCampaignAmounts(c, cart, cartBase, loyaltyTier);
        // Kupon yolu bonus qazandırmır (yalnız endirim) — mövcud davranışa sadiq.
        if (amt.endirimMebleg <= 0) continue;
        seenCoupons.add(entry.coupon_id);
        out.push({
          campaign_id: c.id,
          ad: c.ad,
          tip: c.tip,
          endirim_mebleg: amt.endirimMebleg,
          endirim_faiz: cart.cemi > 0 ? Math.round((amt.endirimMebleg / cart.cemi) * 1000) / 10 : 0,
          bonus_qazanildi: 0,
          free_shipping: amt.freeShipping,
          qeyd: `${amt.qeyd} (kupon)`,
          coupon_id: coupon.id,
        });
        cartBase = Math.max(0, cartBase - amt.endirimMebleg);
        continue;
      }

      // ── AVTO-KAMPANIYA YOLU ──
      if (!entry.campaign_id || seenCampaigns.has(entry.campaign_id)) continue;
      const c = (await prisma.campaigns.findFirst({ where: { id: entry.campaign_id } })) as unknown as CampaignRow | null;
      if (!c || c.status !== "active") continue;
      if (c.max_uses && c.current_uses >= c.max_uses) continue;
      if (c.max_per_user && cart.kontragent_id && (userUsageMap.get(c.id) ?? 0) >= c.max_per_user) continue;
      if (!passesCampaignConditions(c, cart, cartBase)) continue;
      const amt = computeCampaignAmounts(c, cart, cartBase, loyaltyTier);
      if (amt.endirimMebleg <= 0 && amt.bonusQazanildi <= 0 && !amt.freeShipping) continue;
      seenCampaigns.add(entry.campaign_id);
      out.push({
        campaign_id: c.id,
        ad: c.ad,
        tip: c.tip,
        endirim_mebleg: amt.endirimMebleg,
        endirim_faiz: cart.cemi > 0 ? Math.round((amt.endirimMebleg / cart.cemi) * 1000) / 10 : 0,
        bonus_qazanildi: amt.bonusQazanildi,
        free_shipping: amt.freeShipping,
        qeyd: amt.qeyd,
      });
      cartBase = Math.max(0, cartBase - amt.endirimMebleg);
    }

    return out;
    } catch (e) {
      // Fail-safe: validasiya səhvi satışı bloklamamalı — endirim tətbiq olunmasa da
      // (müştəri tam məbləği ödəyir) pul itkisi olmur.
      console.error("[validateAppliedCampaigns]", e);
      return [];
    }
  });
}

/**
 * 🔒 Bonus sərfini server-də validasiya et (audit #6 major).
 *
 * Client (pos-loyalty-widget) yalnız max_serf_pct / min_serf_meblegh limitini
 * tətbiq edir — server heç yoxlamırdı, ona görə istənilən balans istənilən satışa
 * sərf oluna bilirdi. Bu funksiya kart balansı + tenant ayarları (max_serf_pct,
 * min_serf_meblegh) + səbət dəyəri əsasında icazə verilən maksimal sərfi qaytarır.
 * @returns { mebleg, kartId } və ya null (sərf icazəsi yoxdur).
 */
export async function validateBonusSpend(
  kontragentId: string,
  requested: number,
  cartTotal: number,
): Promise<{ mebleg: number; kartId: string } | null> {
  if (!(requested > 0)) return null;
  return withTenant(async () => {
    try {
      const card = await prisma.loyalty_cards.findFirst({
        where: { kontragent_id: kontragentId, aktiv: true },
        select: { id: true, balans: true },
      });
      if (!card) return null;
      const settings = await prisma.ayarlar.findMany({
        where: { qrup: "loyalty", acar: { in: ["max_serf_pct", "min_serf_meblegh"] } },
        select: { acar: true, deyer: true },
      });
      const map = new Map(settings.map((s) => [s.acar, s.deyer]));
      const maxPct = Number(map.get("max_serf_pct") ?? 30);
      const minMebl = Number(map.get("min_serf_meblegh") ?? 5);
      const balans = Number(card.balans);
      const pctCap = maxPct > 0 ? Math.round((cartTotal * maxPct) / 100 * 100) / 100 : cartTotal;
      const allowed = Math.max(0, Math.round(Math.min(requested, balans, cartTotal, pctCap) * 100) / 100);
      if (allowed <= 0 || allowed < minMebl) return null;
      return { mebleg: allowed, kartId: card.id };
    } catch (e) {
      // Fail-safe: bonus validasiya səhvi satışı bloklamamalı (sərf tətbiq olunmaz).
      console.error("[validateBonusSpend]", e);
      return null;
    }
  });
}

/**
 * Tətbiq olunmuş kampaniyaları DB-yə yazır + sayğacları artırır + bonus toplayır.
 * Satış tamamlandıqdan sonra çağırılır. DİQQƏT: `applied` server-avtoritativ
 * olmalıdır (validateAppliedCampaigns-dən) — client dəyəri birbaşa ötürülməməlidir.
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
        // Hər tətbiq atomik bir transaction-da — qismən uğursuzluqda ledger drift
        // olmasın (audit: campaign_usage transaction xarici idi).
        const added = await prisma.$transaction(async (tx) => {
          // QA-K7: idempotentlik — eyni satış+kampaniya təkrarı (offline retry /
          // double-submit) yenidən yazmasın.
          const existing = await tx.campaign_usage.findFirst({
            where: { satis_id: satisId, campaign_id: a.campaign_id },
            select: { id: true },
          });
          if (existing) return 0;

          await tx.campaign_usage.create({
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
          await tx.campaigns.update({
            where: { id: a.campaign_id },
            data: { current_uses: { increment: 1 }, yenilendi: new Date() },
          });

          // QA-K8: kupon sayğacı — atomik + limit guard (max_uses-ə çatıbsa artırma).
          // Paralel satışda birdəfəlik kuponun ikiqat işləməsinin qarşısını alır.
          if (a.coupon_id) {
            const cp = await tx.coupons.findFirst({ where: { id: a.coupon_id }, select: { max_uses: true } });
            if (cp) {
              await tx.coupons.updateMany({
                where: { id: a.coupon_id, current_uses: { lt: cp.max_uses } },
                data: { current_uses: { increment: 1 } },
              });
            }
          }

          // Loyalty bonus accrual — ATOMİK increment (əvvəl oxu-hesabla-yaz race idi).
          if (a.bonus_qazanildi > 0 && kontragentId) {
            const card = await tx.loyalty_cards.findFirst({
              where: { kontragent_id: kontragentId },
              select: { id: true },
            });
            if (card) {
              await tx.loyalty_cards.update({
                where: { id: card.id },
                data: {
                  balans: { increment: a.bonus_qazanildi },
                  total_qazanc: { increment: a.bonus_qazanildi },
                  son_alish_de: new Date(),
                  yenilendi: new Date(),
                },
              });
              const after = await tx.loyalty_cards.findUnique({ where: { id: card.id }, select: { balans: true } });
              await tx.loyalty_tx.create({
                data: {
                  sahibkar_id: sahibkarId,
                  kart_id: card.id,
                  satis_id: satisId,
                  nov: "qazandi",
                  mebleg: a.bonus_qazanildi,
                  qaliq: Number(after?.balans ?? 0),
                  qeyd: `Satış #${satisId.slice(0, 8)} — ${a.ad}`,
                },
              });
              return a.bonus_qazanildi;
            }
          }
          return 0;
        });
        bonusAdded += added;
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
 * findApplicableCampaigns ilə eyni şərtlərdən keçir (audit #7 — əvvəl min_cart,
 * tarix aralığı, kanal/filial atlanırdı).
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
    const c = coupon.campaigns as unknown as CampaignRow | null;
    if (!c || c.status !== "active") return { ok: false, error: "Kampaniya aktiv deyil" };
    // 🔒 Kampaniya şərtləri (tarix, min_cart, kanal, filial, time_window) — audit #7.
    if (!passesCampaignConditions(c, cart, cart.cemi)) {
      return { ok: false, error: "Kupon bu səbətə uyğun deyil (şərtlər ödənmir)" };
    }

    const action = (c.action_json ?? {}) as Record<string, unknown>;
    const discountType = action.discount_type as string | undefined;
    const value = Number(action.value ?? 0);
    if (!discountType || !Number.isFinite(value) || value <= 0) {
      return { ok: false, error: "Kampaniya ayarları natamamdır — admin endirim faizini təyin etməlidir" };
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
        coupon_id: coupon.id,
      },
    };
  });
}
