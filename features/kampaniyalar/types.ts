/**
 * Kampaniyalar modulunun ortaq tipləri.
 */

export type KampaniyaTip =
  | "percent_endirim"     // % endirim (məhsul/kateqoriya/səbət)
  | "sabit_endirim"       // Sabit məbləğ endirim (məs. 5 ₼)
  | "bogo"                // Buy One Get One free
  | "pillevari"           // Volume tier (5+ = -5%, 10+ = -10%)
  | "sebet_endirim"       // Səbət dəyəri əsaslı
  | "pulsuz_catdirilma"   // Free shipping
  | "loyalty"             // Bonus toplama proqramı
  | "coupon"              // Kupon əsaslı kampaniya
  | "gift_card"           // Hədiyyə kartı satışı
  | "flash_sale"          // Qısa müddətli flash sale
  | "doğum_gunu"          // Doğum günü trigger
  | "welcome"             // İlk satış endirim
  | "reaktivlesdir";      // Inaktiv müştəri qaytarma

export type KampaniyaStatus = "draft" | "active" | "paused" | "expired" | "archived";

export const TIP_META: Record<KampaniyaTip, { ad: string; emoji: string; reng: string; tesvir: string }> = {
  percent_endirim:    { ad: "% Endirim",          emoji: "💰", reng: "emerald", tesvir: "Faiz əsaslı endirim" },
  sabit_endirim:      { ad: "Sabit Endirim",      emoji: "🎯", reng: "sky",     tesvir: "Konkret məbləğ endirim" },
  bogo:               { ad: "Al-Bir Al-Bir (BOGO)", emoji: "🎁", reng: "pink",  tesvir: "İkincisini pulsuz/endirimli al" },
  pillevari:          { ad: "Pilləvari Endirim",  emoji: "📊", reng: "indigo",  tesvir: "Çoxlu alış üçün artan endirim" },
  sebet_endirim:      { ad: "Səbət Endirimi",     emoji: "🛒", reng: "violet",  tesvir: "Min səbət dəyərinə görə" },
  pulsuz_catdirilma:  { ad: "Pulsuz Çatdırılma",  emoji: "🚚", reng: "blue",    tesvir: "Müəyyən şərtlərdə çatdırılma" },
  loyalty:            { ad: "Sadiqlik Proqramı",  emoji: "⭐", reng: "amber",   tesvir: "Bonus toplama + tier sistemi" },
  coupon:             { ad: "Kupon Kodu",         emoji: "🎟",  reng: "rose",   tesvir: "Promokod ilə endirim" },
  gift_card:          { ad: "Hədiyyə Kartı",      emoji: "💳", reng: "fuchsia", tesvir: "Qabaqcadan ödənilmiş kart" },
  flash_sale:         { ad: "Flash Sale",         emoji: "⚡", reng: "rose",    tesvir: "Qısa müddətli güclü endirim" },
  doğum_gunu:         { ad: "Doğum Günü",         emoji: "🎂", reng: "pink",    tesvir: "Müştəri ad günündə avto bonus" },
  welcome:            { ad: "Xoş Gəldin",         emoji: "👋", reng: "teal",    tesvir: "Yeni müştəri ilk satış endirimi" },
  reaktivlesdir:      { ad: "Geri Qayıt",         emoji: "🔄", reng: "orange",  tesvir: "İnaktiv müştərini qaytarmaq" },
};

export const STATUS_META: Record<KampaniyaStatus, { ad: string; reng: string }> = {
  draft:    { ad: "Qaralama",   reng: "border-border bg-secondary text-muted-foreground" },
  active:   { ad: "Aktiv",      reng: "border-emerald-500/40 bg-emerald-500/10 text-emerald-500" },
  paused:   { ad: "Dayandırılıb", reng: "border-amber-500/40 bg-amber-500/10 text-amber-500" },
  expired:  { ad: "Bitdi",      reng: "border-rose-500/40 bg-rose-500/10 text-rose-500" },
  archived: { ad: "Arxiv",      reng: "border-border bg-secondary text-muted-foreground" },
};

export type LoyaltyTier = "bronze" | "silver" | "gold" | "platinum";

export const TIER_META: Record<LoyaltyTier, { ad: string; emoji: string; minSpend: number; bonusPct: number; endirimPct: number; reng: string }> = {
  bronze:   { ad: "Bronze",   emoji: "🥉", minSpend: 0,    bonusPct: 1, endirimPct: 0, reng: "border-amber-700/40 bg-amber-700/10 text-amber-700 dark:text-amber-500" },
  silver:   { ad: "Silver",   emoji: "🥈", minSpend: 500,  bonusPct: 2, endirimPct: 3, reng: "border-slate-400/40 bg-slate-400/10 text-slate-500" },
  gold:     { ad: "Gold",     emoji: "🥇", minSpend: 2000, bonusPct: 3, endirimPct: 5, reng: "border-amber-500/40 bg-amber-500/10 text-amber-500" },
  platinum: { ad: "Platinum", emoji: "💎", minSpend: 5000, bonusPct: 5, endirimPct: 8, reng: "border-violet-500/40 bg-violet-500/10 text-violet-500" },
};

export function calcTier(totalSpend: number): LoyaltyTier {
  if (totalSpend >= TIER_META.platinum.minSpend) return "platinum";
  if (totalSpend >= TIER_META.gold.minSpend) return "gold";
  if (totalSpend >= TIER_META.silver.minSpend) return "silver";
  return "bronze";
}
