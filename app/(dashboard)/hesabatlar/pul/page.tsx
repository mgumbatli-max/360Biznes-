import type { Metadata } from "next";
import { Coins, ArrowDownToLine, ArrowUpFromLine, Wallet, AlertTriangle, Activity, TrendingUp, TrendingDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KpiCard } from "@/features/dashboard/components/kpi-card";
import { InOutLineChart, PiePaymentChart } from "@/features/hesabatlar/components/charts";
import {
  getDailyCashFlow30,
  getCashFlowByPayment,
  getAccountBalances,
  getExpenseCategories,
  getCashFlowSummary30,
} from "@/features/hesabatlar/pul-queries";
import { getPlSummary } from "@/features/hesabatlar/maliyye-queries";
import { thisMonthRange } from "@/features/hesabatlar/shared";
import { formatMoney } from "@/lib/utils";

export const metadata: Metadata = { title: "Pul axını hesabatı" };
export const dynamic = "force-dynamic";

const PAYMENT_LABELS: Record<string, string> = { negd: "Nağd", kart: "Kart", kecirme: "Bank köçürmə", nisye: "Nisyə" };
const CRITICAL_BALANCE = 5000;

export default async function PulReportPage() {
  const range = thisMonthRange();
  const daily = await getDailyCashFlow30();
  const [byPay, accounts, expenseCats, pl, summary] = await Promise.all([
    getCashFlowByPayment(),
    getAccountBalances(),
    getExpenseCategories(),
    getPlSummary(range),
    getCashFlowSummary30(daily),
  ]);

  const totalIn = summary.total_in;
  const totalOut = summary.total_out;
  const net = summary.net;
  const expenseTotal = expenseCats.reduce((s, c) => s + c.mebleg, 0);

  // Critical balance banner conditions
  const criticalLow = summary.closing_balance < CRITICAL_BALANCE;
  const runwayRisk = summary.runway_days != null && summary.runway_days < 30;

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Pul axını hesabatı</h1>
        <p className="mt-1 text-sm text-muted-foreground">Son 30 gün: mədaxil/məxaric, hesab balansları, kateqoriya breakdown və runway analizi.</p>
      </header>

      {(criticalLow || runwayRisk) && (
        <div className={`flex items-start gap-3 rounded-xl border p-3 text-sm ${criticalLow ? "border-danger/30 bg-danger/10 text-danger" : "border-warning/30 bg-warning/10 text-warning"}`}>
          <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0" />
          <div>
            {criticalLow ? (
              <>
                <div className="font-semibold">Kritik qalıq xəbərdarlığı</div>
                <p className="mt-0.5 text-xs">
                  Bağlanış qalıq <span className="font-semibold tabular-nums">{formatMoney(summary.closing_balance)}</span> — kritik səviyyə ({formatMoney(CRITICAL_BALANCE)}) altındadır. Mədaxil sürəti artırılmalıdır.
                </p>
              </>
            ) : (
              <>
                <div className="font-semibold">Pul axını riski</div>
                <p className="mt-0.5 text-xs">
                  Cari burn rate ilə cəmi <span className="font-semibold">{summary.runway_days} gün</span> qalır. Xərclər nəzərdən keçirilməlidir.
                </p>
              </>
            )}
          </div>
        </div>
      )}

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <KpiCard icon={Wallet} label="Açılış qalıq" value={formatMoney(summary.opening_balance)} subline="30 gün əvvəl" />
        <KpiCard icon={ArrowDownToLine} label="Mədaxil" value={formatMoney(totalIn)} subline="Son 30 gün" tone="success" />
        <KpiCard icon={ArrowUpFromLine} label="Məxaric" value={formatMoney(totalOut)} subline="Qaytarma + xərc" tone="danger" />
        <KpiCard icon={Wallet} label="Net axın" value={formatMoney(net)} subline={`${summary.change_pct >= 0 ? "+" : ""}${summary.change_pct.toFixed(1)}% dəyişiklik`} tone={net >= 0 ? "success" : "danger"} />
        <KpiCard icon={Coins} label="Bağlanış qalıq" value={formatMoney(summary.closing_balance)} subline="Cari" tone={criticalLow ? "danger" : "info"} />
      </section>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <KpiCard icon={Activity} label="Cash runway" value={summary.runway_days != null ? `${summary.runway_days} gün` : "—"} subline="Burn rate-lə qalan" tone={summary.runway_days != null && summary.runway_days < 30 ? "danger" : "neutral"} />
        <KpiCard icon={TrendingDown} label="Burn (günlük)" value={formatMoney(summary.burn_per_day)} subline="Orta xərc/gün" tone="warning" />
        <KpiCard icon={TrendingUp} label="Run rate (illik)" value={formatMoney(summary.run_rate_annual)} subline="Orta dövr × 365" tone={summary.run_rate_annual >= 0 ? "success" : "danger"} />
        <KpiCard icon={TrendingDown} label="Min qalıq" value={formatMoney(summary.min_day?.balance ?? 0)} subline={summary.min_day ? new Date(summary.min_day.date).toLocaleDateString("az-AZ", { day: "2-digit", month: "short" }) : "—"} />
        <KpiCard icon={TrendingUp} label="Max qalıq" value={formatMoney(summary.max_day?.balance ?? 0)} subline={summary.max_day ? new Date(summary.max_day.date).toLocaleDateString("az-AZ", { day: "2-digit", month: "short" }) : "—"} />
      </section>

      <section className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <KpiCard icon={Coins} label="Net mənfəət (P&L)" value={formatMoney(pl.net_profit)} subline={`Bu ay · ${pl.net_margin_pct.toFixed(1)}% margin`} tone={pl.net_profit >= 0 ? "success" : "danger"} />
        <KpiCard icon={ArrowDownToLine} label="P&L gəlir" value={formatMoney(pl.revenue)} subline={`Bu ay`} tone="info" />
        <KpiCard icon={Activity} label="P&L COGS + OPEX" value={formatMoney(pl.cogs + pl.opex)} subline={`COGS ${formatMoney(pl.cogs)} · OPEX ${formatMoney(pl.opex)}`} tone="warning" />
      </section>

      <Card className="glass">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Gündəlik pul axını (son 30 gün)</CardTitle>
        </CardHeader>
        <CardContent>
          <InOutLineChart data={daily} />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="glass">
          <CardHeader className="pb-2"><CardTitle className="text-base">Xərc kateqoriyaları (pie)</CardTitle></CardHeader>
          <CardContent>
            <PiePaymentChart data={expenseCats.map((c) => ({ name: c.kateqoriya, value: c.mebleg }))} />
            <div className="mt-2 text-xs text-muted-foreground">Cəm xərc: <span className="font-semibold tabular-nums">{formatMoney(expenseTotal)}</span></div>
          </CardContent>
        </Card>

        <Card className="glass">
          <CardHeader className="pb-2"><CardTitle className="text-base">Ödəniş növü</CardTitle></CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="border-b border-border/60 text-left text-[10.5px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Növ</th>
                  <th className="px-3 py-2 text-right">Mədaxil</th>
                  <th className="px-3 py-2 text-right">Məxaric</th>
                  <th className="px-3 py-2 text-right">Net</th>
                </tr>
              </thead>
              <tbody>
                {byPay.map((p) => (
                  <tr key={p.odenis_nov} className="border-b border-border/30">
                    <td className="px-3 py-2">{PAYMENT_LABELS[p.odenis_nov] ?? p.odenis_nov}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-success">{formatMoney(p.daxil)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-danger">{formatMoney(p.xaric)}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-semibold">{formatMoney(p.daxil - p.xaric)}</td>
                  </tr>
                ))}
                {byPay.length === 0 && (
                  <tr><td colSpan={4} className="py-8 text-center text-muted-foreground">Məlumat yoxdur</td></tr>
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>

      <Card className="glass">
        <CardHeader className="pb-2"><CardTitle className="text-base">Hesab balansları</CardTitle></CardHeader>
        <CardContent className="p-0">
          {accounts.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Hesab tapılmadı</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-border/60 text-left text-[10.5px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Kassa</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2 text-right">Mədaxil</th>
                  <th className="px-3 py-2 text-right">Məxaric</th>
                  <th className="px-3 py-2 text-right">Net</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((a) => (
                  <tr key={a.id} className="border-b border-border/30">
                    <td className="px-3 py-2 font-medium">{a.ad}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground capitalize">{a.status ?? "—"}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-success">{formatMoney(a.daxil)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-danger">{formatMoney(a.xaric)}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-semibold">{formatMoney(a.daxil - a.xaric)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
