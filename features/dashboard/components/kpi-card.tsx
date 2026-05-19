import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { TrendingUp, TrendingDown } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Sparkline } from "@/components/ui/sparkline";
import { cn } from "@/lib/utils";

type Props = {
  icon: LucideIcon;
  label: string;
  value: string;
  subline?: string;
  tone?: "neutral" | "success" | "warning" | "danger" | "info";
  trend?: { dir: "up" | "down"; label: string };
  href?: string;
  active?: boolean;
  /** Optional inline sparkline shown at the bottom of the card */
  sparkline?: number[];
  /** Render value at larger size for hero placement */
  size?: "default" | "hero";
};

const SPARKLINE_COLOR: Record<NonNullable<Props["tone"]>, string> = {
  neutral: "hsl(var(--primary))",
  success: "hsl(142 76% 45%)",
  warning: "hsl(38 92% 50%)",
  danger:  "hsl(0 84% 60%)",
  info:    "hsl(217 91% 60%)",
};

const TONE_CLASS: Record<NonNullable<Props["tone"]>, string> = {
  neutral: "text-foreground",
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
  info: "text-info",
};

const ICON_TONE: Record<NonNullable<Props["tone"]>, string> = {
  neutral: "bg-secondary/60 text-foreground/60",
  success: "bg-success/15 text-success",
  warning: "bg-warning/15 text-warning",
  danger: "bg-danger/15 text-danger",
  info: "bg-info/15 text-info",
};

export function KpiCard({ icon: Icon, label, value, subline, tone = "neutral", trend, href, active, sparkline, size = "default" }: Props) {
  const card = (
    <Card
      className={cn(
        "group glass relative overflow-hidden transition-all duration-200",
        href && "cursor-pointer hover:-translate-y-0.5 hover:border-primary/40 hover:bg-secondary/30 hover:shadow-md hover:shadow-foreground/5",
        active && "border-primary/60 ring-1 ring-primary/30"
      )}
    >
      {/* Subtle gradient halo */}
      <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-gradient-to-br opacity-40 blur-2xl transition-opacity group-hover:opacity-80"
           style={{
             background: tone === "success" ? "radial-gradient(circle, hsl(142 76% 45% / 0.4), transparent 70%)" :
                         tone === "danger" ? "radial-gradient(circle, hsl(0 84% 60% / 0.4), transparent 70%)" :
                         tone === "warning" ? "radial-gradient(circle, hsl(38 92% 50% / 0.4), transparent 70%)" :
                         tone === "info" ? "radial-gradient(circle, hsl(217 91% 60% / 0.4), transparent 70%)" :
                         "radial-gradient(circle, hsl(var(--primary) / 0.2), transparent 70%)",
           }}
      />
      <CardContent className={cn("relative", size === "hero" ? "space-y-2 py-5" : "space-y-1.5 py-4")}>
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-[10.5px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
            <span className={cn("grid h-5 w-5 place-items-center rounded-md transition", ICON_TONE[tone])}>
              <Icon className="h-3 w-3" />
            </span>
            {label}
          </span>
          {trend && (
            <span
              className={cn(
                "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                trend.dir === "up" ? "bg-success/15 text-success" : "bg-danger/15 text-danger"
              )}
            >
              {trend.dir === "up" ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {trend.label}
            </span>
          )}
        </div>
        <div className={cn(
          "font-bold tracking-tight tabular-nums transition",
          size === "hero" ? "text-3xl md:text-[28px] leading-none" : "text-2xl",
          TONE_CLASS[tone]
        )}>
          {value}
        </div>
        {subline && <div className="text-[11px] leading-snug text-muted-foreground">{subline}</div>}
        {sparkline && sparkline.length > 1 && (
          <div className="-mx-1 mt-1 opacity-90 transition group-hover:opacity-100">
            <Sparkline
              data={sparkline}
              width={size === "hero" ? 220 : 140}
              height={size === "hero" ? 36 : 28}
              color={SPARKLINE_COLOR[tone]}
              filled
              showLast
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
  if (href) {
    return (
      <Link href={href} className="block">
        {card}
      </Link>
    );
  }
  return card;
}
