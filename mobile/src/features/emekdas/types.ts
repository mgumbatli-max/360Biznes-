// ─── Əməkdaş siyahı elementi (GET /emekdaslar) ───────────────────────────────
export type EmekdasItem = {
  id: string;
  ad_soyad: string;
  vezife: string | null;
  rol_ad: string;
  telefon: string | null;
  email: string;
  status: string;
  aktiv: boolean;
  profil_sekil: string | null;
  default_filial_ad: string | null;
};

export type EmekdasPage = { items: EmekdasItem[]; total: number };

// ─── Əməkdaş detalı (GET /emekdaslar/[id]) — sərbəst forma ────────────────────
export type EmekdasDetail = {
  id: string;
  ad_soyad: string;
  email?: string | null;
  telefon?: string | null;
  vezife?: string | null;
  aylik_maas?: number | null;
  ise_baslama?: string | null;
  dogum_tarixi?: string | null;
  unvan?: string | null;
  fin_kod?: string | null;
  bank_hesab?: string | null;
  bank_ad?: string | null;
  aktiv?: boolean;
  son_giris?: string | null;
  roles?: { ad: string } | null;
  filiallar_istifadeciler_default_filial_idTofiliallar?: { ad: string } | null;
  [key: string]: unknown;
};

export type EmekdasDetailResponse = { emekdas: EmekdasDetail };
