import type { Metadata } from "next";
import Link from "next/link";
import {
  Lock, TrendingUp, Boxes, Users, Building2, ArrowRight, ShieldOff, Wallet, ClipboardList,
  StickyNote, Camera, Truck, FileText, Activity, GitCompare, Smartphone, History,
  Sparkles, AlertTriangle, Calendar, Pin, FolderArchive, EyeOff, Database,
} from "lucide-react";
import { Settings } from "lucide-react";
import { auth } from "@/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { KpiCard } from "@/features/dashboard/components/kpi-card";
import { requireSahibkarSession } from "@/lib/sahibkar/guard";
import { lockSahibkar } from "@/features/sahibkar/actions";
import { SessionCountdown } from "@/features/sahibkar/components/session-countdown";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { getOwnerDashboard } from "@/features/sahibkar/queries";
import { RiskFirsetlerWidget } from "@/features/sahibkar/components/risk-firsetler-widget";
import { CashRunwayWidget } from "@/features/sahibkar/components/cash-runway-widget";
import { TodayPulseWidget } from "@/features/sahibkar/components/today-pulse-widget";
import {
  getOwnerHubSnapshot,
  getOwnerNotes,
  getOwnerTasks,
  getOwnerHubCounts,
  getOwnerCriticalInsights,
  getOwnerHesabatSummary,
} from "@/features/sahibkar/owner-queries";
import { formatMoney, formatNumber } from "@/lib/utils";
import { ErrorSilentWrapper } from "@/components/error-silent-wrapper";

export const metadata: Metadata = { title: "Sahibkar bölməsi" };
export const dynamic = "force-dynamic";

