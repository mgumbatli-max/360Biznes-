import type { Metadata } from "next";
import Link from "next/link";
import {
  BarChart3, TrendingUp, Clock, Settings,
  ArrowLeft, CheckCircle2, Trophy, AlertTriangle, ArrowRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Təsdiq mərkəzi — Statistika" };

async function loadStats() {
  return withTenant(async () => {
    const now = new Date();
    const month30 = new Date();
    month30.setDate(now.getDate() - 30);

    // Type breakdown (last 30 days)
    const byType = await prisma.tesdiq_telep.groupBy({
      by: ["emeliyyat_nov"],
      where: { yaradildi: { gte: month30 } },
      _count: { _all: true },
      orderBy: { _count: { emeliyyat_nov: "desc" } },
    });

    // Status breakdown (last 30 days)
    const byStatus = await prisma.tesdiq_telep.groupBy({
      by: ["status"],
      where: { yaradildi: { gte: month30 } },
      _count: { _all: true },
    });

    // Avg response time per type
    const respRows = await prisma.tesdiq_telep.findMany({
      where: { netice_tarix: { gte: month30, not: null }, status: { in: ["tesdiq", "red"] } },
      select: { emeliyyat_nov: true, yaradildi: true, netice_tarix: true, status: true },
      take: 1000,
    });

    const respByType = new Map<string, { hours: number[]; tesdiq: number; red: number }>();
    for (const r of respRows) {
      if (!r.yaradildi || !r.netice_tarix) continue;
      const h = (r.netice_tarix.getTime() - r.yaradildi.getTime()) / 3_600_000;
      const cur = respByType.get(r.emeliyyat_nov) ?? { hours: [], tesdiq: 0, red: 0 };
      cur.hours.push(h);
      if (r.status === "tesdiq") cur.tesdiq++;
      else if (r.status === "red") cur.red++;
      respByType.set(r.emeliyyat_nov, cur);
    }
    const respStats = Array.from(respByType.entries()).map(([nov, v]) => {
      const avg = v.hours.length > 0 ? v.hours.reduce((s, h) => s + h, 0) / v.hours.length : 0;
      const total = v.tesdiq + v.red;
      return { emeliyyat_nov: nov, avg_hours: avg, count: total, approval_rate: total > 0 ? (v.tesdiq / total) * 100 : 0 };
    }).sort((a, b) => b.count - a.count);

    // Top approvers (last 30 days)
    const topApprovers = await prisma.tesdiq_telep.groupBy({
      by: ["baxan_id"],
      where: { netice_tarix: { gte: month30, not: null }, baxan_id: { not: null }, status: { in: ["tesdiq", "red"] } },
      _count: { _all: true },
      orderBy: { _count: { baxan_id: "desc" } },
      take: 5,
    });
    const approverIds = topApprovers.map((a) => a.baxan_id).filter((v): v is string => !!v);
    const approverUsers = approverIds.length > 0
      ? await prisma.istifadeciler.findMany({
          where: { id: { in: approverIds } },
          select: { id: true, ad_soyad: true },
        })
      : [];
    const approverMap = new Map(approverUsers.map((u) => [u.id, u.ad_soyad]));

    // Pending bottleneck — oldest pending
    const oldestPending = await prisma.tesdiq_telep.findMany({
      where: { status: "gozleyir" },
      orderBy: { yaradildi: "asc" },
      take: 5,
      select: { id: true, basliq: true, emeliyyat_nov: true, prioritet: true, yaradildi: true },
    });

    const total30 = byType.reduce((s, t) => s + t._count._all, 0);
    const tesdiq30 = byStatus.find((s) => s.status === "tesdiq")?._count._all ?? 0;
    const red30 = byStatus.find((s) => s.status === "red")?._count._all ?? 0;
    const gozleyen30 = byStatus.find((s) => s.status === "gozleyir")?._count._all ?? 0;
    const overallApprovalRate = tesdiq30 + red30 > 0 ? (tesdiq30 / (tesdiq30 + red30)) * 100 : 0;
    const overallAvgHours = respRows.length > 0
      ? respRows.reduce((s, r) => {
          if (!r.yaradildi || !r.netice_tarix) return s;
          return s + (r.netice_tarix.getTime() - r.yaradildi.getTime()) / 3_600_000;
        }, 0) / respRows.length
      : 0;

    return {
      total30, tesdiq30, red30, gozleyen30,
      overallApprovalRate, overallAvgHours,
      byType,
      respStats,
      topApprovers: topApprovers.map((a) => ({
        id: a.baxan_id ?? "",
        ad: approverMap.get(a.baxan_id ?? "") ?? "—",
        count: a._count._all,
      })),
      oldestPending: oldestPending.map((o) => ({
        ...o,
        days_ago: o.yaradildi ? Math.floor((Date.now() - o.yaradildi.getTime()) / 86_400_000) : 0,
      })),
    };
  });
}

const TYPE_LABEL: Record<string, string> = {
  endirim: "Endirim",
  qiymet_deyisdi: "Qiymət dəyişdi",
  maya_alti: "Maya altı",
  borc_limit: "Borc limiti",
  silme: "Silmə",
  qaytarma: "Qaytarma",
  xerc: "Xərc",
  stok_duzelis: "Stok düzəliş",
  diger: "Digər",
};

export default async function TesdiqStatistikaPage() {
  const s = await loadStats();
  const maxTypeCount = Math.max(...s.byType.map((t) => t._count._all), 1);

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-primary to-violet-500">
            <BarChart3 className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Statistika</h1>
            <p className="mt-1 text-sm text-muted-foreground">Son 30 günlük təsdiq fəaliyyəti.</p>
          </div>
        </div>
        <SubNav />
      </header>

      {/* Top KPIs */}
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi icon={TrendingUp} label="Cəmi" value={s.total30} sub="Son 30 gün" tone="primary" />
        <Kpi icon={CheckCircle2} label="Təsdiq nisbəti" value={`${s.overallApprovalRate.toFixed(0)}%`} sub={`${s.tesdiq30} təsdiq · ${s.red30} rədd`} tone="emerald" />
        <Kpi icon={Clock} label="Orta cavab" value={`${s.overallAvgHours.toFixed(1)}s`} sub="saatda" tone="amber" />
        <Kpi icon={AlertTriangle} label="Hələ gözləyir" value={s.gozleyen30} sub="Hazır deyil" tone={s.gozleyen30 > 0 ? "rose" : "neutral"} />
      </section>

      {/* By type — horizontal bars */}
      <Card className="glass">
        <CardHeader>
          <CardTitle className="text-base">Növ üzrə paylanma</CardTitle>
        </CardHeader>
        <CardContent>
          {s.byType.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Bu dövrdə məlumat yoxdur</p>
          ) : (
            <div className="space-y-2">
              {s.byType.map((t) => {
                const pct = (t._count._all / maxTypeCount) * 100;
                return (
                  <div key={t.emeliyyat_nov} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium">{TYPE_LABEL[t.emeliyyat_nov] ?? t.emeliyyat_nov}</span>
                      <span className="tabular-nums text-muted-foreground">{t._count._all}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-secondary/40">
                      <div className="h-full rounded-full bg-gradient-to-r from-primary to-violet-500" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Response time + approval rate by type */}
      <Card className="glass">
        <CardHeader>
          <CardTitle className="text-base">Növ üzrə performans</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {s.respStats.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Cavablanmış məlumat yoxdur</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-border/40 text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Növ</th>
                  <th className="px-3 py-2 text-right">Sayı</th>
                  <th className="px-3 py-2 text-right">Orta cavab</th>
                  <th className="px-3 py-2 text-right">Təsdiq %</th>
                </tr>
              </thead>
              <tbody>
                {s.respStats.map((r) => (
                  <tr key={r.emeliyyat_nov} className="border-b border-border/20">
                    <td className="px-3 py-2 font-medium">{TYPE_LABEL[r.emeliyyat_nov] ?? r.emeliyyat_nov}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.count}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.avg_hours.toFixed(1)} saat</td>
                    <td className="px-3 py-2 text-right">
                      <Badge variant="outline" className={cn(
                        "text-[10px]",
                        r.approval_rate >= 80 ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-500" :
                        r.approval_rate >= 50 ? "border-amber-500/30 bg-amber-500/10 text-amber-500" :
                        "border-rose-500/30 bg-rose-500/10 text-rose-500"
                      )}>
                        {r.approval_rate.toFixed(0)}%
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Two columns: Top approvers + Bottleneck */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card className="glass">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Trophy className="h-4 w-4 text-amber-500" />
              Top təsdiq edənlər
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {s.topApprovers.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Hələ təsdiq olmayıb</p>
            ) : (
              <ul className="divide-y divide-border/30">
                {s.topApprovers.map((a, i) => (
                  <li key={a.id} className="flex items-center justify-between px-3 py-2 text-sm">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="h-5 w-5 justify-center p-0 text-[10px]">{i + 1}</Badge>
                      <span className="font-medium">{a.ad}</span>
                    </div>
                    <span className="text-sm font-bold tabular-nums">{a.count}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="glass">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4 text-rose-500" />
              Ən köhnə gözləyən
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {s.oldestPending.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Bütün sorğular cavablanıb 🎉</p>
            ) : (
              <ul className="divide-y divide-border/30">
                {s.oldestPending.map((o) => (
                  <li key={o.id}>
                    <Link href={`/tesdiq/${o.id}`} className="flex items-center justify-between gap-2 px-3 py-2 text-sm hover:bg-secondary/30">
                      <div className="min-w-0">
                        <div className="truncate font-medium">{o.basliq ?? o.emeliyyat_nov}</div>
                        <div className="text-[10.5px] text-muted-foreground">{TYPE_LABEL[o.emeliyyat_nov] ?? o.emeliyyat_nov}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={cn(
                          "text-[10px]",
                          o.days_ago > 7 ? "border-rose-500/30 bg-rose-500/10 text-rose-500" :
                          o.days_ago > 3 ? "border-amber-500/30 bg-amber-500/10 text-amber-500" :
                          "border-border bg-secondary text-muted-foreground"
                        )}>
                          {o.days_ago === 0 ? "Bu gün" : `${o.days_ago} gün`}
                        </Badge>
                        <ArrowRight className="h-3 w-3 text-muted-foreground" />
                      </div>
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

function SubNav() {
  return (
    <nav className="inline-flex items-center gap-1 rounded-lg border border-border/60 bg-card/40 p-0.5">
      <Link href="/tesdiq" className="inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium text-muted-foreground hover:bg-secondary/40 hover:text-foreground">
        <ArrowLeft className="h-3 w-3" />
        Mərkəz
      </Link>
      <span className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary/15 px-2.5 text-xs font-semibold text-primary">
        <BarChart3 className="h-3 w-3" />
        Statistika
      </span>
      <Link href="/tesdiq/ayarlar" className="inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium text-muted-foreground hover:bg-secondary/40 hover:text-foreground">
        <Settings className="h-3 w-3" />
        Ayarlar
      </Link>
    </nav>
  );
}

function Kpi({ icon: Icon, label, value, sub, tone }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string; value: number | string; sub: string;
  tone: "primary" | "emerald" | "rose" | "amber" | "neutral";
}) {
  const cls = {
    primary: "border-primary/30 bg-primary/5 text-primary",
    emerald: "border-emerald-500/30 bg-emerald-500/5 text-emerald-500",
    rose: "border-rose-500/30 bg-rose-500/5 text-rose-500",
    amber: "border-amber-500/30 bg-amber-500/5 text-amber-500",
    neutral: "border-border bg-card/40",
  }[tone];
  return (
    <div className={`rounded-xl border p-4 ${cls}`}>
      <div className="flex items-center gap-2 text-[10.5px] font-bold uppercase tracking-wider opacity-75">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className="mt-1 text-2xl font-bold tabular-nums">{value}</div>
      <div className="mt-0.5 text-[11px] opacity-75">{sub}</div>
    </div>
  );
}
