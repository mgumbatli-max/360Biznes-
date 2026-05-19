// Client-safe types for servis module.

export type ServisStatus =
  | "qebul_edildi"
  | "diaqnostikada"
  | "teklif_gozleyir"
  | "usta_baxir"
  | "ehtiyat_hisse"
  | "temir_olunur"
  | "temir_edildi"
  | "musteriye_tehvil"
  | "qaytarildi"
  | "redd_edildi";

/**
 * Status badges — slate / sky / amber / violet / emerald / rose palette
 * (Tailwind v4 + theme tokens). Each variant uses bg /15 with /30 border.
 */
export const SERVIS_STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  qebul_edildi:     { label: "Qəbul edildi",   cls: "border-slate-400/30 bg-slate-400/15 text-slate-300" },
  diaqnostikada:    { label: "Diaqnostika",    cls: "border-sky-400/30 bg-sky-400/15 text-sky-300" },
  teklif_gozleyir:  { label: "Təklif gözləyir", cls: "border-amber-400/30 bg-amber-400/15 text-amber-300" },
  usta_baxir:       { label: "Usta baxır",     cls: "border-sky-400/30 bg-sky-400/15 text-sky-300" },
  ehtiyat_hisse:    { label: "Ehtiyat hissə",  cls: "border-amber-400/30 bg-amber-400/15 text-amber-300" },
  temir_olunur:     { label: "Təmirdə",        cls: "border-violet-400/30 bg-violet-400/15 text-violet-300" },
  temir_edildi:     { label: "Hazır",          cls: "border-emerald-400/30 bg-emerald-400/15 text-emerald-300" },
  musteriye_tehvil: { label: "Təhvil verildi", cls: "border-emerald-500/40 bg-emerald-500/25 text-emerald-200" },
  qaytarildi:       { label: "Qaytarıldı",     cls: "border-rose-400/30 bg-rose-400/15 text-rose-300" },
  redd_edildi:      { label: "Rədd edildi",    cls: "border-rose-400/30 bg-rose-400/15 text-rose-300" },
};

export const SERVIS_STATUS_ORDER: string[] = [
  "qebul_edildi",
  "diaqnostikada",
  "teklif_gozleyir",
  "usta_baxir",
  "ehtiyat_hisse",
  "temir_olunur",
  "temir_edildi",
  "musteriye_tehvil",
];

export type ServisPriority = "asagi" | "orta" | "yuksek" | "tecili";

export const SERVIS_PRIORITY_LABELS: Record<string, { label: string; cls: string }> = {
  asagi:  { label: "Aşağı",  cls: "border-slate-400/30 bg-slate-400/10 text-slate-300" },
  orta:   { label: "Orta",   cls: "border-sky-400/30 bg-sky-400/10 text-sky-300" },
  yuksek: { label: "Yüksək", cls: "border-amber-400/40 bg-amber-400/15 text-amber-300" },
  tecili: { label: "Təcili", cls: "border-rose-500/40 bg-rose-500/15 text-rose-300" },
};

export type ServisRow = {
  id: string;
  nomre: string;
  yaradildi: Date | null;
  musteri_id: string | null;
  musteri_ad: string;
  musteri_telefon: string;
  mehsul_id: string | null;
  mehsul_ad: string;
  mehsul_kod: string | null;
  mehsul_barkod: string | null;
  mehsul_seri_nomresi: string | null;
  problem_tesviri: string;
  status: string;
  /** Inferred from daxili_qeyd JSON tag if exists. */
  prioritet: string;
  servis_iscisi_ad: string | null;
  qebul_eden_ad: string | null;
  texmini_tehvil: Date | null;
  qapanma_tarixi: Date | null;
  zemanet_var: boolean;
  zemanet_baslama: Date | null;
  zemanet_bitme: Date | null;
  temir_xerci: number;
  musteriden_alinan: number;
  satis_id: string | null;
  satis_tarixi: Date | null;
  filial_id: number | null;
  filial_ad: string | null;
  /** "true" if customer phone matches another previous servis. */
  yenidenGelen: boolean;
};

export type ZemanetRow = {
  id: string;
  unikal_kod: string;
  qr_token: string;
  satis_id: string | null;
  satis_nomre: string | null;
  musteri_id: string | null;
  musteri_ad: string | null;
  musteri_telefon: string | null;
  mehsul_id: string | null;
  mehsul_ad: string | null;
  mehsul_kod: string | null;
  mehsul_barkod: string | null;
  serial_nomre: string | null;
  imei: string | null;
  baslama_tarixi: Date;
  bitme_tarixi: Date;
  ay_sayi: number;
  status: string;
  satis_qiymeti: number | null;
  servis_id: string | null;
  servis_sayi: number;
  son_temir: Date | null;
};
