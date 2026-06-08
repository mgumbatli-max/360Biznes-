import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ShieldAlert, Radar, ShieldCheck, Workflow, Boxes, CreditCard, UserX,
  Wrench, Globe, CheckCircle2, AlertTriangle, Activity, Flame, ArrowRight, TrendingUp,
  Info, ListTodo,
} from "lucide-react";
import { auth } from "@/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { NezaretMerkeziTabs } from "@/features/nezaret-merkezi/components/tabs";
import { getNezaretBadges } from "@/features/nezaret-merkezi/counts";
import { getRiskDashboard } from "@/features/nezaret-merkezi/dashboard-queries";
import { getRequestPermissions } from "@/lib/auth/get-permissions";
import { cn, formatMoney } from "@/lib/utils";

export const metadata: Metadata = { title: "Nəzarət Mərkəzi — Dashboard" };

export default async function NezaretMerkeziPage() {
  // Master icazə yoxlaması — nezaret.oxu yoxdursa səhifə açılmır
  const session = await auth();
  if (!session?.user) return null;
  const icazeler = await getRequestPermissions();
  const rolAd = (session.user.rol_ad ?? "").toLowerCase();
  const isOwnerOrAdmin =
    rolAd.includes("sahibkar") || rolAd.includes("owner") || rolAd.includes("admin");
  if (!isOwnerOrAdmin && !icazeler.includes("nezaret.oxu")) {
    redirect("/tapshiriqlar");
  }

  const [badges, data] = await Promise.all([
    getNezaretBadges(),
    getRiskDashboard(),
  ]);

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      {/* Hero */}
      <header className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 via-card to-rose-500/5 p-5 shadow-sm">
        <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-gradient-to-br from-primary to-rose-500 opacity-10 blur-3xl" />
        <div className="relative flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br from-primary to-rose-500 shadow-lg shadow-primary/20">
              <ShieldAlert className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Nəzarət Mərkəzi</h1>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                ERP-nin risk, icazə və avtomatik nəzarət mərkəzi. Xəbərdarlıqlar, təsdiqlər və avtomatlaşdırma — bir yerdə.
              </p>
            </div>
          </div>
        </div>

        {/* Explainer */}
        <div className="relative mt-4 grid grid-cols-1 gap-2 md:grid-cols-3">
          <ExplainerCard
            icon={Workflow}
            color="violet"
            title="Qaydalar"
            desc="Hadisə → şərt → əməliyyat. Sistem hadisəni izləyir və avtomatik addım atır."
            href="/avtomatlasdirma"
          />
          <ExplainerCard
            icon={Radar}
            color="amber"
            title="Xəbərdarlıqlar"
            desc="Qaydalardan və proseslərdən yaranan risklər. Sadəcə informasiya, əməliyyat bloklamır."
            href="/xeberdarliqlar"
          />
          <ExplainerCard
            icon={ShieldCheck}
            color="emerald"
            title="Təsdiqlər"
            desc="Sahibkar icazəsi olmadan icra olunmayan əməliyyatlar. Burada gözləyirlər."
            href="/tesdiq"
          />
        </div>
      </header>

      {/* Tab nav */}
      <NezaretMerkeziTabs current="dashboard" badges={badges} />

      {/* Big risk strip — most important numbers */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <RiskCard icon={Radar} label="Aktiv xəbərdarlıq" value={data.alert_open} sub={`${data.alert_kritik} kritik`} tone={data.alert_kritik > 0 ? "rose" : data.alert_open > 0 ? "amber" : "emerald"} href="/xeberdarliqlar" />
        <RiskCard icon={ShieldCheck} label="Təsdiq gözləyir" value={data.tesdiq_gozleyen} sub={`${data.tesdiq_kritik} kritik`} tone={data.tesdiq_gozleyen > 0 ? "emerald" : "neutral"} href="/tesdiq" />
        <RiskCard icon={Workflow} label="Aktiv qayda" value={data.active_rules} sub={`24s: ${data.automation_runs_24h} icra · ${data.automation_errors_24h} xəta`} tone={data.automation_errors_24h > 0 ? "rose" : "primary"} href="/avtomatlasdirma" />
        <RiskCard icon={CheckCircle2} label="Bu gün həll olunan" value={data.alert_resolved_today + data.tesdiq_today_completed} sub={`${data.alert_resolved_today} risk · ${data.tesdiq_today_completed} icazə`} tone="emerald" href="/nezaret-merkezi/loglar" />
      </section>

      {/* Detailed risk grid */}
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <DetailRiskTile icon={ListTodo} label="Gecikmiş tapşırıq" value={data.task_overdue} tone={data.task_overdue > 5 ? "rose" : data.task_overdue > 0 ? "amber" : "emerald"} href="/tapshiriqlar?gecikmis=1" />
        <DetailRiskTile icon={Boxes} label="Stok riski" value={data.stock_zero + data.stock_low} sub={`${data.stock_zero} bitib · ${data.stock_low} az`} tone={data.stock_zero > 0 ? "rose" : data.stock_low > 0 ? "amber" : "emerald"} href="/anbar" />
        <DetailRiskTile icon={CreditCard} label="Borclu müştəri" value={data.debtor_count} sub={`${formatMoney(data.debtor_amount)} cəmi`} tone={data.overdue_debt > 0 || data.debtor_count > 10 ? "rose" : data.debtor_count > 0 ? "amber" : "emerald"} href="/elaqe?borc=1" />
        <DetailRiskTile icon={UserX} label="İşçi davamiyyət" value={data.late_employees_today} sub="Bu gün gec gələn" tone={data.late_employees_today > 0 ? "amber" : "emerald"} href="/iscilier" />
        <DetailRiskTile icon={Wrench} label="Servis gecikmə" value={data.service_stalled} sub="Status dəyişmir" tone={data.service_stalled > 0 ? "amber" : "emerald"} href="/servis" />
        <DetailRiskTile icon={Globe} label="Marketplace" value={data.mp_pending} sub="Gözləyən sifariş" tone={data.mp_pending > 0 ? "amber" : "emerald"} href="/marketplace" />
        <DetailRiskTile icon={Activity} label="Son 24 saat" value={data.alerts_24h} sub="Yeni risk" tone={data.alerts_24h > 10 ? "rose" : data.alerts_24h > 0 ? "amber" : "emerald"} href="/xeberdarliqlar" />
        <DetailRiskTile icon={Flame} label="Bu gün yaranan" value={data.alert_today} sub="Risk hadisəsi" tone={data.alert_today > 0 ? "amber" : "emerald"} href="/xeberdarliqlar" />
      </section>

      {/* Two-column: top categories + recurring problems */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card className="glass">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-4 w-4 text-amber-500" />
              Ən riskli proseslər
            </CardTitle>
            <p className="text-xs text-muted-foreground">Açıq xəbərdarlıqları olan kateqoriyalar</p>
          </CardHeader>
          <CardContent className="p-0">
            {data.top_categories.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">Heç bir kateqoriyada açıq risk yoxdur — sistem sağlamdır 🎉</p>
            ) : (
              <ul className="divide-y divide-border/30">
                {data.top_categories.map((c, i) => {
                  const pct = Math.min(100, Math.round((c.count / Math.max(...data.top_categories.map((x) => x.count), 1)) * 100));
                  return (
                    <li key={c.kateqoriya_kod}>
                      <Link href={`/xeberdarliqlar?kateq=${c.kateqoriya_kod}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-secondary/30">
                        <span className="w-6 text-xs text-muted-foreground">{i + 1}.</span>
                        <span className="text-lg">{c.emoji ?? "🔔"}</span>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-semibold">{c.kateqoriya_ad}</div>
                          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-secondary/40">
                            <div className="h-full rounded-full bg-amber-500" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                        <span className="ml-auto text-sm font-bold tabular-nums">{c.count}</span>
                        <ArrowRight className="h-3 w-3 text-muted-foreground" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="glass">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4 text-rose-500" />
              Ən çox təkrarlanan problemlər
            </CardTitle>
            <p className="text-xs text-muted-foreground">Son 7 gündə eyni qaydadan yaranmış xəbərdarlıqlar</p>
          </CardHeader>
          <CardContent className="p-0">
            {data.recurring.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">Hələ təkrarlanan problem yoxdur</p>
            ) : (
              <ul className="divide-y divide-border/30">
                {data.recurring.map((r, i) => (
                  <li key={i} className="flex items-start gap-3 px-4 py-2.5">
                    <span className="w-6 shrink-0 text-xs text-muted-foreground">{i + 1}.</span>
                    <div className="min-w-0 flex-1">
                      <code className="rounded bg-secondary/60 px-1.5 py-0.5 font-mono text-[10px]">{r.rule_kod ?? "—"}</code>
                      {r.example && <div className="mt-0.5 line-clamp-1 text-[11px] text-muted-foreground">{r.example}</div>}
                    </div>
                    <Badge variant="outline" className="ml-auto border-rose-500/30 bg-rose-500/10 text-rose-500">
                      ×{r.count}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Footer hint */}
      <div className="rounded-lg border border-dashed border-border/40 bg-card/20 p-3 text-[11px] text-muted-foreground">
        <Info className="mr-1 inline h-3 w-3" />
        <strong className="text-foreground">Necə işləyir:</strong> Avtomatlaşdırma qaydaları sistemdə hadisəni izləyir,
        şərt uyğun gələndə Xəbərdarlıqlar / Təsdiqlər / Bildiriş / Tapşırıq / Bloklama yaradır. Bu Dashboard hamısının
        ümumi vəziyyətini göstərir.
      </div>
    </div>
  );
}

function ExplainerCard({ icon: Icon, color, title, desc, href }: {
  icon: React.ComponentType<{ className?: string }>;
  color: "violet" | "amber" | "emerald";
  title: string;
  desc: string;
  href: string;
}) {
  const cls = {
    violet:  "border-violet-500/30 bg-violet-500/5 hover:bg-violet-500/10",
    amber:   "border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10",
    emerald: "border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/10",
  }[color];
  const iconCls = {
    violet:  "text-violet-500",
    amber:   "text-amber-500",
    emerald: "text-emerald-500",
  }[color];
  return (
    <Link href={href} className={cn("group block rounded-lg border p-3 transition", cls)}>
      <div className="flex items-center gap-2">
        <Icon className={cn("h-4 w-4", iconCls)} />
        <span className="text-sm font-bold">{title}</span>
        <ArrowRight className="ml-auto h-3 w-3 text-muted-foreground transition group-hover:translate-x-0.5" />
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground">{desc}</p>
    </Link>
  );
}

function RiskCard({ icon: Icon, label, value, sub, tone, href }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  sub: string;
  tone: "rose" | "amber" | "emerald" | "primary" | "neutral";
  href: string;
}) {
  const cls = {
    rose:    "border-rose-500/30 bg-rose-500/5 text-rose-500",
    amber:   "border-amber-500/30 bg-amber-500/5 text-amber-500",
    emerald: "border-emerald-500/30 bg-emerald-500/5 text-emerald-500",
    primary: "border-primary/30 bg-primary/5 text-primary",
    neutral: "border-border bg-card/40",
  }[tone];
  return (
    <Link href={href} className={cn("group block rounded-xl border p-4 transition hover:-translate-y-0.5", cls)}>
      <div className="flex items-center justify-between">
        <Icon className="h-4 w-4" />
        <ArrowRight className="h-3 w-3 opacity-0 transition group-hover:opacity-100" />
      </div>
      <div className="mt-2 text-3xl font-bold tabular-nums">{value}</div>
      <div className="text-[10px] font-bold uppercase tracking-wider opacity-75">{label}</div>
      <div className="mt-0.5 text-[10.5px] opacity-75">{sub}</div>
    </Link>
  );
}

function DetailRiskTile({ icon: Icon, label, value, sub, tone, href }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  sub?: string;
  tone: "rose" | "amber" | "emerald";
  href: string;
}) {
  const cls = {
    rose:    "border-rose-500/30 bg-rose-500/5 text-rose-500",
    amber:   "border-amber-500/30 bg-amber-500/5 text-amber-500",
    emerald: "border-emerald-500/20 bg-emerald-500/5 text-emerald-500/80",
  }[tone];
  return (
    <Link href={href} className={cn("flex items-center gap-2 rounded-lg border p-2.5 transition hover:-translate-y-0.5", cls)}>
      <Icon className="h-4 w-4 shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="text-lg font-bold tabular-nums">{value}</div>
        <div className="truncate text-[10px] font-semibold uppercase tracking-wider opacity-75">{label}</div>
        {sub && <div className="truncate text-[10px] opacity-60">{sub}</div>}
      </div>
    </Link>
  );
}
