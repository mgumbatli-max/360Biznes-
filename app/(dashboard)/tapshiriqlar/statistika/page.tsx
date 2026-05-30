import type { Metadata } from "next";
import Link from "next/link";
import {
  BarChart3, TrendingUp, CheckCircle2, Clock, AlertTriangle, Trophy, Calendar,
  ArrowRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TaskSectionTabs } from "@/features/tapshiriqlar/components/section-tabs";
import { getTaskAnalytics } from "@/features/tapshiriqlar/stats-queries";
import { formatDate, cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Tapşırıqlar — Statistika" };

const STATUS_LABEL: Record<string, string> = {
  yeni: "Yeni", icrada: "İcradadır", gozlemede: "Yoxlanılır", tamamlandi: "Tamamlandı", legv: "Ləğv",
};
const PRIORITY_LABEL: Record<string, string> = {
  asagi: "Aşağı", normal: "Normal", yuksek: "Yüksək", tecili: "Təcili",
};

export default async function TaskStatistikaPage() {
  const a = await getTaskAnalytics();

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <header className="flex items-start gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-lg bg-gradient-to-br from-primary to-violet-500">
          <BarChart3 className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tapşırıq statistikası</h1>
          <p className="mt-1 text-sm text-muted-foreground">Son 30 günlük performans, gecikmə və komanda yükü.</p>
        </div>
      </header>

      <TaskSectionTabs current="statistika" />

      {/* KPIs */}
      <section className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Kpi icon={TrendingUp} label="Cəmi" value={a.totals.total} sub="hamısı" tone="primary" />
        <Kpi icon={Clock} label="Aktiv" value={a.totals.aktiv} sub="açıq tapşırıq" tone="amber" />
        <Kpi icon={CheckCircle2} label="30 günə tamam" value={a.totals.tamamlanan_30g} sub="tamamlandı" tone="emerald" />
        <Kpi icon={AlertTriangle} label="Gecikmiş" value={a.totals.gecikmis} sub="aktiv olub geç" tone={a.totals.gecikmis > 0 ? "rose" : "neutral"} />
        <Kpi icon={Calendar} label="Orta cavab" value={a.totals.avg_completion_hours != null ? `${a.totals.avg_completion_hours.toFixed(1)}s` : "—"} sub="saatda" tone="primary" />
      </section>

      {/* By status + priority */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card className="glass">
          <CardHeader>
            <CardTitle className="text-base">Status üzrə</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {a.by_status.length === 0 ? (
              <p className="text-sm text-muted-foreground">Məlumat yoxdur</p>
            ) : (
              a.by_status.map((s) => {
                const max = Math.max(...a.by_status.map((x) => x.count), 1);
                const pct = (s.count / max) * 100;
                return (
                  <div key={s.status} className="space-y-0.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium">{STATUS_LABEL[s.status] ?? s.status}</span>
                      <span className="tabular-nums">{s.count}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-secondary/40">
                      <div className="h-full rounded-full bg-primary/70" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        <Card className="glass">
          <CardHeader>
            <CardTitle className="text-base">Prioritet üzrə</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {a.by_priority.length === 0 ? (
              <p className="text-sm text-muted-foreground">Məlumat yoxdur</p>
            ) : (
              a.by_priority.map((p) => {
                const max = Math.max(...a.by_priority.map((x) => x.count), 1);
                const pct = (p.count / max) * 100;
                const tone = p.prioritet === "tecili" ? "bg-rose-500" : p.prioritet === "yuksek" ? "bg-rose-400" : p.prioritet === "normal" ? "bg-amber-500" : "bg-slate-400";
                return (
                  <div key={p.prioritet} className="space-y-0.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium">{PRIORITY_LABEL[p.prioritet] ?? p.prioritet}</span>
                      <span className="tabular-nums">{p.count}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-secondary/40">
                      <div className={cn("h-full rounded-full", tone)} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>

      {/* By assignee leaderboard */}
      <Card className="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Trophy className="h-4 w-4 text-amber-500" />
            Komanda performansı (son 30 gün)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {a.by_assignee.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">Bu dövrdə tapşırıq təyin olunmayıb</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-border/40 text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">#</th>
                  <th className="px-3 py-2">İşçi</th>
                  <th className="px-3 py-2 text-right">Cəm</th>
                  <th className="px-3 py-2 text-right">Tamamlanan</th>
                  <th className="px-3 py-2 text-right">Gecikmiş</th>
                  <th className="px-3 py-2 text-right">Tamamlanma %</th>
                </tr>
              </thead>
              <tbody>
                {a.by_assignee.map((r, i) => {
                  const completionRate = r.total > 0 ? (r.tamamlanan / r.total) * 100 : 0;
                  return (
                    <tr key={r.mesul_id} className="border-b border-border/20 hover:bg-secondary/20">
                      <td className="px-3 py-2 text-xs tabular-nums">{i + 1}</td>
                      <td className="px-3 py-2 font-medium">{r.ad}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{r.total}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-emerald-500">{r.tamamlanan}</td>
                      <td className={cn("px-3 py-2 text-right tabular-nums", r.gecikmis > 0 ? "text-rose-500 font-semibold" : "text-muted-foreground")}>{r.gecikmis}</td>
                      <td className="px-3 py-2 text-right">
                        <Badge variant="outline" className={cn(
                          "text-[10px]",
                          completionRate >= 80 ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-500" :
                          completionRate >= 50 ? "border-amber-500/30 bg-amber-500/10 text-amber-500" :
                          "border-rose-500/30 bg-rose-500/10 text-rose-500"
                        )}>
                          {completionRate.toFixed(0)}%
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Top overdue + oncoming */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card className="glass">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4 text-rose-500" />
              Ən çox gecikmiş
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {a.top_overdue.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-muted-foreground">Gecikmiş tapşırıq yoxdur 🎉</p>
            ) : (
              <ul className="divide-y divide-border/30">
                {a.top_overdue.map((t) => (
                  <li key={t.id}>
                    <Link href={`/tapshiriqlar/${t.id}`} className="flex items-center justify-between gap-2 px-4 py-2 hover:bg-secondary/30">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{t.basliq}</div>
                        {t.mesul_ad && <div className="text-[10.5px] text-muted-foreground">👤 {t.mesul_ad}</div>}
                      </div>
                      <Badge variant="outline" className="border-rose-500/30 bg-rose-500/10 text-rose-500">
                        {t.days_overdue}g
                      </Badge>
                      <ArrowRight className="h-3 w-3 text-muted-foreground" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="glass">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Calendar className="h-4 w-4 text-primary" />
              Növbəti 7 gün
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {a.oncoming.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-muted-foreground">Bu həftə üçün planlanmış tapşırıq yoxdur</p>
            ) : (
              <ul className="divide-y divide-border/30">
                {a.oncoming.map((t) => (
                  <li key={t.id}>
                    <Link href={`/tapshiriqlar/${t.id}`} className="flex items-center justify-between gap-2 px-4 py-2 hover:bg-secondary/30">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{t.basliq}</div>
                        {t.mesul_ad && <div className="text-[10.5px] text-muted-foreground">👤 {t.mesul_ad}</div>}
                      </div>
                      {t.deadline && (
                        <Badge variant="outline" className="text-[10px]">
                          {formatDate(t.deadline, { day: "2-digit", month: "short" })}
                        </Badge>
                      )}
                      <ArrowRight className="h-3 w-3 text-muted-foreground" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Kpi({ icon: Icon, label, value, sub, tone }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string; value: number | string; sub: string;
  tone: "primary" | "emerald" | "amber" | "rose" | "neutral";
}) {
  const cls = {
    primary: "border-primary/30 bg-primary/5 text-primary",
    emerald: "border-emerald-500/30 bg-emerald-500/5 text-emerald-500",
    amber:   "border-amber-500/30 bg-amber-500/5 text-amber-500",
    rose:    "border-rose-500/30 bg-rose-500/5 text-rose-500",
    neutral: "border-border bg-card/40",
  }[tone];
  return (
    <div className={cn("rounded-xl border p-3", cls)}>
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider opacity-75">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <div className="mt-1 text-2xl font-bold tabular-nums">{value}</div>
      <div className="text-[10.5px] opacity-75">{sub}</div>
    </div>
  );
}
