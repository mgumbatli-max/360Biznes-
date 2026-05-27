import type { Metadata } from "next";
import Link from "next/link";
import {
  History,
  Search,
  Activity,
  Plus,
  Trash2,
  AlertTriangle,
  Moon,
  Download,
  ClipboardList,
  Ban,
  Clock,
} from "lucide-react";
import { BackButton } from "@/components/ui/back-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import { KpiCard } from "@/features/dashboard/components/kpi-card";
import { AutoRefresh } from "@/features/audit-log/components/auto-refresh";
import { SettingsTopNav } from "@/features/ayar/components/settings-top-nav";
import { cn } from "@/lib/utils";
import {
  getAuditLog,
  getAuditStats,
  getTopUsers,
  getTopEntities,
  getAnomalies,
  type AuditFilter,
} from "@/features/audit-log/queries";
import {
  getBlockedIps,
  getRecentFailedLogins,
  getLoginRules,
} from "@/features/audit-log/security-queries";
import { getIstifadeciList } from "@/features/ayar/queries";
import { IpBlockManager } from "@/features/audit-log/components/ip-block-manager";
import { LoginHoursManager } from "@/features/audit-log/components/login-hours-manager";
import { AuditDetailModal, AuditRowLink } from "@/features/audit-log/components/audit-detail-modal";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Audit log & Təhlükəsizlik" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

const AUDIT_TABS = [
  { key: "log", label: "Log", icon: ClipboardList },
  { key: "ip", label: "IP bloklamaları", icon: Ban },
  { key: "giris", label: "Giriş saatları", icon: Clock },
] as const;

const NOV_TONES: Record<string, string> = {
  YARAT: "bg-success/15 text-success",
  YENILE: "bg-info/15 text-info",
  SIL: "bg-danger/15 text-danger",
  GIRIS: "bg-primary/15 text-primary-light",
  TESDIQLENDI: "bg-success/15 text-success",
  STATUS_DEYISDI: "bg-warning/15 text-warning",
};

type SearchParams = AuditFilter & { page?: string; sub?: string };

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const sub = (sp.sub ?? "log") as (typeof AUDIT_TABS)[number]["key"];
  const filter: AuditFilter = {
    q: sp.q,
    emeliyyat: sp.emeliyyat,
    resurs_nov: sp.resurs_nov,
    status: sp.status,
    istifadeci_id: sp.istifadeci_id,
    from: sp.from,
    to: sp.to,
  };

  const [{ items, total }, stats, topUsers, topEntities, anomalies] = await Promise.all([
    getAuditLog(filter, page, PAGE_SIZE),
    getAuditStats(),
    getTopUsers(5),
    getTopEntities(5),
    getAnomalies(),
  ]);

  // CSV export URL
  const csvParams = new URLSearchParams();
  Object.entries({ ...filter, format: "csv" }).forEach(([k, v]) => {
    if (v) csvParams.set(k, String(v));
  });

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <BackButton fallback="/ayarlar" label="Tənzimləmələr" />

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Audit log & Təhlükəsizlik</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Bütün dəyişikliklər izlənilir. {total} qeyd.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <AutoRefresh />
          <a
            href={`/api/audit-log/export?${csvParams.toString()}`}
            className="inline-flex h-8 items-center gap-1 rounded-md border border-border px-3 text-xs font-medium hover:bg-secondary"
          >
            <Download className="h-3 w-3" /> CSV
          </a>
        </div>
      </header>

      <SettingsTopNav />

      <nav className="flex flex-wrap gap-1 border-b border-border/40">
        {AUDIT_TABS.map((t) => {
          const Icon = t.icon;
          const active = sub === t.key;
          return (
            <Link
              key={t.key}
              href={`?sub=${t.key}`}
              scroll={false}
              className={cn(
                "inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition",
                active ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {t.label}
            </Link>
          );
        })}
      </nav>

      {sub === "ip" && <IpTabWrapper />}
      {sub === "giris" && <LoginHoursTabWrapper />}
      {sub === "log" && <LogTabContent
        stats={stats}
        anomalies={anomalies}
        topUsers={topUsers}
        topEntities={topEntities}
        items={items}
        total={total}
        page={page}
        sp={sp}
      />}

      <AuditDetailModal />
    </div>
  );
}

