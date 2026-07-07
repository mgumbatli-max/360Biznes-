export type MarketplaceAccount = {
  id: string;
  platform: string;
  ad: string;
  store_id: string | null;
  store_url: string | null;
  status: string;
  aktiv: boolean;
  komisyon_faiz: number;
  son_sync: string | null;
  son_xeta: string | null;
  yaradildi: string | null;
};

export type MarketplaceStats = {
  total: number;
  aktiv: number;
  bu_ay_sifaris: number;
  bu_ay_meblegh: number;
  syncs_24h: number;
};

export type MarketplaceResponse = {
  accounts: MarketplaceAccount[];
  stats: MarketplaceStats;
};
