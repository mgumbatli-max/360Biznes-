import type { Metadata } from "next";
import Link from "next/link";
import {
  Workflow, Zap, Power, AlertTriangle, Info, Radar, ShieldCheck, List, LayoutGrid, Search,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { KpiCard } from "@/features/dashboard/components/kpi-card";
import { RuleBuilder } from "@/features/avtomatlasdirma/components/rule-builder";
import { RuleCard } from "@/features/avtomatlasdirma/components/rule-card";
import { getRules, getRuleStats, getRecentLogs } from "@/features/avtomatlasdirma/queries";
import { MODULLAR, PRIORITY_META } from "@/features/avtomatlasdirma/catalog";
import { NezaretMerkeziTabs } from "@/features/nezaret-merkezi/components/tabs";
import { getNezaretBadges } from "@/features/nezaret-merkezi/counts";
import { formatDate, cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Avtomatlaşdırma Mərkəzi" };
export const dynamic = "force-dynamic";

type SP = {
  view?: string;
  modul?: string;
  status?: string;
  prioritet?: string;
  q?: string;
};

function filterRules<T extends {
  ad: string;
  modul: string | null;
  trigger_kod: string;
  prioritet: string | null;
  aktiv: boolean | null;
  tesvir: string | null;
}>(rules: T[], sp: SP): T[] {
  let r = rules;
  if (sp.modul) r = r.filter((x) => x.modul === sp.modul);
  if (sp.status === "aktiv") r = r.filter((x) => x.aktiv === true);
  if (sp.status === "deaktiv") r = r.filter((x) => x.aktiv === false);
  if (sp.prioritet) r = r.filter((x) => x.prioritet === sp.prioritet);
  if (sp.q) {
    const q = sp.q.toLowerCase();
    r = r.filter((x) => x.ad.toLowerCase().includes(q) || (x.tesvir ?? "").toLowerCase().includes(q));
  }
  return r;
}

function buildHref(sp: SP, override: Partial<SP>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...sp, ...override })) {
    if (v) p.set(k, String(v));
  }
  const qs = p.toString();
  return qs ? `/avtomatlasdirma?${qs}` : "/avtomatlasdirma";
}

