export type PosKassa = {
  id: string;
  ad: string;
  acan_ad: string | null;
  acilis_qaligi: number;
  cari_negd: number;
  cari_kart: number;
  cari_bank: number;
  cari_borc: number;
  cemi_satis: number;
  emeliyyatlar_say: number;
};

export type PosAnbar = { id: number; ad: string };

export type PosContext = {
  kassa: PosKassa | null;
  anbarlar: PosAnbar[];
  default_anbar_id: number | null;
  valyuta: string;
  sirket_ad: string;
  can_open_kassa: boolean;
};

export type PosProduct = {
  id: string;
  ad: string;
  kod: string | null;
  barkod: string | null;
  qiymet: number;
  valyuta: string;
  stok: number | null;
};

export type PosLookupResponse = { items: PosProduct[] };

export type OdenisNov = "negd" | "kart" | "kecirme" | "nisye";

export const ODENIS_LABEL: Record<OdenisNov, string> = {
  negd: "Nağd",
  kart: "Kart",
  kecirme: "Köçürmə",
  nisye: "Nisyə (borc)",
};

export type CartLine = {
  mehsul_id: string;
  ad: string;
  barkod: string | null;
  qiymet: number;
  miqdar: number;
  endirim_faiz: number;
  stok: number | null;
};

export type CreateSaleBody = {
  kassa_id: string;
  anbar_id: number;
  musteri_id?: string | null;
  odenis_nov: OdenisNov;
  endirim_mebleg?: number;
  lines: { mehsul_id: string; miqdar: number; qiymet: number; endirim_faiz?: number }[];
  client_op_id?: string;
};

export type CreateSaleResult =
  | { ok: true; satis_id: string; nomre: string; son_mebleg: number; pos_cek_nomresi: string }
  | { ok: false; error: string };
