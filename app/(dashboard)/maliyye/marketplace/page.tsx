import type { Metadata } from "next";
import { ShoppingCart, Clock, CheckCircle2, AlertCircle, Store } from "lucide-react";
import { KpiCard } from "@/features/dashboard/components/kpi-card";
import { MaliyyeSubNav } from "@/components/maliyye-subnav";
import { MarketplaceTable } from "@/features/maliyye/components/marketplace-table";
import { MarketplaceReconcileDialog } from "@/features/maliyye/components/marketplace-reconcile-dialog";
import {
  getMarketplacePayments,
  getMarketplaceStats,
  getMarketplacePlatformCards,
} from "@/features/maliyye/marketplace-queries";
import { formatMoney, formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Marketplace ödənişləri" };
export const dynamic = "force-dynamic";

type SearchParams = { platforma?: string; status?: string; from?: string; to?: string };

const PLATFORM_LABELS: Record<string, string> = {
  bolt: "Bolt", wolt: "Wolt", yango: "Yango", tap_az: "Tap.az",
  progo: "ProGo", umico: "Umico", trendyol: "Trendyol", amazon: "Amazon",
};

export default async function MarketplacePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const [items, stats, platformCards] = await Promise.all([
    getMarketplacePayments({
      platforma: sp.platforma,
      status: sp.status,
      from: sp.from ? new Date(sp.from) : undefined,
      to: sp.to ? new Date(sp.to) : undefined,
    }),
    getMarketplaceStats(),
    getMarketplacePlatformCards(),
  ]);

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Marketplace ödənişləri</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Bolt, Wolt, Yango, Tap.az və digər platformalardan gözlənən və ödənilmiş hesabatlar.
          </p>
        </div>
        <MarketplaceReconcileDialog />
      </header>

      <MaliyyeSubNav active="/maliyye/marketplace" />

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard icon={ShoppingCart} label="Cəm qeyd" value={String(items.length)} subline="Bütün dövrlər" />
        <KpiCard icon={Clock} label="Gözləyən" value={String(stats.gozleyir_say)} subline={formatMoney(stats.gozleyir_mebleg)} tone="warning" />
        <KpiCard icon={CheckCircle2} label="Ödənilmiş" value={String(stats.odenildi_say)} subline={formatMoney(stats.odenildi_mebleg)} tone="success" />
        <KpiCard icon={AlertCircle} label="Cəm gözlənən AZN" value={formatMoney(stats.gozleyir_mebleg)} />
      </section>

      {/* Per-platforma kartları */}
      {platformCards.length > 0 && (
        <section
          data-section="platform-cards"
          className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5"
        >
          {platformCards.map((p) => (
            <div
              key={p.platforma}
              data-platform-card={p.platforma}
              className="rounded-xl border border-border bg-card/40 p-3 transition hover:border-primary/40 hover:shadow-sm"
            >
              <div className="flex items-center gap-2">
                <div className="grid h-8 w-8 place-items-center rounded-lg bg-secondary/60">
                  <Store className="h-4 w-4 text-primary-light" />
                </div>
                <div className="flex-1">
                  <div className="text-xs font-semibold capitalize">{PLATFORM_LABELS[p.platforma] ?? p.platforma}</div>
                  <div className="text-[10px] text-muted-foreground">Bu ay</div>
                </div>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-x-2 gap-y-1 text-[11px]">
                <div className="text-muted-foreground">Sifariş</div>
                <div className="text-right tabular-nums font-semibold">{p.sifaris_say}</div>
                <div className="text-muted-foreground">Brüt</div>
                <div className="text-right tabular-nums">{formatMoney(p.brut)}</div>
                <div className="text-muted-foreground">Komissiya</div>
                <div className="text-right tabular-nums text-warning">{formatMoney(p.komissiya)}</div>
                <div className="text-muted-foreground">Net</div>
                <div className="text-right tabular-nums font-bold text-success">{formatMoney(p.net)}</div>
              </div>
              {p.son_donem && (
                <div className="mt-1.5 text-[10px] text-muted-foreground">Son sifariş: {formatDate(p.son_donem)}</div>
              )}
            </div>
          ))}
        </section>
      )}

      <form className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card/30 p-3">
        <select name="platforma" defaultValue={sp.platforma ?? ""} className="h-9 rounded-md border border-input bg-background px-2 text-sm">
          <option value="">Bütün platformalar</option>
          <option value="bolt">Bolt</option>
          <option value="wolt">Wolt</option>
          <option value="yango">Yango</option>
          <option value="tap_az">Tap.az</option>
          <option value="progo">ProGo</option>
          <option value="umico">Umico</option>
          <option value="trendyol">Trendyol</option>
          <option value="amazon">Amazon</option>
          <option value="diger">Digər</option>
        </select>
        <select name="status" defaultValue={sp.status ?? ""} className="h-9 rounded-md border border-input bg-background px-2 text-sm">
          <option value="">Bütün status</option>
          <option value="gozleyir">Gözləyir</option>
          <option value="odenildi">Ödənildi</option>
          <option value="legv">Ləğv</option>
        </select>
        <input type="date" name="from" defaultValue={sp.from ?? ""} className="h-9 rounded-md border border-input bg-background px-2 text-sm" />
        <input type="date" name="to" defaultValue={sp.to ?? ""} className="h-9 rounded-md border border-input bg-background px-2 text-sm" />
        <button type="submit" className="h-9 rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground">Filtrlə</button>
      </form>

      <MarketplaceTable items={items} />
    </div>
  );
}
