import type { Metadata } from "next";
import { TrendingUp, TrendingDown, Wallet, Flame, Hourglass, ChevronsUpDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KpiCard } from "@/features/dashboard/components/kpi-card";
import { MaliyyeSubNav } from "@/components/maliyye-subnav";
import { CashflowChart } from "@/features/maliyye/components/cashflow-chart";
import { getCashflowSeries, type CashflowPeriod } from "@/features/maliyye/cashflow-queries";
import { getAccounts } from "@/features/maliyye/account-queries";
import { formatMoney } from "@/lib/utils";

export const metadata: Metadata = { title: "Pul axını" };

type SearchParams = { dovr?: string; range?: string };

export default async function PulAxiniPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const dovr = (sp.dovr as CashflowPeriod) ?? "gun";
  const range = Math.max(7, Math.min(180, Number(sp.range ?? (dovr === "ay" ? 12 : dovr === "hefte" ? 12 : 30))));

  const [series, accounts] = await Promise.all([
    getCashflowSeries(dovr, range),
    getAccounts(),
  ]);

  const cemDaxil = series.reduce((s, r) => s + r.daxil, 0);
  const cemXaric = series.reduce((s, r) => s + r.xaric, 0);
  const cemNet = cemDaxil - cemXaric;
  const cemBalans = accounts.filter((a) => a.aktiv).reduce((s, a) => s + (a.valyuta === "AZN" ? a.qaliq : 0), 0);
  const days = Math.max(1, series.length);
  const burnRate = cemXaric / days;
  const cashRunway = burnRate > 0 ? Math.floor(cemBalans / burnRate) : null;
  const posDays = series.filter((s) => s.net >= 0).length;
  const negDays = series.length - posDays;

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Pul axını</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Mədaxil və məxaric hərəkətinin dövr üzrə cədvəli və balansları.
        </p>
      </header>

      <MaliyyeSubNav active="/maliyye/pul-axini" />

      <form className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card/30 p-3">
        <select name="dovr" defaultValue={dovr} className="h-9 rounded-md border border-input bg-background px-2 text-sm">
          <option value="gun">Günlük</option>
          <option value="hefte">Həftəlik</option>
          <option value="ay">Aylıq</option>
        </select>
        <input
          type="number"
          name="range"
          min={7}
          max={180}
          defaultValue={range}
          className="h-9 w-24 rounded-md border border-input bg-background px-2 text-sm"
        />
        <button type="submit" className="h-9 rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground">
          Yenilə
        </button>
        <div className="flex gap-1">
          <a href="/maliyye/pul-axini?dovr=gun&range=7" className="inline-flex h-9 items-center rounded-md border border-border bg-background px-2 text-[11px] font-semibold hover:bg-secondary">Həftə</a>
          <a href="/maliyye/pul-axini?dovr=gun&range=30" className="inline-flex h-9 items-center rounded-md border border-border bg-background px-2 text-[11px] font-semibold hover:bg-secondary">30 gün</a>
          <a href="/maliyye/pul-axini?dovr=gun&range=90" className="inline-flex h-9 items-center rounded-md border border-border bg-background px-2 text-[11px] font-semibold hover:bg-secondary">Rüb</a>
          <a href="/maliyye/pul-axini?dovr=ay&range=12" className="inline-flex h-9 items-center rounded-md border border-border bg-background px-2 text-[11px] font-semibold hover:bg-secondary">12 ay</a>
        </div>
      </form>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        <KpiCard icon={TrendingUp} label="Cəm mədaxil" value={formatMoney(cemDaxil)} tone="success" />
        <KpiCard icon={TrendingDown} label="Cəm məxaric" value={formatMoney(cemXaric)} tone="warning" />
        <KpiCard icon={Wallet} label="Net axın" value={formatMoney(cemNet)} tone={cemNet >= 0 ? "success" : "danger"} />
        <KpiCard icon={Flame} label="Günlük burn" value={formatMoney(burnRate)} subline={`${days} dövr`} tone="warning" />
        <KpiCard icon={Hourglass} label="Cash runway" value={cashRunway != null ? `${cashRunway} gün` : "—"} subline={cashRunway != null && cashRunway < 30 ? "Aşağı" : undefined} tone={cashRunway != null && cashRunway < 30 ? "danger" : "neutral"} />
        <KpiCard icon={ChevronsUpDown} label="Müsbət / Mənfi" value={`${posDays} / ${negDays}`} subline="gün" tone={posDays >= negDays ? "success" : "warning"} />
      </section>

      <Card className="glass">
        <CardHeader>
          <CardTitle className="text-base">Pul axını qrafiki</CardTitle>
        </CardHeader>
        <CardContent>
          <CashflowChart data={series} />
        </CardContent>
      </Card>

      {/* Daily net cash sparkline + opening/closing */}
      <Card className="glass" data-section="cashflow-sparkline">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Günlük net axın trendi</CardTitle>
          <p className="text-xs text-muted-foreground">
            Açılış balans: <span className="font-semibold tabular-nums">{formatMoney(cemBalans - cemNet)}</span>
            {" "}→ Bağlanış: <span className="font-semibold tabular-nums">{formatMoney(cemBalans)}</span>
            {" • "}
            Dövr dəyişikliyi: <span className={`font-semibold tabular-nums ${cemNet >= 0 ? "text-success" : "text-danger"}`}>{cemNet >= 0 ? "+" : ""}{formatMoney(cemNet)}</span>
          </p>
        </CardHeader>
        <CardContent>
          <Sparkline data={series.map((s) => ({ x: s.bucket, y: s.net }))} />
        </CardContent>
      </Card>

      <Card className="glass">
        <CardHeader>
          <CardTitle className="text-base">Pul axını cədvəli</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border/60 text-left text-[10.5px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-3 py-2.5">Dövr</th>
                  <th className="px-3 py-2.5 text-right">Mədaxil</th>
                  <th className="px-3 py-2.5 text-right">Məxaric</th>
                  <th className="px-3 py-2.5 text-right">Fərq</th>
                  <th className="px-3 py-2.5 text-right">Dövriyyə</th>
                </tr>
              </thead>
              <tbody>
                {series.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                      Bu dövrdə hərəkət yoxdur
                    </td>
                  </tr>
                )}
                {[...series].reverse().map((r) => (
                  <tr key={r.bucket} className="border-b border-border/30">
                    <td className="px-3 py-2.5 text-xs">{r.bucket}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-success">{formatMoney(r.daxil)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-danger">{formatMoney(r.xaric)}</td>
                    <td className={`px-3 py-2.5 text-right tabular-nums font-semibold ${r.net >= 0 ? "text-success" : "text-danger"}`}>
                      {r.net > 0 ? "+" : ""}{formatMoney(r.net)}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-xs text-muted-foreground">
                      {formatMoney(r.daxil + r.xaric)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card className="glass">
        <CardHeader>
          <CardTitle className="text-base">Mövcud balanslar</CardTitle>
        </CardHeader>
        <CardContent>
          {accounts.length === 0 ? (
            <p className="text-sm text-muted-foreground">Hesab yoxdur.</p>
          ) : (
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3">
              {accounts.slice(0, 12).map((a) => (
                <div key={a.id} className="rounded-lg border border-border/50 bg-card/30 p-3">
                  <div className="text-xs text-muted-foreground">{a.is_kassa ? "Kassa" : a.bank_adi ?? a.nov}</div>
                  <div className="text-sm font-medium">{a.ad}</div>
                  <div className="mt-1 tabular-nums font-bold">{formatMoney(a.qaliq)} <span className="text-xs text-muted-foreground">{a.valyuta}</span></div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Sparkline({ data }: { data: { x: string; y: number }[] }) {
  if (data.length === 0) {
    return <p className="text-center text-sm text-muted-foreground py-6">Məlumat yoxdur</p>;
  }
  const width = 800;
  const height = 80;
  const pad = 6;
  const min = Math.min(0, ...data.map((d) => d.y));
  const max = Math.max(0, ...data.map((d) => d.y));
  const range = max - min || 1;
  const stepX = (width - 2 * pad) / Math.max(1, data.length - 1);
  const yMap = (v: number) => height - pad - ((v - min) / range) * (height - 2 * pad);
  const points = data.map((d, i) => `${pad + i * stepX},${yMap(d.y)}`).join(" ");
  const zeroY = yMap(0);
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-20" preserveAspectRatio="none" data-spark="cashflow">
      <line x1={pad} x2={width - pad} y1={zeroY} y2={zeroY} stroke="currentColor" strokeOpacity="0.15" strokeDasharray="2 2" />
      <polyline fill="none" stroke="var(--info, #3b82f6)" strokeWidth="2" points={points} />
      {data.map((d, i) => (
        <circle
          key={i}
          cx={pad + i * stepX}
          cy={yMap(d.y)}
          r={data.length <= 30 ? 2.5 : 1.5}
          fill={d.y >= 0 ? "var(--success, #10b981)" : "var(--danger, #ef4444)"}
        >
          <title>{d.x}: {d.y.toFixed(2)} ₼</title>
        </circle>
      ))}
    </svg>
  );
}
