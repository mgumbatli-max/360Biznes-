import type { Metadata } from "next";
import { TrendingUp, Receipt, Users, Award, RotateCcw, ShoppingCart, Percent } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { KpiCard } from "@/features/dashboard/components/kpi-card";
import { DateRangeFilter } from "@/features/hesabatlar/components/date-range-filter";
import { YoyStrip } from "@/features/hesabatlar/components/yoy-strip";
import { ViewToggle, parseView } from "@/features/hesabatlar/components/view-toggle";
import { MehsulBrick, MusteriBrick, SaticiBrick, BrickEmpty } from "@/features/hesabatlar/components/brick-cards";
import {
  DailyLineChart,
  HorizontalBarChart,
  PiePaymentChart,
} from "@/features/hesabatlar/components/charts";
import {
  getSalesKpi,
  getDailySales,
  getSalesHeatmap,
  getPaymentMethodSlices,
  getSalesByWarehouse,
  getSalesByUser,
  getTopProductsExt,
  getTopCustomersExt,
  getMonthlyComparison,
  getSalesPivot,
  getYoyComparison,
  getMarginByProduct,
  getHourlyPerf,
  type GroupKey,
} from "@/features/hesabatlar/satis-queries";
import { parseDateRange, formatDateInput } from "@/features/hesabatlar/shared";
import { formatMoney, formatNumber, cn } from "@/lib/utils";
import { getStealthState } from "@/lib/stealth/server"; // QA-orta: gizli rejim miqyası

export const metadata: Metadata = { title: "Satış hesabatı" };

const PAYMENT_LABELS: Record<string, string> = { negd: "Nağd", kart: "Kart", kecirme: "Bank köçürmə", nisye: "Nisyə (borc)" };
const DOW = ["B", "Be", "Ça", "Çə", "Cə", "Cü", "Şə"];

type SP = {
  from?: string;
  to?: string;
  preset?: string;
  anbar?: string;
  satici?: string;
  odenis?: string;
  group?: string;
  prod_view?: string;
  cust_view?: string;
  user_view?: string;
};

const GROUP_OPTIONS: { value: GroupKey; label: string }[] = [
  { value: "gun", label: "Gün" },
  { value: "hefte", label: "Həftə" },
  { value: "ay", label: "Ay" },
  { value: "menecer", label: "Menecer" },
  { value: "musteri", label: "Müştəri" },
  { value: "anbar", label: "Anbar" },
  { value: "odenis", label: "Ödəniş növü" },
];

