export type Alert = {
  id: string;
  basliq: string;
  tesvir: string | null;
  seviyye: string;
  status: string;
  kateqoriya_ad: string;
  kateqoriya_emoji: string | null;
  obyekt_basliq: string | null;
  first_seen_at: string | null;
};

export type NezaretPage = {
  items: Alert[];
  total: number;
  summary: { open: number; kritik: number; today: number };
};
