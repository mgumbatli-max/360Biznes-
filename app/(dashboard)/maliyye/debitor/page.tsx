import type { Metadata } from "next";
import Link from "next/link";
import {
  Users,
  HandCoins,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Clock,
  Search,
} from "lucide-react";
import { MaliyyeSubNav } from "@/components/maliyye-subnav";
import { QuickOpDialog } from "@/features/maliyye/components/quick-op-dialog";
import { DebtorRowExpanded } from "@/features/maliyye/components/debtor-row-expanded";
import {
  getDebtors,
  getQuickRefs,
  getOpenSalesForCustomers,
} from "@/features/maliyye/queries";
import { formatMoney } from "@/lib/utils";

export const metadata: Metadata = { title: "Debitor — müştəri borcları" };

type SearchParams = {
  q?: string;
  gecik?: string;
  sort?: string;
  menecer?: string;
  mn?: string;
  mx?: string;
  df?: string;
  dt?: string;
};

export default async function DebitorPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { requireMaliyyePerm } = await import("@/features/maliyye/access-guard");
  await requireMaliyyePerm("debitor.oxu");

  const sp = await searchParams;
  const q = (sp.q ?? "").toLowerCase().trim();
  const gecik = Number(sp.gecik ?? 0);
  const sort = sp.sort ?? "borc_h";
  const menecerFilter = sp.menecer ?? "";

  // Yeni filtrlər — query where-ə ötürülür (param → where)
  const minBorc = sp.mn != null && sp.mn !== "" ? Number(sp.mn) : undefined;
  const maxBorc = sp.mx != null && sp.mx !== "" ? Number(sp.mx) : undefined;
  const dateFrom = sp.df ? new Date(sp.df) : undefined;
  const dateTo = sp.dt ? new Date(`${sp.dt}T23:59:59.999`) : undefined;

  const [allRows, refs] = await Promise.all([
    getDebtors({
      search: sp.q?.trim() || undefined,
      min: Number.isFinite(minBorc) ? minBorc : undefined,
      max: Number.isFinite(maxBorc) ? maxBorc : undefined,
      from: dateFrom && !Number.isNaN(dateFrom.getTime()) ? dateFrom : undefined,
      to: dateTo && !Number.isNaN(dateTo.getTime()) ? dateTo : undefined,
    }),
    getQuickRefs(),
  ]);

  // Pre-fetch open invoices for top-N debtors — TƏK batch sorğu (əvvəl 25 ayrı sorğu = N+1).
  const TOP = 25;
  const openSalesMap = await getOpenSalesForCustomers(allRows.slice(0, TOP).map((r) => r.id), 100);

  let rows = allRows;
  if (q) {
    rows = rows.filter((r) =>
      [r.ad, r.telefon, r.voen, r.menecer_ad].some((v) =>
        (v ?? "").toLowerCase().includes(q),
      ),
    );
  }
  if (gecik > 0) rows = rows.filter((r) => r.gun_kecdi >= gecik);
  if (menecerFilter) rows = rows.filter((r) => r.menecer_ad === menecerFilter);

  rows = [...rows].sort((a, b) => {
    if (sort === "borc_h") return b.borc - a.borc;
    if (sort === "borc_l") return a.borc - b.borc;
    if (sort === "gun_h") return b.gun_kecdi - a.gun_kecdi;
    if (sort === "ad") return a.ad.localeCompare(b.ad, "az");
    return 0;
  });

  // Aging buckets (5-li dünya praktikası)
  const cari = rows.filter((r) => r.gun_kecdi <= 30).reduce((s, r) => s + r.borc, 0);
  const b3060 = rows.filter((r) => r.gun_kecdi > 30 && r.gun_kecdi <= 60).reduce((s, r) => s + r.borc, 0);
  const b6090 = rows.filter((r) => r.gun_kecdi > 60 && r.gun_kecdi <= 90).reduce((s, r) => s + r.borc, 0);
  const b90plus = rows.filter((r) => r.gun_kecdi > 90).reduce((s, r) => s + r.borc, 0);
  const cemi = cari + b3060 + b6090 + b90plus;

  const limAsib = rows.filter((r) => r.limit_asib).length;
  const orta = rows.length ? cemi / rows.length : 0;
  const top = rows.slice(0, 5);

  // Unique manecerlər (filter üçün)
  const menecerler = Array.from(
    new Set(allRows.map((r) => r.menecer_ad).filter(Boolean) as string[]),
  ).sort();

  const totalAcigSened = rows.reduce((s, r) => s + r.acig_sened_say, 0);
  const totalAvans = rows.reduce((s, r) => s + r.avans, 0);

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      {/* HEADER */}
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="bg-gradient-to-br from-foreground to-foreground/70 bg-clip-text text-2xl font-bold tracking-tight text-transparent">
            Debitor — müştəri borcları
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {rows.length} müştəri · {totalAcigSened} açıq sənəd · {formatMoney(cemi)} ümumi borc
          </p>
        </div>
        <Link
          href="/maliyye/debitor?new=musteri_odenish"
          className="inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition hover:scale-105"
          style={{ background: "var(--brand-gradient)" }}
        >
          <HandCoins className="h-3.5 w-3.5" /> Ödəniş qəbul et
        </Link>
      </header>

      <MaliyyeSubNav active="/maliyye/debitor" />

      {/* KPI CARDS — 4 əsas */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          icon={TrendingUp}
          label="Cəmi debitor borcu"
          value={formatMoney(cemi)}
          subline={`${rows.length} müştəri`}
          tone="success"
        />
        <KpiCard
          icon={Clock}
          label="Cari (0-30 gün)"
          value={formatMoney(cari)}
          subline={`${((cari / (cemi || 1)) * 100).toFixed(0)}% portfeldən`}
          tone="neutral"
        />
        <KpiCard
          icon={AlertTriangle}
          label="Kritik (60+ gün)"
          value={formatMoney(b6090 + b90plus)}
          subline={`${rows.filter((r) => r.gun_kecdi > 60).length} müştəri`}
          tone={b6090 + b90plus > 0 ? "danger" : "neutral"}
        />
        <KpiCard
          icon={TrendingDown}
          label="Limit aşan"
          value={String(limAsib)}
          subline={`Avans cəmi: ${formatMoney(totalAvans)}`}
          tone={limAsib > 0 ? "warning" : "neutral"}
        />
      </section>

      {/* AGING BREAKDOWN — modern bar */}
      <section className="rounded-2xl border border-border bg-card/40 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Yaş analizi (Aging)</h3>
          <span className="text-xs text-muted-foreground">Orta borc: {formatMoney(orta)}</span>
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <AgingBucket
            label="0-30 gün"
            value={cari}
            total={cemi}
            count={rows.filter((r) => r.gun_kecdi <= 30).length}
            tone="emerald"
          />
          <AgingBucket
            label="31-60 gün"
            value={b3060}
            total={cemi}
            count={rows.filter((r) => r.gun_kecdi > 30 && r.gun_kecdi <= 60).length}
            tone="amber"
          />
          <AgingBucket
            label="61-90 gün"
            value={b6090}
            total={cemi}
            count={rows.filter((r) => r.gun_kecdi > 60 && r.gun_kecdi <= 90).length}
            tone="orange"
          />
          <AgingBucket
            label="90+ gün"
            value={b90plus}
            total={cemi}
            count={rows.filter((r) => r.gun_kecdi > 90).length}
            tone="rose"
          />
        </div>
      </section>

      {/* TOP 5 DEBITORS chart */}
      {top.length > 0 && (
        <section className="rounded-2xl border border-border bg-card/40 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Top 5 borclu müştəri</h3>
            <Link
              href="/maliyye/debitor?sort=borc_h"
              className="text-[11px] text-muted-foreground hover:text-foreground"
            >
              Hamısına bax →
            </Link>
          </div>
          <div className="space-y-2">
            {top.map((r, i) => {
              const maxBorc = top[0].borc || 1;
              const w = (r.borc / maxBorc) * 100;
              const tone =
                r.gun_kecdi > 60
                  ? "from-rose-500 to-rose-400"
                  : r.gun_kecdi > 30
                    ? "from-amber-500 to-amber-400"
                    : "from-emerald-500 to-emerald-400";
              return (
                <Link
                  key={r.id}
                  href={`/elaqe/musteriler/${r.id}`}
                  className="group block"
                >
                  <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                    <span className="font-medium">
                      {i + 1}. {r.ad}
                    </span>
                    <span className="tabular-nums font-semibold text-emerald-600 dark:text-emerald-400">
                      {formatMoney(r.borc)}
                    </span>
                  </div>
                  <div className="relative h-2 overflow-hidden rounded-full bg-secondary">
                    <div
                      className={`absolute inset-y-0 left-0 rounded-full bg-gradient-to-r ${tone} transition-all group-hover:brightness-110`}
                      style={{ width: `${w}%` }}
                    />
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* FILTERS — modern toolbar */}
      <section className="rounded-2xl border border-border bg-card/40 p-3">
        <form className="flex flex-wrap items-center gap-2">
          {/* Pill ilə seçilən gecikmə filtrini submit-də qoru */}
          {gecik > 0 && <input type="hidden" name="gecik" value={String(gecik)} />}
          <div className="relative min-w-[240px] flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              name="q"
              defaultValue={q}
              placeholder="Ad, telefon, VÖEN, menecer..."
              className="h-9 w-full rounded-lg border border-input bg-background pl-8 pr-3 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* Gecikmə pillərı */}
          <div className="flex items-center gap-1 rounded-lg border border-border bg-background p-0.5">
            {[
              { v: 0, l: "Hamısı" },
              { v: 30, l: "30+" },
              { v: 60, l: "60+" },
              { v: 90, l: "90+" },
            ].map((o) => {
              const params = new URLSearchParams();
              if (q) params.set("q", q);
              if (sort && sort !== "borc_h") params.set("sort", sort);
              if (menecerFilter) params.set("menecer", menecerFilter);
              if (sp.mn) params.set("mn", sp.mn);
              if (sp.mx) params.set("mx", sp.mx);
              if (sp.df) params.set("df", sp.df);
              if (sp.dt) params.set("dt", sp.dt);
              if (o.v > 0) params.set("gecik", String(o.v));
              const active = gecik === o.v;
              return (
                <Link
                  key={o.v}
                  href={`/maliyye/debitor?${params.toString()}`}
                  className={`inline-flex h-7 items-center rounded-md px-2.5 text-xs font-medium transition ${
                    active
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {o.l}
                </Link>
              );
            })}
          </div>

          {menecerler.length > 0 && (
            <select
              name="menecer"
              defaultValue={menecerFilter}
              className="h-9 rounded-lg border border-input bg-background px-2 text-xs shadow-sm focus:border-primary focus:outline-none"
            >
              <option value="">Bütün menecerlər</option>
              {menecerler.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          )}

          {/* Borc aralığı (min/max) — query where-ə bağlıdır */}
          <div className="flex items-center gap-1" title="Borc aralığı (₼)">
            <input
              type="number"
              name="mn"
              defaultValue={sp.mn ?? ""}
              min={0}
              step="0.01"
              placeholder="min ₼"
              className="h-9 w-24 rounded-lg border border-input bg-background px-2 text-xs shadow-sm focus:border-primary focus:outline-none"
            />
            <span className="text-muted-foreground">–</span>
            <input
              type="number"
              name="mx"
              defaultValue={sp.mx ?? ""}
              min={0}
              step="0.01"
              placeholder="max ₼"
              className="h-9 w-24 rounded-lg border border-input bg-background px-2 text-xs shadow-sm focus:border-primary focus:outline-none"
            />
          </div>

          {/* Son alver tarix aralığı — query where-ə bağlıdır */}
          <div className="flex items-center gap-1" title="Son alver tarix aralığı">
            <input
              type="date"
              name="df"
              defaultValue={sp.df ?? ""}
              className="h-9 rounded-lg border border-input bg-background px-2 text-xs shadow-sm focus:border-primary focus:outline-none"
            />
            <span className="text-muted-foreground">–</span>
            <input
              type="date"
              name="dt"
              defaultValue={sp.dt ?? ""}
              className="h-9 rounded-lg border border-input bg-background px-2 text-xs shadow-sm focus:border-primary focus:outline-none"
            />
          </div>

          <select
            name="sort"
            defaultValue={sort}
            className="h-9 rounded-lg border border-input bg-background px-2 text-xs shadow-sm focus:border-primary focus:outline-none"
          >
            <option value="borc_h">Borc ↓</option>
            <option value="borc_l">Borc ↑</option>
            <option value="gun_h">Gün ↓</option>
            <option value="ad">Ad üzrə</option>
          </select>

          <button
            type="submit"
            className="h-9 rounded-lg bg-primary px-3.5 text-xs font-semibold text-primary-foreground shadow-sm transition hover:opacity-90"
          >
            Filtrlə
          </button>
        </form>
      </section>

      {/* TABLE */}
      {rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/30 py-16 text-center">
          <div className="mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-secondary">
            <Users className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="font-semibold">
            {q || gecik || sp.mn || sp.mx || sp.df || sp.dt
              ? "Filterə uyğun borc yoxdur"
              : "Borclu müştəri yoxdur"}
          </h3>
          {!q && !gecik && !sp.mn && !sp.mx && !sp.df && !sp.dt && (
            <p className="mt-1 text-sm text-muted-foreground">
              Bütün müştərilər tam ödəyiblər.
            </p>
          )}
        </div>
      ) : (
        <section className="overflow-hidden rounded-2xl border border-border bg-card/40 shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-secondary/80 backdrop-blur-sm">
                <tr className="text-left text-[10.5px] uppercase tracking-wider text-muted-foreground">
                  <th className="px-3 py-3 w-10"></th>
                  <th className="px-3 py-3">Müştəri</th>
                  <th className="px-3 py-3">Əlaqə</th>
                  <th className="px-3 py-3 text-right">Borc</th>
                  <th className="px-3 py-3 text-center">Açıq sənəd</th>
                  <th className="px-3 py-3 text-right">Gün</th>
                  <th className="px-3 py-3 text-right">Əməliyyat</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <DebtorRowExpanded
                    key={r.id}
                    row={r}
                    hesablar={refs.hesablar}
                    initialOpenSales={openSalesMap.get(r.id)}
                  />
                ))}
              </tbody>
              <tfoot className="bg-secondary/40">
                <tr className="border-t border-border/60 text-xs">
                  <td colSpan={3} className="px-3 py-2.5 font-semibold">
                    Cəmi ({rows.length})
                  </td>
                  <td className="px-3 py-2.5 text-right text-base font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                    {formatMoney(cemi)}
                  </td>
                  <td className="px-3 py-2.5 text-center font-bold tabular-nums">
                    {totalAcigSened}
                  </td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>
      )}

      <QuickOpDialog
        hesablar={refs.hesablar}
        iscilier={refs.iscilier}
        kontragentler={refs.kontragentler}
      />
    </div>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  subline,
  tone = "neutral",
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  subline: string;
  tone?: "success" | "warning" | "danger" | "neutral";
}) {
  const toneCls =
    tone === "success"
      ? "from-emerald-500/10 to-emerald-500/5 text-emerald-600 dark:text-emerald-400"
      : tone === "warning"
        ? "from-amber-500/10 to-amber-500/5 text-amber-600 dark:text-amber-400"
        : tone === "danger"
          ? "from-rose-500/10 to-rose-500/5 text-rose-600 dark:text-rose-400"
          : "from-secondary/40 to-secondary/20 text-foreground";
  return (
    <div
      className={`group relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br ${toneCls} p-4 shadow-sm transition hover:shadow-md`}
    >
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[10.5px] font-medium uppercase tracking-wider text-muted-foreground">
            {label}
          </div>
          <div className="mt-1 text-2xl font-bold tabular-nums">{value}</div>
          <div className="mt-0.5 text-[11px] text-muted-foreground">{subline}</div>
        </div>
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-background/60">
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </div>
  );
}

function AgingBucket({
  label,
  value,
  total,
  count,
  tone,
}: {
  label: string;
  value: number;
  total: number;
  count: number;
  tone: "emerald" | "amber" | "orange" | "rose";
}) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  const gradient = {
    emerald: "from-emerald-500 to-emerald-400",
    amber: "from-amber-500 to-amber-400",
    orange: "from-orange-500 to-orange-400",
    rose: "from-rose-500 to-rose-400",
  }[tone];
  const text = {
    emerald: "text-emerald-600 dark:text-emerald-400",
    amber: "text-amber-600 dark:text-amber-400",
    orange: "text-orange-600 dark:text-orange-400",
    rose: "text-rose-600 dark:text-rose-400",
  }[tone];
  return (
    <div className="rounded-xl border border-border bg-background p-3">
      <div className="flex items-center justify-between text-[11px]">
        <span className="font-medium text-muted-foreground">{label}</span>
        <span className="tabular-nums text-muted-foreground">{count}</span>
      </div>
      <div className={`mt-1.5 text-lg font-bold tabular-nums ${text}`}>
        {formatMoney(value)}
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-secondary">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${gradient}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="mt-1 text-[10px] tabular-nums text-muted-foreground">
        {pct.toFixed(1)}% portfeldən
      </div>
    </div>
  );
}
