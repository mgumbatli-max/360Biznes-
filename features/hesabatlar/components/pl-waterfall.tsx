import { TrendingUp, ShoppingCart, Receipt, RotateCcw, Wallet } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoney } from "@/lib/utils";
import { cn } from "@/lib/utils";

type Step = {
  key: string;
  label: string;
  value: number;
  kind: "in" | "out" | "subtotal";
  icon: React.ComponentType<{ className?: string }>;
  hint?: string;
};

/**
 * P&L waterfall: shows how revenue flows down to net profit step by step.
 * Each bar is positioned and sized to reflect "running balance" → very intuitive.
 */
export function PlWaterfall({
  revenue,
  returns,
  cogs,
  opex,
  gross,
  net,
}: {
  revenue: number;
  returns: number;
  cogs: number;
  opex: number;
  gross: number;
  net: number;
}) {
  const steps: Step[] = [
    { key: "rev", label: "Gəlir", value: revenue, kind: "in", icon: ShoppingCart, hint: "Bütün satışlar" },
    { key: "ret", label: "Qaytarmalar", value: -returns, kind: "out", icon: RotateCcw, hint: "Qaytarılan mallar" },
    { key: "cogs", label: "COGS", value: -cogs, kind: "out", icon: Receipt, hint: "Satılan malların mayası" },
    { key: "gross", label: "Brüt mənfəət", value: gross, kind: "subtotal", icon: TrendingUp },
    { key: "opex", label: "OPEX", value: -opex, kind: "out", icon: Wallet, hint: "Əməliyyat xərcləri" },
    { key: "net", label: "Net mənfəət", value: net, kind: "subtotal", icon: TrendingUp },
  ];

  const max = Math.max(revenue, gross, net, 1);
  const scale = (v: number) => Math.max(2, (Math.abs(v) / max) * 100);

  return (
    <Card className="glass">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <TrendingUp className="h-4 w-4 text-primary" />
          P&L waterfall
        </CardTitle>
        <p className="text-xs text-muted-foreground">Gəlirdən net mənfəətə qədər axın</p>
      </CardHeader>
      <CardContent className="space-y-3">
        {steps.map((s, idx) => {
          const isSubtotal = s.kind === "subtotal";
          const isIn = s.kind === "in";
          const w = scale(s.value);

          const bar =
            s.kind === "in"
              ? "from-emerald-500/60 to-emerald-500/30 border-emerald-500/40"
              : s.kind === "out"
              ? "from-rose-500/55 to-rose-500/25 border-rose-500/40"
              : s.value >= 0
              ? "from-primary/60 to-primary/30 border-primary/50"
              : "from-rose-600/60 to-rose-600/30 border-rose-600/50";

          const Icon = s.icon;
          return (
            <div key={s.key} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="inline-flex items-center gap-2">
                  <Icon className={cn("h-3.5 w-3.5", isIn ? "text-emerald-500" : s.kind === "out" ? "text-rose-500" : "text-primary")} />
                  <span className={cn("font-semibold", isSubtotal && "text-sm")}>{s.label}</span>
                  {s.hint && <span className="text-[10px] text-muted-foreground">— {s.hint}</span>}
                </span>
                <span
                  className={cn(
                    "tabular-nums",
                    isSubtotal ? "text-base font-bold" : "text-sm font-semibold",
                    s.kind === "out" && "text-rose-500",
                    s.kind === "in" && "text-emerald-500",
                    isSubtotal && s.value < 0 && "text-rose-500",
                    isSubtotal && s.value >= 0 && "text-primary"
                  )}
                >
                  {s.value < 0 ? "− " : isIn ? "+ " : ""}
                  {formatMoney(Math.abs(s.value))}
                </span>
              </div>
              <div className="h-3 rounded-md bg-secondary/40 overflow-hidden">
                <div
                  className={cn("h-full rounded-md border bg-gradient-to-r transition-all duration-700", bar, isSubtotal && "shadow-sm")}
                  style={{ width: `${w}%` }}
                />
              </div>
              {idx < steps.length - 1 && !isSubtotal && (
                <div className="ml-1 h-1.5 w-px bg-border/50" aria-hidden />
              )}
            </div>
          );
        })}

        <div className="grid grid-cols-2 gap-2 border-t border-border/40 pt-3">
          <div className="rounded-lg bg-secondary/40 px-3 py-2 text-center">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Brüt marja</div>
            <div className={cn("text-lg font-bold tabular-nums", gross >= 0 ? "text-primary" : "text-rose-500")}>
              {revenue - returns > 0 ? ((gross / (revenue - returns)) * 100).toFixed(1) : "0"}%
            </div>
          </div>
          <div className="rounded-lg bg-secondary/40 px-3 py-2 text-center">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Net marja</div>
            <div className={cn("text-lg font-bold tabular-nums", net >= 0 ? "text-emerald-500" : "text-rose-500")}>
              {revenue - returns > 0 ? ((net / (revenue - returns)) * 100).toFixed(1) : "0"}%
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
