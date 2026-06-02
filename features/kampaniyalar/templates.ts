/**
 * Hazır kampaniya şablonları — dünya praktikasından inspirasiya.
 * Sahibkar bir kliklə bunlardan birini götürüb öz biznesinə uyğunlaşdıra bilir.
 */

import type { KampaniyaTip } from "./types";

export type KampaniyaTemplate = {
  kod: string;
  ad: string;
  emoji: string;
  qisa: string;        // 1-sətr təsvir
  tip: KampaniyaTip;
  rules: Record<string, unknown>;
  action: Record<string, unknown>;
  reng: string;
  /** Hansı sahibkara uyğundur (texniki, retail, restoran və s.) */
  uygun: string[];
};

export const TEMPLATES: KampaniyaTemplate[] = [
  // ── ENDİRİM ──
  {
    kod: "yeni-musteri-10",
    ad: "Yeni müştəri 10% endirim",
    emoji: "👋",
    qisa: "İlk satışda 10% endirim — müştəri qazanma kampaniyası",
    tip: "welcome",
    rules: { first_purchase_only: true },
    action: { discount_type: "percent", value: 10 },
    reng: "from-teal-500 to-cyan-600",
    uygun: ["retail", "restaurant", "service"],
  },
  {
    kod: "dogum-gunu-bonus",
    ad: "Doğum günü bonusu",
    emoji: "🎂",
    qisa: "Doğum günü 10₼ bonus + 15% endirim həftə boyu",
    tip: "doğum_gunu",
    rules: { trigger: "birthday", window_days: 7 },
    action: { bonus_amount: 10, discount_type: "percent", value: 15 },
    reng: "from-pink-500 to-rose-600",
    uygun: ["retail", "restaurant", "service"],
  },
  {
    kod: "novruz-special",
    ad: "Novruz xüsusi 20%",
    emoji: "🌱",
    qisa: "Novruz həftəsi bütün məhsullara 20% endirim",
    tip: "percent_endirim",
    rules: { date_range: { start: "2026-03-15", end: "2026-03-22" } },
    action: { discount_type: "percent", value: 20, scope: "all" },
    reng: "from-emerald-500 to-green-600",
    uygun: ["retail", "restaurant"],
  },
  {
    kod: "yeni-il-15",
    ad: "Yeni İl 15% + pulsuz çatdırılma",
    emoji: "🎄",
    qisa: "Yeni il endirim + çatdırılma pulsuz",
    tip: "percent_endirim",
    rules: { date_range: { start: "2026-12-20", end: "2026-12-31" } },
    action: { discount_type: "percent", value: 15, free_shipping: true },
    reng: "from-red-500 to-rose-700",
    uygun: ["retail"],
  },

  // ── BOGO ──
  {
    kod: "bogo-2nd-50",
    ad: "İkinci məhsul 50% endirim",
    emoji: "🎁",
    qisa: "1 məhsul tam qiymət, 2-cisi 50% endirim",
    tip: "bogo",
    rules: { buy_qty: 1, get_qty: 1 },
    action: { discount_type: "percent", value: 50, applies_to: "cheapest" },
    reng: "from-pink-500 to-fuchsia-600",
    uygun: ["retail"],
  },
  {
    kod: "bogo-free",
    ad: "Al-bir Al-bir (2-ci pulsuz)",
    emoji: "🎁",
    qisa: "1 alın 1 pulsuz — eyni qiymətə",
    tip: "bogo",
    rules: { buy_qty: 1, get_qty: 1, same_product: true },
    action: { discount_type: "percent", value: 100, applies_to: "cheapest" },
    reng: "from-purple-500 to-pink-600",
    uygun: ["retail", "restaurant"],
  },

  // ── PİLLƏLİ ──
  {
    kod: "topdan-pille",
    ad: "Topdan pilləli endirim",
    emoji: "📊",
    qisa: "5+ ədəd -5% / 10+ -10% / 50+ -15%",
    tip: "pillevari",
    rules: {
      tiers: [
        { min_qty: 5, discount_pct: 5 },
        { min_qty: 10, discount_pct: 10 },
        { min_qty: 50, discount_pct: 15 },
      ],
    },
    action: { discount_type: "tiered" },
    reng: "from-indigo-500 to-blue-700",
    uygun: ["retail", "wholesale"],
  },

  // ── SƏBƏT ──
  {
    kod: "sebet-50-pulsuz",
    ad: "50₼+ səbətə pulsuz çatdırılma",
    emoji: "🚚",
    qisa: "Səbət 50₼-dən çoxdursa çatdırılma sahibkarın hesabına",
    tip: "pulsuz_catdirilma",
    rules: { min_cart: 50 },
    action: { free_shipping: true },
    reng: "from-blue-500 to-sky-600",
    uygun: ["retail"],
  },
  {
    kod: "sebet-100-10",
    ad: "100₼+ səbətə 10% endirim",
    emoji: "🛒",
    qisa: "Səbət 100₼-dən böyükdürsə avtomatik 10% endirim",
    tip: "sebet_endirim",
    rules: { min_cart: 100 },
    action: { discount_type: "percent", value: 10 },
    reng: "from-violet-500 to-purple-600",
    uygun: ["retail"],
  },

  // ── LOYALTY ──
  {
    kod: "loyalty-standart",
    ad: "Standart loyalty proqram (Bronze→Platinum)",
    emoji: "⭐",
    qisa: "4 səviyyəli sadiqlik — hər satışdan bonus + tier endirim",
    tip: "loyalty",
    rules: { tier_thresholds: [0, 500, 2000, 5000] },
    action: { bonus_pct_by_tier: [1, 2, 3, 5], discount_pct_by_tier: [0, 3, 5, 8] },
    reng: "from-amber-500 to-orange-600",
    uygun: ["retail", "restaurant", "service"],
  },
  {
    kod: "cashback-3",
    ad: "Hər satışdan 3% cashback",
    emoji: "💸",
    qisa: "Hər alışdan 3% kartda toplanır, sonrakı alışda istifadə",
    tip: "loyalty",
    rules: {},
    action: { bonus_pct: 3 },
    reng: "from-emerald-500 to-teal-600",
    uygun: ["retail", "restaurant"],
  },

  // ── KUPON ──
  {
    kod: "kupon-10",
    ad: "Reklam kuponu (10% endirim)",
    emoji: "🎟",
    qisa: "Sosial şəbəkə reklamı üçün kupon — `REKLAM10`",
    tip: "coupon",
    rules: { coupon_codes: ["REKLAM10"], max_uses_total: 1000 },
    action: { discount_type: "percent", value: 10 },
    reng: "from-rose-500 to-pink-600",
    uygun: ["retail", "online"],
  },

  // ── FLASH SALE ──
  {
    kod: "flash-2saat",
    ad: "2 saatlıq Flash Sale 30%",
    emoji: "⚡",
    qisa: "Bu gün 18:00-20:00 arası 30% endirim",
    tip: "flash_sale",
    rules: { time_window: { from: "18:00", to: "20:00" }, days: 1 },
    action: { discount_type: "percent", value: 30 },
    reng: "from-rose-600 to-red-700",
    uygun: ["retail", "restaurant"],
  },

  // ── REAKTİVLƏŞDIR ──
  {
    kod: "geri-qayit-90",
    ad: "90 gün gəlməyənə geri qayıt",
    emoji: "🔄",
    qisa: "Son alışdan 90 gün keçən müştəriyə 20% endirim WhatsApp",
    tip: "reaktivlesdir",
    rules: { inactive_days: 90 },
    action: { discount_type: "percent", value: 20, send_notification: true },
    reng: "from-orange-500 to-amber-600",
    uygun: ["retail", "service"],
  },

  // ── GIFT CARD ──
  {
    kod: "gift-100-90",
    ad: "100₼-lik kart 90₼-ə",
    emoji: "💳",
    qisa: "Hədiyyə kartı satışı — 90₼ qarşılığında 100₼ kart",
    tip: "gift_card",
    rules: {},
    action: { nominal: 100, satish_qiymet: 90 },
    reng: "from-fuchsia-500 to-purple-600",
    uygun: ["retail", "restaurant"],
  },
];
