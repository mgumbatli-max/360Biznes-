/**
 * Qovluq rəngi — JSON tree-də saxlanılır, DB migration tələb etmir.
 * "default" → standart amber, digər açarlar üçün Tailwind palitri.
 */
export type QovluqColor = "default" | "indigo" | "emerald" | "sky" | "amber" | "rose" | "violet" | "pink" | "slate";

/**
 * Sahibkar sənədinin / qovluğunun digər bölmələrə bağlantısı.
 * Polymorphic — `nov` entity-növünü, `id` həmin entity-nin id-sini saxlayır,
 * `label` UI-da göstərmək üçün cache-lənmiş etiketdir.
 */
export type SenedLink = {
  nov: "satinalma" | "satis" | "mehsul" | "musteri" | "techizatci" | "partiya" | "tapshiriq" | "qaime" | "diger";
  id: string;
  label: string;
};

export type SenedQovluq = {
  id: string;              // uuid
  name: string;
  parent_id: string | null;
  yaradildi: string;       // ISO
  color?: QovluqColor;     // opsional — köhnə dataları qırmamaq üçün
  link?: SenedLink | null; // qovluqun başqa entity-yə bağlantısı
};

export type SenedFayl = {
  id: string;
  folder_id: string | null; // null = root
  name: string;
  tip: "file" | "link";
  url: string;
  olcu_byte: number;
  mime: string;
  qeyd: string;
  tags: string[];
  yaradildi: string;
  link?: SenedLink | null; // fayl bir entity ilə bağlıdırsa
};

export type SenedTree = {
  folders: SenedQovluq[];
  files: SenedFayl[];
};

export const EMPTY_TREE: SenedTree = { folders: [], files: [] };

/**
 * Qovluq rəngləri üçün UI palitri — border + bg + icon rəngi.
 * Tailwind-uyğun class-lar.
 */
export const QOVLUQ_COLOR_CLASSES: Record<QovluqColor, { border: string; bg: string; icon: string; dot: string; label: string }> = {
  default: { border: "border-amber-500/30", bg: "bg-amber-500/5", icon: "text-amber-500", dot: "bg-amber-400", label: "Amber" },
  indigo:  { border: "border-indigo-500/30", bg: "bg-indigo-500/5", icon: "text-indigo-500", dot: "bg-indigo-500", label: "İndigo" },
  emerald: { border: "border-emerald-500/30", bg: "bg-emerald-500/5", icon: "text-emerald-500", dot: "bg-emerald-500", label: "Yaşıl" },
  sky:     { border: "border-sky-500/30", bg: "bg-sky-500/5", icon: "text-sky-500", dot: "bg-sky-500", label: "Göy" },
  amber:   { border: "border-amber-500/30", bg: "bg-amber-500/5", icon: "text-amber-500", dot: "bg-amber-500", label: "Amber" },
  rose:    { border: "border-rose-500/30", bg: "bg-rose-500/5", icon: "text-rose-500", dot: "bg-rose-500", label: "Qırmızı" },
  violet:  { border: "border-violet-500/30", bg: "bg-violet-500/5", icon: "text-violet-500", dot: "bg-violet-500", label: "Bənövşəyi" },
  pink:    { border: "border-pink-500/30", bg: "bg-pink-500/5", icon: "text-pink-500", dot: "bg-pink-500", label: "Çəhrayı" },
  slate:   { border: "border-slate-500/30", bg: "bg-slate-500/5", icon: "text-slate-500", dot: "bg-slate-400", label: "Boz" },
};
