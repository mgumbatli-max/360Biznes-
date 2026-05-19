/**
 * Pure types + constants for the sales pipeline view. Safe to import from
 * both server queries and client components.
 */

export type PipelineStage =
  | "teklif"
  | "sifaris"
  | "sovde"
  | "catdir"
  | "catib"
  | "faktura"
  | "odendi";

export const PIPELINE_LABELS: Record<PipelineStage, string> = {
  teklif: "Təklif",
  sifaris: "Sifariş",
  sovde: "Sövdələşdə",
  catdir: "Çatdırılır",
  catib: "Çatdırılıb",
  faktura: "Faktura",
  odendi: "Ödənildi",
};

export const PIPELINE_ORDER: PipelineStage[] = [
  "teklif",
  "sifaris",
  "sovde",
  "catdir",
  "catib",
  "faktura",
  "odendi",
];

export type PipelineItem = {
  id: string;
  nomre: string;
  musteri_ad: string | null;
  son_mebleg: number;
  odenilmis: number;
  yas_gun: number;
  tarix: Date;
  status_raw: string;
  stage: PipelineStage;
};

export type PipelineColumn = {
  stage: PipelineStage;
  label: string;
  count: number;
  total: number;
  items: PipelineItem[];
};
