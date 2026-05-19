import Link from "next/link";
import {
  Sparkles,
  AlertTriangle,
  TrendingUp,
  Lightbulb,
  ArrowRight,
  Brain,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { TradeInsight } from "../dashboard-queries";

const INSIGHT_STYLE: Record<
  TradeInsight["novu"],
  { icon: React.ComponentType<{ className?: string }>; cls: string; badge: string; label: string }
> = {
  alarm: {
    icon: AlertTriangle,
    cls: "border-rose-500/30 bg-rose-500/5 hover:bg-rose-500/10",
    badge: "bg-rose-500/15 text-rose-600",
    label: "ALARM",
  },
  fursat: {
    icon: Sparkles,
    cls: "border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/10",
    badge: "bg-emerald-500/15 text-emerald-600",
    label: "FÜRSƏT",
  },
  tovsiye: {
    icon: Lightbulb,
    cls: "border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10",
    badge: "bg-amber-500/15 text-amber-600",
    label: "TÖVSİYƏ",
  },
  ugur: {
    icon: TrendingUp,
    cls: "border-primary/30 bg-primary/5 hover:bg-primary/10",
    badge: "bg-primary/15 text-primary",
    label: "UĞUR",
  },
};

export function TradeInsights({ insights }: { insights: TradeInsight[] }) {
  if (insights.length === 0) {
    return (
      <Card className="glass">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Brain className="h-4 w-4 text-primary" />
            AI Biznes İnsight
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-dashed border-border py-8 text-center">
            <Sparkles className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">Hələ insight yoxdur — daha çox satış əməliyyatı lazımdır</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-base">
          <span className="flex items-center gap-2">
            <Brain className="h-4 w-4 text-primary" />
            AI Biznes İnsight
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[9px] font-bold text-primary">
              {insights.length}
            </span>
          </span>
          <span className="text-[10.5px] text-muted-foreground">real-time analiz</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          {insights.map((ins, i) => {
            const style = INSIGHT_STYLE[ins.novu];
            const Icon = style.icon;
            const Wrap = ins.href ? Link : "div";
            const wrapProps = ins.href ? { href: ins.href } : ({} as Record<string, unknown>);
            return (
              <Wrap
                key={i}
                {...(wrapProps as { href: string })}
                className={cn(
                  "group flex items-start gap-2.5 rounded-xl border p-3 transition-all",
                  style.cls,
                  ins.href && "cursor-pointer hover:-translate-y-0.5 hover:shadow-md"
                )}
              >
                <div className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-lg shadow-sm", style.badge)}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <Badge variant="outline" className={cn("text-[9px] font-bold", style.badge)}>
                      {style.label}
                    </Badge>
                    {ins.metric && (
                      <span className="rounded-md bg-background/60 px-1.5 py-0.5 text-[10px] font-bold tabular-nums">
                        {ins.metric}
                      </span>
                    )}
                  </div>
                  <h4 className="mt-1 text-sm font-bold leading-tight">{ins.basliq}</h4>
                  <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted-foreground">{ins.tesvir}</p>
                  {ins.href && (
                    <div className="mt-1 inline-flex items-center gap-1 text-[10.5px] font-semibold text-foreground/70 transition group-hover:gap-2">
                      Ətraflı bax <ArrowRight className="h-3 w-3 transition group-hover:translate-x-0.5" />
                    </div>
                  )}
                </div>
              </Wrap>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
