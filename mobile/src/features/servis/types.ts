// ─── Servis siyahı elementi (GET /servis) ────────────────────────────────────
export type ServisItem = {
  id: string;
  nomre: string;
  musteri_ad: string;
  musteri_telefon: string;
  mehsul_ad: string;
  problem: string;
  status: string;
  prioritet: string;
  servis_iscisi_ad: string | null;
  texmini_tehvil: string | null;
  temir_xerci: number;
  zemanet_var: boolean;
  yaradildi: string | null;
};

export type ServisPage = {
  items: ServisItem[];
  total: number;
};

// ─── Servis detalı (GET /servis/[id]) — geniş, sərbəst forma ──────────────────
export type ServisDetail = {
  id: string;
  nomre: string;
  status: string;
  problem_tesviri?: string | null;
  daxili_qeyd?: string | null;
  temir_xerci?: number | null;
  musteriden_alinan?: number | null;
  yaradildi?: string | null;
  texmini_tehvil?: string | null;
  qapanma_tarixi?: string | null;
  kontragentler?: { id: string; ad: string; telefon: string | null } | null;
  mehsullar?: { id: string; ad: string; kod: string | null; barkod: string | null } | null;
  servis_status_tarixce?: Array<{ id: number; yeni_status: string; yaradildi: string | null; qeyd: string | null }>;
  [key: string]: unknown;
};

export type ServisDetailResponse = { servis: ServisDetail };
