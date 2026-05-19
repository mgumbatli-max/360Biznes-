import type { Metadata } from "next";
import { Percent, TrendingUp, TrendingDown, Package, Users, AlertTriangle, Award, BarChart3, Filter, Tag } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { KpiCard } from "@/features/dashboard/components/kpi-card";
import { DateRangeFilter } from "@/features/hesabatlar/components/date-range-filter";
import { HorizontalBarChart } from "@/features/hesabatlar/components/charts";
import { ViewToggle, SortLink, parseView } from "@/features/hesabatlar/components/view-toggle";
import { MehsulBrick, KateqoriyaBrick, MusteriBrick, BrickEmpty } from "@/features/hesabatlar/components/brick-cards";
import {
  getMarjaKpi,
  getMarjaByCategory,
  getMarjaProducts,
  getMarjaByCustomer,
  getMarjaBuckets,
} from "@/features/hesabatlar/marja-queries";
import { parseDateRange, formatDateInput, rangeLabel } from "@/features/hesabatlar/shared";
import { formatMoney, formatNumber } from "@/lib/utils";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Marja hesabatı" };
export const dynamic = "force-dynamic";

type SP = {
  from?: string;
  to?: string;
  preset?: string;
  gorunus?: string; // cedvel | kerpic
  cat_view?: string;
  cust_view?: string;
  prod_view?: string;
  sort?: string;
  dir?: "asc" | "desc";
};

function marginColor(pct: number) {
  if (pct >= 30) return "text-emerald-500";
  if (pct >= 15) return "text-primary";
  if (pct >= 5) return "text-amber-500";
  if (pct >= 0) return "text-orange-500";
  return "text-rose-500";
}

