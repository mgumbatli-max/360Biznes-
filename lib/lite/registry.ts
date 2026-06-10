/**
 * Lite rejimi — blok registry (tək mənbə).
 *
 * Hər modulun Lite-da konfiqurasiya oluna bilən bloklarını elan edir. Həm ayar
 * UI (`/ayarlar/gorunis`), həm səhifələr (`getLiteConfig`) buradan oxuyur.
 * Yeni modul/blok əlavə etmək: bura bir sətir + həmin səhifədə `liteBlock(...)` yoxlaması.
 */

export type LiteBlockDef = {
  kod: string;
  ad: string;
  /** Lite-da default açıqdırmı (sahibkar dəyişməyibsə). */
  liteDefault: boolean;
  tesvir?: string;
};

export type LiteModuleDef = {
  kod: string;
  ad: string;
  bloklar: LiteBlockDef[];
};

export const LITE_MODULES: LiteModuleDef[] = [
  {
    kod: "dashboard",
    ad: "Ana səhifə (Dashboard)",
    bloklar: [
      { kod: "kpi", ad: "Əsas göstəricilər (KPI)", liteDefault: true },
      { kod: "alerts", ad: "Kritik xəbərdarlıqlar", liteDefault: true },
      { kod: "lowStock", ad: "Az qalan stok", liteDefault: true },
      { kod: "top5", ad: "Top 5 məhsul", liteDefault: true },
      { kod: "debtors", ad: "Borclu müştərilər", liteDefault: true },
      { kod: "charts", ad: "Qrafiklər (satış trendi)", liteDefault: false },
      { kod: "activity", ad: "Son satış aktivliyi", liteDefault: false },
      { kod: "feed", ad: "Biznes lent", liteDefault: false },
      { kod: "sync", ad: "Sinxronizasiya / Webhook sifarişləri", liteDefault: false },
      { kod: "insight", ad: "AI tövsiyə bannerı", liteDefault: false },
    ],
  },
  {
    kod: "ticaret",
    ad: "Ticarət (satışlar)",
    bloklar: [
      { kod: "dashboard", ad: "Modulun öz dashboardu (KPI/icmal)", liteDefault: false },
      { kod: "ozet", ad: "Xülasə kartları (bugün / həftə / ay / borc)", liteDefault: true },
      { kod: "filtrler", ad: "Qabaqcıl filtrlər", liteDefault: false },
    ],
  },
  {
    kod: "anbar",
    ad: "Anbar (məhsullar)",
    bloklar: [
      { kod: "dashboard", ad: "Modulun öz dashboardu (KPI/icmal)", liteDefault: false },
      { kod: "ozet", ad: "Xülasə kartları (dəyər, say, az stok…)", liteDefault: true },
      { kod: "filtrler", ad: "Qabaqcıl filtrlər", liteDefault: false },
    ],
  },
  {
    kod: "hesabatlar",
    ad: "Hesabatlar",
    bloklar: [
      { kod: "ozet", ad: "Xülasə göstəriciləri (KPI)", liteDefault: true },
      { kod: "qrafikler", ad: "Qrafiklər", liteDefault: false },
      { kod: "detal_cedvel", ad: "Detal cədvəllər", liteDefault: false },
    ],
  },
  {
    kod: "maliyye",
    ad: "Maliyyə (əməliyyatlar)",
    bloklar: [
      { kod: "dashboard", ad: "Modulun öz dashboardu (KPI/icmal)", liteDefault: false },
      { kod: "ozet", ad: "Xülasə kartları (mədaxil, məxaric, net…)", liteDefault: true },
    ],
  },
  {
    kod: "servis",
    ad: "Servis",
    bloklar: [
      { kod: "ozet", ad: "Xülasə / KPI kartları (gecikən, orta təmir, gəlir…)", liteDefault: true },
      { kod: "qrafikler", ad: "Qrafiklər (qəbul/təhvil, heatmap)", liteDefault: false },
      { kod: "detal_cedvel", ad: "Texnik liderlik cədvəli", liteDefault: false },
    ],
  },
  {
    kod: "elaqe",
    ad: "Əlaqə (müştərilər)",
    bloklar: [
      { kod: "dashboard", ad: "Modulun öz dashboardu (KPI/icmal)", liteDefault: false },
      { kod: "ozet", ad: "Xülasə kartları (aktiv, borclu, cəmi borc…)", liteDefault: true },
      { kod: "filtrler", ad: "Qabaqcıl filtrlər (menecer, ölkə/şəhər…)", liteDefault: false },
    ],
  },
  {
    kod: "kampaniyalar",
    ad: "Kampaniyalar",
    bloklar: [
      { kod: "ozet", ad: "Xülasə kartları (cəmi, aktiv, endirim, bonus…)", liteDefault: true },
    ],
  },
  {
    kod: "iscilier",
    ad: "İşçilər",
    bloklar: [
      { kod: "ozet", ad: "Heyət xülasə (KPI) kartları", liteDefault: true },
    ],
  },
  {
    kod: "tapshiriqlar",
    ad: "Tapşırıqlar",
    bloklar: [
      { kod: "ozet", ad: "KPI strip (tapşırıq xülasəsi)", liteDefault: true },
      { kod: "filtrler", ad: "Qabaqcıl filtrlər", liteDefault: false },
    ],
  },
];

/* ── Dizayn forması seçimləri ─────────────────────────────────────────── */

export const DENSITY_OPTIONS = [
  { kod: "kompakt", ad: "Kompakt" },
  { kod: "rahat", ad: "Rahat" },
  { kod: "genis", ad: "Geniş" },
] as const;

export const FONT_OPTIONS = [
  { kod: "kicik", ad: "Kiçik" },
  { kod: "normal", ad: "Normal" },
  { kod: "boyuk", ad: "Böyük" },
] as const;

export const MOBILE_LAYOUT_OPTIONS = [
  { kod: "kart", ad: "Kart" },
  { kod: "cedvel", ad: "Cədvəl" },
] as const;

export const ACCENT_OPTIONS = [
  { kod: "rose", ad: "Çəhrayı", hex: "#e11d48" },
  { kod: "blue", ad: "Mavi", hex: "#2563eb" },
  { kod: "emerald", ad: "Yaşıl", hex: "#059669" },
  { kod: "violet", ad: "Bənövşəyi", hex: "#7c3aed" },
  { kod: "amber", ad: "Narıncı", hex: "#d97706" },
] as const;

export type Density = (typeof DENSITY_OPTIONS)[number]["kod"];
export type FontScale = (typeof FONT_OPTIONS)[number]["kod"];
export type MobileLayout = (typeof MOBILE_LAYOUT_OPTIONS)[number]["kod"];
export type Accent = (typeof ACCENT_OPTIONS)[number]["kod"];
