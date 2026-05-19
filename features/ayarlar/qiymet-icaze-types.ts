export type TierKey =
  | "satis_qiymeti"
  | "endirimli_qiymet"
  | "topdan_qiymeti"
  | "partnyor_qiymeti"
  | "vip_qiymeti"
  | "min_satis_qiymeti";

export const TIER_LABELS: Record<TierKey, string> = {
  satis_qiymeti: "Pərakəndə",
  endirimli_qiymet: "Endirimli",
  topdan_qiymeti: "Topdan",
  partnyor_qiymeti: "Partnyor",
  vip_qiymeti: "VIP",
  min_satis_qiymeti: "Min satış",
};

export const ALL_TIERS: TierKey[] = [
  "satis_qiymeti",
  "endirimli_qiymet",
  "topdan_qiymeti",
  "partnyor_qiymeti",
  "vip_qiymeti",
  "min_satis_qiymeti",
];
