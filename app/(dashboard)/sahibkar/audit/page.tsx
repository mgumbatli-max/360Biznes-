import type { Metadata } from "next";
import Link from "next/link";
import {
  History, User, Globe, Smartphone, Terminal, CheckCircle2, XCircle,
  Activity, Filter, Search, Calendar, ShieldAlert,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { requireSahibkarSession } from "@/lib/sahibkar/guard";
import { getDetailedAuditLog, getAuditFacets, type AuditFilter } from "@/features/sahibkar/queries";
import { formatDate, cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Audit log — Sahibkar" };
export const dynamic = "force-dynamic";

type SP = {
  q?: string;
  emeliyyat?: string;
  resurs_nov?: string;
  status?: string;
  from?: string;
  to?: string;
};

const STATUS_TONE: Record<string, { cls: string; icon: typeof CheckCircle2 }> = {
  ugur: { cls: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30", icon: CheckCircle2 },
  ugurlu: { cls: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30", icon: CheckCircle2 },
  ugursuz: { cls: "bg-rose-500/15 text-rose-500 border-rose-500/30", icon: XCircle },
  xeta: { cls: "bg-rose-500/15 text-rose-500 border-rose-500/30", icon: XCircle },
  xeberdarliq: { cls: "bg-amber-500/15 text-amber-500 border-amber-500/30", icon: ShieldAlert },
};

const EMELIYYAT_TONE: Record<string, string> = {
  insert: "bg-emerald-500/10 text-emerald-500 border-emerald-500/30",
  create: "bg-emerald-500/10 text-emerald-500 border-emerald-500/30",
  yarat: "bg-emerald-500/10 text-emerald-500 border-emerald-500/30",
  update: "bg-amber-500/10 text-amber-500 border-amber-500/30",
  yenile: "bg-amber-500/10 text-amber-500 border-amber-500/30",
  delete: "bg-rose-500/10 text-rose-500 border-rose-500/30",
  sil: "bg-rose-500/10 text-rose-500 border-rose-500/30",
  login: "bg-primary/10 text-primary border-primary/30",
  giris: "bg-primary/10 text-primary border-primary/30",
  gizli_giris: "bg-purple-500/15 text-purple-500 border-purple-500/40",
  logout: "bg-slate-500/10 text-slate-500 border-slate-500/30",
  pin_dey: "bg-violet-500/10 text-violet-500 border-violet-500/30",
};

function emeliyyatBadge(op: string): string {
  const k = op.toLowerCase();
  for (const [key, cls] of Object.entries(EMELIYYAT_TONE)) {
    if (k.includes(key)) return cls;
  }
  return "bg-secondary text-foreground border-border";
}

function jsonExcerpt(value: unknown): string | null {
  if (!value) return null;
  try {
    const s = JSON.stringify(value);
    return s.length > 280 ? s.slice(0, 280) + "…" : s;
  } catch {
    return null;
  }
}

export default async function SahibkarAuditPage({ searchParams }: { searchParams: Promise<SP> }) {
  await requireSahibkarSession();
  const sp = await searchParams;
  const filter: AuditFilter = {
    q: sp.q || undefined,
    emeliyyat: sp.emeliyyat || undefined,
    resurs_nov: sp.resurs_nov || undefined,
    status: sp.status || undefined,
    from: sp.from ? new Date(sp.from + "T00:00:00") : undefined,
    to: sp.to ? new Date(sp.to + "T23:59:59") : undefined,
    limit: 100,
  };

  const [rows, facets] = await Promise.all([
    getDetailedAuditLog(filter),
    getAuditFacets(),
  ]);

  const ugurCount = facets.status.find((s) => s.value === "ugur" || s.value === "ugurlu")?.count ?? 0;
  const xetaCount = rows.filter((r) => r.status === "xeta" || r.status === "ugursuz").length;

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-slate-500 to-zinc-700">
            <History className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">Audit log — detallı</h1>
              <Badge variant="outline" className="text-[10px]">{facets.total} total qeyd</Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Hər əməliyyat: kim, nə, nə vaxt, hardan, hansı brauzerdən. Dəyişiklik diff-i (köhnə vs yeni data).
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <KpiPill label="Uğurlu" value={ugurCount} icon={CheckCircle2} tone="emerald" />
          <KpiPill label="Xəta" value={xetaCount} icon={XCircle} tone="rose" />
          <KpiPill label="Göstərilir" value={rows.length} icon={Activity} tone="primary" />
        </div>
      </header>

      {/* Filters */}
      <Card className="glass">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Filter className="h-4 w-4 text-primary" />
            Filtr
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form method="get" className="grid grid-cols-1 gap-2 md:grid-cols-6">
            <div className="md:col-span-2">
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Axtarış</label>
              <div className="relative mt-1">
                <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <input name="q" defaultValue={sp.q ?? ""} placeholder="İstifadəçi, URL, səbəb..." className="h-9 w-full rounded-md border border-border bg-background pl-8 pr-2 text-sm" />
              </div>
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Əməliyyat</label>
              <select name="emeliyyat" defaultValue={sp.emeliyyat ?? ""} className="mt-1 h-9 w-full rounded-md border border-border bg-background px-2 text-sm">
                <option value="">Hamısı</option>
                {facets.emeliyyat.map((f) => (
                  <option key={f.value} value={f.value}>{f.value} ({f.count})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Resurs</label>
              <select name="resurs_nov" defaultValue={sp.resurs_nov ?? ""} className="mt-1 h-9 w-full rounded-md border border-border bg-background px-2 text-sm">
                <option value="">Hamısı</option>
                {facets.resurs_nov.map((f) => (
                  <option key={f.value} value={f.value}>{f.value} ({f.count})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Status</label>
              <select name="status" defaultValue={sp.status ?? ""} className="mt-1 h-9 w-full rounded-md border border-border bg-background px-2 text-sm">
                <option value="">Hamısı</option>
                {facets.status.map((f) => (
                  <option key={f.value} value={f.value}>{f.value} ({f.count})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Dövr</label>
              <div className="mt-1 flex items-center gap-1">
                <input type="date" name="from" defaultValue={sp.from ?? ""} className="h-9 w-full rounded-md border border-border bg-background px-2 text-xs" />
                <input type="date" name="to" defaultValue={sp.to ?? ""} className="h-9 w-full rounded-md border border-border bg-background px-2 text-xs" />
              </div>
            </div>
            <div className="md:col-span-6 flex items-center gap-2">
              <button type="submit" className="h-9 rounded-md bg-foreground px-4 text-xs font-bold text-background hover:bg-foreground/90">
                Tətbiq et
              </button>
              <Link href="/sahibkar/audit" className="h-9 inline-flex items-center rounded-md border border-border bg-card px-4 text-xs hover:bg-secondary">
                Təmizlə
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Timeline */}
      {rows.length === 0 ? (
        <Card className="glass">
          <CardContent className="py-16 text-center">
            <History className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">Bu filtrlərə uyğun qeyd yoxdur</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => {
            const status = STATUS_TONE[r.status ?? ""] ?? STATUS_TONE.ugur;
            const StatusIcon = status.icon;
            const opCls = emeliyyatBadge(r.emeliyyat);
            const oldData = jsonExcerpt(r.evvelki_data);
            const newData = jsonExcerpt(r.yeni_data);
            return (
              <Card key={r.id} className="glass">
                <CardContent className="space-y-2 py-3">
                  {/* Header line */}
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className={cn("text-[10px]", opCls)}>
                      {r.emeliyyat}
                    </Badge>
                    <span className="text-sm font-bold">{r.resurs_nov}</span>
                    {r.resurs_id && (
                      <code className="rounded bg-secondary/60 px-1.5 py-0.5 font-mono text-[10px]">{r.resurs_id}</code>
                    )}
                    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold", status.cls)}>
                      <StatusIcon className="h-2.5 w-2.5" />
                      {r.status ?? "—"}
                    </span>
                    <span className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      {r.tarix ? formatDate(r.tarix, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "—"}
                    </span>
                  </div>

                  {/* Sub-row: user + IP + browser + URL */}
                  <div className="grid grid-cols-1 gap-2 text-xs md:grid-cols-4">
                    <Meta icon={User} label={r.istifadeci_ad ?? "—"} />
                    <Meta icon={Globe} label={r.ip_adres ?? "—"} mono />
                    <Meta icon={Smartphone} label={[r.brauzer, r.os, r.cihaz].filter(Boolean).join(" · ") || "—"} />
                    {r.url && (
                      <Meta icon={Terminal} label={`${r.metod ?? "GET"} ${r.url}`} mono />
                    )}
                  </div>

                  {/* Reason */}
                  {r.sebeb && (
                    <div className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-1.5 text-xs">
                      <strong className="text-amber-500">Səbəb:</strong> {r.sebeb}
                    </div>
                  )}

                  {/* Diff: old vs new */}
                  {(oldData || newData) && (
                    <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                      {oldData && (
                        <div className="rounded-md border border-rose-500/20 bg-rose-500/5 px-3 py-1.5">
                          <div className="mb-1 text-[9px] font-bold uppercase tracking-wider text-rose-500">Əvvəlki</div>
                          <pre className="overflow-x-auto whitespace-pre-wrap break-all text-[10.5px] leading-tight">{oldData}</pre>
                        </div>
                      )}
                      {newData && (
                        <div className="rounded-md border border-emerald-500/20 bg-emerald-500/5 px-3 py-1.5">
                          <div className="mb-1 text-[9px] font-bold uppercase tracking-wider text-emerald-500">Yeni</div>
                          <pre className="overflow-x-auto whitespace-pre-wrap break-all text-[10.5px] leading-tight">{newData}</pre>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Meta({ icon: Icon, label, mono }: { icon: React.ComponentType<{ className?: string }>; label: string; mono?: boolean }) {
  return (
    <div className="inline-flex min-w-0 items-center gap-1.5 text-muted-foreground">
      <Icon className="h-3 w-3 shrink-0" />
      <span className={cn("truncate", mono && "font-mono")} title={label}>{label}</span>
    </div>
  );
}

function KpiPill({ label, value, icon: Icon, tone }: { label: string; value: number; icon: React.ComponentType<{ className?: string }>; tone: "emerald" | "rose" | "primary" }) {
  const cls = tone === "emerald" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-500" : tone === "rose" ? "border-rose-500/30 bg-rose-500/10 text-rose-500" : "border-primary/30 bg-primary/10 text-primary";
  return (
    <div className={`inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 ${cls}`}>
      <Icon className="h-3.5 w-3.5" />
      <div>
        <div className="text-base font-bold leading-none tabular-nums">{value}</div>
        <div className="text-[9px] uppercase tracking-wider opacity-75">{label}</div>
      </div>
    </div>
  );
}