function marginBadge(pct: number) {
  if (pct >= 30) return { cls: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30", label: "Əla" };
  if (pct >= 15) return { cls: "bg-primary/15 text-primary border-primary/30", label: "Yaxşı" };
  if (pct >= 5) return { cls: "bg-amber-500/15 text-amber-500 border-amber-500/30", label: "Orta" };
  if (pct >= 0) return { cls: "bg-orange-500/15 text-orange-500 border-orange-500/30", label: "Aşağı" };
  return { cls: "bg-rose-500/15 text-rose-500 border-rose-500/30", label: "Zərər" };
}

export default async function MarjaReportPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const range = parseDateRange(sp);

  const prodView = parseView(sp, "prod_view");
  const custView = parseView(sp, "cust_view");
  const catView = parseView(sp, "cat_view");

  const sortField = sp.sort ?? "margin_pct";
  const sortDir = sp.dir === "asc" ? "asc" : "desc";

  const [kpi, byCat, bestProducts, worstProducts, biggestEarners, byCust, buckets] = await Promise.all([
    getMarjaKpi(range),
    getMarjaByCategory(range),
    getMarjaProducts(range, "best", 20),
    getMarjaProducts(range, "worst", 15),
    getMarjaProducts(range, "biggest", 20),
    getMarjaByCustomer(range, 24),
    getMarjaBuckets(range),
  ]);

  // Sort categories by selected field
  const sortedCats = [...byCat].sort((a, b) => {
    const f = sortField as keyof typeof a;
    const va = Number(a[f] ?? 0);
    const vb = Number(b[f] ?? 0);
    return sortDir === "asc" ? va - vb : vb - va;
  });

  const baseUrl = "/hesabatlar/marja";
  const spDict: Record<string, string | undefined> = {
    from: sp.from,
    to: sp.to,
    preset: sp.preset,
    gorunus: sp.gorunus,
    cat_view: sp.cat_view,
    cust_view: sp.cust_view,
    prod_view: sp.prod_view,
    sort: sp.sort,
    dir: sp.dir,
  };

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <header>
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500">
            <Percent className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Marja hesabatı</h1>
            <p className="text-sm text-muted-foreground">{rangeLabel(range)} — kateqoriya, məhsul və müştəri üzrə marja analizi</p>
          </div>
        </div>
      </header>

      <DateRangeFilter
        base={baseUrl}
        current={{ from: formatDateInput(range.from), to: formatDateInput(range.to), preset: sp.preset }}
      />

      {/* KPI strip */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        <KpiCard icon={TrendingUp} label="Gəlir" value={formatMoney(kpi.revenue)} subline={`${formatNumber(kpi.total_units, 0)} ədəd`} tone="success" />
        <KpiCard icon={TrendingDown} label="Maya (COGS)" value={formatMoney(kpi.cogs)} subline="Alış qiyməti" tone="warning" />
        <KpiCard
          icon={Percent}
          label="Cəm marja"
          value={formatMoney(kpi.margin)}
          subline={`${kpi.margin_pct.toFixed(1)}% gəlirdən`}
          tone={kpi.margin >= 0 ? "success" : "danger"}
        />
        <KpiCard
          icon={BarChart3}
          label="Marja %"
          value={`${kpi.margin_pct.toFixed(1)}%`}
          subline={kpi.margin_pct >= 25 ? "Sağlam" : kpi.margin_pct >= 10 ? "Orta" : "Aşağı"}
          tone={kpi.margin_pct >= 25 ? "success" : kpi.margin_pct >= 10 ? "neutral" : "danger"}
        />
        <KpiCard icon={Award} label="Orta ədəd marja" value={formatMoney(kpi.avg_margin_per_item)} subline="Vahid başına" />
        <KpiCard
          icon={AlertTriangle}
          label="Loss leaders"
          value={String(kpi.loss_leaders_count)}
          subline="Zərərlə satılan məhsul"
          tone={kpi.loss_leaders_count > 0 ? "danger" : "success"}
        />
      </section>

      {/* Marja distribution */}
      <Card className="glass">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart3 className="h-4 w-4 text-primary" />
            Məhsul marja paylanması
          </CardTitle>
          <p className="text-xs text-muted-foreground">Hansı marja səviyyəsində neçə məhsul satılır</p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-6">
            {buckets.map((b) => {
              const isLoss = b.bucket === "Zərərlə";
              const color = isLoss
                ? "bg-rose-500/15 text-rose-500 border-rose-500/30"
                : b.bucket === "50%+"
                ? "bg-emerald-500/15 text-emerald-500 border-emerald-500/30"
                : b.bucket === "30-50%"
                ? "bg-primary/15 text-primary border-primary/30"
                : "bg-secondary/40 text-muted-foreground border-border";
              return (
                <div key={b.bucket} className={cn("rounded-lg border p-3 text-center", color)}>
                  <div className="text-[10px] font-semibold uppercase tracking-wider">{b.bucket}</div>
                  <div className="mt-1 text-xl font-bold tabular-nums">{b.count}</div>
                  <div className="text-[10px] tabular-nums opacity-75">{formatMoney(b.revenue)}</div>
                </div>
              );
            })}
            {buckets.length === 0 && (
              <div className="col-span-full py-8 text-center text-sm text-muted-foreground">Bu dövrdə satış yoxdur</div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Category leaderboard — toggle table/brick + sortable */}
      <Card className="glass">
        <CardHeader className="flex flex-wrap items-center justify-between gap-2 pb-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Tag className="h-4 w-4 text-primary" />
              Kateqoriya üzrə marja
            </CardTitle>
            <p className="text-xs text-muted-foreground">Sıralanma: {sortField} {sortDir === "desc" ? "↓" : "↑"}</p>
          </div>
          <ViewToggle base={baseUrl} current={catView} searchParams={spDict} param="cat_view" />
        </CardHeader>
        <CardContent className={catView === "kerpic" ? "" : "p-0"}>
          {catView === "kerpic" ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {sortedCats.length === 0 ? (
                <BrickEmpty icon={Tag} msg="Kateqoriya məlumatı yoxdur" />
              ) : (
                sortedCats.map((c) => (
                  <KateqoriyaBrick
                    key={c.kateqoriya}
                    ad={c.kateqoriya}
                    units={c.units}
                    revenue={c.revenue}
                    cogs={c.cogs}
                    margin={c.margin}
                    margin_pct={c.margin_pct}
                  />
                ))
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border/60 text-left text-[10.5px] uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">Kateqoriya</th>
                    <th className="px-3 py-2 text-right">
                      <SortLink base={baseUrl} searchParams={spDict} field="units" currentField={sortField} currentDir={sortDir}>Ədəd</SortLink>
                    </th>
                    <th className="px-3 py-2 text-right">
                      <SortLink base={baseUrl} searchParams={spDict} field="revenue" currentField={sortField} currentDir={sortDir}>Gəlir</SortLink>
                    </th>
                    <th className="px-3 py-2 text-right">
                      <SortLink base={baseUrl} searchParams={spDict} field="cogs" currentField={sortField} currentDir={sortDir}>COGS</SortLink>
                    </th>
                    <th className="px-3 py-2 text-right">
                      <SortLink base={baseUrl} searchParams={spDict} field="margin" currentField={sortField} currentDir={sortDir}>Marja</SortLink>
                    </th>
                    <th className="px-3 py-2 text-right">
                      <SortLink base={baseUrl} searchParams={spDict} field="margin_pct" currentField={sortField} currentDir={sortDir}>Marja %</SortLink>
                    </th>
                    <th className="px-3 py-2 text-right">Tutum</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedCats.length === 0 ? (
                    <tr><td colSpan={7} className="py-8 text-center text-sm text-muted-foreground">Məlumat yoxdur</td></tr>
                  ) : (
                    sortedCats.map((c) => {
                      const share = kpi.revenue > 0 ? (c.revenue / kpi.revenue) * 100 : 0;
                      return (
                        <tr key={c.kateqoriya} className="border-b border-border/30 hover:bg-secondary/20">
                          <td className="px-3 py-2 font-medium">{c.kateqoriya}</td>
                          <td className="px-3 py-2 text-right tabular-nums text-xs">{formatNumber(c.units, 0)}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{formatMoney(c.revenue)}</td>
                          <td className="px-3 py-2 text-right tabular-nums text-xs text-muted-foreground">{formatMoney(c.cogs)}</td>
                          <td className={cn("px-3 py-2 text-right tabular-nums font-semibold", marginColor(c.margin_pct))}>{formatMoney(c.margin)}</td>
                          <td className="px-3 py-2 text-right">
                            <Badge variant="outline" className={cn("text-[10px]", marginBadge(c.margin_pct).cls)}>
                              {c.margin_pct.toFixed(1)}%
                            </Badge>
                          </td>
                          <td className="px-3 py-2 text-right">
                            <div className="ml-auto flex w-24 items-center gap-1.5">
                              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary/60">
                                <div className="h-full rounded-full bg-primary/70" style={{ width: `${Math.min(100, share)}%` }} />
                              </div>
                              <span className="w-9 text-right text-[10px] tabular-nums text-muted-foreground">{share.toFixed(0)}%</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Best products — toggle */}
      <Card className="glass">
        <CardHeader className="flex flex-wrap items-center justify-between gap-2 pb-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Award className="h-4 w-4 text-emerald-500" />
              Ən yüksək marjalı 20 məhsul
            </CardTitle>
            <p className="text-xs text-muted-foreground">Marja % bazasında sıralanıb</p>
          </div>
          <ViewToggle base={baseUrl} current={prodView} searchParams={spDict} param="prod_view" />
        </CardHeader>
        <CardContent className={prodView === "kerpic" ? "" : "p-0"}>
          {prodView === "kerpic" ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {bestProducts.length === 0 ? (
                <BrickEmpty msg="Məhsul məlumatı yoxdur" />
              ) : (
                bestProducts.map((p, i) => (
                  <MehsulBrick
                    key={p.mehsul_id}
                    rank={i + 1}
                    ad={p.ad}
                    kod={p.kod}
                    kateqoriya={p.kateqoriya}
                    units={p.units}
                    revenue={p.revenue}
                    cogs={p.cogs}
                    margin={p.margin}
                    margin_pct={p.margin_pct}
                  />
                ))
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border/60 text-left text-[10.5px] uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">#</th>
                    <th className="px-3 py-2">Məhsul</th>
                    <th className="px-3 py-2">Kateqoriya</th>
                    <th className="px-3 py-2 text-right">Ədəd</th>
                    <th className="px-3 py-2 text-right">Gəlir</th>
                    <th className="px-3 py-2 text-right">COGS</th>
                    <th className="px-3 py-2 text-right">Marja</th>
                    <th className="px-3 py-2 text-right">Marja %</th>
                  </tr>
                </thead>
                <tbody>
                  {bestProducts.length === 0 ? (
                    <tr><td colSpan={8} className="py-8 text-center text-sm text-muted-foreground">Məlumat yoxdur</td></tr>
                  ) : (
                    bestProducts.map((p, i) => (
                      <tr key={p.mehsul_id} className="border-b border-border/30 hover:bg-secondary/20">
                        <td className="px-3 py-2 text-xs tabular-nums">{i + 1}</td>
                        <td className="px-3 py-2">
                          <div className="font-medium">{p.ad}</div>
                          {p.kod && <div className="text-[10px] font-mono text-muted-foreground">{p.kod}</div>}
                        </td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">{p.kateqoriya}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-xs">{formatNumber(p.units, 0)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{formatMoney(p.revenue)}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-xs text-muted-foreground">{formatMoney(p.cogs)}</td>
                        <td className="px-3 py-2 text-right tabular-nums font-semibold text-emerald-500">{formatMoney(p.margin)}</td>
                        <td className="px-3 py-2 text-right">
                          <Badge variant="outline" className={cn("text-[10px]", marginBadge(p.margin_pct).cls)}>
                            {p.margin_pct.toFixed(1)}%
                          </Badge>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Worst products (loss leaders) */}
      <Card className="glass">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="h-4 w-4 text-rose-500" />
            Ən aşağı marjalı 15 məhsul (loss leaders riski)
          </CardTitle>
          <p className="text-xs text-muted-foreground">Yenidən qiymət strategiyası tələb edir</p>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border/60 text-left text-[10.5px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">#</th>
                  <th className="px-3 py-2">Məhsul</th>
                  <th className="px-3 py-2">Kateqoriya</th>
                  <th className="px-3 py-2 text-right">Ədəd</th>
                  <th className="px-3 py-2 text-right">Gəlir</th>
                  <th className="px-3 py-2 text-right">COGS</th>
                  <th className="px-3 py-2 text-right">Marja</th>
                  <th className="px-3 py-2 text-right">Marja %</th>
                </tr>
              </thead>
              <tbody>
                {worstProducts.length === 0 ? (
                  <tr><td colSpan={8} className="py-8 text-center text-sm text-muted-foreground">Məlumat yoxdur</td></tr>
                ) : (
                  worstProducts.map((p, i) => (
                    <tr key={p.mehsul_id} className="border-b border-border/30 hover:bg-rose-500/5">
                      <td className="px-3 py-2 text-xs tabular-nums">{i + 1}</td>
                      <td className="px-3 py-2">
                        <div className="font-medium">{p.ad}</div>
                        {p.kod && <div className="text-[10px] font-mono text-muted-foreground">{p.kod}</div>}
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{p.kateqoriya}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-xs">{formatNumber(p.units, 0)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatMoney(p.revenue)}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-xs text-muted-foreground">{formatMoney(p.cogs)}</td>
                      <td className={cn("px-3 py-2 text-right tabular-nums font-semibold", marginColor(p.margin_pct))}>
                        {p.margin < 0 ? "− " : ""}{formatMoney(Math.abs(p.margin))}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Badge variant="outline" className={cn("text-[10px]", marginBadge(p.margin_pct).cls)}>
                          {p.margin_pct.toFixed(1)}%
                        </Badge>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Biggest earners — absolute margin */}
      <Card className="glass">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Package className="h-4 w-4 text-primary" />
            Cash cow: ən çox marja qazandıran 20 məhsul
          </CardTitle>
          <p className="text-xs text-muted-foreground">Mütləq marja məbləği — bu məhsullar biznesin əsas qazanc lokomotivi</p>
        </CardHeader>
        <CardContent>
          <HorizontalBarChart
            data={biggestEarners.slice(0, 12).map((p) => ({ label: p.ad, value: p.margin, sub: p.units }))}
            label="Marja"
          />
        </CardContent>
      </Card>

      {/* Customer profitability — toggle */}
      <Card className="glass">
        <CardHeader className="flex flex-wrap items-center justify-between gap-2 pb-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4 text-primary" />
              Müştəri üzrə marja (top 24)
            </CardTitle>
            <p className="text-xs text-muted-foreground">Hansı müştərilərdən daha çox qazanırsınız</p>
          </div>
          <ViewToggle base={baseUrl} current={custView} searchParams={spDict} param="cust_view" />
        </CardHeader>
        <CardContent className={custView === "kerpic" ? "" : "p-0"}>
          {custView === "kerpic" ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {byCust.length === 0 ? (
                <BrickEmpty icon={Users} msg="Müştəri məlumatı yoxdur" />
              ) : (
                byCust.map((c, i) => (
                  <MusteriBrick
                    key={c.musteri_id}
                    rank={i + 1}
                    ad={c.ad}
                    orders={c.orders}
                    revenue={c.revenue}
                    margin={c.margin}
                    margin_pct={c.margin_pct}
                  />
                ))
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border/60 text-left text-[10.5px] uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">#</th>
                    <th className="px-3 py-2">Müştəri</th>
                    <th className="px-3 py-2 text-right">Sifariş</th>
                    <th className="px-3 py-2 text-right">Gəlir</th>
                    <th className="px-3 py-2 text-right">COGS</th>
                    <th className="px-3 py-2 text-right">Marja</th>
                    <th className="px-3 py-2 text-right">Marja %</th>
                    <th className="px-3 py-2 text-right">Orta çek</th>
                  </tr>
                </thead>
                <tbody>
                  {byCust.length === 0 ? (
                    <tr><td colSpan={8} className="py-8 text-center text-sm text-muted-foreground">Məlumat yoxdur</td></tr>
                  ) : (
                    byCust.map((c, i) => (
                      <tr key={c.musteri_id} className="border-b border-border/30 hover:bg-secondary/20">
                        <td className="px-3 py-2 text-xs tabular-nums">{i + 1}</td>
                        <td className="px-3 py-2 font-medium">{c.ad}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{c.orders}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-xs text-muted-foreground">{formatMoney(c.revenue)}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-xs text-muted-foreground">{formatMoney(c.cogs)}</td>
                        <td className={cn("px-3 py-2 text-right tabular-nums font-semibold", marginColor(c.margin_pct))}>
                          {formatMoney(c.margin)}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <Badge variant="outline" className={cn("text-[10px]", marginBadge(c.margin_pct).cls)}>
                            {c.margin_pct.toFixed(1)}%
                          </Badge>
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-xs">{formatMoney(c.orders > 0 ? c.revenue / c.orders : 0)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Filters hint */}
      <div className="rounded-lg border border-dashed border-border/40 bg-card/20 p-3 text-[10.5px] text-muted-foreground">
        <Filter className="mr-1 inline h-3 w-3" />
        Hər cədvəldə sütun başlığına klik edərək sıralanmağı dəyişə bilərsiniz. Yuxarı sağdakı toggle ilə kərpic görünüşünə keçin.
      </div>
    </div>
  );
}
