import Link from "next/link";
import { Users, Crown, ShoppingBag, Handshake, Star, type LucideIcon } from "lucide-react";
import { cn, formatMoney } from "@/lib/utils";
import type { SegmentCountsResult } from "../queries";

type SegmentMeta = {
  qiymet_tipi: string;
  label: string;
  icon: LucideIcon;
  tone: "primary" | "amber" | "violet" | "emerald" | "rose";
  desc: string;
};

const MUSTERI_SEGMENTS: SegmentMeta[] = [
  { qiymet_tipi: "adi",      label: "Pərakəndə",  icon: ShoppingBag, tone: "primary", desc: "Standart qiymət" },
  { qiymet_tipi: "topdan",   label: "Topdan",     icon: Users,       tone: "amber",   desc: "Topdan satış" },
  { qiymet_tipi: "partnyor", label: "Diller",     icon: Handshake,   tone: "violet",  desc: "Partnyor / diller" },
  { qiymet_tipi: "vip",      label: "VIP",        icon: Crown,       tone: "emerald", desc: "VIP / korporativ" },
];

const TECH_SEGMENTS: SegmentMeta[] = [
  { qiymet_tipi: "adi",      label: "Standart",   icon: ShoppingBag, tone: "primary", desc: "Adi tədarükçü" },
  { qiymet_tipi: "topdan",   label: "Topdan",     icon: Users,       tone: "amber",   desc: "Topdan tədarük" },
  { qiymet_tipi: "partnyor", label: "Partnyor",   icon: Handshake,   tone: "violet",  desc: "Uzunmüddətli partnyor" },
  { qiymet_tipi: "vip",      label: "Strateji",   icon: Star,        tone: "emerald", desc: "Strateji tədarükçü" },
];

const TONE_CLS = {
  primary: {
    active: "border-primary bg-primary/15 text-primary",
    badge: "bg-primary/20 text-primary",
  },
  amber: {
    active: "border-amber-500 bg-amber-500/15 text-amber-600 dark:text-amber-400",
    badge: "bg-amber-500/20 text-amber-600 dark:text-amber-400",
  },
  violet: {
    active: "border-violet-500 bg-violet-500/15 text-violet-600 dark:text-violet-400",
    badge: "bg-violet-500/20 text-violet-600 dark:text-violet-400",
  },
  emerald: {
    active: "border-emerald-500 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
    badge: "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400",
  },
  rose: {
    active: "border-rose-500 bg-rose-500/15 text-rose-500",
    badge: "bg-rose-500/20 text-rose-500",
  },
};

/**
 * Segment tabs based on `qiymet_tipi` — clickable pills with counts and debt totals.
 * Each tab toggles `?qiymet=...` in the URL; "Hamısı" clears it.
 */
export function SegmentTabs({
  basePath,
  current,
  data,
  nov,
  searchParams,
}: {
  basePath: string;
  current: string | undefined;
  data: SegmentCountsResult;
  nov: "musteri" | "techizatci";
  searchParams: Record<string, string | undefined>;
}) {
  const meta = nov === "musteri" ? MUSTERI_SEGMENTS : TECH_SEGMENTS;
  const segMap = new Map(data.segments.map((s) => [s.qiymet_tipi, s]));

  const buildHref = (qiymetValue?: string) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(searchParams)) {
      if (k === "qiymet") continue;
      if (v) p.set(k, v);
    }
    if (qiymetValue) p.set("qiymet", qiymetValue);
    const qs = p.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
        {/* All */}
        <Link
          href={buildHref(undefined)}
          className={cn(
            "rounded-xl border bg-card/40 p-3 transition hover:-translate-y-0.5 hover:border-primary/40",
            !current && "border-foreground/30 bg-foreground/5 ring-1 ring-foreground/20"
          )}
        >
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs font-bold">Hamısı</span>
          </div>
          <div className="mt-1.5 text-2xl font-bold tabular-nums">{data.total}</div>
          <div className="text-[10px] text-muted-foreground">{formatMoney(data.borc_total)} borc</div>
        </Link>

        {meta.map((s) => {
          const stat = segMap.get(s.qiymet_tipi);
          const count = stat?.count ?? 0;
          const debt = stat?.borc_cemi ?? 0;
          const active = current === s.qiymet_tipi;
          const Icon = s.icon;
          const tone = TONE_CLS[s.tone];
          return (
            <Link
              key={s.qiymet_tipi}
              href={buildHref(s.qiymet_tipi)}
              className={cn(
                "rounded-xl border p-3 transition hover:-translate-y-0.5 hover:border-primary/40",
                active ? tone.active : "border-border bg-card/40"
              )}
            >
              <div className="flex items-center gap-2">
                <Icon className="h-4 w-4" />
                <span className="text-xs font-bold">{s.label}</span>
              </div>
              <div className="mt-1.5 text-2xl font-bold tabular-nums">{count}</div>
              <div className="text-[10px] opacity-75">{s.desc}</div>
              {debt > 0 && (
                <div className={cn("mt-1 inline-block rounded-full px-1.5 py-0.5 text-[10px] font-semibold", tone.badge)}>
                  Borc: {formatMoney(debt)}
                </div>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
