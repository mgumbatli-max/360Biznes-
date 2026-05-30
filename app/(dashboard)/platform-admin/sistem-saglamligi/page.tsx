import type { Metadata } from "next";
import { Activity, Database, HardDrive, AlertTriangle, Users, Zap } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { requirePlatformAdmin } from "@/lib/platform-admin/guard";
import { prismaUnscoped } from "@/lib/db/prisma";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Sistem sağlamlığı" };

async function getHealthMetrics() {
  const now = new Date();
  const last24h = new Date(now.getTime() - 24 * 3600 * 1000);

  const dbStart = Date.now();
  const [tenantSayi, activeSessions, last24Audits, recentErrors] = await Promise.all([
    prismaUnscoped.sahibkarlar.count(),
    prismaUnscoped.istifadeci_sessiya.count({
      where: { bitirilib: false },
    }).catch(() => 0),
    prismaUnscoped.audit_log.count({
      where: { yaradildi: { gte: last24h } },
    }),
    prismaUnscoped.audit_log.findMany({
      where: { status: { not: "ugur" }, yaradildi: { gte: last24h } },
      orderBy: { yaradildi: "desc" },
      take: 10,
      include: { sahibkarlar: { select: { ad: true } } },
    }),
  ]);
  const dbLatency = Date.now() - dbStart;

  const errorAudits = recentErrors.length;
  const errorRate = last24Audits > 0 ? (errorAudits / last24Audits) * 100 : 0;

  // Process metrics
  const mem = process.memoryUsage();
  const memMb = Math.round((mem.heapUsed / 1024 / 1024) * 10) / 10;
  const memTotalMb = Math.round((mem.heapTotal / 1024 / 1024) * 10) / 10;
  const uptimeSec = Math.round(process.uptime());
  const uptimeStr = uptimeSec < 3600
    ? `${Math.round(uptimeSec / 60)} dəq`
    : uptimeSec < 86400
      ? `${(uptimeSec / 3600).toFixed(1)} saat`
      : `${(uptimeSec / 86400).toFixed(1)} gün`;

  return {
    dbLatency,
    tenantSayi,
    activeSessions,
    last24Audits,
    errorAudits,
    errorRate,
    recentErrors,
    memMb,
    memTotalMb,
    uptimeStr,
  };
}

export default async function SistemSaglamligiPage() {
  await requirePlatformAdmin();
  const m = await getHealthMetrics();

  const dbHealth = m.dbLatency < 100 ? "yaxşı" : m.dbLatency < 500 ? "orta" : "yavaş";
  const dbTone = m.dbLatency < 100 ? "text-success" : m.dbLatency < 500 ? "text-warning" : "text-danger";

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Sistem sağlamlığı</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          DB latentlik, sessiya, yaddaş, son 24 saatın xətaları.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <HealthCard icon={Database} label="DB latency" value={`${m.dbLatency}ms`} sub={dbHealth} tone={dbTone} />
        <HealthCard icon={Users} label="Aktiv sessiya" value={String(m.activeSessions)} sub="canlı user" />
        <HealthCard icon={Activity} label="Audit (24s)" value={String(m.last24Audits)} sub="əməliyyat" />
        <HealthCard
          icon={AlertTriangle}
          label="Xəta dərəcəsi"
          value={`${m.errorRate.toFixed(1)}%`}
          sub={`${m.errorAudits} xəta`}
          tone={m.errorRate > 5 ? "text-danger" : m.errorRate > 1 ? "text-warning" : "text-success"}
        />
        <HealthCard icon={HardDrive} label="Yaddaş" value={`${m.memMb} MB`} sub={`/ ${m.memTotalMb} MB`} />
        <HealthCard icon={Zap} label="Uptime" value={m.uptimeStr} sub="prosess" />
      </div>

      <Card className="glass">
        <CardContent className="space-y-3 py-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Son fatal xətalar (24 saat)</h2>
            <Badge variant={m.errorAudits > 0 ? "destructive" : "outline"}>{m.errorAudits}</Badge>
          </div>
          {m.recentErrors.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Xəta yoxdur. Hər şey yaxşıdır.</p>
          ) : (
            <div className="divide-y divide-border/40">
              {m.recentErrors.map((e) => (
                <div key={String(e.id)} className="py-2 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="destructive" className="text-[10px]">{e.status}</Badge>
                        <span className="font-medium">{e.emeliyyat}</span>
                        <span className="text-xs text-muted-foreground">{e.resurs_nov}</span>
                      </div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {e.sahibkarlar?.ad ?? "—"} · {e.istifadeci_ad ?? "sistem"}
                      </div>
                      {e.sebeb && <div className="mt-0.5 line-clamp-2 text-xs text-danger/80">{e.sebeb}</div>}
                    </div>
                    <div className="whitespace-nowrap text-[10.5px] text-muted-foreground tabular-nums">
                      {formatDate(e.yaradildi, { dateStyle: "short", timeStyle: "short" })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="glass">
        <CardContent className="py-4 text-sm">
          <h2 className="mb-2 font-semibold">Tenant ümumi</h2>
          <p className="text-muted-foreground">
            Cəmi tenant: <span className="font-semibold text-foreground tabular-nums">{m.tenantSayi}</span>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function HealthCard({
  icon: Icon,
  label,
  value,
  sub,
  tone = "text-foreground",
}: {
  icon: typeof Activity;
  label: string;
  value: string;
  sub: string;
  tone?: string;
}) {
  return (
    <Card className="glass">
      <CardContent className="py-3">
        <div className="flex items-center gap-1.5 text-[10.5px] uppercase tracking-wider text-muted-foreground">
          <Icon className="h-3 w-3" /> {label}
        </div>
        <div className={`mt-1 text-xl font-bold tabular-nums ${tone}`}>{value}</div>
        <div className="text-[10.5px] text-muted-foreground">{sub}</div>
      </CardContent>
    </Card>
  );
}
