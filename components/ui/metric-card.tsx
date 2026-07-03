"use client";

import { useEffect, useState } from "react";
import { ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";
import { cn, formatMoney, formatNumber } from "@/lib/utils";

type Trend = { value: number; label?: string };

type Props = {
  label: string;
  value: number | string;
  icon?: React.ComponentType<{ className?: string }>;
  tone?: "default" | "primary" | "emerald" | "rose" | "amber" | "violet" | "sky";
  trend?: Trend;
  sub?: string;
  loading?: boolean;
  format?: "number" | "money" | "percent" | "plain";
  href?: string;
  animated?: boolean;
};

const TONE_BG: Record<NonNullable<Props["tone"]>, string> = {
  default: "from-foreground/5 to-foreground/0 text-foreground",
  primary: "from-primary/15 to-primary/0 text-primary",
  emerald: "from-emerald-500/15 to-emerald-500/0 text-emerald-500",
  rose: "from-rose-500/15 to-rose-500/0 text-rose-500",
  amber: "from-amber-500/15 to-amber-500/0 text-amber-500",
  violet: "from-violet-500/15 to-violet-500/0 text-violet-500",
  sky: "from-sky-500/15 to-sky-500/0 text-sky-500",
};

function useAnimatedNumber(target: number, enabled = true, durationMs = 600) {
  const [val, setVal] = useState(enabled ? 0 : target);
  useEffect(() => {
    if (!enabled || !Number.isFinite(target)) {
      setVal(target);
      return;
    }
    const start = performance.now();
    const startVal = 0;
    let raf = 0;
    const step = (t: number) => {
      const progress = Math.min(1, (t - start) / durationMs);
      const eased = 1 - Math.pow(1 - progress, 3);
      setVal(startVal + (target - startVal) * eased);
      if (progress < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, enabled, durationMs]);
  return val;
}

function format(value: number | string, fmt: Props["format"] = "number") {
  if (typeof value === "string") return value;
  if (fmt === "money") return formatMoney(value);
  if (fmt === "percent") return value.toFixed(1) + "%";
  if (fmt === "plain") return String(value);
  return formatNumber(Math.round(value), 0);
}

export function MetricCard({
  label,
  value,
  icon: Icon,
  tone = "default",
  trend,
  sub,
  loading,
  format: fmt = "number",
  href,
  animated = true,
}: Props) {
  const numericValue = typeof value === "number" ? value : NaN;
  const animatedValue = useAnimatedNumber(numericValue, animated && Number.isFinite(numericValue));
  const display =
    typeof value === "string"
      ? value
      : format(animated && Number.isFinite(numericValue) ? animatedValue : numericValue, fmt);

  const Wrapper = href ? (props: React.ComponentPropsWithoutRef<"a">) => <a href={href} {...props} /> : "div";

  const trendDir = trend ? (trend.value > 0 ? "up" : trend.value < 0 ? "down" : "flat") : null;

  return (
    <Wrapper
      className={cn(
        "group relative overflow-hidden rounded-xl border border-border/40 bg-card/40 backdrop-blur transition-all",
        "hover:-translate-y-0.5 hover:border-border hover:shadow-md hover:shadow-foreground/5",
        href && "cursor-pointer"
      )}
    >
      {/* Gradient halo */}
      <div
        className={cn(
          "pointer-events-none absolute inset-0 bg-gradient-to-br opacity-50 transition-opacity group-hover:opacity-100",
          TONE_BG[tone]
        )}
      />

      <div className="relative flex items-start justify-between gap-3 px-4 py-3">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
            {label}
          </div>
          {loading ? (
            <div className="h-7 w-16 animate-pulse rounded bg-muted" />
          ) : (
            <div className={cn("text-2xl font-bold tabular-nums leading-none", `text-${tone === "default" ? "foreground" : tone}`)}>
              {display}
            </div>
          )}
          {sub && <div className="truncate text-[10.5px] text-muted-foreground/80">{sub}</div>}
          {trend && trendDir && (
            <div className="flex items-center gap-1 text-[10.5px]">
              {trendDir === "up" ? (
                <ArrowUpRight className="h-3 w-3 text-emerald-500" />
              ) : trendDir === "down" ? (
                <ArrowDownRight className="h-3 w-3 text-rose-500" />
              ) : (
                <Minus className="h-3 w-3 text-muted-foreground" />
              )}
              <span
                className={cn(
                  "font-semibold",
                  trendDir === "up" ? "text-emerald-500" : trendDir === "down" ? "text-rose-500" : "text-muted-foreground"
                )}
              >
                {trend.value > 0 ? "+" : ""}
                {trend.value.toFixed(1)}%
              </span>
              {trend.label && <span className="text-muted-foreground">{trend.label}</span>}
            </div>
          )}
        </div>
        {Icon && (
          <div
            className={cn(
              "grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-background/60 ring-1 ring-border/40 transition group-hover:scale-110"
            )}
          >
            <Icon className="h-4 w-4" />
          </div>
        )}
      </div>
    </Wrapper>
  );
}