export default async function SatisReportPage({ searchParams }: { searchParams: Promise<SP> }) {
  // 🔒 (audit #12) Səhifə-səviyyəli guard — yalnız layout gate-ə söykənmə (müdafiə-dərinliyi).
  const { requireHesabatPagePerm } = await import("@/features/hesabatlar/access-guard");
  await requireHesabatPagePerm("hesabat.view");
  const sp = await searchParams;
  const range = parseDateRange(sp);
  const filter = {
    range,
    anbar_id: sp.anbar ? Number(sp.anbar) : undefined,
    satici_id: sp.satici || undefined,
    odenis_nov: sp.odenis || undefined,
  };

  const groupKey: GroupKey = (sp.group as GroupKey) || "gun";
  const validGroup = GROUP_OPTIONS.some((g) => g.value === groupKey) ? groupKey : "gun";

  const [kpi, daily, heat, byPay, byAnbar, byUser, topProducts, topCustomers, cmp, pivot, yoy, topMargins, hourly] = await Promise.all([
    getSalesKpi(filter),
    getDailySales(filter),
    getSalesHeatmap(filter),
    getPaymentMethodSlices(filter),
    getSalesByWarehouse(filter),
    getSalesByUser(filter, 10),
    getTopProductsExt(filter, 20),
    getTopCustomersExt(filter, 20),
    getMonthlyComparison(range),
    getSalesPivot(filter, validGroup),
    getYoyComparison(range),
    getMarginByProduct(filter, 10, "best"),
    getHourlyPerf(filter),
  ]);

  // QA-orta: kpi.total_amount gizli rejimdə scale olunur, cədvəl sətirləri isə raw —
  // pay (share) raw cəmlə hesablanır ki, 100%-dən böyük absurd faizlər çıxmasın.
  const stealth = await getStealthState();
  const rawTotal = stealth.aktiv && stealth.scale > 0 ? kpi.total_amount / stealth.scale : kpi.total_amount;

  const bestHour = hourly.length > 0 ? hourly.reduce((a, b) => (b.mebleg > a.mebleg ? b : a)) : null;
  const worstHour = hourly.filter((h) => h.sayi > 0).length > 0
    ? hourly.filter((h) => h.sayi > 0).reduce((a, b) => (b.mebleg < a.mebleg ? b : a))
    : null;

  const prodView = parseView(sp, "prod_view");
  const custView = parseView(sp, "cust_view");
  const userView = parseView(sp, "user_view");
  const spDict: Record<string, string | undefined> = {
    from: sp.from,
    to: sp.to,
    preset: sp.preset,
    anbar: sp.anbar,
    satici: sp.satici,
    odenis: sp.odenis,
    group: sp.group,
    prod_view: sp.prod_view,
    cust_view: sp.cust_view,
    user_view: sp.user_view,
  };

  // Build heatmap grid
  const grid: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
  let heatMax = 0;
  for (const h of heat) {
    grid[h.dow][h.hour] = h.say;
    if (h.say > heatMax) heatMax = h.say;
  }
  const heatBg = (v: number) => {
    if (v <= 0) return "bg-secondary/40";
    const p = v / Math.max(1, heatMax);
    if (p < 0.2) return "bg-success/15";
    if (p < 0.4) return "bg-success/35";
    if (p < 0.6) return "bg-success/55";
    if (p < 0.8) return "bg-warning/55";
    return "bg-danger/70";
  };

  const exportParams = new URLSearchParams({
    from: formatDateInput(range.from),
    to: formatDateInput(range.to),
  });
  if (sp.anbar) exportParams.set("anbar", sp.anbar);
  if (sp.satici) exportParams.set("satici", sp.satici);
  if (sp.odenis) exportParams.set("odenis", sp.odenis);

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Satış hesabatı</h1>
        <p className="mt-1 text-sm text-muted-foreground">KPI-lər, trend, heatmap və ən yaxşı kateqoriyalar üzrə analiz.</p>
      </header>

      <DateRangeFilter
        base="/hesabatlar/satis"
        current={{ from: formatDateInput(range.from), to: formatDateInput(range.to), preset: sp.preset }}
        exportHref={`/api/hesabatlar/satis/export?${exportParams.toString()}`}
      />

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        <KpiCard icon={ShoppingCart} label="Sifariş" value={formatNumber(kpi.total_count, 0)} subline={`${cmp.change_pct >= 0 ? "+" : ""}${cmp.change_pct.toFixed(1)}% əvvəlki dövr`} tone={cmp.change_pct >= 0 ? "success" : "danger"} />
        <KpiCard icon={TrendingUp} label="Cəm məbləğ" value={formatMoney(kpi.total_amount)} subline={`${formatMoney(cmp.prev_amount)} əvvəlki`} tone="success" />
        <KpiCard icon={Receipt} label="Orta çek" value={formatMoney(kpi.avg_sale)} subline="Sifariş başına" />
        <KpiCard icon={Award} label="Ən böyük satış" value={formatMoney(kpi.max_sale)} subline="Tək sifariş" />
        <KpiCard icon={Users} label="Yeni müştəri" value={formatNumber(kpi.new_customers, 0)} subline="Bu dövrdə qeydiyyat" tone="info" />
        <KpiCard icon={RotateCcw} label="Qaytarma" value={`${kpi.return_rate.toFixed(1)}%`} subline={`${kpi.return_count} qaytarma`} tone={kpi.return_rate > 5 ? "warning" : "neutral"} />
      </section>

      {/* Year-over-year comparison strip */}
      <YoyStrip
        title="İllik müqayisə (YoY)"
        curLabel="Bu dövr"
        prevLabel="Keçən il"
        rows={[
          { label: "Cəm məbləğ", cur: yoy.cur_amount, prev: yoy.yoy_amount, goodUp: true },
          { label: "Sifariş sayı", cur: yoy.cur_count, prev: yoy.yoy_count, goodUp: true },
        ]}
      />

      <Card className="glass">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Gündəlik satış trendi</CardTitle>
        </CardHeader>
        <CardContent>
          <DailyLineChart data={daily} />
        </CardContent>
      </Card>

      {/* Best/worst hour insight + top margin earners */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="glass">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Award className="h-4 w-4 text-emerald-500" />
              Saat üzrə pik vaxtlar
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-emerald-500">Ən aktiv saat</div>
                {bestHour ? (
                  <>
                    <div className="mt-1 text-2xl font-bold tabular-nums">
                      {String(bestHour.saat).padStart(2, "0")}:00
                    </div>
                    <div className="text-[10.5px] text-muted-foreground">
                      {bestHour.sayi} sifariş · {formatMoney(bestHour.mebleg)}
                    </div>
                  </>
                ) : (
                  <div className="mt-2 text-sm text-muted-foreground">—</div>
                )}
              </div>
              <div className="rounded-lg border border-rose-500/20 bg-rose-500/5 p-3">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-rose-500">Ən zəif saat</div>
                {worstHour ? (
                  <>
                    <div className="mt-1 text-2xl font-bold tabular-nums">
                      {String(worstHour.saat).padStart(2, "0")}:00
                    </div>
                    <div className="text-[10.5px] text-muted-foreground">
                      {worstHour.sayi} sifariş · {formatMoney(worstHour.mebleg)}
                    </div>
                  </>
                ) : (
                  <div className="mt-2 text-sm text-muted-foreground">—</div>
                )}
              </div>
            </div>
            <p className="mt-3 text-[10.5px] text-muted-foreground">
              Pik saatlarda staff sayını artırın, zəif saatlarda promo və ya endirim kampaniyası planlayın.
            </p>
          </CardContent>
        </Card>

        <Card className="glass">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Percent className="h-4 w-4 text-primary" />
              Top 10 marja məhsulu
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="border-b border-border/60 text-left text-[10.5px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Məhsul</th>
                  <th className="px-3 py-2 text-right">Marja</th>
                  <th className="px-3 py-2 text-right">%</th>
                </tr>
              </thead>
              <tbody>
                {topMargins.length === 0 ? (
                  <tr><td colSpan={3} className="py-8 text-center text-sm text-muted-foreground">Məlumat yoxdur</td></tr>
                ) : (
                  topMargins.map((p, i) => (
                    <tr key={p.mehsul_id} className="border-b border-border/30">
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="h-5 w-5 justify-center p-0 text-[10px]">{i + 1}</Badge>
                          <div className="min-w-0">
                            <div className="truncate font-medium">{p.ad}</div>
                            {p.kod && <div className="text-[10px] font-mono text-muted-foreground">{p.kod}</div>}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-emerald-500 font-semibold">{formatMoney(p.margin)}</td>
                      <td className="px-3 py-2 text-right">
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[10px]",
                            p.margin_pct >= 30
                              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-500"
                              : p.margin_pct >= 15
                              ? "border-primary/40 bg-primary/10 text-primary"
                              : "border-amber-500/40 bg-amber-500/10 text-amber-500"
                          )}
                        >
                          {p.margin_pct.toFixed(1)}%
                        </Badge>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>

      {/* Qruplaşdırma cədvəli */}
      <Card className="glass" data-section="sales-pivot">
        <CardHeader className="flex flex-wrap items-center justify-between gap-2 pb-3">
          <CardTitle className="text-base">Qruplaşdırma cədvəli</CardTitle>
          <form method="get" className="flex items-center gap-2">
            {sp.from && <input type="hidden" name="from" value={sp.from} />}
            {sp.to && <input type="hidden" name="to" value={sp.to} />}
            {sp.preset && <input type="hidden" name="preset" value={sp.preset} />}
            {sp.anbar && <input type="hidden" name="anbar" value={sp.anbar} />}
            {sp.satici && <input type="hidden" name="satici" value={sp.satici} />}
            {sp.odenis && <input type="hidden" name="odenis" value={sp.odenis} />}
            <label className="text-[10.5px] uppercase tracking-wider text-muted-foreground">Qruplaşdır:</label>
            <select
              name="group"
              defaultValue={validGroup}
              className="h-8 rounded-md border border-input bg-background px-2 text-xs"
              data-pivot-group-select="1"
            >
              {GROUP_OPTIONS.map((g) => (
                <option key={g.value} value={g.value}>{g.label}</option>
              ))}
            </select>
            <button type="submit" className="h-8 rounded-md bg-primary px-3 text-[11px] font-semibold text-primary-foreground">Yenilə</button>
            <a
              href={`/api/hesabatlar/satis/export?${exportParams.toString()}&group=${validGroup}`}
              className="h-8 inline-flex items-center rounded-md border border-border bg-background px-3 text-[11px] font-semibold hover:bg-secondary"
              data-pivot-export="1"
            >
              CSV ixrac
            </a>
          </form>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border/60 text-left text-[10.5px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">{GROUP_OPTIONS.find((g) => g.value === validGroup)?.label ?? "Qrup"}</th>
                  <th className="px-3 py-2 text-right">Sifariş</th>
                  <th className="px-3 py-2 text-right">Cəmi</th>
                  <th className="px-3 py-2 text-right">Orta çek</th>
                </tr>
              </thead>
              <tbody>
                {pivot.length === 0 ? (
                  <tr><td colSpan={4} className="py-8 text-center text-sm text-muted-foreground">Məlumat yoxdur</td></tr>
                ) : (
                  pivot.map((r) => (
                    <tr key={r.label} className="border-b border-border/30">
                      <td className="px-3 py-2">
                        <div className="font-medium">{r.label}</div>
                        {r.sub && <div className="text-[10px] text-muted-foreground">{r.sub}</div>}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{r.sifaris_say}</td>
                      <td className="px-3 py-2 text-right tabular-nums font-semibold">{formatMoney(r.cemi)}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-xs text-muted-foreground">{formatMoney(r.orta_chek)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="glass">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Ödəniş növü</CardTitle>
          </CardHeader>
          <CardContent>
            <PiePaymentChart data={byPay.map((p) => ({ name: PAYMENT_LABELS[p.odenis_nov] ?? p.odenis_nov, value: p.amount }))} />
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {byPay.map((p) => (
                <div key={p.odenis_nov} className="rounded-md border border-border bg-secondary/30 p-2">
                  <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground">{PAYMENT_LABELS[p.odenis_nov] ?? p.odenis_nov}</div>
                  <div className="mt-0.5 text-sm font-bold tabular-nums">{formatMoney(p.amount)}</div>
                  <div className="text-xs text-muted-foreground">{p.count} sifariş</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="glass">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Anbar üzrə</CardTitle>
          </CardHeader>
          <CardContent>
            <HorizontalBarChart data={byAnbar.slice(0, 10).map((a) => ({ label: a.anbar_ad, value: a.amount, sub: a.count }))} />
          </CardContent>
        </Card>
      </div>

      <Card className="glass">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Saat × gün heatmap</CardTitle>
          <p className="text-xs text-muted-foreground">Pik vaxtları aşkarlamaq üçün</p>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="border-separate border-spacing-[2px] text-[10px]">
            <thead>
              <tr>
                <th className="w-7 px-1.5 py-1 text-muted-foreground"></th>
                {Array.from({ length: 24 }, (_, h) => (
                  <th key={h} className="w-6 px-0.5 py-1 text-center font-mono text-[9px] text-muted-foreground">
                    {String(h).padStart(2, "0")}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {DOW.map((label, dow) => (
                <tr key={dow}>
                  <td className="px-1.5 py-1 text-right font-mono font-medium text-muted-foreground">{label}</td>
                  {Array.from({ length: 24 }, (_, h) => {
                    const v = grid[dow][h];
                    return <td key={h} title={`${label} ${String(h).padStart(2, "0")}:00 — ${v} satış`} className={`h-6 w-6 rounded ${heatBg(v)}`} />;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card className="glass">
        <CardHeader className="flex flex-wrap items-center justify-between gap-2 pb-3">
          <div>
            <CardTitle className="text-base">Top 10 satıcı</CardTitle>
            <p className="text-xs text-muted-foreground">Sifariş sayı, cəmi və orta çek</p>
          </div>
          <ViewToggle base="/hesabatlar/satis" current={userView} searchParams={spDict} param="user_view" />
        </CardHeader>
        <CardContent className={userView === "kerpic" ? "" : "p-0"}>
          {userView === "kerpic" ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {byUser.length === 0 ? (
                <BrickEmpty msg="Bu dövrdə satıcı məlumatı yoxdur" />
              ) : (
                byUser.map((u, i) => (
                  <SaticiBrick
                    key={u.isci_id}
                    rank={i + 1}
                    ad={u.ad}
                    orders={u.sifaris_say}
                    revenue={u.cemi}
                    avg_check={u.sifaris_say > 0 ? u.cemi / u.sifaris_say : 0}
                  />
                ))
              )}
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-border/60 text-left text-[10.5px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">#</th>
                  <th className="px-3 py-2">Satıcı</th>
                  <th className="px-3 py-2 text-right">Sifariş</th>
                  <th className="px-3 py-2 text-right">Cəmi</th>
                  <th className="px-3 py-2 text-right">Orta çek</th>
                  <th className="px-3 py-2 text-right">Pay</th>
                </tr>
              </thead>
              <tbody>
                {byUser.length === 0 ? (
                  <tr><td colSpan={6} className="py-8 text-center text-sm text-muted-foreground">Məlumat yoxdur</td></tr>
                ) : (
                  byUser.map((u, i) => {
                    const avg = u.sifaris_say > 0 ? u.cemi / u.sifaris_say : 0;
                    const share = rawTotal > 0 ? (u.cemi / rawTotal) * 100 : 0; // QA-orta: raw pay
                    return (
                      <tr key={u.isci_id} className="border-b border-border/30 hover:bg-secondary/20">
                        <td className="px-3 py-2 text-xs tabular-nums">{i + 1}</td>
                        <td className="px-3 py-2 font-medium">{u.ad}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{u.sifaris_say}</td>
                        <td className="px-3 py-2 text-right tabular-nums font-semibold">{formatMoney(u.cemi)}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-xs text-muted-foreground">{formatMoney(avg)}</td>
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
          )}
        </CardContent>
      </Card>

      <Card className="glass">
        <CardHeader className="flex flex-wrap items-center justify-between gap-2 pb-3">
          <div>
            <CardTitle className="text-base">Top 20 məhsul</CardTitle>
            <p className="text-xs text-muted-foreground">Sayı, cəmi, orta qiymət və ümumi satışdakı pay</p>
          </div>
          <ViewToggle base="/hesabatlar/satis" current={prodView} searchParams={spDict} param="prod_view" />
        </CardHeader>
        <CardContent className={prodView === "kerpic" ? "" : "p-0"}>
          {prodView === "kerpic" ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {topProducts.length === 0 ? (
                <BrickEmpty msg="Məhsul məlumatı yoxdur" />
              ) : (
                topProducts.map((p, i) => {
                  // Find margin info from topMargins (if present)
                  const marginInfo = topMargins.find((tm) => tm.mehsul_id === p.mehsul_id);
                  return (
                    <MehsulBrick
                      key={p.mehsul_id}
                      rank={i + 1}
                      ad={p.ad}
                      kod={p.kod}
                      mehsulId={p.mehsul_id}
                      units={p.satilan_qty}
                      revenue={p.cemi}
                      margin={marginInfo?.margin ?? 0}
                      margin_pct={marginInfo?.margin_pct ?? 0}
                    />
                  );
                })
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border/60 text-left text-[10.5px] uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">#</th>
                    <th className="px-3 py-2">Məhsul</th>
                    <th className="px-3 py-2">Kod</th>
                    <th className="px-3 py-2 text-right">Sayı</th>
                    <th className="px-3 py-2 text-right">Orta qiymət</th>
                    <th className="px-3 py-2 text-right">Cəmi</th>
                    <th className="px-3 py-2 text-right">Pay</th>
                  </tr>
                </thead>
                <tbody>
                  {topProducts.length === 0 ? (
                    <tr><td colSpan={7} className="py-8 text-center text-sm text-muted-foreground">Məlumat yoxdur</td></tr>
                  ) : (
                    topProducts.map((p, i) => {
                      const avg = p.satilan_qty > 0 ? p.cemi / p.satilan_qty : 0;
                      const share = rawTotal > 0 ? (p.cemi / rawTotal) * 100 : 0; // QA-orta: raw pay
                      return (
                        <tr key={p.mehsul_id} className="border-b border-border/30 hover:bg-secondary/20">
                          <td className="px-3 py-2 text-xs tabular-nums">{i + 1}</td>
                          <td className="px-3 py-2 font-medium">{p.ad}</td>
                          <td className="px-3 py-2 text-[10px] font-mono text-muted-foreground">{p.kod ?? "—"}</td>
                          <td className="px-3 py-2 text-right tabular-nums text-xs">{formatNumber(p.satilan_qty, 0)}</td>
                          <td className="px-3 py-2 text-right tabular-nums text-xs text-muted-foreground">{formatMoney(avg)}</td>
                          <td className="px-3 py-2 text-right tabular-nums font-semibold">{formatMoney(p.cemi)}</td>
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

      <Card className="glass">
        <CardHeader className="flex flex-wrap items-center justify-between gap-2 pb-3">
          <div>
            <CardTitle className="text-base">Top 20 müştəri</CardTitle>
            <p className="text-xs text-muted-foreground">Sifariş sayı, cəmi və orta çek</p>
          </div>
          <ViewToggle base="/hesabatlar/satis" current={custView} searchParams={spDict} param="cust_view" />
        </CardHeader>
        <CardContent className={custView === "kerpic" ? "" : "p-0"}>
          {custView === "kerpic" ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {topCustomers.length === 0 ? (
                <BrickEmpty msg="Müştəri məlumatı yoxdur" />
              ) : (
                topCustomers.map((c, i) => (
                  <MusteriBrick
                    key={c.musteri_id}
                    rank={i + 1}
                    ad={c.ad}
                    orders={c.sifaris_say}
                    revenue={c.cemi}
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
                    <th className="px-3 py-2 text-right">Orta çek</th>
                    <th className="px-3 py-2 text-right">Cəmi</th>
                    <th className="px-3 py-2 text-right">Pay</th>
                  </tr>
                </thead>
                <tbody>
                  {topCustomers.length === 0 ? (
                    <tr><td colSpan={6} className="py-8 text-center text-sm text-muted-foreground">Məlumat yoxdur</td></tr>
                  ) : (
                    topCustomers.map((c, i) => {
                      const avg = c.sifaris_say > 0 ? c.cemi / c.sifaris_say : 0;
                      const share = rawTotal > 0 ? (c.cemi / rawTotal) * 100 : 0; // QA-orta: raw pay
                      return (
                        <tr key={c.musteri_id} className="border-b border-border/30 hover:bg-secondary/20">
                          <td className="px-3 py-2 text-xs tabular-nums">{i + 1}</td>
                          <td className="px-3 py-2 font-medium">{c.ad}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{c.sifaris_say}</td>
                          <td className="px-3 py-2 text-right tabular-nums text-xs text-muted-foreground">{formatMoney(avg)}</td>
                          <td className="px-3 py-2 text-right tabular-nums font-semibold">{formatMoney(c.cemi)}</td>
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
    </div>
  );
}
