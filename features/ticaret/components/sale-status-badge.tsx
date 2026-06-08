import { cn } from "@/lib/utils";

type StatusDef = {
  label: string;
  /** vertical gradient + text + dot */
  cls: string;
  dotCls: string;
};

const STATUS: Record<string, StatusDef> = {
  aktiv: {
    label: "Aktiv",
    cls: "bg-gradient-to-b from-emerald-500/15 to-emerald-500/[0.06] text-emerald-700 ring-1 ring-inset ring-emerald-500/20 dark:text-emerald-300",
    dotCls: "bg-emerald-500",
  },
  gozleyen_tesdiq: {
    label: "Təsdiq gözləyir",
    cls: "bg-gradient-to-b from-amber-500/15 to-amber-500/[0.06] text-amber-800 ring-1 ring-inset ring-amber-500/30 dark:text-amber-300",
    dotCls: "bg-amber-500 animate-pulse",
  },
  yeni: {
    label: "Yeni",
    cls: "bg-gradient-to-b from-sky-500/15 to-sky-500/[0.06] text-sky-700 ring-1 ring-inset ring-sky-500/20 dark:text-sky-300",
    dotCls: "bg-sky-500",
  },
  tesdiqlenmemis: {
    label: "Gözləyir",
    cls: "bg-gradient-to-b from-amber-500/15 to-amber-500/[0.06] text-amber-800 ring-1 ring-inset ring-amber-500/30 dark:text-amber-300",
    dotCls: "bg-amber-500 animate-pulse",
  },
  tesdiqlendi: {
    label: "Təsdiqləndi",
    cls: "bg-gradient-to-b from-sky-500/15 to-sky-500/[0.06] text-sky-700 ring-1 ring-inset ring-sky-500/20 dark:text-sky-300",
    dotCls: "bg-sky-500",
  },
  tesdiq: {
    label: "Təsdiq",
    cls: "bg-gradient-to-b from-violet-500/15 to-violet-500/[0.06] text-violet-700 ring-1 ring-inset ring-violet-500/20 dark:text-violet-300",
    dotCls: "bg-violet-500",
  },
  tesdiq_gozleyir: {
    label: "Təsdiq gözləyir",
    cls: "bg-gradient-to-b from-amber-500/15 to-amber-500/[0.06] text-amber-800 ring-1 ring-inset ring-amber-500/30 dark:text-amber-300",
    dotCls: "bg-amber-500 animate-pulse",
  },
  gonderildi: {
    label: "Göndərildi",
    cls: "bg-gradient-to-b from-blue-500/15 to-blue-500/[0.06] text-blue-700 ring-1 ring-inset ring-blue-500/20 dark:text-blue-300",
    dotCls: "bg-blue-500",
  },
  gozlemede: {
    label: "Gözləmədə",
    cls: "bg-gradient-to-b from-amber-500/15 to-amber-500/[0.06] text-amber-800 ring-1 ring-inset ring-amber-500/30 dark:text-amber-300",
    dotCls: "bg-amber-500",
  },
  qebul_edildi: {
    label: "Qəbul edildi",
    cls: "bg-gradient-to-b from-emerald-500/15 to-emerald-500/[0.06] text-emerald-700 ring-1 ring-inset ring-emerald-500/20 dark:text-emerald-300",
    dotCls: "bg-emerald-500",
  },
  tamamlandi: {
    label: "Tamamlandı",
    cls: "bg-gradient-to-b from-emerald-500/15 to-emerald-500/[0.06] text-emerald-700 ring-1 ring-inset ring-emerald-500/20 dark:text-emerald-300",
    dotCls: "bg-emerald-500",
  },
  legv: {
    label: "Ləğv",
    cls: "bg-gradient-to-b from-rose-500/15 to-rose-500/[0.06] text-rose-700 ring-1 ring-inset ring-rose-500/20 line-through decoration-rose-500/40 dark:text-rose-300",
    dotCls: "bg-rose-500",
  },
  redd: {
    label: "Rədd",
    cls: "bg-gradient-to-b from-rose-500/15 to-rose-500/[0.06] text-rose-700 ring-1 ring-inset ring-rose-500/20 dark:text-rose-300",
    dotCls: "bg-rose-500",
  },
};

const ODENIS: Record<string, StatusDef> = {
  negd: {
    label: "Nağd",
    cls: "bg-gradient-to-b from-emerald-500/15 to-emerald-500/[0.06] text-emerald-700 ring-1 ring-inset ring-emerald-500/20 dark:text-emerald-300",
    dotCls: "bg-emerald-500",
  },
  kart: {
    label: "Kart",
    cls: "bg-gradient-to-b from-sky-500/15 to-sky-500/[0.06] text-sky-700 ring-1 ring-inset ring-sky-500/20 dark:text-sky-300",
    dotCls: "bg-sky-500",
  },
  kecirme: {
    label: "Bank",
    cls: "bg-gradient-to-b from-indigo-500/15 to-indigo-500/[0.06] text-indigo-700 ring-1 ring-inset ring-indigo-500/20 dark:text-indigo-300",
    dotCls: "bg-indigo-500",
  },
  bank: {
    label: "Bank",
    cls: "bg-gradient-to-b from-indigo-500/15 to-indigo-500/[0.06] text-indigo-700 ring-1 ring-inset ring-indigo-500/20 dark:text-indigo-300",
    dotCls: "bg-indigo-500",
  },
  nisye: {
    label: "Borc",
    cls: "bg-gradient-to-b from-amber-500/15 to-amber-500/[0.06] text-amber-800 ring-1 ring-inset ring-amber-500/30 dark:text-amber-300",
    dotCls: "bg-amber-500",
  },
  borc: {
    label: "Borc",
    cls: "bg-gradient-to-b from-amber-500/15 to-amber-500/[0.06] text-amber-800 ring-1 ring-inset ring-amber-500/30 dark:text-amber-300",
    dotCls: "bg-amber-500",
  },
};

const PILL_BASE =
  "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10.5px] font-semibold leading-none shadow-sm shadow-black/[0.02] dark:shadow-black/20 transition-shadow duration-150 hover:shadow";

export function SaleStatusBadge({ value }: { value: string }) {
  const s = STATUS[value] ?? STATUS.yeni;
  return (
    <span className={cn(PILL_BASE, s.cls)}>
      <span aria-hidden className={cn("h-1.5 w-1.5 shrink-0 rounded-full", s.dotCls)} />
      {s.label}
    </span>
  );
}

export function PaymentBadge({ value }: { value: string }) {
  const o = ODENIS[value] ?? ODENIS.negd;
  return (
    <span className={cn(PILL_BASE, o.cls)}>
      <span aria-hidden className={cn("h-1.5 w-1.5 shrink-0 rounded-full", o.dotCls)} />
      {o.label}
    </span>
  );
}
