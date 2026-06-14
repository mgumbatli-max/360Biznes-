export type SaleLineSummary = {
  ad?: string;
  miqdar?: number;
  [key: string]: unknown;
};

// ─── Satış siyahı elementi (GET /satislar) ───────────────────────────────────
export type Sale = {
  id: string;
  nomre: string;
  tarix: string;
  status: string;
  odenis_nov: string;
  umumi_mebleg: number;
  endirim_mebleg: number;
  son_mebleg: number;
  odenilmis: number;
  musteri_id: string | null;
  musteri_ad: string | null;
  satici_ad: string | null;
  anbar_ad: string | null;
  satir_say: number;
  ilk_mehsullar: SaleLineSummary[];
  qaralama: boolean;
  marketplace_platform: string | null;
};

export type SaleStats = {
  bugun: { count: number; mebleg: number };
  bu_hefte: { count: number; mebleg: number };
  bu_ay: { count: number; mebleg: number };
  borc_mebleg: number;
};

export type SalesPage = {
  items: Sale[];
  total: number;
  stats?: SaleStats | null;
};

// ─── Satış detalı (GET /satislar/[id]) — sərbəst tipli (serializeForJson) ─────
export type SaleLine = {
  id?: string | number;
  miqdar?: number;
  vahid_qiymet?: number;
  cemi?: number;
  mehsullar?: { ad?: string; kod?: string | null } | null;
  [key: string]: unknown;
};

export type SaleDetail = {
  id: string;
  nomre?: string;
  tarix?: string;
  status?: string;
  odenis_nov?: string;
  umumi_mebleg?: number;
  endirim_mebleg?: number;
  son_mebleg?: number;
  odenilmis?: number;
  qeyd?: string | null;
  kontragentler?: { id: string; ad: string; telefon: string | null } | null;
  anbarlar?: { ad: string } | null;
  satis_sifaris_satirlari?: SaleLine[];
  [key: string]: unknown;
};

export type SaleDetailResponse = { sale: SaleDetail };
