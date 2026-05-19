export type PosPriceSettings = {
  show_pere: boolean;
  show_topdan: boolean;
  show_partnyor: boolean;
  show_vip: boolean;
  show_endirimli: boolean;

  show_min_only_admin: boolean;
  show_cost_only_owner: boolean;
  show_margin_only_owner: boolean;

  cashier_can_change_price: boolean;
  cashier_can_sell_below_min: boolean;
  below_min_needs_approval: boolean;

  default_tier:
    | "satis_qiymeti"
    | "endirimli_qiymet"
    | "topdan_qiymeti"
    | "partnyor_qiymeti"
    | "vip_qiymeti";
};

export const DEFAULTS: PosPriceSettings = {
  show_pere: true,
  show_topdan: false,
  show_partnyor: false,
  show_vip: false,
  show_endirimli: false,
  show_min_only_admin: true,
  show_cost_only_owner: true,
  show_margin_only_owner: true,
  cashier_can_change_price: false,
  cashier_can_sell_below_min: false,
  below_min_needs_approval: true,
  default_tier: "satis_qiymeti",
};
