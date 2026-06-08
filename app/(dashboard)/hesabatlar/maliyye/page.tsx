import type { Metadata } from "next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Equal, Receipt, Anchor, Wind } from "lucide-react";
import { DateRangeFilter } from "@/features/hesabatlar/components/date-range-filter";
import { MonthlyPlChart, HorizontalBarChart } from "@/features/hesabatlar/components/charts";
import { PlWaterfall } from "@/features/hesabatlar/components/pl-waterfall";
import { YoyStrip } from "@/features/hesabatlar/components/yoy-strip";
import { getPlSummary, getMonthlyPl12, getYoyPl, getFixedVariableBreak } from "@/features/hesabatlar/maliyye-queries";
import { getExpenseCategories } from "@/features/hesabatlar/pul-queries";
import { parseDateRange, formatDateInput, rangeLabel, lastMonthRange, thisMonthRange } from "@/features/hesabatlar/shared";
import { requireHesabatPagePerm } from "@/features/hesabatlar/access-guard";
import { formatMoney } from "@/lib/utils";

export const metadata: Metadata = { title: "Maliyyə hesabatı (P&L)" };

type SP = { from?: string; to?: string; preset?: string };

export default async function MaliyyeReportPage({ searchParams }: { searchParams: Promise<SP> }) {
  await requireHesabatPagePerm("maliye.view");
  const sp = await searchParams;
  const range = parseDateRange(sp);

  const [pl, monthly, expenseCats, thisPl, lastPl, yoy, fxVar] = await Promise.all([
    getPlSummary(range),
    getMonthlyPl12(),
    getExpenseCategories(),
    getPlSummary(thisMonthRange()),
    getPlSummary(lastMonthRange()),
    getYoyPl(range),
    getFixedVariableBreak(range),
  ]);

  const delta = (cur: number, prev: number) => {
    if (prev === 0) return cur === 0 ? 0 : 100;
    return ((cur - prev) / Math.abs(prev)) * 100;
  };
  const cmpRows = [
    { label: "Gəlir", cur: thisPl.revenue, prev: lastPl.revenue, goodUp: true },
    { label: "Xərc (OPEX)", cur: thisPl.opex, prev: lastPl.opex, goodUp: false },
    { label: "Brüt mənfəət", cur: thisPl.gross_profit, prev: lastPl.gross_profit, goodUp: true },
    { label: "Net mənfəət", cur: thisPl.net_profit, prev: lastPl.net_profit, goodUp: true },
    { label: "Brüt marja %", cur: thisPl.gross_margin_pct, prev: lastPl.gross_margin_pct, goodUp: true, isPct: true },
    { label: "Net marja %", cur: thisPl.net_margin_pct, prev: lastPl.net_margin_pct, goodUp: true, isPct: true },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Maliyyə hesabatı (P&L)</h1>
        <p className="mt-1 text-sm text-muted-foreground">{rangeLabel(range)}</p>
      </header>

      <DateRangeFilter
        base="/hesabatlar/maliyye"
        current={{ from: formatDateInput(range.from), to: formatDateInput(range.to), preset: sp.preset }}
        exportHref={`/api/hesabatlar/maliyye/export?from=${formatDateInput(range.from)}&to=${formatDateInput(range.to)}`}
      />

      {/* Bu ay vs keçən ay müqayisəsi */}
      <Card className="glass" data-section="finance-comparison">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Bu ay vs keçən ay</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
            {cmpRows.map((r) => {
              const d = delta(r.cur, r.prev);
              const positive = (d > 0) === r.goodUp;
              const tone = d === 0 ? "text-muted-foreground" : positive ? "text-success" : "text-danger";
              const format = r.isPct ? (v: number) => `${v.toFixed(1)}%` : formatMoney;
              return (
                <div key={r.label} className="rounded-lg border border-border bg-card/40 p-3" data-cmp-row={r.label}>
                  <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground">{r.label}</div>
                  <div className="mt-1 text-lg font-bold tabular-nums">{format(r.cur)}</div>
                  <div className="mt-0.5 text-xs text-muted-foreground tabular-nums">Keçən ay: {format(r.prev)}</div>
                  <div className={`mt-1 text-xs font-semibold tabular-nums ${tone}`}>
                    {d >= 0 ? "+" : ""}{d.toFixed(1)}%
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Year-over-Year strip */}
      <YoyStrip
        title="İllik müqayisə (YoY)"
        curLabel="Bu dövr"
        prevLabel="Keçən il"
        rows={[
          { label: "Gəlir", cur: yoy.cur.revenue, prev: yoy.prev.revenue, goodUp: true },
          { label: "COGS", cur: yoy.cur.cogs, prev: yoy.prev.cogs, goodUp: false },
          { label: "Brüt mənfəət", cur: yoy.cur.gross_profit, prev: yoy.prev.gross_profit, goodUp: true },
          { label: "OPEX", cur: yoy.cur.opex, prev: yoy.prev.opex, goodUp: false },
          { label: "Net mənfəət", cur: yoy.cur.net_profit, prev: yoy.prev.net_profit, goodUp: true },
          { label: "Net marja %", cur: yoy.cur.net_margin_pct, prev: yoy.prev.net_margin_pct, goodUp: true, isPct: true },
        ]}
      />

      {/* Waterfall — visualize the P&L flow */}
      <PlWaterfall
        revenue={pl.revenue}
        returns={pl.returns}
        cogs={pl.cogs}
        opex={pl.opex}
        gross={pl.gross_profit}
        net={pl.net_profit}
      />

      <Card className="glass">
        <CardHeader>
          <CardTitle className="text-base">Mənfəət-zərər hesabatı</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Line icon={TrendingUp} tone="success" label="Gəlir (satış)" value={pl.revenue} />
          {pl.returns > 0 && <Line icon={TrendingDown} tone="warning" label="Qaytarmalar" value={-pl.returns} />}
          <Line icon={TrendingDown} tone="danger" label="COGS (satılan malların mayası)" value={-pl.cogs} />
          <Divider />
          <Line
            icon={Equal}
            tone={pl.gross_profit >= 0 ? "success" : "danger"}
            label="Brüt mənfəət"
            value={pl.gross_profit}
            bold
            subline={`${pl.gross_margin_pct.toFixed(1)}% gross margin`}
          />
          <Line icon={Receipt} tone="danger" label="Əməliyyat xərcləri (OPEX)" value={-pl.opex} />
          <Divider />
          <Line
            icon={Equal}
            tone={pl.net_profit >= 0 ? "success" : "danger"}
            label="Net mənfəət"
            value={pl.net_profit}
            bold
            big
            subline={`${pl.net_margin_pct.toFixed(1)}% net margin`}
          />
        </CardContent>
      </Card>

      <Card className="glass">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Son 12 ay (gəlir, brüt, net, OPEX)</CardTitle>
        </CardHeader>
        <CardContent>
          <MonthlyPlChart data={monthly} />
        </CardContent>
      </Card>

      <Card className="glass">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Xərc kateqoriyaları (bu ay)</CardTitle>
        </CardHeader>
        <CardContent>
          <HorizontalBarChart data={expenseCats.slice(0, 12).map((c) => ({ label: c.kateqoriya, value: c.mebleg, sub: c.sayi }))} />
        </CardContent>
      </Card>

      {/* Fixed vs Variable expense breakdown */}
      <Card className="glass">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Sabit vs dəyişkən xərclər</CardTitle>
          <p className="text-xs text-muted-foreground">
            Sabit xərclər (kirayə, maaş, abunəlik) hər ay təxminən eynidir; dəyişkən xərclər həcm ilə dəyişir.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
              <div className="flex items-center gap-2">
                <Anchor className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold">Sabit xərclər</span>
              </div>
              <div className="mt-2 text-2xl font-bold tabular-nums">{formatMoney(fxVar.fixed_total)}</div>
              <div className="text-xs text-muted-foreground">{fxVar.fixed_pct.toFixed(1)}% — cəm xərcdən</div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-secondary/40">
                <div className="h-full rounded-full bg-primary transition-all duration-700" style={{ width: `${fxVar.fixed_pct}%` }} />
              </div>
            </div>
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
              <div className="flex items-center gap-2">
                <Wind className="h-4 w-4 text-amber-500" />
                <span className="text-sm font-semibold">Dəyişkən xərclər</span>
              </div>
              <div className="mt-2 text-2xl font-bold tabular-nums">{formatMoney(fxVar.variable_total)}</div>
              <div className="text-xs text-muted-foreground">{fxVar.variable_pct.toFixed(1)}% — cəm xərcdən</div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-secondary/40">
                <div className="h-full rounded-full bg-amber-500 transition-all duration-700" style={{ width: `${fxVar.variable_pct}%` }} />
              </div>
            </div>
          </div>

          {fxVar.categories.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border/60 text-left text-[10.5px] uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">Kateqoriya</th>
                    <th className="px-3 py-2">Tip</th>
                    <th className="px-3 py-2 text-right">Məbləğ</th>
                  </tr>
                </thead>
                <tbody>
                  {fxVar.categories.slice(0, 15).map((c) => (
                    <tr key={c.ad} className="border-b border-border/30">
                      <td className="px-3 py-2 font-medium">{c.ad}</td>
                      <td className="px-3 py-2">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                            c.tip === "sabit"
                              ? "border-primary/30 bg-primary/10 text-primary"
                              : "border-amber-500/30 bg-amber-500/10 text-amber-500"
                          }`}
                        >
                          {c.tip === "sabit" ? "Sabit" : "Dəyişkən"}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums font-semibold">{formatMoney(c.mebleg)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Line({
  icon: Icon,
  tone,
  label,
  value,
  bold,
  big,
  subline,
}: {
  icon: React.ComponentType<{ className?: string }>;
  tone: "success" | "danger" | "warning" | "neutral";
  label: string;
  value: number;
  bold?: boolean;
  big?: boolean;
  subline?: string;
}) {
  const toneCls =
    tone === "success" ? "text-success" : tone === "danger" ? "text-danger" : tone === "warning" ? "text-warning" : "text-foreground";
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Icon className={`h-4 w-4 ${toneCls}`} />
        <div>
          <span className={`text-sm ${bold ? "font-semibold" : ""}`}>{label}</span>
          {subline && <div className="text-[10.5px] text-muted-foreground">{subline}</div>}
        </div>
      </div>
      <span className={`tabular-nums ${big ? "text-xl font-bold" : bold ? "font-semibold" : ""} ${toneCls}`}>
        {value < 0 ? "− " : ""}
        {formatMoney(Math.abs(value))}
      </span>
    </div>
  );
}

function Divider() {
  return <div className="h-px bg-border/60" />;
}
