import type { Metadata } from "next";
import Link from "next/link";
import {
  Building2,
  TrendingUp,
  AlertTriangle,
  Users,
  ArrowRight,
  Sparkles,
  CalendarClock,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { KpiCard } from "@/features/dashboard/components/kpi-card";
import { requirePlatformAdmin } from "@/lib/platform-admin/guard";
import { getPlatformKpis, getExpiringTrials, getRevenueByPlan } from "@/features/platform-admin/queries";
import { formatMoney, formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Platform Admin" };

export default async function PlatformAdminPage() {
  await requirePlatformAdmin();
  const [kpis, expiring, byPlan] = await Promise.all([
    getPlatformKpis(),
    getExpiringTrials(7),
    getRevenueByPlan(),
  ]);

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <header className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Platform Admin</h1>
          <p className="mt-1 text-sm text-muted-foreground">SaaS metrikləri, tenant idarəsi, gəlir analitika.</p>
        </div>
        <Link
          href="/platform-admin/tenantlar"
          className="inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-semibold text-white"
          style={{ background: "var(--brand-gradient)" }}
        >
          Bütün tenantlar <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </header>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard icon={Building2} label="Cəm tenant" value={String(kpis.total_tenants)} subline={`${kpis.active_tenants} aktiv`} />
        <KpiCard icon={Sparkles} label="Demo (sınaq)" value={String(kpis.trial_tenants)} subline="Aktiv triallar" />
        <KpiCard icon={TrendingUp} label="MRR" value={formatMoney(kpis.mrr)} subline={`ARR ${formatMoney(kpis.arr)}`} tone="success" />
        <KpiCard icon={Users} label="İstifadəçi" value={String(kpis.total_users)} subline="Bütün tenantlarda" />
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="glass">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-warning" />
              Demolar bitir (7 gün)
            </CardTitle>
            <Badge variant={expiring.length > 0 ? "secondary" : "outline"}>{expiring.length}</Badge>
          </CardHeader>
          <CardContent className="space-y-2">
            {expiring.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Yaxın 7 günə bitən demo yoxdur</p>
            ) : (
              expiring.slice(0, 8).map((t) => (
                <Link
                  key={t.sahibkar_id}
                  href={`/platform-admin/tenantlar/${t.sahibkar_id}`}
                  className="flex items-center justify-between rounded-md border border-border/40 bg-secondary/30 px-3 py-2 text-sm transition hover:border-border"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{t.sahibkar_ad}</div>
                    <div className="text-xs text-muted-foreground">{t.email}</div>
                  </div>
                  <Badge variant={t.days_left <= 2 ? "destructive" : "secondary"}>
                    {t.days_left === 0 ? "Bu gün" : `${t.days_left} gün`}
                  </Badge>
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="glass">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Plan üzrə gəlir</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {byPlan.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Aktiv ödənişli abunə yoxdur</p>
            ) : (
              byPlan.map((p) => (
                <div key={p.kod} className="flex items-center justify-between rounded-md border border-border/40 bg-secondary/30 px-3 py-2">
                  <div>
                    <div className="text-sm font-medium">{p.ad}</div>
                    <div className="text-xs text-muted-foreground">{p.count} müştəri</div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold tabular-nums">{formatMoney(p.mrr)}</div>
                    <div className="text-[10.5px] text-muted-foreground">aylıq</div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </section>

      {kpis.expired > 0 && (
        <div className="rounded-xl border border-danger/30 bg-danger/10 p-3 text-sm">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-danger" />
            <span><strong>{kpis.expired}</strong> abunə vaxtı bitib və ödəniş yenilənməyib.</span>
          </div>
        </div>
      )}

      <section className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <Link href="/platform-admin/tenantlar">
          <Card className="glass transition hover:border-primary/30">
            <CardContent className="py-4">
              <div className="text-sm font-semibold">Tenantlar</div>
              <div className="text-xs text-muted-foreground">Sahibkar şirkətlər siyahısı</div>
            </CardContent>
          </Card>
        </Link>
        <Link href="/platform-admin/istifadeciler">
          <Card className="glass transition hover:border-primary/30">
            <CardContent className="py-4">
              <div className="text-sm font-semibold">İstifadəçilər</div>
              <div className="text-xs text-muted-foreground">Bütün şirkətlərin istifadəçiləri · şifrə yenilə</div>
            </CardContent>
          </Card>
        </Link>
        <Link href="/platform-admin/giris-cehdleri">
          <Card className="glass transition hover:border-primary/30">
            <CardContent className="py-4">
              <div className="text-sm font-semibold">Giriş cəhdləri</div>
              <div className="text-xs text-muted-foreground">Login log · uğurlu/uğursuz · IP</div>
            </CardContent>
          </Card>
        </Link>
        <Link href="/platform-admin/ip-bloklari">
          <Card className="glass transition hover:border-primary/30">
            <CardContent className="py-4">
              <div className="text-sm font-semibold">IP bloklama</div>
              <div className="text-xs text-muted-foreground">Şübhəli IP-ləri login-dən blokla</div>
            </CardContent>
          </Card>
        </Link>
        <Link href="/platform-admin/paketler">
          <Card className="glass transition hover:border-primary/30">
            <CardContent className="py-4">
              <div className="text-sm font-semibold">Paketlər</div>
              <div className="text-xs text-muted-foreground">Abunəlik planları və limitlər</div>
            </CardContent>
          </Card>
        </Link>
        <Link href="/platform-admin/modullar">
          <Card className="glass transition hover:border-primary/30">
            <CardContent className="py-4">
              <div className="text-sm font-semibold">Modul kataloqu</div>
              <div className="text-xs text-muted-foreground">Modul qiymətləri · plan paketləri</div>
            </CardContent>
          </Card>
        </Link>
        <Link href="/platform-admin/audit">
          <Card className="glass transition hover:border-primary/30">
            <CardContent className="py-4">
              <div className="text-sm font-semibold">Audit</div>
              <div className="text-xs text-muted-foreground">Cross-tenant audit log</div>
            </CardContent>
          </Card>
        </Link>
        <Link href="/platform-admin/sistem-saglamligi">
          <Card className="glass transition hover:border-primary/30">
            <CardContent className="py-4">
              <div className="text-sm font-semibold">Sistem sağlamlığı</div>
              <div className="text-xs text-muted-foreground">DB latency, errors, uptime</div>
            </CardContent>
          </Card>
        </Link>
      </section>
    </div>
  );
}
