export type Kampaniya = {
  id: string;
  ad: string;
  tip: string;
  status: string;
  bitme: string | null;
  current_uses: number;
  max_uses: number | null;
  kupon_say: number;
  reng: string | null;
};

export type KampaniyaPage = { items: Kampaniya[]; total: number };
