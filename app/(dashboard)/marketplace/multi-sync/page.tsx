import type { Metadata } from "next";
import Link from "next/link";
import {
  RefreshCw,
  Store,
  ShoppingBag,
  Wallet,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ArrowRight,
  Package,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MarketplaceSubNav } from "@/components/marketplace-subnav";
import { KpiCard } from "@/features/dashboard/components/kpi-card";
import { EmptyState } from "@/components/ui/empty-state";
import { SyncAllButton } from "@/features/marketplace/components/sync-all-button";
import {
  getMultiSyncStats,
  getUnifiedOrders,
  getSyncCandidates,
} from "@/features/marketplace/multisync-queries";
import { getMarketplaceAccounts } from "@/features/marketplace/queries";
import { formatDate, formatMoney } from "@/lib/utils";

export const metadata: Metadata = { title: "Marketplace Multi-Sync" };

type SP = { platform?: string; status?: string; q?: string };

const PLATFORM_BADGE: Record<string, string> = {
  trendyol:   "bg-orange-500/10 text-orange-600",
  wildberries:"bg-violet-500/10 text-violet-600",
  wolt:       "bg-sky-500/10 text-sky-600",
  bolt:       "bg-emerald-500/10 text-emerald-600",
  yango:      "bg-amber-500/10 text-amber-600",
  tap:        "bg-rose-500/10 text-rose-600",
  umico:      "bg-cyan-500/10 text-cyan-600",
  birmarket:  "bg-indigo-500/10 text-indigo-600",
  lalafo:     "bg-pink-500/10 text-pink-600",
  progo:      "bg-fuchsia-500/10 text-fuchsia-600",
};

const STATUS_BADGE: Record<string, string> = {
  yeni:           "border-sky-500/30 bg-sky-500/10 text-sky-600",
  qebul_edildi:   "border-emerald-500/30 bg-emerald-500/10 text-emerald-600",
  hazirlanır:     "border-amber-500/30 bg-amber-500/10 text-amber-600",
  catdirilir:     "border-violet-500/30 bg-violet-500/10 text-violet-600",
  tamamlandi:     "border-emerald-500/30 bg-emerald-500/10 text-emerald-600",
  legv:           "border-rose-500/30 bg-rose-500/10 text-rose-600",
};

