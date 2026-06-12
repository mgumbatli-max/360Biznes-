// ─── Anbar bölgüsü ───────────────────────────────────────────────────────────
export type AnbarBreakdown = {
  anbar_id: number;
  anbar_ad: string;
  miqdar: number;
};

// ─── Siyahı elementi (GET /mehsullar) ────────────────────────────────────────
export type Product = {
  id: string;
  ad: string;
  kod: string | null;
  barkod: string | null;
  sekil_url: string | null;
  aciqlamaq: string | null;
  qisaca_tesvir: string | null;

  kateqoriya_id: number | null;
  kateqoriya_ad: string | null;
  kateqoriya_ust_ad: string | null;
  marka_id: number | null;
  marka_ad: string | null;
  olcu_id: number | null;
  olcu_ad: string | null;

  alish_qiymeti: number;
  satis_qiymeti: number;
  endirimli_qiymet: number | null;
  min_satis_qiymeti: number;
  topdan_qiymeti: number;
  partnyor_qiymeti: number;
  vip_qiymeti: number;
  komissiya_faiz: number;

  kritik_stok: number | null;
  min_stok: number | null;
  max_stok: number | null;
  stok_miqdari: number;
  bron_miqdari: number;
  satis_acig_miqdari: number;
  anbar_sayi: number;
  anbar_breakdown: AnbarBreakdown[];

  servis_sayi: number;

  model: string | null;
  rang: string | null;
  istehsalci: string | null;
  cheki_kg: number | null;
  hecm_m3: number | null;
  olculer: string | null;
  qutu_say: number | null;

  zemanet_ay: number;
  serial_lazim: boolean;
  imei_lazim: boolean;

  valyuta: string;
  edv_status: string;
  etiketsiz: boolean;

  yaradildi: string | null;
  son_satis_de: string | null;
  aktiv: boolean;
};

// ─── Detallar üçün tam məhsul sətri (GET /mehsullar/[id] → item) ─────────────
// DB sətrinin tam proyeksiyası — Product sahələrini optional kimi əhatə edir,
// id + ad məcburi, nested relasiyalar əlavə edilir, əlavə açarlar icazəlidir.
export type ProductItem = Partial<Product> & {
  id: string;
  ad: string;
  kateqoriyalar?: { id: number; ad: string } | null;
  markalar?: { id: number; ad: string } | null;
  olcu_vahidleri?: { ad: string; qisa: string | null } | null;
  [key: string]: unknown;
};

// ─── Stok sırası ─────────────────────────────────────────────────────────────
export type StokRow = {
  anbar_id: number;
  anbar_ad: string;
  miqdar: number;
  son_qiymet: number | null;
};

// ─── Hərəkət sırası ──────────────────────────────────────────────────────────
export type HereketRow = {
  id: string;
  tarix: string | null;
  nov: string;
  anbar_ad: string;
  miqdar: number;
  qiymet: number | null;
  edilen_ad: string | null;
  qeyd: string | null;
  ref_nov: string | null;
};

// ─── Satış sırası ────────────────────────────────────────────────────────────
export type SatisRow = {
  sale_id: string;
  nomre: string;
  tarix: string;
  miqdar: number;
  vahid_qiymet: number;
  cemi: number;
  musteri_ad: string | null;
};

// ─── Statistika ──────────────────────────────────────────────────────────────
export type ProductStats = {
  bu_ay: { qty: number; mebleg: number };
  son_30: { qty: number; mebleg: number };
  toplam: { qty: number; mebleg: number; sifaris_say: number };
};

// ─── Servis sırası ───────────────────────────────────────────────────────────
export type ServisRow = {
  id: string;
  nomre: string;
  yaradildi: string | null;
  musteri_ad: string;
  musteri_telefon: string;
  problem_tesviri: string;
  status: string;
  temir_xerci: number;
  musteriden_alinan: number;
  qapanma_tarixi: string | null;
  texniki_ad: string | null;
  qebul_eden_ad: string | null;
};

// ─── Servis paketi ───────────────────────────────────────────────────────────
export type ServisBundle = {
  rows: ServisRow[];
  stats: {
    total: number;
    thisYear: number;
    active: number;
  };
};

// ─── GET /mehsullar/[id] cavabı ──────────────────────────────────────────────
export type ProductDetailResponse = {
  item: ProductItem;
  stok: StokRow[];
  hereketler: HereketRow[];
  son_satislar: SatisRow[];
  stats: ProductStats;
  servis: ServisBundle;
};

// ─── GET /mehsullar cavabı (siyahı + pagination) ─────────────────────────────
export type ProductsPage = {
  items: Product[];
  total: number;
};

// ─── POST/PUT /mehsullar giriş gövdəsi ───────────────────────────────────────
export type SaveProductBody = {
  id?: string;
  ad: string;
  kod?: string;
  barkod?: string;
  kateqoriya_id?: number;
  marka_id?: number;
  olcu_id?: number;
  sekil_url?: string;
  qisaca_tesvir?: string;
  aciqlamaq?: string;
  satis_qiymeti?: number;
  endirimli_qiymet?: number;
  min_satis_qiymeti?: number;
  topdan_qiymeti?: number;
  partnyor_qiymeti?: number;
  vip_qiymeti?: number;
  model?: string;
  rang?: string;
  istehsalci?: string;
  olculer?: string;
  kritik_stok?: number;
  min_stok?: number;
  max_stok?: number;
  zemanet_ay?: number;
  serial_lazim?: boolean;
  imei_lazim?: boolean;
  servis_lazim?: boolean;
  valyuta?: string;
  edv_status?: string;
  aktiv?: boolean;
};