export default async function AvtomatlasdirmaPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const view = sp.view === "list" ? "list" : "card";

  const [rules, stats, logs, tabBadges] = await Promise.all([
    getRules(),
    getRuleStats(),
    getRecentLogs(15),
    getNezaretBadges(),
  ]);

  const filtered = filterRules(rules, sp);

  // Module counts for filter chips
  const modulCounts = new Map<string, number>();
  for (const r of rules) {
    if (r.modul) modulCounts.set(r.modul, (modulCounts.get(r.modul) ?? 0) + 1);
  }

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <NezaretMerkeziTabs current="qaydalar" badges={tabBadges} />

      {/* Hero header */}
      <header className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 via-card to-violet-500/5 p-5 shadow-sm">
        <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-gradient-to-br from-primary to-violet-500 opacity-10 blur-3xl" />
        <div className="relative flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br from-primary to-violet-500 shadow-lg shadow-primary/20">
              <Workflow className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Avtomatlaşdırma Mərkəzi — Ağıllı nəzarət</h1>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                <strong className="text-foreground">ƏGƏR hadisə + şərt = avtomatik əməliyyat.</strong>{" "}
                Bu bölmə qaydaları <em>yaradır</em>. Xəbərdarlıqlar və Təsdiq Mərkəzi onların nəticələrini göstərir.
              </p>
            </div>
          </div>
          <RuleBuilder />
        </div>

        {/* Distinction banner */}
        <div className="relative mt-4 flex flex-wrap items-center gap-2 rounded-lg border border-border/40 bg-background/40 px-3 py-2 text-xs">
          <Info className="h-3.5 w-3.5 shrink-0 text-sky-500" />
          <span className="text-muted-foreground">3-lü ekosistem:</span>
          <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 font-semibold text-primary">
            <Workflow className="h-3 w-3" />
            Avtomatlaşdırma (qayda)
          </span>
          <span className="text-muted-foreground">→</span>
          <Link href="/xeberdarliqlar" className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 font-semibold text-amber-600 hover:bg-amber-500/15 dark:text-amber-400">
            <Radar className="h-3 w-3" />
            Xəbərdarlıq (risk)
          </Link>
          <span className="text-muted-foreground">+</span>
          <Link href="/tesdiq" className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 font-semibold text-emerald-600 hover:bg-emerald-500/15 dark:text-emerald-400">
            <ShieldCheck className="h-3 w-3" />
            Təsdiq (icazə)
          </Link>
        </div>
      </header>

      {/* KPI */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard icon={Workflow} label="Cəm qayda" value={String(stats.total)} subline={`${stats.aktiv} aktiv · ${stats.passiv} passiv`} />
        <KpiCard icon={Power} label="Aktiv" value={String(stats.aktiv)} subline="İşləyən qaydalar" tone="success" />
        <KpiCard icon={Zap} label="24 saat icra" value={String(stats.log24h)} subline="Trigger sayı" tone="info" />
        <KpiCard icon={AlertTriangle} label="24 saat xəta" value={String(stats.xeta24)} subline="Uğursuz icralar" tone={stats.xeta24 > 0 ? "danger" : "neutral"} />
      </section>

      {/* View toggle + filter */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex items-center gap-0.5 rounded-lg border border-border/60 bg-card/40 p-0.5">
          <Link
            href={buildHref(sp, { view: undefined })}
            className={cn(
              "inline-flex h-8 items-center gap-1 rounded-md px-2.5 text-xs font-medium",
              view === "card" ? "bg-foreground text-background" : "text-muted-foreground hover:bg-secondary/40 hover:text-foreground"
            )}
          >
            <LayoutGrid className="h-3 w-3" />
            <span className="hidden sm:inline">Kart</span>
          </Link>
          <Link
            href={buildHref(sp, { view: "list" })}
            className={cn(
              "inline-flex h-8 items-center gap-1 rounded-md px-2.5 text-xs font-medium",
              view === "list" ? "bg-foreground text-background" : "text-muted-foreground hover:bg-secondary/40 hover:text-foreground"
            )}
          >
            <List className="h-3 w-3" />
            <span className="hidden sm:inline">List</span>
          </Link>
        </div>
        <span className="text-xs text-muted-foreground">{filtered.length} / {rules.length} qayda</span>
      </div>

      {/* Filters */}
      <form className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card/40 px-3 py-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            name="q"
            defaultValue={sp.q ?? ""}
            placeholder="Qayda axtar..."
            className="h-9 w-full rounded-md border border-input bg-background pl-8 pr-3 text-sm"
          />
        </div>
        <select name="status" defaultValue={sp.status ?? ""} className="h-9 rounded-md border border-input bg-background px-2 text-sm">
          <option value="">Hər status</option>
          <option value="aktiv">Aktiv</option>
          <option value="deaktiv">Deaktiv</option>
        </select>
        <select name="modul" defaultValue={sp.modul ?? ""} className="h-9 rounded-md border border-input bg-background px-2 text-sm">
          <option value="">Hər modul</option>
          {Array.from(modulCounts.entries()).map(([m, c]) => (
            <option key={m} value={m}>{MODULLAR[m as keyof typeof MODULLAR]?.ad ?? m} ({c})</option>
          ))}
        </select>
        <select name="prioritet" defaultValue={sp.prioritet ?? ""} className="h-9 rounded-md border border-input bg-background px-2 text-sm">
          <option value="">Hər prioritet</option>
          <option value="kritik">Kritik</option>
          <option value="yuxsek">Yüksək</option>
          <option value="orta">Orta</option>
          <option value="asagi">Aşağı</option>
        </select>
        {sp.view && <input type="hidden" name="view" value={sp.view} />}
        <button type="submit" className="h-9 rounded-md bg-foreground px-3 text-xs font-bold text-background">Süz</button>
        {(sp.q || sp.modul || sp.status || sp.prioritet) && (
          <Link href={sp.view ? `/avtomatlasdirma?view=${sp.view}` : "/avtomatlasdirma"} className="h-9 inline-flex items-center rounded-md border border-border bg-card px-3 text-xs hover:bg-secondary">
            Təmizlə
          </Link>
        )}
      </form>

      {/* Rules */}
      {filtered.length === 0 ? (
        <Card className="glass">
          <CardContent className="py-16 text-center">
            <Workflow className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50" />
            <h3 className="font-semibold">{rules.length === 0 ? "Hələ qayda yoxdur" : "Filtrlərə uyğun qayda yoxdur"}</h3>
            <p className="mt-1 max-w-md mx-auto text-sm text-muted-foreground">
              {rules.length === 0
                ? 'Yuxarıda "Yeni qayda" düyməsi ilə ilk avtomatlaşdırmanı yaradın və ya hazır şablonlardan birini seçin.'
                : "Filtrləri dəyişin və ya təmizləyin."}
            </p>
          </CardContent>
        </Card>
      ) : view === "list" ? (
        <div className="space-y-1.5">
          {filtered.map((r) => <RuleCard key={r.id} rule={r} view="list" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((r) => <RuleCard key={r.id} rule={r} view="card" />)}
        </div>
      )}

      {/* Activity log */}
      {logs.length > 0 && (
        <Card className="glass">
          <CardContent className="p-0">
            <header className="border-b border-border/60 px-4 py-2.5">
              <h3 className="text-sm font-bold">Son icra aktivliyi</h3>
              <p className="text-[10.5px] text-muted-foreground">Son 15 icra — uğurlu və ya xətalı.</p>
            </header>
            <div className="divide-y divide-border/30">
              {logs.map((l) => (
                <div key={l.id.toString()} className="flex flex-wrap items-center gap-3 px-4 py-2 text-xs hover:bg-secondary/30">
                  <span className="shrink-0 w-32 truncate text-[10.5px] text-muted-foreground">
                    {l.yaradildi && formatDate(l.yaradildi, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-medium">
                    {l.avto_qayda ? (
                      <Link href={`/avtomatlasdirma/${l.qayda_id}`} className="hover:underline">{l.avto_qayda.ad}</Link>
                    ) : "—"}
                  </span>
                  <code className="shrink-0 rounded bg-secondary/60 px-1.5 font-mono text-[10px]">{l.trigger_kod}</code>
                  <Badge variant="outline" className={cn("shrink-0 text-[10px]",
                    l.status === "ok" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-500" : "border-rose-500/30 bg-rose-500/10 text-rose-500"
                  )}>
                    {l.status === "ok" ? "Uğurlu" : "Xəta"}
                  </Badge>
                  {l.xeta_metn && <span className="shrink-0 max-w-[20ch] truncate text-[10.5px] text-rose-500" title={l.xeta_metn}>{l.xeta_metn}</span>}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Priority legend (helper) */}
      <div className="rounded-lg border border-dashed border-border/40 bg-card/20 p-3 text-[10.5px]">
        <span className="font-bold uppercase tracking-wider text-muted-foreground">Prioritet izahı:</span>{" "}
        {(Object.entries(PRIORITY_META) as [keyof typeof PRIORITY_META, typeof PRIORITY_META[keyof typeof PRIORITY_META]][]).map(([k, m]) => (
          <Badge key={k} variant="outline" className={cn("ml-1 text-[9px]", m.cls)}>{m.ad}</Badge>
        ))}
      </div>
    </div>
  );
}
