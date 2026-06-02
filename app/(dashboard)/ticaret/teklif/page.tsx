import type { Metadata } from "next";
import Link from "next/link";
import { FileText, CheckCircle2, XCircle, TrendingUp, Clock4 } from "lucide-react";
import { TicaretSubNav } from "@/components/ticaret-subnav";
import { RefreshButton } from "@/components/refresh-button";
import { KpiCard } from "@/features/dashboard/components/kpi-card";
import { TeklifTable } from "@/features/ticaret/components/teklif-table";
import { TeklifExpireButton } from "@/features/ticaret/components/teklif-expire-button";
import {
  getTeklifler,
  getTeklifStats,
  getTeklifStatusCounts,
  type TeklifFilter,
} from "@/features/ticaret/teklif-queries";
import { cn, formatMoney } from "@/lib/utils";

export const metadata: Metadata = { title: "Təkliflər" };

type SearchParams = {
  q?: string;
  status?: string | string[];
  from?: string;
  to?: string;
};

function asArray(v: string | string[] | undefined): string[] {
  if (!v) return [];
  return Array.isArray(v) ? v : [v];
}

const STATUS_PILLS: { key: string; label: string; status: string | null }[] = [
  { key: "hamisi",          label: "Hamısı",          status: null },
  { key: "qaralama",        label: "Qaralama",        status: "qaralama" },
  { key: "gonderildi",      label: "Göndərildi",      status: "gonderildi" },
  { key: "qebul",           label: "Təsdiq",          status: "qebul" },
  { key: "satisa_cevrildi", label: "Satışa çevrildi", status: "satisa_cevrildi" },
  { key: "redd",            label: "Rədd",            status: "redd" },
  { key: "vaxti_bitdi",     label: "Vaxtı bitdi",     status: "vaxti_bitdi" },
];

export default async function TeklifPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { requireTicaretPerm } = await import("@/features/ticaret/access-guard");
  await requireTicaretPerm("teklif.oxu");

  const sp = await searchParams;
  const filter: TeklifFilter = {
    search: sp.q,
    status: asArray(sp.status),
    from: sp.from ? new Date(sp.from) : undefined,
    to: sp.to ? new Date(sp.to + "T23:59:59") : undefined,
  };

  const [stats, counts, list] = await Promise.all([
    getTeklifStats(),
    getTeklifStatusCounts(),
    getTeklifler(filter),
  ]);

  const active = asArray(sp.status)[0] ?? null;

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Təkliflər</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Müştəriyə göndərilmiş təklif sənədləri (proposal). Qəbul edildikdə satışa çevir.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <TeklifExpireButton />
          <RefreshButton />
        </div>
      </div>

      <TicaretSubNav active="/ticaret/teklif" />

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard icon={FileText} label="Aktiv" value={String(stats.aktiv)} subline="cavab gözləyir" tone={stats.aktiv > 0 ? "info" : "neutral"} />
        <KpiCard icon={CheckCircle2} label="Satışa çevrildi" value={String(stats.cevrildi)} subline="tarixdə" tone="success" />
        <KpiCard icon={XCircle} label="Rədd edildi" value={String(stats.redd)} subline="tarixdə" tone={stats.redd > 0 ? "danger" : "neutral"} />
        <KpiCard icon={TrendingUp} label="Konversiya" value={`${stats.konversiya}%`} subline={`Bu ay: ${formatMoney(stats.bu_ay_meb)}`} tone="info" />
      </section>

      <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-border bg-card/40 p-2">
        {STATUS_PILLS.map((p) => {
          const isActive = p.status === active || (!active && p.status === null);
          const params = new URLSearchParams();
          if (sp.q) params.set("q", sp.q);
          if (p.status) params.set("status", p.status);
          const href = `/ticaret/teklif${params.toString() ? "?" + params.toString() : ""}`;
          const count = (counts as unknown as Record<string, number>)[p.key] ?? 0;
          return (
            <Link
              key={p.key}
              href={href}
              className={cn(
                "inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium transition",
                isActive
                  ? "border-primary/40 bg-primary/15 text-primary-light"
                  : "border-border bg-card text-muted-foreground hover:text-foreground"
              )}
            >
              {p.key === "vaxti_bitdi" && <Clock4 className="h-3 w-3" />}
              <span>{p.label}</span>
              <span className="tabular-nums opacity-80">{count}</span>
            </Link>
          );
        })}
      </div>

      <div className="rounded-xl border border-border bg-card/40 p-3">
        <form className="flex flex-wrap items-center gap-2">
          <input
            type="search"
            name="q"
            defaultValue={sp.q ?? ""}
            placeholder="Nömrə və ya müştəri…"
            className="h-9 min-w-[200px] rounded-lg border border-border bg-background px-3 text-sm focus:border-primary focus:outline-none"
          />
          {active && <input type="hidden" name="status" value={active} />}
          <button
            type="submit"
            className="inline-flex h-9 items-center rounded-lg bg-secondary px-3 text-xs font-semibold hover:bg-secondary/80"
          >
            Axtar
          </button>
        </form>
      </div>

      <TeklifTable items={list.items} total={list.total} />
    </div>
  );
}