export default async function SahibkarHomePage() {
  await requireSahibkarSession();
  const session = await auth();
  const [stats, _hub, notes, tasks, counts, insights, hesabat, cfg] = await Promise.all([
    getOwnerDashboard(),
    getOwnerHubSnapshot(),
    getOwnerNotes(5),
    getOwnerTasks(5),
    getOwnerHubCounts(),
    getOwnerCriticalInsights(3),
    getOwnerHesabatSummary(),
    withTenant(() => prisma.sahibkar_ayar.findFirst({ select: { sessiya_muddet: true, sidebar_gorunsun: true } })).catch(() => null),
  ]);
  // Qoruma: əgər DB-də 0 və ya çox kiçik dəyər varsa, minimum 5 dəq tətbiq olunur.
  // Yoxsa SessionCountdown 0-da dərhal kilidləyir (2-3 saniyəyə atır).
  const rawSessionMin = cfg?.sessiya_muddet ?? 15;
  const sessionMin = rawSessionMin < 5 ? 15 : rawSessionMin;
  const sidebarHidden = cfg?.sidebar_gorunsun === false;

  // Real metrik: ilk gələn açıq tapşırığın deadline-ı — yaxın iclas əvəzinə
  const upcomingTask = tasks.find((t) => t.status !== "tamamlandi" && t.status !== "legv");

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-xl" style={{ background: "var(--brand-gradient)" }}>
            <Lock className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">Sahibkar bölməsi</h1>
              <Badge variant="outline" className="text-[10px]">PIN ilə qorunan</Badge>
              {sidebarHidden && (
                <Badge variant="outline" className="border-rose-500/30 bg-rose-500/10 text-[10px] text-rose-500">Gizli rejim</Badge>
              )}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Salam, {session?.user.ad_soyad}. Sessiya {sessionMin} dəqiqə aktiv qalır.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SessionCountdown totalSec={sessionMin * 60} />
          <Link href="/sahibkar/ayarlar">
            <Button variant="outline" size="sm">
              <Settings className="h-3.5 w-3.5" /> Ayarlar
            </Button>
          </Link>
          <form
            action={async () => {
              "use server";
              await lockSahibkar();
            }}
          >
            <Button type="submit" variant="outline" size="sm">
              <ShieldOff className="h-3.5 w-3.5" /> Kilidlə
            </Button>
          </form>
        </div>
      </header>

      {/* 1. Bu günün nəbzi — sahibkar ən vacib şeyi dərhal görür */}
      <ErrorSilentWrapper name="today-pulse">
        <TodayPulseWidget />
      </ErrorSilentWrapper>

      {/* 2. Cash Runway + Risk və Fürsətlər — yanaşı, kompakt */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <ErrorSilentWrapper name="cash-runway">
          <CashRunwayWidget />
        </ErrorSilentWrapper>
        <ErrorSilentWrapper name="risk-firsetler">
          <RiskFirsetlerWidget />
        </ErrorSilentWrapper>
      </div>

      {/* 3. Stratejik KPI strip — aylıq/illik baxış */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard icon={TrendingUp} label="Bu ay satış" value={formatMoney(stats.revenue_this_month)}
          subline={`İl: ${formatMoney(hesabat.year.revenue)}`} tone="success" />
        <KpiCard icon={Boxes} label="Stok dəyəri" value={formatMoney(stats.stock_value)} subline="Alış qiyməti ilə" />
        <KpiCard icon={Users} label="Aktiv işçi" value={formatNumber(stats.isci_count)}
          subline={`Aylıq ${formatMoney(stats.total_salary)}`} />
        <KpiCard icon={Building2} label="Filial" value={formatNumber(stats.branch_count)} subline="Aktiv" />
      </section>

      {/* 4. Critical insights — AI, alerts, calendar */}
      <section className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Card className="glass relative overflow-hidden border-indigo-500/30">
          <div className="absolute inset-x-0 top-0 h-1" style={{ background: "var(--brand-gradient)" }} />
          <CardContent className="space-y-2 py-4">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5 text-indigo-400" /> AI Köməkçi
            </div>
            <div className="text-sm font-medium">Diqqətli olun — bu ayın gəliri keçən aya nəzərən {hesabat.yoy_growth_pct.toFixed(1)}% dəyişib.</div>
            <Link href="/ai" className="inline-flex items-center gap-1 text-xs text-primary-light hover:underline">
              Tam analizə bax <ArrowRight className="h-3 w-3" />
            </Link>
          </CardContent>
        </Card>

        <Card className="glass border-rose-500/30">
          <CardContent className="space-y-2 py-4">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <AlertTriangle className="h-3.5 w-3.5 text-rose-500" /> Diqqət lazımdır
            </div>
            {insights.length === 0 ? (
              <div className="text-xs text-muted-foreground">Kritik xəbərdarlıq yoxdur.</div>
            ) : (
              <ul className="space-y-1">
                {insights.map((i) => (
                  <li key={i.id} className="flex items-start gap-2 text-xs">
                    <span>{i.kateqoriya_emoji ?? "•"}</span>
                    <Link href={`/xeberdarliqlar/${i.id}`} className="line-clamp-1 hover:underline">
                      {i.basliq}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="glass border-amber-500/30">
          <CardContent className="space-y-2 py-4">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <Calendar className="h-3.5 w-3.5 text-amber-400" /> Növbəti tapşırıq
            </div>
            {upcomingTask ? (
              <>
                <Link href={`/sahibkar/tapshiriq`} className="text-sm font-medium line-clamp-1 hover:text-primary">
                  {upcomingTask.basliq}
                </Link>
                <div className="text-xs text-muted-foreground">
                  Status: <Badge variant="outline" className="text-[10px]">{upcomingTask.status ?? "acig"}</Badge>
                </div>
              </>
            ) : (
              <>
                <div className="text-sm font-medium text-muted-foreground">Açıq tapşırıq yoxdur</div>
                <Link href="/sahibkar/tapshiriq" className="text-xs text-primary-light">
                  Yeni tapşırıq yarat <ArrowRight className="inline h-3 w-3" />
                </Link>
              </>
            )}
          </CardContent>
        </Card>
      </section>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card className="glass">
          <CardContent className="space-y-3 py-4">
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-1.5 text-sm font-semibold">
                <Pin className="h-3.5 w-3.5" /> Mənim qeydlərim
              </h3>
              <Link href="/sahibkar/not" className="text-xs text-primary-light">
                Hamısı <ArrowRight className="inline h-3 w-3" />
              </Link>
            </div>
            {notes.length === 0 ? (
              <p className="text-xs text-muted-foreground">Hələ qeyd yoxdur.</p>
            ) : (
              <ul className="space-y-1.5">
                {notes.map((n) => (
                  <li key={n.id} className="rounded-md border border-border/40 px-2 py-1.5 text-xs">
                    <div className="font-medium">{n.basliq ?? "Başlıqsız"}</div>
                    {n.metn ? <div className="line-clamp-1 text-muted-foreground">{n.metn}</div> : null}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="glass">
          <CardContent className="space-y-3 py-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Açıq tapşırıqlar</h3>
              <Link href="/sahibkar/tapshiriq" className="text-xs text-primary-light">
                Hamısı <ArrowRight className="inline h-3 w-3" />
              </Link>
            </div>
            {tasks.length === 0 ? (
              <p className="text-xs text-muted-foreground">Hələ tapşırıq yoxdur.</p>
            ) : (
              <ul className="space-y-1.5">
                {tasks.slice(0, 5).map((t) => (
                  <li key={t.id} className="flex items-center justify-between rounded-md border border-border/40 px-2 py-1.5 text-xs">
                    <span className="font-medium">{t.basliq}</span>
                    <Badge variant="outline" className="text-[10px]">{t.status ?? "acig"}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>


      {/* Rich hub cards with gradient accents + count badges */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        <HubCard href="/sahibkar/hesabat" icon={FileText} title="Hesabat" desc="Aylıq/rüblük xülasə"
          count={formatMoney(hesabat.month.revenue)} gradient="from-indigo-500/15 to-purple-500/5" />
        <HubCard href="/sahibkar/isci" icon={Users} title="İşçilər" desc="Performans baxış"
          count={`${counts.isci_count} nəfər`} gradient="from-sky-500/15 to-cyan-500/5" />
        <HubCard href="/sahibkar/magaza" icon={Building2} title="Mağaza" desc="Mağaza idarə"
          gradient="from-pink-500/15 to-rose-500/5" />
        <HubCard href="/sahibkar/maya" icon={Wallet} title="Maya analizi" desc="COGS, OPEX, maaş"
          gradient="from-emerald-500/15 to-teal-500/5" />
        <HubCard href="/sahibkar/not" icon={StickyNote} title="Qeydlər" desc="Şəxsi notlar"
          count={`${counts.qeyd_count}`} gradient="from-amber-500/15 to-yellow-500/5" />
        <HubCard href="/sahibkar/partiya" icon={Truck} title="Partiyalar" desc="Idxal və ROI"
          count={`${counts.partiya_count}`} gradient="from-orange-500/15 to-red-500/5" />
        <HubCard href="/sahibkar/snapshot" icon={Camera} title="Snapshot" desc="Günlük tarix"
          gradient="from-violet-500/15 to-fuchsia-500/5" />
        <HubCard href="/sahibkar/tapshiriq" icon={ClipboardList} title="Tapşırıqlar" desc="Kanban görünüş"
          count={`${counts.open_task_count} açıq`} gradient="from-blue-500/15 to-indigo-500/5"
          highlight={counts.open_task_count > 0} />
        <HubCard href="/sahibkar/filiallar" icon={Building2} title="Filiallar" desc="Şəbəkə idarə"
          count={`${counts.branch_count}`} gradient="from-teal-500/15 to-emerald-500/5" />
        <HubCard href="/sahibkar/filial-muqayise" icon={GitCompare} title="Filial müqayisə" desc="Yanaşı analiz"
          gradient="from-cyan-500/15 to-blue-500/5" />
        <HubCard href="/sahibkar/data-saglamligi" icon={Activity} title="Data sağlamlığı" desc="Anomaliyalar"
          count={`${counts.data_issues}`} gradient="from-rose-500/15 to-pink-500/5"
          highlight={counts.data_issues > 0} />
        <HubCard href="/sahibkar/audit" icon={History} title="Audit" desc="Əməliyyatlar izi"
          count={`24s: ${counts.audit_last24}`} gradient="from-slate-500/15 to-zinc-500/5" />
        <HubCard href="/sahibkar/mobile" icon={Smartphone} title="Mobil panel" desc="Touch görünüş"
          gradient="from-lime-500/15 to-green-500/5" />
        <HubCard href="/sahibkar/gizli-elaqe" icon={Lock} title="Gizli əlaqələr" desc="İzolyasiyalı kontakt bazası"
          gradient="from-purple-500/15 to-fuchsia-500/5" />
        <HubCard href="/sahibkar/senedler" icon={FolderArchive} title="Sənədlər" desc="Vacib sənədlər, qovluqlar, linklər"
          gradient="from-amber-500/15 to-orange-500/5" />
        <HubCard href="/sahibkar/gizli-mod" icon={EyeOff} title="Gizli mod" desc="Rəqəmləri rəqibdən gizlət"
          gradient="from-violet-500/15 to-purple-500/5" />
        <HubCard href="/sahibkar/backup" icon={Database} title="Backup" desc="Bütün datanı JSON-a yüklə"
          gradient="from-emerald-500/15 to-teal-500/5" />
        <HubCard href="/sahibkar/aktivlik" icon={Activity} title="Aktivlik nəzarəti" desc="Anomaliya detektoru"
          gradient="from-violet-500/15 to-fuchsia-500/5" />
        <HubCard href="/sahibkar/ayarlar" icon={Settings} title="Daxili ayarlar" desc="Görünüş, kod, sessiya"
          gradient="from-zinc-500/15 to-slate-500/5" />
      </div>
    </div>
  );
}

function SnapStat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div>
      <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-xl font-bold tabular-nums">{value}</div>
      <div className="text-[10.5px] text-muted-foreground">{sub}</div>
    </div>
  );
}

function HubCard({
  href,
  icon: Icon,
  title,
  desc,
  count,
  gradient,
  highlight,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  desc: string;
  count?: string;
  gradient?: string;
  highlight?: boolean;
}) {
  return (
    <Link href={href}>
      <Card className={`glass relative overflow-hidden transition hover:border-primary/30 ${highlight ? "border-rose-500/30" : ""}`}>
        {gradient ? <div className={`absolute inset-0 bg-gradient-to-br ${gradient} pointer-events-none`} /> : null}
        <CardContent className="relative flex items-start gap-3 py-4">
          <div className="grid h-10 w-10 place-items-center rounded-md bg-secondary text-muted-foreground">
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <div className="text-sm font-semibold">{title}</div>
              {count ? (
                <Badge variant={highlight ? "destructive" : "secondary"} className="h-4 text-[9.5px]">
                  {count}
                </Badge>
              ) : null}
            </div>
            <div className="text-xs text-muted-foreground">{desc}</div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
