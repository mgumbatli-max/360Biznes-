import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  History, Workflow, ShieldCheck, Radar, Filter, Search, CheckCircle2, XCircle,
  ChevronRight, User, Calendar,
} from "lucide-react";
import { auth } from "@/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { NezaretMerkeziTabs } from "@/features/nezaret-merkezi/components/tabs";
import { getNezaretBadges } from "@/features/nezaret-merkezi/counts";
import { getUnifiedLog } from "@/features/nezaret-merkezi/log-queries";
import { getRequestPermissions } from "@/lib/auth/get-permissions";
import { formatDate, cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Nəzarət Mərkəzi — Loglar" };

type SP = {
  source?: string;
  status?: string;
  q?: string;
};

const SOURCE_META = {
  automation: { label: "Avtomatlaşdırma", icon: Workflow, cls: "border-violet-500/30 bg-violet-500/10 text-violet-500" },
  approval:   { label: "Təsdiq",          icon: ShieldCheck, cls: "border-emerald-500/30 bg-emerald-500/10 text-emerald-500" },
  alert:      { label: "Xəbərdarlıq",     icon: Radar,       cls: "border-amber-500/30 bg-amber-500/10 text-amber-500" },
} as const;

const BADGE_TONE = {
  primary: "border-primary/30 bg-primary/10 text-primary",
  amber:   "border-amber-500/30 bg-amber-500/10 text-amber-500",
  emerald: "border-emerald-500/30 bg-emerald-500/10 text-emerald-500",
  rose:    "border-rose-500/30 bg-rose-500/10 text-rose-500",
  neutral: "border-border bg-secondary/40 text-muted-foreground",
};

export default async function NezaretLoglarPage({ searchParams }: { searchParams: Promise<SP> }) {
  const session = await auth();
  if (!session?.user) return null;
  const icazeler = await getRequestPermissions();
  const rolAd = (session.user.rol_ad ?? "").toLowerCase();
  const isOwnerOrAdmin =
    rolAd.includes("sahibkar") || rolAd.includes("owner") || rolAd.includes("admin");
  if (!isOwnerOrAdmin && (!icazeler.includes("nezaret.oxu") || !icazeler.includes("nezaret.loglar"))) {
    redirect("/tapshiriqlar");
  }

  const sp = await searchParams;
  const [badges, entries] = await Promise.all([
    getNezaretBadges(),
    getUnifiedLog({
      source: (sp.source === "automation" || sp.source === "approval" || sp.source === "alert") ? sp.source : undefined,
      status: (sp.status === "ok" || sp.status === "xeta") ? sp.status : undefined,
      q: sp.q,
      limit: 100,
    }),
  ]);

  const errorCount = entries.filter((e) => e.status === "xeta").length;
  const okCount = entries.filter((e) => e.status === "ok").length;

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      {/* Header */}
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-gradient-to-br from-slate-500 to-zinc-700">
            <History className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Loglar / Tarixçə</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Bütün avtomatik icra, təsdiq və xəbərdarlıq hadisələri tək yerdə.
            </p>
          </div>
        </div>
      </header>

      <NezaretMerkeziTabs current="loglar" badges={badges} />

      {/* Stats */}
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Cəmi" value={entries.length} icon={History} tone="primary" />
        <Stat label="Uğurlu" value={okCount} icon={CheckCircle2} tone="emerald" />
        <Stat label="Xəta" value={errorCount} icon={XCircle} tone={errorCount > 0 ? "rose" : "neutral"} />
        <Stat label="Filter aktiv" value={(sp.source ? 1 : 0) + (sp.status ? 1 : 0) + (sp.q ? 1 : 0)} icon={Filter} tone="neutral" />
      </section>

      {/* Filters */}
      <form className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card/40 px-3 py-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            name="q"
            defaultValue={sp.q ?? ""}
            placeholder="Başlıq, istifadəçi və ya detal..."
            className="h-9 w-full rounded-md border border-input bg-background pl-8 pr-3 text-sm"
          />
        </div>
        <select name="source" defaultValue={sp.source ?? ""} className="h-9 rounded-md border border-input bg-background px-2 text-sm">
          <option value="">Hər mənbə</option>
          <option value="automation">Avtomatlaşdırma</option>
          <option value="approval">Təsdiq</option>
          <option value="alert">Xəbərdarlıq</option>
        </select>
        <select name="status" defaultValue={sp.status ?? ""} className="h-9 rounded-md border border-input bg-background px-2 text-sm">
          <option value="">Hər status</option>
          <option value="ok">Uğurlu</option>
          <option value="xeta">Xəta</option>
        </select>
        <button type="submit" className="h-9 rounded-md bg-foreground px-3 text-xs font-bold text-background">
          <Filter className="mr-1 inline h-3 w-3" />
          Süz
        </button>
        {(sp.q || sp.source || sp.status) && (
          <Link href="/nezaret-merkezi/loglar" className="h-9 inline-flex items-center rounded-md border border-border bg-card px-3 text-xs hover:bg-secondary">
            Təmizlə
          </Link>
        )}
      </form>

      {/* Log entries */}
      {entries.length === 0 ? (
        <Card className="glass">
          <CardContent className="py-16 text-center">
            <History className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50" />
            <h3 className="font-semibold">Bu filtrlərə uyğun log yoxdur</h3>
            <p className="mt-1 max-w-md mx-auto text-sm text-muted-foreground">
              Filtrləri dəyişin və ya təmizləyin. Aktiv qaydalar işə düşdükdə loglar burada görünəcək.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="glass">
          <CardContent className="p-0">
            <ul className="divide-y divide-border/30">
              {entries.map((e) => {
                const sourceMeta = SOURCE_META[e.source];
                const SourceIcon = sourceMeta.icon;
                return (
                  <li key={e.id}>
                    <Link href={e.link} className="block px-4 py-3 transition hover:bg-secondary/30">
                      <div className="flex items-start gap-3">
                        {/* Source icon */}
                        <div className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-lg border", sourceMeta.cls)}>
                          <SourceIcon className="h-4 w-4" />
                        </div>

                        {/* Body */}
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-sm font-semibold">{e.title}</span>
                            {e.badges.map((b, i) => (
                              <Badge key={i} variant="outline" className={cn("text-[9px]", BADGE_TONE[b.tone])}>
                                {b.label}
                              </Badge>
                            ))}
                          </div>
                          {e.detail && (
                            <p className="mt-0.5 line-clamp-1 text-[11px] text-muted-foreground">
                              {e.detail}
                            </p>
                          )}
                          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10.5px] text-muted-foreground">
                            {e.user && (
                              <span className="inline-flex items-center gap-0.5">
                                <User className="h-2.5 w-2.5" />
                                {e.user}
                              </span>
                            )}
                            {e.timestamp && (
                              <span className="inline-flex items-center gap-0.5">
                                <Calendar className="h-2.5 w-2.5" />
                                {formatDate(e.timestamp, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                              </span>
                            )}
                          </div>
                        </div>

                        <ChevronRight className="mt-2 h-4 w-4 shrink-0 text-muted-foreground" />
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Stat({ label, value, icon: Icon, tone }: {
  label: string; value: number; icon: React.ComponentType<{ className?: string }>;
  tone: "primary" | "emerald" | "rose" | "neutral";
}) {
  const cls = {
    primary: "border-primary/30 bg-primary/5 text-primary",
    emerald: "border-emerald-500/30 bg-emerald-500/5 text-emerald-500",
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
    </div>
  );
}