export default async function MultiSyncPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const [stats, orders, candidates, accounts] = await Promise.all([
    getMultiSyncStats(),
    getUnifiedOrders({
      platform: sp.platform || undefined,
      status: sp.status || undefined,
      search: sp.q || undefined,
      limit: 100,
    }),
    getSyncCandidates(),
    getMarketplaceAccounts(),
  ]);

  // Platform üzrə filter pill-ləri
  const platforms = Array.from(new Set(accounts.map((a) => a.platform)));
  // Server-side render — hər request-də bir dəfə hesablanır. "freshness" üçün 24 saat threshold.
  // eslint-disable-next-line react-hooks/purity
  const freshnessThreshold = Date.now() - 24 * 3600_000;

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <MarketplaceSubNav active="/marketplace/multi-sync" />

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-gradient-to-br from-emerald-500 to-cyan-500 shadow-lg shadow-emerald-500/30">
            <RefreshCw className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Marketplace Multi-Sync</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Trendyol, Wildberries, Wolt, Bolt, Yango, Tap.az — hamısı tək cədvəldə. Stok dəyişəndə bir kliklə hamısı yenilənir.
            </p>
          </div>
        </div>
        <SyncAllButton />
      </header>

      {/* KPI */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          icon={Store}
          label="Qoşulu hesab"
          value={String(stats.hesab_total)}
          subline={`${stats.hesab_aktiv} aktiv`}
        />
        <KpiCard
          icon={ShoppingBag}
          label="Bu ay sifariş"
          value={String(stats.cem_sifaris_ay)}
          subline={`24s: ${stats.cem_sifaris_24s} sifariş`}
          tone={stats.cem_sifaris_24s > 0 ? "info" : "neutral"}
        />
        <KpiCard
          icon={Wallet}
          label="Bu ay gəlir"
          value={formatMoney(stats.cem_meblegh_ay)}
          subline="Bütün platformalar"
          tone="success"
        />
        <KpiCard
          icon={AlertTriangle}
          label="24+ saat sync yox"
          value={String(stats.syncsiz_hesab)}
          subline={`${stats.sync_24s} sync (24s)`}
          tone={stats.syncsiz_hesab > 0 ? "warning" : "success"}
        />
      </section>

      {/* Aktiv hesablar — qrid */}
      {accounts.length === 0 ? (
        <EmptyState
          icon={Store}
          tone="primary"
          title="Hələ marketplace hesab yoxdur"
          description="Trendyol, Wildberries, Wolt, Bolt və digər platformaları qoş — hamısını bir yerdən idarə et."
          help="Hər platforma üçün API token + Store ID lazımdır. Marketplace ana səhifəsindən «Yeni hesab qoş» düyməsi ilə əlavə edin."
          actions={[
            { label: "Yeni hesab qoş", tone: "primary", href: "/marketplace", icon: Store },
          ]}
        />
      ) : (
        <Card className="glass">
          <CardContent className="p-0">
            <header className="flex items-center justify-between border-b border-border/60 px-4 py-2">
              <h3 className="text-sm font-bold">Aktiv platformalar ({accounts.length})</h3>
              <Link href="/marketplace" className="text-xs text-primary hover:underline">
                Hesabı idarə et →
              </Link>
            </header>
            <div className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-3 lg:grid-cols-4">
              {accounts.map((a) => {
                const fresh = a.son_sync && new Date(a.son_sync).getTime() > freshnessThreshold;
                return (
                  <div
                    key={a.id}
                    className={`rounded-lg border p-2.5 ${a.aktiv ? "border-border bg-card" : "border-border bg-card opacity-50"}`}
                  >
                    <div className="flex items-center justify-between">
                      <Badge className={`text-[10px] capitalize ${PLATFORM_BADGE[a.platform] ?? "bg-secondary text-muted-foreground"}`}>
                        {a.platform}
                      </Badge>
                      {a.aktiv && fresh ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                      ) : a.aktiv ? (
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                      ) : (
                        <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
                    </div>
                    <div className="mt-1 truncate text-xs font-semibold" title={a.ad}>
                      {a.ad}
                    </div>
                    <div className="text-[10.5px] text-muted-foreground">
                      {a.son_sync
                        ? `Son sync: ${formatDate(a.son_sync, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}`
                        : "Hələ sync olunmayıb"}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sync candidate-lər — son 24 saatda dəyişən məhsullar */}
      {candidates.length > 0 && (
        <Card className="glass border-amber-500/20">
          <CardContent className="p-0">
            <header className="flex items-center justify-between border-b border-amber-500/20 bg-amber-500/5 px-4 py-2">
              <div>
                <h3 className="flex items-center gap-1.5 text-sm font-bold">
                  <RefreshCw className="h-3.5 w-3.5 text-amber-600" />
                  Sync gözləyən məhsullar ({candidates.length})
                </h3>
                <p className="text-[10.5px] text-muted-foreground">
                  Son 24 saatda stok və ya qiymət dəyişən məhsullar — platformalara sync olmalıdır
                </p>
              </div>
              <SyncAllButton />
            </header>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border/40 text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">Məhsul</th>
                    <th className="px-3 py-2 text-right">Stok</th>
                    <th className="px-3 py-2 text-right">Qiymət</th>
                    <th className="px-3 py-2">Son dəyişiklik</th>
                  </tr>
                </thead>
                <tbody>
                  {candidates.slice(0, 10).map((c) => (
                    <tr key={c.mehsul_id} className="border-b border-border/20 hover:bg-secondary/30">
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          {c.sekil_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img loading="lazy" decoding="async" src={c.sekil_url} alt={c.ad} className="h-8 w-8 rounded object-cover" />
                          ) : (
                            <div className="grid h-8 w-8 place-items-center rounded bg-secondary text-muted-foreground/50">
                              <Package className="h-4 w-4" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="truncate text-xs font-semibold">{c.ad}</div>
                            {c.kod && <div className="text-[10px] font-mono text-muted-foreground">{c.kod}</div>}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums font-semibold">{c.cem_stok}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatMoney(c.satis_qiymeti)}</td>
                      <td className="px-3 py-2 text-[10.5px] text-muted-foreground">
                        {c.son_yenileme ? formatDate(c.son_yenileme, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {candidates.length > 10 && (
                <div className="border-t border-border/40 px-3 py-2 text-center text-[10.5px] text-muted-foreground">
                  Daha {candidates.length - 10} məhsul var
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Unified orders */}
      <Card className="glass">
        <CardContent className="p-0">
          <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 px-4 py-2">
            <h3 className="flex items-center gap-1.5 text-sm font-bold">
              <ShoppingBag className="h-3.5 w-3.5 text-primary" />
              Bütün platformaların sifarişləri ({orders.length})
            </h3>
            <div className="flex flex-wrap items-center gap-1">
              <Link
                href="/marketplace/multi-sync"
                className={`rounded-md px-2 py-1 text-[10.5px] font-semibold ${
                  !sp.platform ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-secondary"
                }`}
              >
                Hamısı
              </Link>
              {platforms.map((p) => (
                <Link
                  key={p}
                  href={`?platform=${p}`}
                  className={`rounded-md px-2 py-1 text-[10.5px] font-semibold capitalize ${
                    sp.platform === p ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-secondary"
                  }`}
                >
                  {p}
                </Link>
              ))}
            </div>
          </header>
          {orders.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              Filtrə uyğun sifariş yoxdur
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border/40 text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">Platforma</th>
                    <th className="px-3 py-2">№</th>
                    <th className="px-3 py-2">Müştəri</th>
                    <th className="px-3 py-2">Məhsul</th>
                    <th className="px-3 py-2 text-right">Say</th>
                    <th className="px-3 py-2 text-right">Məbləğ</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Tarix</th>
                    <th className="px-3 py-2 w-10" />
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => (
                    <tr key={o.id} className="border-b border-border/20 hover:bg-secondary/30">
                      <td className="px-3 py-2">
                        <Badge className={`text-[10px] capitalize ${PLATFORM_BADGE[o.platform] ?? "bg-secondary text-muted-foreground"}`}>
                          {o.platform}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 font-mono text-[10.5px] text-muted-foreground">{o.xarici_nomre}</td>
                      <td className="px-3 py-2 text-xs">
                        <div className="font-medium">{o.musteri_ad ?? "—"}</div>
                        {o.musteri_telefon && (
                          <div className="text-[10px] text-muted-foreground">{o.musteri_telefon}</div>
                        )}
                      </td>
                      <td className="px-3 py-2 text-xs">
                        <span className="line-clamp-1" title={o.mehsul_ad ?? ""}>{o.mehsul_ad ?? "—"}</span>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-xs">{o.sayi}</td>
                      <td className="px-3 py-2 text-right tabular-nums font-semibold">{formatMoney(o.meblegh)}</td>
                      <td className="px-3 py-2">
                        <Badge variant="outline" className={`text-[10px] ${STATUS_BADGE[o.status] ?? ""}`}>{o.status}</Badge>
                      </td>
                      <td className="px-3 py-2 text-[10.5px] text-muted-foreground whitespace-nowrap">
                        {formatDate(o.yaradildi, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </td>
                      <td className="px-3 py-2">
                        {o.erp_satis_id && (
                          <Link
                            href={`/ticaret/satislar/${o.erp_satis_id}`}
                            className="inline-flex h-6 w-6 items-center justify-center rounded text-primary hover:bg-primary/10"
                            title="ERP-də gör"
                          >
                            <ArrowRight className="h-3 w-3" />
                          </Link>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Footer hint */}
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs">
        <strong className="text-primary">💡 Necə işləyir?</strong>{" "}
        <span className="text-muted-foreground">
          Stok dəyişəndə (satış, alış, sayım) sistemdə yenilənir, sonra «Hamısını Sync» düyməsi ilə bütün platformalara
          eyni anda göndərilir. Sifarişlər istənilən platformadan gəldikdə avtomatik bu cədvələ düşür və ERP-yə çevirilə bilər.
        </span>
      </div>
    </div>
  );
}
