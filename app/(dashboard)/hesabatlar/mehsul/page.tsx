import type { Metadata } from "next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PackageX, TrendingDown, TrendingUp, AlertTriangle } from "lucide-react";
import { DateRangeFilter } from "@/features/hesabatlar/components/date-range-filter";
import { HorizontalBarChart } from "@/features/hesabatlar/components/charts";
import {
  getAbcAnalysis,
  getDeadStock90,
  getTopMovers,
  getMostProfitable,
  getSlowMovers,
  getSalesByCategory,
  getReorderList,
  getReorderFilters,
} from "@/features/hesabatlar/mehsul-queries";
import { parseDateRange, formatDateInput } from "@/features/hesabatlar/shared";
import { formatMoney, formatNumber, formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Məhsul hesabatı" };

type SP = { from?: string; to?: string; preset?: string; kateqoriya?: string; marka?: string; anbar?: string; q?: string };

export default async function MehsulReportPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const range = parseDateRange(sp);

  const [abc, dead, movers, profitable, slow, byCategory, reorder, filters] = await Promise.all([
    getAbcAnalysis(range),
    getDeadStock90(20),
    getTopMovers(range, 15),
    getMostProfitable(range, 15),
    getSlowMovers(range, 15),
    getSalesByCategory(range),
    getReorderList(30),
    getReorderFilters(),
  ]);

  // Client-side product filter applied below
  const lowerQ = (sp.q ?? "").toLowerCase().trim();
  const kateqoriyaFilter = sp.kateqoriya ?? "";
  const markaFilter = sp.marka ?? "";
  const anbarFilter = sp.anbar ?? "";
  const filteredReorder = reorder.filter((r) => {
    if (lowerQ && !(r.ad.toLowerCase().includes(lowerQ) || (r.kod ?? "").toLowerCase().includes(lowerQ))) return false;
    return true;
  });
  const reorderPdfParams = new URLSearchParams();
  if (kateqoriyaFilter) reorderPdfParams.set("kateqoriya", kateqoriyaFilter);
  if (markaFilter) reorderPdfParams.set("marka", markaFilter);
  if (anbarFilter) reorderPdfParams.set("anbar", anbarFilter);
  if (lowerQ) reorderPdfParams.set("q", lowerQ);

  const abcCounts = abc.reduce(
    (acc, r) => {
      acc[r.grade] = (acc[r.grade] ?? 0) + 1;
      return acc;
    },
    {} as Record<"A" | "B" | "C", number>
  );

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Məhsul hesabatı</h1>
        <p className="mt-1 text-sm text-muted-foreground">ABC analizi, ölü stok, top movers və slow movers.</p>
      </header>

      <DateRangeFilter
        base="/hesabatlar/mehsul"
        current={{ from: formatDateInput(range.from), to: formatDateInput(range.to), preset: sp.preset }}
      />

      {/* Filter bar */}
      <form
        method="get"
        className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card/30 p-3"
        data-section="mehsul-filters"
      >
        {sp.from && <input type="hidden" name="from" value={sp.from} />}
        {sp.to && <input type="hidden" name="to" value={sp.to} />}
        {sp.preset && <input type="hidden" name="preset" value={sp.preset} />}
        <input
          type="text"
          name="q"
          defaultValue={sp.q ?? ""}
          placeholder="🔍 Məhsul axtar..."
          className="h-9 min-w-[200px] flex-1 rounded-md border border-input bg-background px-3 text-sm"
        />
        <select name="kateqoriya" defaultValue={kateqoriyaFilter} className="h-9 rounded-md border border-input bg-background px-2 text-sm">
          <option value="">Bütün kateqoriyalar</option>
          {filters.categories.map((c) => <option key={c.id} value={c.id}>{c.ad}</option>)}
        </select>
        <select name="marka" defaultValue={markaFilter} className="h-9 rounded-md border border-input bg-background px-2 text-sm">
          <option value="">Bütün markalar</option>
          {filters.brands.map((b) => <option key={b.id} value={b.id}>{b.ad}</option>)}
        </select>
        <select name="anbar" defaultValue={anbarFilter} className="h-9 rounded-md border border-input bg-background px-2 text-sm">
          <option value="">Bütün anbarlar</option>
          {filters.anbarlar.map((a) => <option key={a.id} value={a.id}>{a.ad}</option>)}
        </select>
        <button type="submit" className="h-9 rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground">Filtrlə</button>
        <a
          href={`/api/hesabatlar/mehsul/reorder-pdf?${reorderPdfParams.toString()}`}
          target="_blank"
          rel="noopener noreferrer"
          className="h-9 inline-flex items-center rounded-md border border-warning/40 bg-warning/10 px-3 text-xs font-semibold text-warning hover:bg-warning/20"
          data-reorder-pdf="1"
        >
          Reorder PDF
        </a>
      </form>

      <section className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <Card className="glass">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">ABC analizi</CardTitle>
            <p className="text-xs text-muted-foreground">A: top 80% gəlir · B: növbəti 15% · C: alt 5%</p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-md border border-success/30 bg-success/10 p-3">
                <div className="text-[10px] uppercase tracking-wider text-success">A — Yüksək dəyər</div>
                <div className="mt-1 text-2xl font-bold tabular-nums">{abcCounts.A ?? 0}</div>
              </div>
              <div className="rounded-md border border-warning/30 bg-warning/10 p-3">
                <div className="text-[10px] uppercase tracking-wider text-warning">B — Orta</div>
                <div className="mt-1 text-2xl font-bold tabular-nums">{abcCounts.B ?? 0}</div>
              </div>
              <div className="rounded-md border border-muted/30 bg-secondary/30 p-3">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">C — Aşağı</div>
                <div className="mt-1 text-2xl font-bold tabular-nums">{abcCounts.C ?? 0}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Kateqoriya üzrə gəlir</CardTitle>
          </CardHeader>
          <CardContent>
            <HorizontalBarChart data={byCategory.slice(0, 10).map((c) => ({ label: c.kateqoriya_ad, value: c.gelir, sub: c.satilan }))} />
          </CardContent>
        </Card>
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="glass">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-4 w-4 text-success" />
              Top movers (ən çox satılan, 15)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ProductTable rows={movers} sortLabel="Sayı" sortKey="satilan" />
          </CardContent>
        </Card>

        <Card className="glass">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-4 w-4 text-info" />
              Ən mənfəətli (15)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ProductTable rows={profitable} sortLabel="Mənfəət" sortKey="mənfeet" />
          </CardContent>
        </Card>
      </div>

      <Card className="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingDown className="h-4 w-4 text-warning" />
            Slow movers (ən az satılan)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ProductTable rows={slow} sortLabel="Sayı" sortKey="satilan" />
        </CardContent>
      </Card>

      <Card className="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <PackageX className="h-4 w-4 text-warning" />
            Ölü stok — 90+ gün satılmayan
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {dead.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Ölü stok yoxdur</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border/60 text-left text-[10.5px] uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">Məhsul</th>
                    <th className="px-3 py-2">Son satış</th>
                    <th className="px-3 py-2 text-right">Stok</th>
                    <th className="px-3 py-2 text-right">Dəyər</th>
                  </tr>
                </thead>
                <tbody>
                  {dead.map((d) => (
                    <tr key={d.mehsul_id} className="border-b border-border/30">
                      <td className="px-3 py-2.5">
                        <div className="font-medium">{d.ad}</div>
                        {d.kod && <div className="text-xs font-mono text-muted-foreground">{d.kod}</div>}
                      </td>
                      <td className="px-3 py-2.5">
                        {d.son_satis ? (
                          <div>
                            <Badge variant="outline" className="text-[10px]">{formatDate(d.son_satis)}</Badge>
                            {d.gun_satissiz != null && <div className="mt-0.5 text-[10px] text-muted-foreground">{d.gun_satissiz} gün</div>}
                          </div>
                        ) : (
                          <Badge variant="outline" className="text-[10px] text-danger">Heç vaxt</Badge>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{formatNumber(d.stok, 0)} əd</td>
                      <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-warning">{formatMoney(d.deyer)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="h-4 w-4 text-warning" />
            Yenidən sifariş lazımdır (stok ≤ min_stok)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {filteredReorder.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Reorder lazım deyil</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border/60 text-left text-[10.5px] uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">Məhsul</th>
                    <th className="px-3 py-2 text-right">Stok</th>
                    <th className="px-3 py-2 text-right">Min</th>
                    <th className="px-3 py-2 text-right">Kritik</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredReorder.map((r) => (
                    <tr key={r.mehsul_id} className="border-b border-border/30">
                      <td className="px-3 py-2.5">
                        <div className="font-medium">{r.ad}</div>
                        {r.kod && <div className="text-xs font-mono text-muted-foreground">{r.kod}</div>}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-warning">{formatNumber(r.stok, 0)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-xs">{formatNumber(r.min_stok, 0)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-xs">{r.kritik_stok != null ? formatNumber(r.kritik_stok, 0) : "—"}</td>
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

function ProductTable({
  rows,
  sortLabel,
  sortKey,
}: {
  rows: { mehsul_id: string; ad: string; kod: string | null; satilan: number; gelir: number; xerc: number; mənfeet: number; margin_faiz: number | null }[];
  sortLabel: string;
  sortKey: "satilan" | "gelir" | "mənfeet";
}) {
  if (rows.length === 0) return <p className="py-8 text-center text-sm text-muted-foreground">Məlumat yoxdur</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="border-b border-border/60 text-left text-[10.5px] uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="px-3 py-2">Məhsul</th>
            <th className="px-3 py-2 text-right">{sortLabel}</th>
            <th className="px-3 py-2 text-right">Gəlir</th>
            <th className="px-3 py-2 text-right">Mənfəət</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.mehsul_id} className="border-b border-border/30">
              <td className="px-3 py-2">
                <div className="font-medium">{r.ad}</div>
                {r.kod && <div className="text-[10px] font-mono text-muted-foreground">{r.kod}</div>}
              </td>
              <td className="px-3 py-2 text-right tabular-nums text-xs">
                {sortKey === "satilan" ? formatNumber(r.satilan, 0) : sortKey === "gelir" ? formatMoney(r.gelir) : formatMoney(r["mənfeet"])}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">{formatMoney(r.gelir)}</td>
              <td className={`px-3 py-2 text-right tabular-nums font-semibold ${r["mənfeet"] < 0 ? "text-danger" : "text-success"}`}>
                {formatMoney(r["mənfeet"])}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
