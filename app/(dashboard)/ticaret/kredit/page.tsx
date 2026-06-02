import type { Metadata } from "next";
import Link from "next/link";
import { CreditCard, AlertTriangle, TrendingUp, Wallet, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TicaretSubNav } from "@/components/ticaret-subnav";
import { RefreshButton } from "@/components/refresh-button";
import { KpiCard } from "@/features/dashboard/components/kpi-card";
import { KreditTable } from "@/features/ticaret/components/kredit-table";
import {
  getKreditSales,
  getKreditStats,
  getMusteriBorc,
} from "@/features/ticaret/kredit-queries";
import { getQuickRefs } from "@/features/maliyye/queries";
import { formatMoney, formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Kreditlə satışlar" };

type SearchParams = {
  q?: string;
  from?: string;
  to?: string;
};

export default async function KreditPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { requireTicaretPerm } = await import("@/features/ticaret/access-guard");
  await requireTicaretPerm("kredit.oxu");

  const sp = await searchParams;
  const [stats, items, musteriBorc, refs] = await Promise.all([
    getKreditStats(),
    getKreditSales({
      search: sp.q,
      from: sp.from ? new Date(sp.from) : undefined,
      to: sp.to ? new Date(sp.to + "T23:59:59") : undefined,
    }),
    getMusteriBorc(10),
    getQuickRefs(),
  ]);

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Kreditlə satışlar</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Borc (nisyə) götürülən satışların izi və ödəniş qəbulu.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild size="sm" className="font-semibold text-white" style={{ background: "var(--brand-gradient)" }}>
            <Link href="/ticaret/kredit-yeni">
              <Plus className="h-4 w-4" /> Yeni kredit
            </Link>
          </Button>
          <RefreshButton />
        </div>
      </div>

      <TicaretSubNav active="/ticaret/kredit" />

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard icon={CreditCard} label="Aktiv kredit" value={String(stats.aktiv)} subline="kredit satışı" tone={stats.aktiv > 0 ? "info" : "neutral"} />
        <KpiCard icon={Wallet} label="Toplam borc" value={formatMoney(stats.toplam_borc)} subline="müştəri borcu" tone={stats.toplam_borc > 0 ? "warning" : "neutral"} />
        <KpiCard icon={AlertTriangle} label="Gecikmiş" value={String(stats.gecikmis)} subline={formatMoney(stats.gecikmis_borc)} tone={stats.gecikmis > 0 ? "danger" : "neutral"} />
        <KpiCard icon={TrendingUp} label="Bu ay yeni" value={String(stats.bu_ay_yeni)} subline={formatMoney(stats.bu_ay_yeni_mebleg)} tone="info" />
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="rounded-xl border border-border bg-card/40 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <form>
                <input
                  type="search"
                  name="q"
                  defaultValue={sp.q ?? ""}
                  placeholder="Müştəri, nömrə, telefon…"
                  className="h-9 min-w-[220px] rounded-lg border border-border bg-background px-3 text-sm focus:border-primary focus:outline-none"
                />
              </form>
              <span className="text-xs text-muted-foreground">
                <strong>Ödəniş</strong> düyməsi ilə qalıq borcu azaltmaq olur.
              </span>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-3">
          <h4 className="mb-2 text-sm font-semibold tracking-tight">Müştəri başına borc (top 10)</h4>
          <ul className="space-y-0">
            {musteriBorc.length === 0 && (
              <li className="py-2 text-xs text-muted-foreground">Borc qalmayıb.</li>
            )}
            {musteriBorc.map((m) => (
              <li key={m.musteri_id} className="flex items-center justify-between gap-2 border-b border-border/40 py-2 text-sm last:border-0">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{m.musteri_ad}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {m.satislar_sayi} satış · son: {formatDate(m.son_satis_tarix)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-semibold tabular-nums text-warning">{formatMoney(m.borc)}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <KreditTable items={items} total={items.length} hesablar={refs.hesablar} />
    </div>
  );
}
