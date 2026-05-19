// Client-safe types and constants for CRM (no server-only imports here).

export type LeadStatus = "yeni" | "elaqe" | "muzakire" | "teklif" | "qazandi" | "itirdi";

export const LEAD_STAGES: { value: LeadStatus; label: string; cls: string }[] = [
  { value: "yeni", label: "Yeni", cls: "border-info/30 bg-info/10" },
  { value: "elaqe", label: "Əlaqədə", cls: "border-primary/30 bg-primary/10" },
  { value: "muzakire", label: "Müzakirə", cls: "border-warning/30 bg-warning/10" },
  { value: "teklif", label: "Təklif", cls: "border-warning/30 bg-warning/10" },
  { value: "qazandi", label: "Qazanıldı", cls: "border-success/30 bg-success/10" },
  { value: "itirdi", label: "İtirildi", cls: "border-destructive/30 bg-destructive/5 opacity-70" },
];

export type LeadPriority = "asagi" | "orta" | "yuksek";

export const LEAD_PRIORITY: Record<LeadPriority, { label: string; cls: string }> = {
  asagi: { label: "Aşağı", cls: "bg-muted text-muted-foreground" },
  orta: { label: "Orta", cls: "bg-info/15 text-info" },
  yuksek: { label: "Yüksək", cls: "bg-danger/15 text-danger" },
};

export const LEAD_SOURCES: { value: string; label: string }[] = [
  { value: "facebook", label: "Facebook" },
  { value: "instagram", label: "Instagram" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "telegram", label: "Telegram" },
  { value: "telefon", label: "Telefon" },
  { value: "magaza", label: "Mağaza (walk-in)" },
  { value: "vebsayt", label: "Website" },
  { value: "tovsiye", label: "Tövsiyə" },
  { value: "reklam", label: "Reklam" },
];

export type LeadCard = {
  id: string;
  ad: string;
  telefon: string | null;
  email: string | null;
  menbe: string | null;
  budce: number;
  ehtimal: number;
  status: string;
  novbeti_elaqe: Date | null;
  menecer_ad: string | null;
  prioritet: LeadPriority;
  gunler_stage: number;
};

export type LeadListRow = {
  id: string;
  ad: string;
  telefon: string | null;
  email: string | null;
  menbe: string | null;
  budce: number;
  ehtimal: number;
  status: LeadStatus;
  novbeti_elaqe: Date | null;
  menecer_ad: string | null;
  yaradildi: Date | null;
  prioritet: LeadPriority;
};

export type TemplateRow = {
  id: number;
  ad: string;
  hadisi: string;
  kanal: string;
  movzu: string | null;
  matn: string;
  deyisenler: string[];
  aktiv: boolean;
};

export const TEMPLATE_CATEGORIES: { value: string; label: string }[] = [
  { value: "welcome", label: "Salamlama" },
  { value: "follow_up", label: "Follow-up" },
  { value: "promosyon", label: "Promosyon" },
  { value: "borc_xebardarliq", label: "Borc xəbərdarlıq" },
  { value: "tesekkur", label: "Təşəkkür" },
  { value: "manual", label: "Manual" },
];

export const AI_TONES: { value: string; label: string }[] = [
  { value: "resmi", label: "Rəsmi" },
  { value: "dostluq", label: "Dostluq" },
  { value: "qisa", label: "Qısa və konkret" },
];

export const AI_LANGS: { value: string; label: string }[] = [
  { value: "az", label: "Azərbaycan" },
  { value: "en", label: "English" },
  { value: "ru", label: "Русский" },
  { value: "tr", label: "Türkçe" },
];
