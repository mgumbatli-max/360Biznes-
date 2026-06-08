import { cn } from "@/lib/utils";

type Def = { label: string; cls: string; dotCls: string; pulse?: boolean };

const STATUS: Record<string, Def> = {
  qebul_edildi: {
    label: "Qəbul edildi",
    cls: "bg-gradient-to-b from-slate-500/15 to-slate-500/[0.06] text-slate-700 ring-1 ring-inset ring-slate-500/20 dark:text-slate-300",
    dotCls: "bg-slate-500",
  },
  diaqnostikada: {
    label: "Diaqnostika",
    cls: "bg-gradient-to-b from-sky-500/15 to-sky-500/[0.06] text-sky-700 ring-1 ring-inset ring-sky-500/20 dark:text-sky-300",
    dotCls: "bg-sky-500 animate-pulse",
    pulse: true,
  },
  teklif_gozleyir: {
    label: "Təklif gözləyir",
    cls: "bg-gradient-to-b from-amber-500/15 to-amber-500/[0.06] text-amber-800 ring-1 ring-inset ring-amber-500/30 dark:text-amber-300",
    dotCls: "bg-amber-500 animate-pulse",
  },
  usta_baxir: {
    label: "Usta baxır",
    cls: "bg-gradient-to-b from-blue-500/15 to-blue-500/[0.06] text-blue-700 ring-1 ring-inset ring-blue-500/20 dark:text-blue-300",
    dotCls: "bg-blue-500 animate-pulse",
  },
  ehtiyat_hisse: {
    label: "Ehtiyat hissə",
    cls: "bg-gradient-to-b from-amber-500/15 to-amber-500/[0.06] text-amber-800 ring-1 ring-inset ring-amber-500/30 dark:text-amber-300",
    dotCls: "bg-amber-500",
  },
  temir_olunur: {
    label: "Təmirdə",
    cls: "bg-gradient-to-b from-violet-500/15 to-violet-500/[0.06] text-violet-700 ring-1 ring-inset ring-violet-500/20 dark:text-violet-300",
    dotCls: "bg-violet-500 animate-pulse",
  },
  temir_edildi: {
    label: "Hazır",
    cls: "bg-gradient-to-b from-emerald-500/15 to-emerald-500/[0.06] text-emerald-700 ring-1 ring-inset ring-emerald-500/20 dark:text-emerald-300",
    dotCls: "bg-emerald-500",
  },
  musteriye_tehvil: {
    label: "Təhvil verildi",
    cls: "bg-gradient-to-b from-emerald-500/20 to-emerald-500/[0.08] text-emerald-800 ring-1 ring-inset ring-emerald-500/30 dark:text-emerald-200",
    dotCls: "bg-emerald-600",
  },
  qaytarildi: {
    label: "Qaytarıldı",
    cls: "bg-gradient-to-b from-rose-500/15 to-rose-500/[0.06] text-rose-700 ring-1 ring-inset ring-rose-500/20 dark:text-rose-300",
    dotCls: "bg-rose-500",
  },
  redd_edildi: {
    label: "Rədd edildi",
    cls: "bg-gradient-to-b from-rose-500/15 to-rose-500/[0.06] text-rose-700 ring-1 ring-inset ring-rose-500/20 line-through decoration-rose-500/40 dark:text-rose-300",
    dotCls: "bg-rose-500",
  },
};

const PILL =
  "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10.5px] font-semibold leading-none shadow-sm shadow-black/[0.02] dark:shadow-black/20 transition-shadow duration-150 hover:shadow";

export function ServisStatusBadge({ value }: { value: string }) {
  const s = STATUS[value] ?? STATUS.qebul_edildi;
  return (
    <span className={cn(PILL, s.cls)}>
      <span aria-hidden className={cn("h-1.5 w-1.5 shrink-0 rounded-full", s.dotCls)} />
      {s.label}
    </span>
  );
}

const PRIORITY: Record<string, Def> = {
  asagi: {
    label: "Aşağı",
    cls: "bg-gradient-to-b from-slate-500/15 to-slate-500/[0.06] text-slate-700 ring-1 ring-inset ring-slate-500/20 dark:text-slate-300",
    dotCls: "bg-slate-500",
  },
  orta: {
    label: "Orta",
    cls: "bg-gradient-to-b from-sky-500/15 to-sky-500/[0.06] text-sky-700 ring-1 ring-inset ring-sky-500/20 dark:text-sky-300",
    dotCls: "bg-sky-500",
  },
  yuksek: {
    label: "Yüksək",
    cls: "bg-gradient-to-b from-amber-500/15 to-amber-500/[0.06] text-amber-800 ring-1 ring-inset ring-amber-500/30 dark:text-amber-300",
    dotCls: "bg-amber-500",
  },
  tecili: {
    label: "Təcili",
    cls: "bg-gradient-to-b from-rose-500/15 to-rose-500/[0.06] text-rose-700 ring-1 ring-inset ring-rose-500/20 dark:text-rose-300",
    dotCls: "bg-rose-500 animate-pulse",
  },
};

export function ServisPriorityBadge({ value }: { value: string }) {
  const p = PRIORITY[value] ?? PRIORITY.orta;
  return (
    <span className={cn(PILL, p.cls)}>
      <span aria-hidden className={cn("h-1.5 w-1.5 shrink-0 rounded-full", p.dotCls)} />
      {p.label}
    </span>
  );
}