async function IpTabWrapper() {
  const [blocks, failed] = await Promise.all([getBlockedIps(), getRecentFailedLogins(24, 50)]);
  return <IpBlockManager blocks={blocks} failedLogins={failed} />;
}

async function LoginHoursTabWrapper() {
  const [rules, users] = await Promise.all([getLoginRules(), getIstifadeciList()]);
  return <LoginHoursManager rules={rules} users={users.map((u) => ({ id: u.id, ad_soyad: u.ad_soyad, email: u.email }))} />;
}

function LogTabContent({
  stats,
  anomalies,
  topUsers,
  topEntities,
  items,
  total,
  page,
  sp,
}: {
  stats: Awaited<ReturnType<typeof getAuditStats>>;
  anomalies: Awaited<ReturnType<typeof getAnomalies>>;
  topUsers: Awaited<ReturnType<typeof getTopUsers>>;
  topEntities: Awaited<ReturnType<typeof getTopEntities>>;
  items: Awaited<ReturnType<typeof getAuditLog>>["items"];
  total: number;
  page: number;
  sp: SearchParams;
}) {
  return (
    <div className="space-y-5">

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <KpiCard icon={Activity} label="Son 24 saat" value={String(stats.total_24h)} subline="Cəm" />
        <KpiCard icon={Plus} label="Yaratma" value={String(stats.yarat_24h)} subline="24 saat" tone="success" />
        <KpiCard icon={Trash2} label="Silmə" value={String(stats.silme_24h)} subline="24 saat" tone={stats.silme_24h > 10 ? "warning" : "neutral"} />
        <KpiCard icon={AlertTriangle} label="Xəta" value={String(stats.xeta_24h)} subline="24 saat" tone={stats.xeta_24h > 0 ? "danger" : "neutral"} />
        <KpiCard icon={Moon} label="Gecə (00-06)" value={String(stats.gece_24h)} subline="24 saat" tone={stats.gece_24h > 0 ? "warning" : "neutral"} />
      </section>

      {anomalies.length > 0 && (
        <Card className="glass border-warning/40">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base text-warning">
              <AlertTriangle className="h-4 w-4" /> Anomali alertlər
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {anomalies.map((a) => (
              <div key={a.kind} className="flex items-center justify-between gap-2 text-sm">
                <span>{a.message}</span>
                <Badge variant="outline" className="border-warning/30 text-warning">{a.sayi}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <Card className="glass">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">
              Top istifadəçilər (7 gün)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {topUsers.length === 0 ? (
              <div className="text-xs text-muted-foreground">Məlumat yoxdur</div>
            ) : (
              topUsers.map((u, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span className="truncate">
                    <span className="text-muted-foreground">{i + 1}.</span> {u.istifadeci_ad}
                  </span>
                  <Badge variant="secondary" className="text-[10px]">{u.sayi}</Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="glass">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">
              Top resurslar (7 gün)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {topEntities.length === 0 ? (
              <div className="text-xs text-muted-foreground">Məlumat yoxdur</div>
            ) : (
              topEntities.map((e, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span className="font-mono text-xs">
                    <span className="text-muted-foreground">{i + 1}.</span> {e.resurs_nov}
                  </span>
                  <Badge variant="secondary" className="text-[10px]">{e.sayi}</Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="glass">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">
              Status (24s)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5 text-sm">
            <div className="flex items-center justify-between">
              <span>Uğurlu</span>
              <Badge variant="outline" className="border-success/30 text-success">
                {stats.total_24h - stats.xeta_24h}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span>Xətalı</span>
              <Badge variant="outline" className="border-danger/30 text-danger">{stats.xeta_24h}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span>Gecə</span>
              <Badge variant="outline" className="border-warning/30 text-warning">{stats.gece_24h}</Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      <form className="space-y-2 rounded-xl border border-border bg-card/40 p-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Sürətli tarix:</span>
          <DatePreset label="Bu gün" days={0} />
          <DatePreset label="Son 7 gün" days={7} />
          <DatePreset label="Son 30 gün" days={30} />
          <DatePreset label="Son 90 gün" days={90} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input name="q" defaultValue={sp.q ?? ""} placeholder="İstifadəçi, resurs, IP, URL..." className="h-9 pl-8" />
        </div>
        <select
          name="emeliyyat"
          defaultValue={sp.emeliyyat ?? ""}
          className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
        >
          <option value="">Bütün əməliyyatlar</option>
          <option value="YARAT">YARAT</option>
          <option value="YENILE">YENILE</option>
          <option value="SIL">SIL</option>
          <option value="GIRIS">GIRIS</option>
          <option value="TESDIQLENDI">TESDIQLENDI</option>
          <option value="STATUS_DEYISDI">STATUS_DEYISDI</option>
        </select>
        <select
          name="status"
          defaultValue={sp.status ?? ""}
          className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
        >
          <option value="">Hər status</option>
          <option value="ugur">Uğurlu</option>
          <option value="xeta">Xəta</option>
          <option value="legv">Ləğv</option>
        </select>
        <Input name="from" type="date" defaultValue={sp.from ?? ""} className="h-9 w-[140px]" />
        <Input name="to" type="date" defaultValue={sp.to ?? ""} className="h-9 w-[140px]" />
        <button type="submit" className="rounded-md bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground hover:bg-primary/90">
          Süz
        </button>
        <Link
          href="/audit-log"
          className="rounded-md border border-border bg-secondary px-3 py-1.5 text-xs font-medium hover:bg-secondary/70"
        >
          Sıfırla
        </Link>
        </div>
      </form>

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
          <History className="mb-2 h-8 w-8 text-muted-foreground/50" />
          <h3 className="font-semibold">Qeyd yoxdur</h3>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card/40">
          <table className="w-full text-sm">
            <thead className="border-b border-border/60 text-left text-[10.5px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-3 py-2.5">Vaxt</th>
                <th className="px-3 py-2.5">İstifadəçi</th>
                <th className="px-3 py-2.5">Əməliyyat</th>
                <th className="px-3 py-2.5">Status</th>
                <th className="px-3 py-2.5">Resurs</th>
                <th className="px-3 py-2.5">URL</th>
                <th className="px-3 py-2.5">IP</th>
              </tr>
            </thead>
            <tbody>
              {items.map((r) => (
                <AuditRowLink key={r.id.toString()} id={r.id.toString()}>
                  <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">
                    {r.yaradildi
                      ? formatDate(r.yaradildi, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
                      : "—"}
                  </td>
                  <td className="px-3 py-2 text-xs">{r.istifadeci_ad ?? "—"}</td>
                  <td className="px-3 py-2">
                    <Badge variant="outline" className={`text-[10px] ${NOV_TONES[r.emeliyyat] ?? ""}`}>
                      {r.emeliyyat}
                    </Badge>
                  </td>
                  <td className="px-3 py-2">
                    {r.status === "ugur" ? (
                      <Badge variant="outline" className="border-success/30 text-success text-[10px]">ugur</Badge>
                    ) : r.status ? (
                      <Badge variant="outline" className="border-danger/30 text-danger text-[10px]">{r.status}</Badge>
                    ) : (
                      <span className="text-[10px] text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {r.resurs_nov}
                    {r.resurs_id && <span className="ml-1 font-mono text-[10px]">{String(r.resurs_id).slice(0, 8)}…</span>}
                  </td>
                  <td className="px-3 py-2 font-mono text-[10.5px] text-muted-foreground">{r.url ?? "—"}</td>
                  <td className="px-3 py-2 font-mono text-[10.5px] text-muted-foreground">{r.ip_adres ?? "—"}</td>
                </AuditRowLink>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pagination total={total} pageSize={PAGE_SIZE} page={page} basePath="/audit-log" />
    </div>
  );
}

function DatePreset({ label, days }: { label: string; days: number }) {
  const now = new Date();
  const to = now.toISOString().slice(0, 10);
  const fromDate = new Date(now);
  fromDate.setDate(fromDate.getDate() - days);
  const from = fromDate.toISOString().slice(0, 10);

  return (
    <Link
      href={`/audit-log?from=${from}&to=${to}`}
      className="rounded-md bg-secondary px-2.5 py-1 text-[10.5px] font-semibold text-muted-foreground hover:bg-secondary/70 hover:text-foreground"
    >
      {label}
    </Link>
  );
}
