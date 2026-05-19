/**
 * Sosial media inteqrasiyası — paylaşılan tiplər və sabitlər.
 * Bu fayl həm server, həm client komponentlərdən import oluna bilər
 * (server-only direktivi yoxdur).
 */

export type SocialChannel = "instagram" | "facebook" | "tiktok" | "telegram" | "whatsapp" | "linkedin" | "x";

export const SOCIAL_CHANNELS: Array<{ id: SocialChannel; label: string; color: string }> = [
  { id: "instagram", label: "Instagram",   color: "from-pink-500 to-orange-500" },
  { id: "facebook",  label: "Facebook",    color: "from-sky-500 to-blue-600" },
  { id: "tiktok",    label: "TikTok",      color: "from-fuchsia-500 to-cyan-500" },
  { id: "telegram",  label: "Telegram",    color: "from-sky-400 to-cyan-500" },
  { id: "whatsapp",  label: "WhatsApp",    color: "from-emerald-500 to-green-600" },
  { id: "linkedin",  label: "LinkedIn",    color: "from-blue-600 to-indigo-700" },
  { id: "x",         label: "X / Twitter", color: "from-zinc-700 to-black" },
];

export type SocialAccount = {
  id: string;
  kanal: SocialChannel;
  ad: string;
  hesab_id: string | null;
  webhook_url: string | null;
  aktiv: boolean;
  son_sync: Date | null;
  yaradildi: Date | null;
  post_sayi: number;
};

export type PostStatus = "qaralama" | "planlasdirilmis" | "gonderildi" | "xeta";

export type SocialPost = {
  id: string;
  basliq: string;
  metn: string;
  sekil_url: string | null;
  mehsul_id: string | null;
  /** ISO date string — null = dərhal göndərilmir */
  planlasdirilan: string | null;
  /** Hesab ID-ləri massivi — bir post bir neçə kanala gedir */
  hesab_ids: string[];
  status: PostStatus;
  yaradildi: string;
  gonderildi: string | null;
  xeta: string | null;
};
