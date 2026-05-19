import { Filter, FileText, ShoppingCart, XCircle, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Funnel = {
  leads: number;
  quotes: number;
  sales: number;
  lost: number;
};

const fmt = (n: number) => new Intl.NumberFormat("az-AZ").format(n);

export function SalesFunnel({ data }: { data: Funnel }) {
  const max = Math.max(data.leads, 1);
  const stages = [
    { key: "leads" as const, label: "Yeni müştəri", icon: Users, value: data.leads, color: "bg-sky-500", textColor: "text-sky-600" },
    { key: "quotes" as const, label: "Təklif", icon: FileText, value: data.quotes, color: "bg-amber-500", textColor: "text-amber-600" },
    { key: "sales" as const, label: "Satış", icon: ShoppingCart, value: data.sales, color: "bg-emerald-500", textColor: "text-emerald-600" },
    { key: "lost" as const, label: "Ləğv", icon: XCircle, value: data.lost, color: "bg-rose-500", textColor: "text-rose-500" },
  ];

  const conversionRate = data.quotes > 0 ? ((data.sales / data.quotes) * 100).toFixed(1) : "0";
  const leadToSale = data.leads > 0 ? ((data.sales / data.leads) * 100).toFixed(1) : "0";

  return (
    <Card className="glass">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-base">
          <span className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-primary" />
            Satış funnel (bu ay)
          </span>
          <span className="text-[10.5px] text-muted-foreground">lead → satış</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Visual funnel */}
        <div className="space-y-2.5">
          {stages.map((s, idx) => {
            const Icon = s.icon;
            const widthPct = max > 0 ? (s.value / max) * 100 : 0;
            const isLast = idx === stages.length - 1;
            const prev = idx > 0 && idx < 3 ? stages[idx - 1].value : null;
            const dropPct = prev != null && prev > 0 ? (((prev - s.value) / prev) * 100).toFixed(0) : null;

            return (
              <div key={s.key} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="inline-flex items-center gap-1.5">
                    <Icon className={cn("h-3.5 w-3.5", s.textColor)} />
                    <span className="font-semibold">{s.label}</span>
                    {dropPct && Number(dropPct) > 0 && (
                      <span className="text-[10px] text-muted-foreground">↓ {dropPct}% itki</span>
                    )}
                  </span>
                  <span className={cn("text-base font-bold tabular-nums", s.textColor)}>{fmt(s.value)}</span>
                </div>
                <div className="relative h-7 overflow-hidden rounded-md bg-secondary/60">
                  <div
                    className={cn("h-full rounded-md transition-all duration-700", s.color, isLast && "opacity-60")}
                    style={{ width: `${Math.max(widthPct, 4)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Conversion summary */}
        <div className="grid grid-cols-2 gap-2 border-t border-border/40 pt-3">
          <div className="rounded-lg bg-secondary/40 px-3 py-2 text-center">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Lead → Satış
            </div>
            <div className="text-xl font-bold tabular-nums text-primary">{leadToSale}%</div>
          </div>
          <div className="rounded-lg bg-secondary/40 px-3 py-2 text-center">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Təklif → Satış
            </div>
            <div className="text-xl font-bold tabular-nums text-emerald-600">{conversionRate}%</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
