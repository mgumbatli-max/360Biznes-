import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { Store, ShoppingBag, RefreshCcw, Wallet, Plus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { KpiCard } from "@/features/dashboard/components/kpi-card";
import { Skeleton } from "@/components/ui/skeleton";
import { ConnectDialog } from "@/features/marketplace/components/connect-dialog";
import { AccountCard } from "@/features/marketplace/components/account-card";
import { MarketplaceSubNav } from "@/components/marketplace-subnav";
import {
  getMarketplaceAccounts,
  getMarketplaceStats,
  getRecentMarketplaceOrders,
} from "@/features/marketplace/queries";
import { formatDate, formatMoney } from "@/lib/utils";

export const metadata: Metadata = { title: "Marketplace" };

const PLATFORM_HINTS: Array<{ platform: string; label: string; tone: string }> = [
  { platform: "bolt", label: "Bolt Food", tone: "bg-success/10 text-success" },
  { platform: "wolt", label: "Wolt", tone: "bg-info/10 text-info" },
  { platform: "yango", label: "Yango Deli", tone: "bg-warning/10 text-warning" },
  { platform: "tap", label: "Tap.az", tone: "bg-danger/10 text-danger" },
  { platform: "progo", label: "ProGo", tone: "bg-primary/10 text-primary-light" },
];

async function StatsSection() {
  const stats = await getMarketplaceStats();
  return (
    <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          icon={Store}
          label="Cəm hesab"
          value={String(stats.total)}
          subline={`${stats.aktiv} aktiv`}
        />
        <KpiCard
          icon={ShoppingBag}
          label="Bu ay sifariş"
          value={String(stats.bu_ay_sifaris)}
          subline="Bütün platformalar"
        />
        <KpiCard
          icon={Wallet}
          label="Bu ay gəlir"
          value={formatMoney(stats.bu_ay_meblegh)}
          subline="Komisyon hesabsız"
          tone="success"
        />
        <KpiCard
          icon={RefreshCcw}
          label="Sync (24s)"
          value={String(stats.syncs_24h)}
          subline="Çağırış"
          tone={stats.syncs_24h > 0 ? "info" : "neutral"}
        />
      </section>
  );
}

function StatsSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-20 rounded-xl" />
      ))}
    </div>
  );
}

async function AccountsSection() {
  const accounts = await getMarketplaceAccounts();
  return (
    <>
      {accounts.length === 0 ? (
        <Card className="glass">
          <CardContent className="flex flex-col items-center justify-center gap-3 py-12 text-center">
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-secondary">
              <Store className="h-6 w-6 text-muted-foreground" />
            </div>
            <div>
              <h3 className="font-semibold">Hələ hesab yoxdur</h3>
              <p className="mt-1 max-w-md text-sm text-muted-foreground">
                Yuxarıda &ldquo;Yeni hesab qoş&rdquo; düyməsi ilə platforma seçin və qoşulun.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
              {PLATFORM_HINTS.map((p) => (
                <Badge key={p.platform} variant="outline" className={`text-[10px] ${p.tone}`}>
                  {p.label}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {accounts.map((a) => (
            <AccountCard key={a.id} a={a} />
          ))}
        </div>
      )}
    </>
  );
}

async function RecentOrdersSection() {
  const recentOrders = await getRecentMarketplaceOrders(8);
  if (recentOrders.length === 0) return null;
  return (
    <>
      {recentOrders.length > 0 && (
        <Card className="glass">
          <CardContent className="p-0">
            <header className="flex items-center justify-between border-b border-border/60 px-4 py-3">
              <h3 className="text-sm font-semibold">Son sifarişlər</h3>
              <Button asChild size="sm" variant="ghost" className="h-7 text-xs">
                <Link href="/ticaret/satislar">
                  Hamısı <Plus className="h-3 w-3 rotate-45" />
                </Link>
              </Button>
            </header>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border/60 text-left text-[10.5px] uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2.5">Platform</th>
                    <th className="px-3 py-2.5">№</th>
                    <th className="px-3 py-2.5">Müştəri</th>
                    <th className="px-3 py-2.5">Məhsul</th>
                    <th className="px-3 py-2.5 text-right">Məbləğ</th>
                    <th className="px-3 py-2.5">Status</th>
                    <th className="px-3 py-2.5">Tarix</th>
                  </tr>
                </thead>
                <tbody>
                  {recentOrders.map((o) => (
                    <tr key={o.id} className="border-b border-border/30 hover:bg-secondary/40">
                      <td className="px-3 py-2 text-xs">
                        <span className="capitalize">{o.marketplace_magaza_hesablari?.platform ?? "—"}</span>
                      </td>
                      <td className="px-3 py-2 font-mono text-[10.5px] text-muted-foreground">{o.xarici_nomre}</td>
                      <td className="px-3 py-2 text-xs">{o.musteri_ad ?? "—"}</td>
                      <td className="px-3 py-2 text-xs">
                        <span className="line-clamp-1">{o.mehsul_ad ?? "—"}</span>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatMoney(Number(o.meblegh ?? 0))}</td>
                      <td className="px-3 py-2">
                        <Badge variant="outline" className="text-[10px]">{o.status}</Badge>
                      </td>
                      <td className="px-3 py-2 text-[10.5px] text-muted-foreground">
                        {formatDate(o.yaradildi, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
}

export default function MarketplacePage() {
  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <MarketplaceSubNav active="/marketplace" />

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Marketplace mərkəzi</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Bolt, Wolt, Yango, Tap, ProGo və digər platformaların inteqrasiyası.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild size="sm" variant="outline">
            <Link href="/ticaret/satislar">
              <ShoppingBag className="h-4 w-4" /> Yeni satış
            </Link>
          </Button>
          <ConnectDialog />
        </div>
      </header>

      <Suspense fallback={<StatsSkeleton />}>
        <StatsSection />
      </Suspense>

      <Suspense fallback={<Skeleton className="h-32 rounded-xl" />}>
        <AccountsSection />
      </Suspense>

      <Suspense fallback={null}>
        <RecentOrdersSection />
      </Suspense>
    </div>
  );
}
