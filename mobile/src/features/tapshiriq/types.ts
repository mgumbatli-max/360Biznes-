export type TaskStatus = "yeni" | "icrada" | "gozlemede" | "tamamlandi" | "legv";
export type TaskPriority = "asagi" | "normal" | "yuksek" | "tecili";

export type Task = {
  id: string;
  basliq: string;
  tesvir: string | null;
  status: string;
  prioritet: string;
  tip: string | null;
  deadline: string | null;
  xatirlatma: string | null;
  yaradan_id: string;
  yaradan_ad: string;
  mesul_id: string | null;
  mesul_ad: string | null;
  icracilar: Array<{ id: string; ad_soyad: string; rol: string }>;
  reng: string | null;
  checklist_total: number;
  checklist_done: number;
  comment_count: number;
  yaradildi: string | null;
  tamamlandi_de: string | null;
};

export type TaskStats = {
  [key: string]: number;
};

export type TasksPage = {
  items: Task[];
  total: number;
  stats?: TaskStats | null;
};

export type AssignUser = { id: string; ad_soyad: string; vezife: string | null };

export type TaskDetailResponse = { task: Record<string, unknown> & { id: string; basliq?: string } };

export type CreateTaskBody = {
  basliq: string;
  tesvir?: string;
  mesul_id?: string;
  prioritet?: TaskPriority;
  deadline?: string;
  xatirlatma?: string;
};
