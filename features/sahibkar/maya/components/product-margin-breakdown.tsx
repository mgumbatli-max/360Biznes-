import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, TrendingDown } from "lucide-react";
import { formatMoney, formatNumber } from "@/lib/utils";

type Item = {
  mehsul_id: string;
  ad: string;
  satilan_say: number;
  revenue: number;
  profit: number;
  margin_pct: number;
};

export function ProductMarginBreakdown({ top, bottom }: { top: Item[]; bottom: Item[] }) {
  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      <Card className="glass border-emerald-500/30">
        <CardContent className="space-y-2 py-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <TrendingUp className="h-4 w-4 text-emerald-500" /> Ən gəlirli məhsullar (bu ay)
          </h3>
          {top.length === 0 ? (
            <p className="text-xs text-muted-foreground">Bu ay satış yoxdur.</p>
          ) : (
            <ul className="space-y-1">
              {top.map((p) => (
                <ProductRow key={p.mehsul_id} item={p} tone="emerald" />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className="glass border-rose-500/30">
        <CardContent className="space-y-2 py-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <TrendingDown className="h-4 w-4 text-rose-500" /> Ən aşağı marja məhsullar (bu ay)
          </h3>
          {bottom.length === 0 ? (
            <p className="text-xs text-muted-foreground">Bu ay satış yoxdur.</p>
          ) : (
            <ul className="space-y-1">
              {bottom.map((p) => (
                <ProductRow key={p.mehsul_id} item={p} tone="rose" />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ProductRow({ item, tone }: { item: Item; tone: "emerald" | "rose" }) {
  const toneClass = tone === "emerald" ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400";
  return (
    <li className="flex items-center justify-between gap-3 rounded-md border border-border/30 px-2 py-1.5 text-xs">
      <div className="min-w-0">
        <div className="truncate font-medium">{item.ad}</div>
        <div className="text-[10.5px] text-muted-foreground">
          {formatNumber(item.satilan_say, 0)} satıldı • {formatMoney(item.revenue)}
        </div>
      </div>
      <div className="text-right">
        <div className={`tabular-nums font-semibold ${toneClass}`}>{item.margin_pct.toFixed(1)}%</div>
        <div className="text-[10.5px] text-muted-foreground tabular-nums">{formatMoney(item.profit)}</div>
      </div>
    </li>
  );
}

type CatItem = {
  kateqoriya_id: string | null;
  kateqoriya_ad: string;
  revenue: number;
  cogs: number;
  profit: number;
  margin_pct: number;
  mehsul_sayi: number;
};

export function KateqoriyaBreakdown({ items }: { items: CatItem[] }) {
  if (items.length === 0) return null;
  const totalRevenue = items.reduce((a, b) => a + b.revenue, 0) || 1;
  return (
    <Card className="glass">
      <CardContent className="space-y-3 py-4">
        <h3 className="text-sm font-semibold">Kateqoriya üzrə satış / maya (bu ay)</h3>
        <div className="space-y-2">
          {items.map((c) => {
            const pct = (c.revenue / totalRevenue) * 100;
            return (
              <div key={c.kateqoriya_id ?? c.kateqoriya_ad} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium">{c.kateqoriya_ad}</span>
                  <div className="flex items-center gap-3 text-[10.5px] text-muted-foreground">
                    <span>{c.mehsul_sayi} məhsul</span>
                    <span className={`tabular-nums font-semibold ${c.margin_pct >= 20 ? "text-emerald-500" : c.margin_pct >= 10 ? "text-amber-500" : "text-rose-500"}`}>
                      {c.margin_pct.toFixed(1)}%
                    </span>
                    <span className="tabular-nums">{formatMoney(c.revenue)}</span>
                  </div>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                  <div className="h-full bg-gradient-to-r from-emerald-500 to-cyan-500" style={{ width: `${Math.min(100, pct)}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

type TrendItem = {
  ay: string;
  revenue: number;
  cogs: number;
  profit: number;
  margin_pct: number;
};

export function MayaTrendChart({ items }: { items: TrendItem[] }) {
  const max = Math.max(1, ...items.map((i) => i.revenue));
  const monthLabel = (ay: string) => {
    const [y, m] = ay.split("-");
    return `${["Yan","Fev","Mar","Apr","May","İyn","İyl","Avq","Sen","Okt","Noy","Dek"][Number(m)-1]} '${y.slice(2)}`;
  };
  return (
    <Card className="glass">
      <CardContent className="space-y-3 py-4">
        <h3 className="text-sm font-semibold">Son 6 ay trendi (gəlir / maya / mənfəət)</h3>
        <div className="grid grid-cols-6 gap-2">
          {items.map((m) => (
            <div key={m.ay} className="flex flex-col items-center gap-1">
              <div className="relative flex h-24 w-full items-end overflow-hidden rounded bg-secondary/40">
                <div className="absolute inset-x-0 bottom-0 bg-rose-500/40" style={{ height: `${(m.cogs / max) * 100}%` }} />
                <div className="absolute inset-x-0 bottom-0 bg-emerald-500/60" style={{ height: `${(m.profit / max) * 100}%`, transform: `translateY(-${(m.cogs / max) * 100}%)` }} />
              </div>
              <div className="text-[9.5px] text-muted-foreground">{monthLabel(m.ay)}</div>
              <div className="text-[10px] tabular-nums">{formatMoney(m.revenue)}</div>
              <div className={`text-[9.5px] tabular-nums ${m.margin_pct >= 20 ? "text-emerald-500" : m.margin_pct >= 10 ? "text-amber-500" : "text-rose-500"}`}>
                {m.margin_pct.toFixed(0)}%
              </div>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-center gap-3 text-[10.5px] text-muted-foreground">
          <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-sm bg-rose-500/60"></span> COGS</span>
          <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-sm bg-emerald-500/60"></span> Mənfəət</span>
        </div>
      </CardContent>
    </Card>
  );
}
