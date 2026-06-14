// ─── Müştəri siyahı elementi (GET /musteriler) ───────────────────────────────
export type Customer = {
  id: string;
  nov: string;
  ad: string;
  telefon: string | null;
  email: string | null;
  unvan: string | null;
  borc: number;
  aktiv: boolean;
  qiymet_tipi: string | null;
  borc_limiti: number | null;
  sheher: string | null;
  sirket_adi: string | null;
  qara_siyahi: boolean;
};

export type CustomersPage = {
  items: Customer[];
  total: number;
  stats?: { count: number; total_borc: number; aktiv_count: number; borclu_count: number };
};

// ─── Müştəri detalı (GET /musteriler/[id]) ───────────────────────────────────
export type CustomerDetail = {
  id: string;
  ad: string;
  nov: string;
  voen: string | null;
  fin_kod: string | null;
  telefon: string | null;
  telefon2: string | null;
  email: string | null;
  unvan: string | null;
  sirket_adi: string | null;
  sheher: string | null;
  olke: string | null;
  valyuta: string | null;
  borc: number;
  alacaq: number;
  avans: number;
  borc_limiti: number | null;
  qiymet_tipi: string | null;
  aktiv: boolean;
  qara_siyahi: boolean;
  funnel_status: string | null;
  son_temas: string | null;
  yaradildi: string | null;
  qeyd: string | null;
};

export type CustomerSale = {
  sale_id?: string;
  nomre?: string;
  tarix?: string;
  cemi?: number;
  status?: string;
  [key: string]: unknown;
};

export type CustomerDetailResponse = {
  customer: CustomerDetail;
  sales: CustomerSale[];
};

// ─── POST /musteriler giriş gövdəsi ──────────────────────────────────────────
export type SaveCustomerBody = {
  ad: string;
  telefon?: string;
  email?: string;
  voen?: string;
  borc_limiti?: number | null;
  qiymet_tipi?: "adi" | "perakende" | "topdan" | "partnyor" | "vip";
  qeyd?: string;
};
