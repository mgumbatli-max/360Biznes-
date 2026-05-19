// Client-safe HR Core types.

export type EduRow = { uni: string; ixtisas: string; derece: string; il: string };
export type LangRow = { lang: string; level: string };
export type SkillRow = { name: string; level: number };
export type CertRow = {
  ad: string;
  verən: string;
  tarix: string;
  bitme: string;
};
export type ExpRow = {
  sirket: string;
  vezife: string;
  tarix: string;
  sebeb: string;
};
export type PerfReview = {
  ts: string;
  reviewer: string;
  scores: Record<string, number>;
  manager_comment: string;
  self_assessment: string;
  goals: Array<{ ad: string; status: "basla" | "yari" | "tamam" }>;
  next_review?: string;
};
export type DisciplineEvent = {
  ts: string;
  nov: string;
  sebeb: string;
  meblegh?: number;
  by?: string;
};
export type OneOnOne = { ts: string; qeyd: string; by?: string };

export type ProfileExtras = {
  education: EduRow[];
  languages: LangRow[];
  skills: SkillRow[];
  certs: CertRow[];
  experience: ExpRow[];
  perf_reviews: PerfReview[];
  disciplinary: DisciplineEvent[];
  one_on_ones: OneOnOne[];
};

export type OrgNode = {
  id: string;
  ad_soyad: string;
  vezife: string | null;
  rol_ad: string | null;
  sobe: string;
};

export type SkillsMatrixData = {
  skills: string[];
  employees: Array<{
    id: string;
    ad_soyad: string;
    vezife: string | null;
    sobe: string | null;
    levels: number[];
  }>;
  gaps: Array<{ skill: string; avg: number; low: number }>;
};

export type HeadcountStats = {
  total: number;
  aktiv: number;
  mezuniyyetde: number;
  isden_cixmis_90: number;
  bu_ay_yeni: number;
};
