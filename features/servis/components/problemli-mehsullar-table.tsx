"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { ExternalLink, Eye, Loader2, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  SERVIS_STATUS_LABELS,
  type ServisRow,
} from "../types";
import { formatMoney, formatDate } from "@/lib/utils";
import { fetchProblemMehsulRows, fetchProductServisTrend } from "../actions-problemli";
import { TopFailChart, TrendChart } from "./hesabat-charts";

type Row = {
  mehsul_id: string | null;
  mehsul_ad: string;
  marka: string | null;
  kateqoriya: string | null;
  servis_sayi: number;
  aktiv_say: number;
  son_tarix: Date | null;
  ilk_tarix: Date | null;
  avg_gun: number;
  cemi_gelir: number;
  top_problem: string | null;
};

function fmt(d: Date | string | null) {
  if (!d) return "—";
  return formatDate(d);
}

export function ProblemMehsullarTable({
  rows,
  markalar = [],
  kateqoriyalar = [],
  initial,
}: {
  rows: Row[];
  markalar?: { id: number; ad: string }[];
  kateqoriyalar?: { id: number; ad: string }[];
  initial?: { marka?: string; kateqoriya?: string; from?: string; to?: string };
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [filters, setFilters] = useState({
    q: "",
    marka: initial?.marka ?? "",
    kateqoriya: initial?.kateqoriya ?? "",
    from: initial?.from ?? "",
    to: initial?.to ?? "",
  });

  const [open, setOpen] = useState<Row | null>(null);
  const [detailRows, setDetailRows] = useState<ServisRow[]>([]);
  const [trend, setTrend] = useState<{ ay: string; say: number; gelir: number }[]>([]);
  const [defekt, setDefekt] = useState<{ mehsul_ad: string; say: number }[]>([]);
  const [pending, startTransition] = useTransition();

  // Sync filters → URL
  useEffect(() => {
    const sp = new URLSearchParams();
    if (filters.marka) sp.set("marka", filters.marka);
    if (filters.kateqoriya) sp.set("kateqoriya", filters.kateqoriya);
    if (filters.from) sp.set("from", filters.from);
    if (filters.to) sp.set("to", filters.to);
    const next = sp.toString();
    if (next === searchParams.toString()) return;
    router.replace(`${pathname}${next ? `?${next}` : ""}`, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.marka, filters.kateqoriya, filters.from, filters.to]);

  const filtered = useMemo(() => {
    if (!filters.q) return rows;
    const q = filters.q.toLowerCase();
    return rows.filter(
      (r) =>
        r.mehsul_ad.toLowerCase().includes(q) ||
        (r.marka ?? "").toLowerCase().includes(q) ||
        (r.kateqoriya ?? "").toLowerCase().includes(q) ||
        (r.top_problem ?? "").toLowerCase().includes(q),
    );
  }, [rows, filters.q]);

  function openDetail(row: Row) {
    setOpen(row);
    setDetailRows([]);
    setTrend([]);
    setDefekt([]);
    startTransition(async () => {
      const [rows, trendRes] = await Promise.all([
        fetchProblemMehsulRows({
          mehsul_id: row.mehsul_id,
          mehsul_ad: row.mehsul_id ? null : row.mehsul_ad,
        }),
        fetchProductServisTrend({
          mehsul_id: row.mehsul_id,
          mehsul_ad: row.mehsul_id ? null : row.mehsul_ad,
        }),
      ]);
      if (rows.ok) setDetailRows(rows.rows);
      if (trendRes.ok) {
        setTrend(trendRes.trend.map((t) => ({ ay: t.ay, say: t.say, gelir: 0 })));
        setDefekt(trendRes.defekt.map((d) => ({ mehsul_ad: d.ad, say: d.say })));
      }
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Axtar (məhsul, marka, kateqoriya, problem)…"
          value={filters.q}
          onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
          className="h-9 min-w-[240px] flex-1"
        />
        {markalar.length > 0 && (
          <select
            value={filters.marka}
            onChange={(e) => setFilters((f) => ({ ...f, marka: e.target.value }))}
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          >
            <option value="">Bütün markalar</option>
            {markalar.map((m) => (
              <option key={m.id} value={String(m.id)}>{m.ad}</option>
            ))}
          </select>
        )}
        {kateqoriyalar.length > 0 && (
          <select
            value={filters.kateqoriya}
            onChange={(e) => setFilters((f) => ({ ...f, kateqoriya: e.target.value }))}
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          >
            <option value="">Bütün kateqoriyalar</option>
            {kateqoriyalar.map((k) => (
              <option key={k.id} value={String(k.id)}>{k.ad}</option>
            ))}
          </select>
        )}
        <Input
          type="date"
          value={filters.from}
          onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))}
          className="h-9 w-[140px]"
          title="Başlanğıc"
        />
        <Input
          type="date"
          value={filters.to}
          onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))}
          className="h-9 w-[140px]"
          title="Bitmə"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
          Filtrlərə uyğun məhsul tapılmadı.
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card/40 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border/60 text-left text-[10.5px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-3 py-2.5">Məhsul</th>
                <th className="px-3 py-2.5">Marka</th>
                <th className="px-3 py-2.5">Kateqoriya</th>
                <th className="px-3 py-2.5 text-right">Servis sayı</th>
                <th className="px-3 py-2.5 text-right">Aktiv</th>
                <th className="px-3 py-2.5">Son servis</th>
                <th className="px-3 py-2.5 text-right">Ort. gün</th>
                <th className="px-3 py-2.5 text-right">Cəmi gəlir</th>
                <th className="px-3 py-2.5">Top problem</th>
                <th className="px-3 py-2.5 text-right">Əməl</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, idx) => (
                <tr key={(r.mehsul_id ?? r.mehsul_ad) + idx} className="border-b border-border/30 transition hover:bg-secondary/40">
                  <td className="px-3 py-2.5 align-top">
                    <button
                      type="button"
                      onClick={() => openDetail(r)}
                      className="text-left font-medium text-foreground hover:text-primary-light"
                    >
                      {r.mehsul_ad}
                    </button>
                  </td>
                  <td className="px-3 py-2.5 align-top text-xs">{r.marka ?? "—"}</td>
                  <td className="px-3 py-2.5 align-top text-xs">{r.kateqoriya ?? "—"}</td>
                  <td className="px-3 py-2.5 align-top text-right tabular-nums font-semibold">
                    {r.servis_sayi}
                  </td>
                  <td className="px-3 py-2.5 align-top text-right tabular-nums">
                    {r.aktiv_say > 0 ? (
                      <Badge variant="outline" className="border-amber-400/30 bg-amber-400/10 text-amber-300">
                        {r.aktiv_say}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 align-top text-xs text-muted-foreground">{fmt(r.son_tarix)}</td>
                  <td className="px-3 py-2.5 align-top text-right tabular-nums text-xs">
                    {r.avg_gun > 0 ? r.avg_gun : "—"}
                  </td>
                  <td className="px-3 py-2.5 align-top text-right tabular-nums text-xs font-semibold">
                    {r.cemi_gelir > 0 ? formatMoney(r.cemi_gelir) : "—"}
                  </td>
                  <td className="px-3 py-2.5 align-top">
                    <p className="line-clamp-2 max-w-xs text-xs text-muted-foreground">{r.top_problem ?? "—"}</p>
                  </td>
                  <td className="px-3 py-2.5 align-top text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => openDetail(r)}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground"
                        title="Servis qeydlərini gör"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </button>
                      {r.mehsul_id && (
                        <Link
                          href={`/anbar/mehsullar/${r.mehsul_id}`}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground"
                          title="Anbarda bax"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Link>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="border-t border-border/40 px-3 py-2 text-xs text-muted-foreground">
            Cəmi: {filtered.length} məhsul
          </div>
        </div>
      )}

      <Dialog open={!!open} onOpenChange={(v) => { if (!v) setOpen(null); }}>
        <DialogContent className="p-4 md:max-w-4xl">
          <DialogHeader className="pb-2">
            <DialogTitle className="flex items-center justify-between text-base">
              <span>{open?.mehsul_ad}</span>
              <button
                type="button"
                onClick={() => setOpen(null)}
                className="rounded-md p-1 text-muted-foreground hover:bg-secondary"
              >
                <X className="h-4 w-4" />
              </button>
            </DialogTitle>
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              {open?.marka && <span>Marka: <span className="font-medium text-foreground">{open.marka}</span></span>}
              {open?.kateqoriya && <span>Kateqoriya: <span className="font-medium text-foreground">{open.kateqoriya}</span></span>}
              <span>Servis sayı: <span className="font-medium text-foreground">{open?.servis_sayi}</span></span>
              {open?.cemi_gelir != null && open.cemi_gelir > 0 && (
                <span>Cəmi gəlir: <span className="font-medium text-foreground">{formatMoney(open.cemi_gelir)}</span></span>
              )}
              {open?.mehsul_id && (
                <Link href={`/anbar/mehsullar/${open.mehsul_id}`} className="text-primary-light hover:underline">
                  Anbarda bax →
                </Link>
              )}
            </div>
          </DialogHeader>

          <div className="max-h-[60vh] overflow-y-auto">
            {pending ? (
              <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Yüklənir…
              </div>
            ) : detailRows.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">Servis qeydi yoxdur.</div>
            ) : (
              <>
                {(trend.length > 0 || defekt.length > 0) && (
                  <div className="mb-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                    {trend.length > 0 && (
                      <div className="rounded-md border border-border/40 bg-card/40 p-2">
                        <div className="mb-1 text-[10.5px] uppercase tracking-wider text-muted-foreground">
                          Son 6 ay servis sayı
                        </div>
                        <TrendChart data={trend} />
                      </div>
                    )}
                    {defekt.length > 0 && (
                      <div className="rounded-md border border-border/40 bg-card/40 p-2">
                        <div className="mb-1 text-[10.5px] uppercase tracking-wider text-muted-foreground">
                          Defekt kateqoriya paylanması
                        </div>
                        <TopFailChart data={defekt} />
                      </div>
                    )}
                  </div>
                )}
              <table className="w-full text-sm">
                <thead className="sticky top-0 border-b border-border/60 bg-background text-left text-[10.5px] uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-2 py-2">Nömrə</th>
                    <th className="px-2 py-2">Tarix</th>
                    <th className="px-2 py-2">Müştəri</th>
                    <th className="px-2 py-2">Problem</th>
                    <th className="px-2 py-2">Status</th>
                    <th className="px-2 py-2 text-right">Ödəniş</th>
                  </tr>
                </thead>
                <tbody>
                  {detailRows.map((r) => {
                    const status = SERVIS_STATUS_LABELS[r.status] ?? SERVIS_STATUS_LABELS.qebul_edildi;
                    return (
                      <tr key={r.id} className="border-b border-border/30 hover:bg-secondary/30">
                        <td className="px-2 py-2 align-top">
                          <Link href={`/servis/${r.id}`} className="font-mono text-xs text-primary-light hover:underline">
                            {r.nomre}
                          </Link>
                        </td>
                        <td className="px-2 py-2 align-top text-xs text-muted-foreground">{fmt(r.yaradildi)}</td>
                        <td className="px-2 py-2 align-top">
                          <div className="text-xs font-medium">{r.musteri_ad}</div>
                          <div className="text-[10px] text-muted-foreground">{r.musteri_telefon}</div>
                        </td>
                        <td className="px-2 py-2 align-top">
                          <p className="line-clamp-2 max-w-xs text-xs text-muted-foreground">{r.problem_tesviri}</p>
                        </td>
                        <td className="px-2 py-2 align-top">
                          <Badge variant="outline" className={status.cls}>{status.label}</Badge>
                        </td>
                        <td className="px-2 py-2 align-top text-right tabular-nums text-xs">
                          {r.musteriden_alinan > 0 ? formatMoney(r.musteriden_alinan) : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
