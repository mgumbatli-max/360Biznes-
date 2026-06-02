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
  Monitor,
  Smartphone,
  UserPlus,
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
import { getActiveDevices, getDeviceSummary } from "@/features/audit-log/active-devices-queries";
import { ActiveDevicesPanel } from "@/features/audit-log/components/active-devices-panel";
import { getIstifadeciList } from "@/features/ayar/queries";
import { IpBlockManager } from "@/features/audit-log/components/ip-block-manager";
import { LoginHoursManager } from "@/features/audit-log/components/login-hours-manager";
import { AuditDetailModal } from "@/features/audit-log/components/audit-detail-modal";
import { AuditFeedList } from "@/features/audit-log/components/audit-feed-list";
import { RESOURCE_LABEL, RESOURCE_MODULES } from "@/features/audit-log/labels";

export const metadata: Metadata = { title: "Audit log & Təhlükəsizlik" };

const PAGE_SIZE = 50;

const AUDIT_TABS = [
  { key: "log", label: "Log", icon: ClipboardList },
  { key: "cihazlar", label: "Aktiv cihazlar", icon: Monitor },
  { key: "ip", label: "IP bloklamaları", icon: Ban },
  { key: "giris", label: "Giriş saatları", icon: Clock },
] as const;


type SearchParams = AuditFilter & { page?: string; sub?: string; modul?: string };

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const sub = (sp.sub ?? "log") as (typeof AUDIT_TABS)[number]["key"];
  // Modul filter — modul kodu seçildikdə həmin modulun bütün resurs növlərini IN ilə süzür.
  const selectedModule = sp.modul ? RESOURCE_MODULES.find((m) => m.kod === sp.modul) : undefined;
  const filter: AuditFilter = {
    q: sp.q,
    emeliyyat: sp.emeliyyat,
    resurs_nov: sp.resurs_nov,
    resurs_nov_in: selectedModule?.resurs,
    status: sp.status,
    istifadeci_id: sp.istifadeci_id,
    from: sp.from,
    to: sp.to,
  };

  const [{ items, total }, stats, topUsers, topEntities, anomalies, deviceSummary] = await Promise.all([
    getAuditLog(filter, page, PAGE_SIZE),
    getAuditStats(),
    getTopUsers(5),
    getTopEntities(5),
    getAnomalies(),
    getDeviceSummary(24),
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
            Bütün dəyişikliklər izlənilir. {total.toLocaleString("az-AZ")} qeyd ·{" "}
            <span className="text-foreground/80">{deviceSummary.total_active_devices} aktiv cihaz</span>
            {deviceSummary.new_devices_24h > 0 && (
              <span className="ml-1 font-semibold text-amber-600">
                · 🆕 {deviceSummary.new_devices_24h} yeni
              </span>
            )}
            {deviceSummary.failed_logins_24h > 0 && (
              <span className="ml-1 font-semibold text-rose-600">
                · ⚠ {deviceSummary.failed_logins_24h} uğursuz cəhd (24s)
              </span>
            )}
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
          // Hər tab üçün badge sayı + ton (vacib məlumat ilkin baxışda görünsün)
          let badgeText: string | null = null;
          let badgeTone: "danger" | "warning" | "neutral" = "neutral";
          if (t.key === "cihazlar") {
            if (deviceSummary.new_devices_24h > 0) {
              badgeText = `${deviceSummary.new_devices_24h}🆕`;
              badgeTone = "danger";
            } else if (deviceSummary.total_active_devices > 0) {
              badgeText = String(deviceSummary.total_active_devices);
              badgeTone = "neutral";
            }
          } else if (t.key === "ip" && deviceSummary.blocked_ips > 0) {
            badgeText = String(deviceSummary.blocked_ips);
            badgeTone = "warning";
          } else if (t.key === "log" && deviceSummary.failed_logins_24h >= 3) {
            badgeText = String(deviceSummary.failed_logins_24h);
            badgeTone = "danger";
          }
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
              {badgeText && (
                <span
                  className={cn(
                    "ml-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none",
                    badgeTone === "danger" && "bg-rose-500/15 text-rose-600",
                    badgeTone === "warning" && "bg-amber-500/15 text-amber-600",
                    badgeTone === "neutral" && "bg-secondary text-muted-foreground",
                  )}
                >
                  {badgeText}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {sub === "ip" && <IpTabWrapper />}
      {sub === "giris" && <LoginHoursTabWrapper />}
      {sub === "cihazlar" && <DevicesTabWrapper />}
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

async function DevicesTabWrapper() {
  const [devices, summary] = await Promise.all([getActiveDevices(24), getDeviceSummary(24)]);
  return (
    <div className="space-y-5">
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        <KpiCard icon={Monitor} label="Aktiv cihaz" value={String(summary.total_active_devices)} subline="24 saat" tone="info" />
        <KpiCard icon={UserPlus} label="Aktiv istifadəçi" value={String(summary.total_active_users)} subline="24 saat" />
        <KpiCard
          icon={Smartphone}
          label="Çox cihazlı"
          value={String(summary.multi_device_users)}
          subline="2+ cihazda aktiv"
          tone={summary.multi_device_users > 0 ? "warning" : "neutral"}
        />
        <KpiCard
          icon={AlertTriangle}
          label="🆕 Yeni cihaz"
          value={String(summary.new_devices_24h)}
          subline="24 saat"
          tone={summary.new_devices_24h > 0 ? "danger" : "neutral"}
        />
        <KpiCard
          icon={Ban}
          label="Bloklanmış IP"
          value={String(summary.blocked_ips)}
          subline="aktiv blok"
          tone={summary.blocked_ips > 0 ? "warning" : "neutral"}
        />
        <KpiCard
          icon={AlertTriangle}
          label="Uğursuz giriş"
          value={String(summary.failed_logins_24h)}
          subline="24 saat"
          tone={summary.failed_logins_24h > 3 ? "danger" : "neutral"}
        />
      </section>

      <ActiveDevicesPanel devices={devices} />
    </div>
  );
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

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        <KpiCard icon={Activity} label="Son 24 saat" value={String(stats.total_24h)} subline="Cəm" />
        <KpiCard icon={Plus} label="Yaratma" value={String(stats.yarat_24h)} subline="24 saat" tone="success" />
        <KpiCard icon={Trash2} label="Silmə" value={String(stats.silme_24h)} subline="24 saat" tone={stats.silme_24h > 10 ? "warning" : "neutral"} />
        <KpiCard icon={AlertTriangle} label="Xəta" value={String(stats.xeta_24h)} subline="24 saat" tone={stats.xeta_24h > 0 ? "danger" : "neutral"} />
        <KpiCard icon={Moon} label="Gecə (00-06)" value={String(stats.gece_24h)} subline="24 saat" tone={stats.gece_24h > 0 ? "warning" : "neutral"} />
        <Link href="?sub=cihazlar" className="block">
          <KpiCard
            icon={Monitor}
            label="Aktiv cihazlar"
            value="→"
            subline="detaillarla bax"
            tone="info"
          />
        </Link>
      </section>

      {anomalies.length > 0 && (
        <Card className={cn(
          "glass",
          anomalies.some((a) => a.severity === "danger") ? "border-rose-500/60" : "border-warning/40",
        )}>
          <CardHeader className="pb-2">
            <CardTitle className={cn(
              "flex items-center gap-2 text-base",
              anomalies.some((a) => a.severity === "danger") ? "text-rose-600" : "text-warning",
            )}>
              <AlertTriangle className="h-4 w-4" />
              {anomalies.some((a) => a.severity === "danger") ? "🚨 Diqqət — risk hadisəsi" : "Anomali alertlər"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {anomalies.map((a) => {
              const isDanger = a.severity === "danger";
              const isWarning = a.severity === "warning";
              return (
                <div
                  key={a.kind}
                  className={cn(
                    "flex items-center justify-between gap-2 rounded-md border-l-4 px-3 py-2 text-sm",
                    isDanger && "border-rose-500 bg-rose-500/5",
                    isWarning && "border-amber-500 bg-amber-500/5",
                    !isDanger && !isWarning && "border-warning/40 bg-warning/5",
                  )}
                >
                  <span className={cn(isDanger && "font-medium text-foreground")}>{a.message}</span>
                  <Badge
                    variant="outline"
                    className={cn(
                      isDanger && "border-rose-500/40 bg-rose-500/10 text-rose-600",
                      isWarning && "border-amber-500/40 bg-amber-500/10 text-amber-600",
                      !isDanger && !isWarning && "border-warning/30 text-warning",
                    )}
                  >
                    {a.sayi}
                  </Badge>
                </div>
              );
            })}
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
                  <span className="truncate">
                    <span className="text-muted-foreground">{i + 1}.</span>{" "}
                    {RESOURCE_LABEL[e.resurs_nov] ?? e.resurs_nov}
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
          name="modul"
          defaultValue={sp.modul ?? ""}
          className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
        >
          <option value="">Bütün modullar</option>
          {RESOURCE_MODULES.map((m) => (
            <option key={m.kod} value={m.kod}>{m.ad}</option>
          ))}
        </select>
        <select
          name="emeliyyat"
          defaultValue={sp.emeliyyat ?? ""}
          className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
        >
          <option value="">Bütün əməliyyatlar</option>
          <optgroup label="Sənəd əməliyyatları">
            <option value="yarat">Yaratma</option>
            <option value="yenile">Yeniləmə</option>
            <option value="sil">Silmə</option>
            <option value="berpa">Bərpa</option>
          </optgroup>
          <optgroup label="Təsdiq mərkəzi">
            <option value="tesdiq">Təsdiq</option>
            <option value="redd">Rədd</option>
            <option value="legv">Ləğv</option>
          </optgroup>
          <optgroup label="Giriş / Çıxış">
            <option value="giris">Giriş</option>
            <option value="cixis">Çıxış</option>
            <option value="uğursuz_giris">Uğursuz giriş</option>
            <option value="pin_giris">PIN girişi</option>
            <option value="pin_lockout">PIN lockout</option>
            <option value="gizli_giris">Gizli koda giriş</option>
          </optgroup>
          <optgroup label="Import / Export">
            <option value="import">Import</option>
            <option value="export">Export</option>
          </optgroup>
          <optgroup label="Köhnə (UPPERCASE)">
            <option value="YARAT">YARAT (köhnə)</option>
            <option value="YENILE">YENILE (köhnə)</option>
            <option value="SIL">SIL (köhnə)</option>
            <option value="GIRIS">GIRIS (köhnə)</option>
          </optgroup>
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
        <AuditFeedList items={items} />
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
