import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  Inbox,
  Search,
  HelpCircle,
  Boxes,
  Wrench,
  CheckCircle2,
  Truck,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

type StatusKey =
  | "qebul_edildi"
  | "diaqnostikada"
  | "teklif_gozleyir"
  | "ehtiyat_hisse"
  | "temir_olunur"
  | "temir_edildi"
  | "musteriye_tehvil"
  | "redd_edildi";

type StageDef = {
  key: StatusKey;
  label: string;
  icon: LucideIcon;
  /** Tailwind palette key (used for ring/border/icon background) */
  tone: "rose" | "amber" | "violet" | "orange" | "sky" | "emerald" | "emerald-solid" | "slate";
};

const STAGES: StageDef[] = [
  { key: "qebul_edildi",      label: "Qəbul edildi",     icon: Inbox,        tone: "rose" },
  { key: "diaqnostikada",     label: "Yoxlanılır",       icon: Search,       tone: "amber" },
  { key: "teklif_gozleyir",   label: "Təklif gözləyir",  icon: HelpCircle,   tone: "violet" },
  { key: "ehtiyat_hisse",     label: "Hissə gözləyir",   icon: Boxes,        tone: "orange" },
  { key: "temir_olunur",      label: "Təmir olunur",     icon: Wrench,       tone: "sky" },
  { key: "temir_edildi",      label: "Hazırdır",         icon: CheckCircle2, tone: "emerald" },
  { key: "musteriye_tehvil",  label: "Təhvil verildi",   icon: Truck,        tone: "emerald-solid" },
  { key: "redd_edildi",       label: "Rədd edildi",      icon: XCircle,      tone: "slate" },
];

const TONE_CARD: Record<StageDef["tone"], string> = {
  rose: "border-rose-400/30 hover:border-rose-400/60",
  amber: "border-amber-400/30 hover:border-amber-400/60",
  violet: "border-violet-400/30 hover:border-violet-400/60",
  orange: "border-orange-400/30 hover:border-orange-400/60",
  sky: "border-sky-400/30 hover:border-sky-400/60",
  emerald: "border-emerald-400/30 hover:border-emerald-400/60",
  "emerald-solid": "border-emerald-500/40 hover:border-emerald-500/70 bg-emerald-500/5",
  slate: "border-slate-400/30 hover:border-slate-400/60",
};

const TONE_ICON: Record<StageDef["tone"], string> = {
  rose: "bg-rose-400/15 text-rose-300",
  amber: "bg-amber-400/15 text-amber-300",
  violet: "bg-violet-400/15 text-violet-300",
  orange: "bg-orange-400/15 text-orange-300",
  sky: "bg-sky-400/15 text-sky-300",
  emerald: "bg-emerald-400/15 text-emerald-300",
  "emerald-solid": "bg-emerald-500/25 text-emerald-200",
  slate: "bg-slate-400/15 text-slate-300",
};

const TONE_RING: Record<StageDef["tone"], string> = {
  rose: "ring-rose-400/60",
  amber: "ring-amber-400/60",
  violet: "ring-violet-400/60",
  orange: "ring-orange-400/60",
  sky: "ring-sky-400/60",
  emerald: "ring-emerald-400/60",
  "emerald-solid": "ring-emerald-500/70",
  slate: "ring-slate-400/60",
};

export function StatusKpiStrip({
  counts,
  activeStatus,
}: {
  counts: Record<string, number>;
  activeStatus?: string;
}) {
  return (
    <section className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
      {STAGES.map((s) => {
        const value = counts[s.key] ?? 0;
        const active = activeStatus === s.key;
        return (
          <Link
            key={s.key}
            href={`/servis?status=${s.key}`}
            className={cn(
              "glass group block rounded-lg border bg-card/40 p-3 transition",
              TONE_CARD[s.tone],
              active && cn("ring-1", TONE_RING[s.tone]),
            )}
          >
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "inline-flex h-7 w-7 items-center justify-center rounded-md",
                  TONE_ICON[s.tone],
                )}
              >
                <s.icon className="h-3.5 w-3.5" />
              </span>
              <span className="text-[10.5px] font-medium uppercase tracking-wider text-muted-foreground">
                {s.label}
              </span>
            </div>
            <div className="mt-1.5 text-xl font-bold tabular-nums">{value}</div>
          </Link>
        );
      })}
    </section>
  );
}
