import type { Metadata } from "next";
import Link from "next/link";
import { Flame, Calendar } from "lucide-react";
import { BackButton } from "@/components/ui/back-button";
import { TicaretSubNav } from "@/components/ticaret-subnav";
import { getSalesHeatmap } from "@/features/ticaret/heatmap-queries";
import { formatMoney, formatNumber } from "@/lib/utils";

export const metadata: Metadata = { title: "Satış istilik xəritəsi" };
export const dynamic = "force-dynamic";

const DOW = ["B", "Be", "Ça", "Çə", "Cə", "Cü", "Şə"]; // Sun..Sat in Azeri short

type SearchParams = { gun?: string };

export default async function SalesHeatmapPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const gun = Math.min(365, Math.max(7, Number(sp.gun) || 90));

  const cells = await getSalesHeatmap(gun);

  // Index by [dow][hour]
  const grid: { say: number; meb: number }[][] = Array.from({ length: 7 }, () =>
    Array.from({ length: 24 }, () => ({ say: 0, meb: 0 }))
  );
  for (const c of cells) grid[c.dow][c.hour] = { say: c.say, meb: c.meb };

  const maxSay = Math.max(1, ...cells.map((c) => c.say));
  const totalSay = cells.reduce((s, c) => s + c.say, 0);
  const totalMeb = cells.reduce((s, c) => s + c.meb, 0);

  function bgFor(say: number): string {
    if (say <= 0) return "bg-secondary/40";
    const pct = say / maxSay;
    if (pct < 0.2) return "bg-success/15";
    if (pct < 0.4) return "bg-success/35";
    if (pct < 0.6) return "bg-success/55";
    if (pct < 0.8) return "bg-warning/55";
    return "bg-danger/70";
  }

  // Peak hour and dow
  let peakSay = 0;
  let peakDow = 0;
  let peakHour = 0;
  for (let d = 0; d < 7; d++) {
    for (let h = 0; h < 24; h++) {
      if (grid[d][h].say > peakSay) {
        peakSay = grid[d][h].say;
        peakDow = d;
        peakHour = h;
      }
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-start gap-3">
          <BackButton fallback="/ticaret" className="mt-1" />
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
              <Flame className="h-5 w-5 text-warning" />
              Satış istilik xəritəsi
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Saat × gün siklində satış sıxlığı. Pik vaxtları və boş slotları aşkarlamaq üçün.
            </p>
          </div>
        </div>
      </div>

      <TicaretSubNav active="/ticaret" />

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card/40 p-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Dövr
        </span>
        {[30, 60, 90, 180, 365].map((d) => (
          <Link
            key={d}
            href={`/ticaret/hesabat/heatmap?gun=${d}`}
            className={`inline-flex h-7 items-center gap-1 rounded-full border px-2.5 text-xs font-medium transition ${
              gun === d
                ? "border-primary/40 bg-primary/15 text-primary-light"
                : "border-border bg-card text-muted-foreground hover:text-foreground"
            }`}
          >
            <Calendar className="h-3 w-3" />
            {d} gün
          </Link>
        ))}
      </div>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-3">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Toplam satış</div>
          <div className="mt-1 text-xl font-bold tabular-nums">{formatNumber(totalSay)}</div>
        </div>
        <div className="rounded-xl border border-border bg-card p-3">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Toplam məbləğ</div>
          <div className="mt-1 text-xl font-bold tabular-nums">{formatMoney(totalMeb)}</div>
        </div>
        <div className="rounded-xl border border-border bg-card p-3">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Pik slot</div>
          <div className="mt-1 text-xl font-bold tabular-nums">
            {peakSay > 0 ? `${DOW[peakDow]} · ${String(peakHour).padStart(2, "0")}:00` : "—"}
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-3">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Pik say</div>
          <div className="mt-1 text-xl font-bold tabular-nums text-warning">
            {formatNumber(peakSay)}
          </div>
        </div>
      </section>

      <div className="rounded-xl border border-border bg-card p-4">
        <div className="overflow-x-auto">
          <table className="border-separate border-spacing-[2px] text-[10px]">
            <thead>
              <tr>
                <th className="w-7 px-1.5 py-1 text-muted-foreground"></th>
                {Array.from({ length: 24 }, (_, h) => (
                  <th
                    key={h}
                    className="w-7 px-1 py-1 text-center font-mono text-[9px] text-muted-foreground"
                  >
                    {String(h).padStart(2, "0")}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {DOW.map((label, dow) => (
                <tr key={dow}>
                  <td className="px-1.5 py-1 text-right font-mono font-medium text-muted-foreground">
                    {label}
                  </td>
                  {Array.from({ length: 24 }, (_, h) => {
                    const cell = grid[dow][h];
                    return (
                      <td
                        key={h}
                        title={`${label} ${String(h).padStart(2, "0")}:00 — ${cell.say} satış · ${formatMoney(cell.meb)}`}
                        className={`h-7 w-7 rounded ${bgFor(cell.say)}`}
                      />
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex items-center justify-end gap-1.5 text-[10px] text-muted-foreground">
          <span>az</span>
          <span className="h-3 w-3 rounded bg-secondary/40" />
          <span className="h-3 w-3 rounded bg-success/15" />
          <span className="h-3 w-3 rounded bg-success/35" />
          <span className="h-3 w-3 rounded bg-success/55" />
          <span className="h-3 w-3 rounded bg-warning/55" />
          <span className="h-3 w-3 rounded bg-danger/70" />
          <span>çox</span>
        </div>
      </div>
    </div>
  );
}
