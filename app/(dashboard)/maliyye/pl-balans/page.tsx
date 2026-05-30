import type { Metadata } from "next";
import Link from "next/link";
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  PiggyBank,
  Receipt,
  Calculator,
  FileSpreadsheet,
  Coins,
  Building2,
} from "lucide-react";
import { MaliyyeSubNav } from "@/components/maliyye-subnav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KpiCard } from "@/features/dashboard/components/kpi-card";
import { PLTrendChart } from "@/features/maliyye/components/pl-trend-chart";
import {
  getPLBlock,
  getBalanceSheet,
  getPLTrend,
} from "@/features/maliyye/extended-queries";
import { formatMoney } from "@/lib/utils";

export const metadata: Metadata = { title: "P&L / Balans" };

function pct(v: number) {
  return `${v >= 0 ? "" : ""}${v.toFixed(1)}%`;
}

export default async function PLBalancPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string }>;
}) {
  const sp = await searchParams;
  const now = new Date();
  const year = Number(sp.year) || now.getFullYear();
  const month = Number(sp.month) || now.getMonth() + 1;

  const [pl, bs, trend] = await Promise.all([
    getPLBlock(year, month),
    getBalanceSheet(),
    getPLTrend(12),
  ]);

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">P&amp;L və Balans</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Beynəlxalq standart maliyyə hesabatları: Mənfəət-Zərər, Balans və 12-aylıq trend.
          </p>
        </div>
        <Link
          href={`/api/hesabatlar/maliyye/export?year=${year}&month=${month}`}
          className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-card px-3 text-xs font-semibold hover:bg-secondary"
        >
          <FileSpreadsheet className="h-3.5 w-3.5" /> Excel ixrac
        </Link>
      </header>

      <MaliyyeSubNav active="/maliyye/pl-balans" />

      {/* Period selector */}
      <form className="flex items-center gap-2 text-xs">
        <label className="font-medium">Dövr:</label>
        <select
          name="month"
          defaultValue={String(month)}
          className="h-8 rounded-md border border-input bg-background px-2"
        >
          {Array.from({ length: 12 }).map((_, i) => (
            <option key={i + 1} value={i + 1}>
              {["Yanvar","Fevral","Mart","Aprel","May","İyun","İyul","Avqust","Sentyabr","Oktyabr","Noyabr","Dekabr"][i]}
            </option>
          ))}
        </select>
        <select
          name="year"
          defaultValue={String(year)}
          className="h-8 rounded-md border border-input bg-background px-2"
        >
          {[year - 2, year - 1, year, year + 1].map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
        <button type="submit" className="rounded-md bg-secondary px-3 py-1 font-semibold">
          Tətbiq
        </button>
        <span className="ml-2 text-muted-foreground">Cari: {pl.donem}</span>
      </form>

      {/* Top KPIs */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          icon={TrendingUp}
          label="Gəlir"
          value={formatMoney(pl.gelir)}
          subline={`Brüt: ${formatMoney(pl.brut_menfeet)}`}
          tone="success"
        />
        <KpiCard
          icon={Receipt}
          label="COGS"
          value={formatMoney(pl.cogs)}
          subline={`Brüt marja: ${pct(pl.brut_marja)}`}
        />
        <KpiCard
          icon={Calculator}
          label="EBITDA"
          value={formatMoney(pl.ebitda)}
          subline={`Əməl. marja: ${pct(pl.ebitda_marja)}`}
          tone={pl.ebitda >= 0 ? "info" : "danger"}
        />
        <KpiCard
          icon={pl.net_menfeet >= 0 ? PiggyBank : TrendingDown}
          label="Net mənfəət"
          value={formatMoney(pl.net_menfeet)}
          subline={`Net marja: ${pct(pl.net_marja)}`}
          tone={pl.net_menfeet >= 0 ? "success" : "danger"}
        />
      </section>

      {/* P&L Statement */}
      <Card className="glass">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Calculator className="h-4 w-4 text-primary-light" />
            Mənfəət-Zərər hesabatı — {pl.donem}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1.5 text-sm">
          <PLRow label="Gəlir (satış + xidmət + digər)" value={pl.gelir} tone="success" bold />
          <PLRow label="COGS (satılan malların maya dəyəri)" value={-pl.cogs} />
          <PLRow
            label="Brüt mənfəət"
            value={pl.brut_menfeet}
            tone={pl.brut_menfeet >= 0 ? "success" : "danger"}
            bold
            extra={`marja: ${pct(pl.brut_marja)}`}
          />
          <Divider />
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Əməliyyat xərcləri
          </div>
          <PLRow label="Əməkhaqqı və maaş" value={-pl.xerc_maas} />
          <PLRow label="Ofis və kommunal" value={-pl.xerc_ofis} />
          <PLRow label="Marketing" value={-pl.xerc_marketing} />
          <PLRow label="Digər" value={-pl.xerc_diger} />
          <PLRow
            label="EBITDA"
            value={pl.ebitda}
            tone={pl.ebitda >= 0 ? "info" : "danger"}
            bold
            extra={`marja: ${pct(pl.ebitda_marja)}`}
          />
          <Divider />
          <PLRow label="Vergi" value={-pl.vergi} />
          <PLRow
            label="Net mənfəət"
            value={pl.net_menfeet}
            tone={pl.net_menfeet >= 0 ? "success" : "danger"}
            bold
            extra={`marja: ${pct(pl.net_marja)}`}
          />
        </CardContent>
      </Card>

      {/* P&L Trend chart */}
      <Card className="glass">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-4 w-4 text-success" />
            12-aylıq P&amp;L trend
          </CardTitle>
        </CardHeader>
        <CardContent>
          <PLTrendChart data={trend} />
        </CardContent>
      </Card>

      {/* Balance Sheet */}
      <Card className="glass">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Building2 className="h-4 w-4 text-info" />
            Balans (cari ay sonu)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-success">
                <Wallet className="h-3.5 w-3.5" /> Aktivlər
              </div>
              <BSRow label="Kassa + Bank" value={bs.aktivler.kassa_bank} />
              <BSRow label="Debitor" value={bs.aktivler.debitor} />
              <BSRow label="Stok" value={bs.aktivler.stok} />
              <BSRow label="Əsas vəsait" value={bs.aktivler.esas_vesait} />
              <BSRow label="Cəmi" value={bs.aktivler.cem} bold />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-danger">
                <Receipt className="h-3.5 w-3.5" /> Passivlər
              </div>
              <BSRow label="Kreditor" value={bs.passivler.kreditor} />
              <BSRow label="Vergi borcu" value={bs.passivler.vergi_borcu} />
              <BSRow label="Kredit" value={bs.passivler.kredit} />
              <BSRow label="Cəmi" value={bs.passivler.cem} bold />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-primary-light">
                <Coins className="h-3.5 w-3.5" /> Kapital
              </div>
              <BSRow label="Sahibkar pulu" value={bs.kapital.sahibkar_pulu} />
              <BSRow label="Yığılmış mənfəət" value={bs.kapital.yigilmis_menfeet} />
              <BSRow label="Cəmi" value={bs.kapital.cem} bold />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function PLRow({
  label,
  value,
  tone,
  bold,
  extra,
}: {
  label: string;
  value: number;
  tone?: "success" | "danger" | "info";
  bold?: boolean;
  extra?: string;
}) {
  const toneCls =
    tone === "success" ? "text-success" : tone === "danger" ? "text-danger" : tone === "info" ? "text-info" : "";
  return (
    <div
      className={`flex items-center justify-between rounded px-2 py-1 ${bold ? "bg-secondary/40 font-semibold" : ""}`}
    >
      <span className={bold ? toneCls : ""}>{label}</span>
      <span className={`tabular-nums ${toneCls}`}>
        {formatMoney(value)} {extra && <span className="ml-2 text-[10.5px] text-muted-foreground">{extra}</span>}
      </span>
    </div>
  );
}

function BSRow({ label, value, bold }: { label: string; value: number; bold?: boolean }) {
  return (
    <div
      className={`flex items-center justify-between rounded px-2 py-1 ${bold ? "bg-secondary/40 font-semibold" : ""}`}
    >
      <span>{label}</span>
      <span className="tabular-nums">{formatMoney(value)}</span>
    </div>
  );
}

function Divider() {
  return <div className="my-1.5 border-t border-border/60" />;
}
