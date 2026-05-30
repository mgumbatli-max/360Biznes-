import type { Metadata } from "next";
import Link from "next/link";
import {
  CheckCircle2, Clock, X, AlertTriangle, ChevronRight, Settings, BarChart3,
  Filter, Search, ShieldCheck, User, Receipt, Tag, RotateCcw, Trash2, CreditCard,
  Boxes, Percent, DollarSign, Info, Radar,
  ShoppingCart, Package, ArrowLeftRight,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { KpiCard } from "@/features/dashboard/components/kpi-card";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { formatDate, formatMoney, cn } from "@/lib/utils";
import { ApprovalActions } from "@/features/tesdiq/components/approval-actions";
import { BulkBar } from "@/features/tesdiq/components/bulk-bar";
import { requireTenant } from "@/lib/db/tenant-context";
import { NezaretMerkeziTabs } from "@/features/nezaret-merkezi/components/tabs";
import { getNezaretBadges } from "@/features/nezaret-merkezi/counts";

export const metadata: Metadata = { title: "Təsdiq Mərkəzi" };

const STATUS: Record<string, { label: string; cls: string; icon: typeof CheckCircle2 }> = {
  gozleyir: { label: "Gözləyir", cls: "bg-amber-500/15 text-amber-500 border-amber-500/30", icon: Clock },
  tesdiq:   { label: "Təsdiq",   cls: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30", icon: CheckCircle2 },
  red:      { label: "Rədd",     cls: "bg-rose-500/15 text-rose-500 border-rose-500/30", icon: X },
  legv:     { label: "Ləğv",     cls: "bg-secondary text-muted-foreground border-border", icon: X },
};

const PRIORITY_CLS: Record<string, string> = {
  kritik: "bg-rose-500 text-white border-rose-600",
  yuxsek: "bg-rose-500/15 text-rose-500 border-rose-500/30",
  orta:   "bg-amber-500/15 text-amber-500 border-amber-500/30",
  asagi:  "bg-secondary text-muted-foreground border-border",
};

type TypeMeta = { label: string; icon: typeof Tag; color: string; group: "sened" | "qiymet" | "anbar" | "maliyye" | "diger" };

const TYPE_META: Record<string, TypeMeta> = {
  // ── Sənəd təsdiqi (4-eyes) — yeni kateqoriya ─────────────────
  alis_qaime:         { label: "Alış qaiməsi",       icon: ShoppingCart,  color: "text-emerald-500", group: "sened" },
  satis_qaime:        { label: "Satış qaiməsi",      icon: Receipt,       color: "text-primary",     group: "sened" },
  mehsul_yaratma:     { label: "Məhsul kartı",       icon: Package,       color: "text-violet-500",  group: "sened" },
  ticaret_emeliyyat:  { label: "Ticarət əməliyyat",  icon: ArrowLeftRight,color: "text-sky-500",     group: "sened" },
  // ── Qiymət/endirim ──────────────────────────────────────────
  endirim:            { label: "Endirim",             icon: Percent,       color: "text-amber-500",   group: "qiymet" },
  qiymet_deyisdi:     { label: "Qiymət dəyişdi",      icon: Tag,           color: "text-violet-500",  group: "qiymet" },
  maya_alti:          { label: "Maya altı",           icon: AlertTriangle, color: "text-rose-500",    group: "qiymet" },
  // ── Anbar ───────────────────────────────────────────────────
  qaytarma:           { label: "Qaytarma",            icon: RotateCcw,     color: "text-amber-500",   group: "anbar" },
  stok_duzelis:       { label: "Stok düzəliş",        icon: Boxes,         color: "text-cyan-500",    group: "anbar" },
  silme:              { label: "Silmə",               icon: Trash2,        color: "text-rose-500",    group: "anbar" },
  // ── Maliyyə ─────────────────────────────────────────────────
  borc_limit:         { label: "Borc limiti",         icon: CreditCard,    color: "text-sky-500",     group: "maliyye" },
  xerc:               { label: "Xərc",                icon: DollarSign,    color: "text-orange-500",  group: "maliyye" },
  // ── Digər ───────────────────────────────────────────────────
  diger:              { label: "Digər",               icon: Tag,           color: "text-muted-foreground", group: "diger" },
};

const GROUP_META: Record<TypeMeta["group"], { label: string; icon: typeof Tag; cls: string }> = {
  sened:   { label: "Sənəd təsdiqi",     icon: Receipt,    cls: "border-primary/30 bg-primary/5" },
  qiymet:  { label: "Qiymət / endirim",  icon: Percent,    cls: "border-amber-500/30 bg-amber-500/5" },
  anbar:   { label: "Anbar",             icon: Boxes,      cls: "border-cyan-500/30 bg-cyan-500/5" },
  maliyye: { label: "Maliyyə",           icon: DollarSign, cls: "border-orange-500/30 bg-orange-500/5" },
  diger:   { label: "Digər",             icon: Tag,        cls: "border-border bg-secondary/30" },
};

type SP = { tab?: string; tip?: string; prioritet?: string; q?: string };

type TabKey = "gozleyen" | "menim" | "cavablanmis" | "hamisi";
const TABS: { key: TabKey; label: string; icon: typeof Clock }[] = [
  { key: "gozleyen", label: "Gözləyən", icon: Clock },
  { key: "menim", label: "Mənim sorğularım", icon: User },
  { key: "cavablanmis", label: "Cavablanmış", icon: CheckCircle2 },
  { key: "hamisi", label: "Hamısı", icon: Receipt },
];

async function getApprovals(sp: SP, tab: TabKey) {
  return withTenant(async () => {
    const { istifadeciId } = requireTenant();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};

    if (tab === "gozleyen") where.status = "gozleyir";
    else if (tab === "menim") where.yaradan_id = istifadeciId;
    else if (tab === "cavablanmis") where.status = { in: ["tesdiq", "red"] };

    if (sp.tip) where.emeliyyat_nov = sp.tip;
    if (sp.prioritet) where.prioritet = sp.prioritet;
    if (sp.q) {
      where.OR = [
        { basliq: { contains: sp.q, mode: "insensitive" } },
        { risk_sebeb: { contains: sp.q, mode: "insensitive" } },
        { resurs_nov: { contains: sp.q, mode: "insensitive" } },
      ];
    }

    return prisma.tesdiq_telep.findMany({
      where,
      orderBy: [{ status: "asc" }, { prioritet: "desc" }, { yaradildi: "desc" }],
      take: 200,
    });
  });
}

async function getStats() {
  return withTenant(async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const [gozleyen, kritik, tesdiq_bugun, red_bugun, week_resp] = await Promise.all([
      prisma.tesdiq_telep.count({ where: { status: "gozleyir" } }),
      prisma.tesdiq_telep.count({ where: { status: "gozleyir", prioritet: { in: ["yuxsek", "kritik"] } } }),
      prisma.tesdiq_telep.count({ where: { status: "tesdiq", netice_tarix: { gte: today } } }),
      prisma.tesdiq_telep.count({ where: { status: "red", netice_tarix: { gte: today } } }),
      prisma.tesdiq_telep.findMany({
        where: { netice_tarix: { gte: weekAgo, not: null }, status: { in: ["tesdiq", "red"] } },
        select: { yaradildi: true, netice_tarix: true },
        take: 200,
      }),
    ]);

    // Avg response time in hours
    let totalMs = 0;
    let count = 0;
    for (const r of week_resp) {
      if (r.yaradildi && r.netice_tarix) {
        totalMs += r.netice_tarix.getTime() - r.yaradildi.getTime();
        count++;
      }
    }
    const avgHours = count > 0 ? totalMs / count / 3_600_000 : null;

    return { gozleyen, kritik, tesdiq_bugun, red_bugun, avgHours };
  });
}

async function getCategoryBreakdown(): Promise<Record<string, number>> {
  return withTenant(async () => {
    const rows = await prisma.tesdiq_telep.groupBy({
      by: ["emeliyyat_nov"],
      where: { status: "gozleyir" },
      _count: { _all: true },
    });
    const out: Record<string, number> = {};
    for (const r of rows) out[r.emeliyyat_nov] = r._count._all;
    return out;
  });
}

function buildHref(currentSp: SP, override: Partial<SP & { tab: string }>): string {
  const p = new URLSearchParams();
  const merged = { ...currentSp, ...override };
  for (const [k, v] of Object.entries(merged)) {
    if (v) p.set(k, String(v));
  }
  const qs = p.toString();
  return qs ? `/tesdiq?${qs}` : "/tesdiq";
}

export default async function TesdiqPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const tab = (sp.tab as TabKey) || "gozleyen";
  const validTab: TabKey = TABS.some((t) => t.key === tab) ? tab : "gozleyen";

  const [rows, stats, tabBadges, breakdown] = await Promise.all([
    getApprovals(sp, validTab),
    getStats(),
    getNezaretBadges(),
    getCategoryBreakdown(),
  ]);

  // Qrup bazlı yığ
  const groupedBreakdown = new Map<TypeMeta["group"], Array<{ key: string; count: number }>>();
  for (const [key, count] of Object.entries(breakdown)) {
    const meta = TYPE_META[key] ?? TYPE_META.diger;
    const arr = groupedBreakdown.get(meta.group) ?? [];
    arr.push({ key, count });
    groupedBreakdown.set(meta.group, arr);
  }

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <NezaretMerkeziTabs current="tesdiqler" badges={tabBadges} />

      <header className="relative overflow-hidden rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/5 via-card to-primary/5 p-5 shadow-sm">
        <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-gradient-to-br from-emerald-500 to-primary opacity-10 blur-3xl" />
        <div className="relative flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 shadow-lg shadow-emerald-500/20">
              <ShieldCheck className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Təsdiq mərkəzi — İcazə paneli</h1>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                Sahibkar/admin <span className="font-semibold text-foreground">icazəsi olmadan icra olunmayan</span> əməliyyatlar.
                Burada saxlanan tələblər təsdiq edilməyincə real data dəyişmir.
              </p>
            </div>
          </div>
          <SubNav />
        </div>

        {/* Difference banner — tells user this is NOT alerts */}
        <div className="relative mt-4 flex flex-wrap items-center gap-2 rounded-lg border border-border/40 bg-background/40 px-3 py-2 text-xs">
          <Info className="h-3.5 w-3.5 shrink-0 text-sky-500" />
          <span className="text-muted-foreground">
            Burada <strong className="text-emerald-600 dark:text-emerald-400">icazə tələb edən əməliyyatlar</strong> saxlanılır. Risk və problem üçün:
          </span>
          <Link
            href="/xeberdarliqlar"
            className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 font-semibold text-amber-600 hover:bg-amber-500/15 dark:text-amber-400"
          >
            <Radar className="h-3 w-3" />
            Xəbərdarlıq paneli
          </Link>
        </div>
      </header>

      {/* KPI strip — 5 cards in a clean row */}
      <section className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <KpiCard icon={Clock} label="Gözləyən" value={String(stats.gozleyen)} subline="Cavab tələb edir" tone={stats.gozleyen > 0 ? "warning" : "neutral"} />
        <KpiCard icon={AlertTriangle} label="Kritik" value={String(stats.kritik)} subline="Yüksək prioritet" tone={stats.kritik > 0 ? "danger" : "neutral"} />
        <KpiCard icon={CheckCircle2} label="Bu gün təsdiq" value={String(stats.tesdiq_bugun)} subline="Onaylandı" tone="success" />
        <KpiCard icon={X} label="Bu gün rədd" value={String(stats.red_bugun)} subline="İmtina" />
        <KpiCard
          icon={BarChart3}
          label="Cavab vaxtı"
          value={stats.avgHours != null ? `${stats.avgHours.toFixed(1)}s` : "—"}
          subline="Son 7 gün, ortalama"
        />
      </section>

      {/* Kateqoriya zolağı — qrup bazlı görmə */}
      {groupedBreakdown.size > 0 && (
        <section className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
              Gözləyən təsdiqlər — kateqoriya
            </h3>
            {sp.tip && (
              <Link
                href={buildHref(sp, { tip: undefined })}
                className="text-[10.5px] text-primary hover:underline"
              >
                Filtri sıfırla
              </Link>
            )}
          </div>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-4">
            {(["sened", "qiymet", "anbar", "maliyye"] as const).map((g) => {
              const items = groupedBreakdown.get(g) ?? [];
              if (items.length === 0) return null;
              const groupTotal = items.reduce((s, x) => s + x.count, 0);
              const groupMeta = GROUP_META[g];
              const GroupIcon = groupMeta.icon;
              return (
                <Card key={g} className={cn("glass", groupMeta.cls)}>
                  <CardContent className="space-y-2 py-3">
                    <div className="flex items-center gap-2">
                      <GroupIcon className="h-3.5 w-3.5 text-muted-foreground" />
                      <h4 className="text-xs font-bold">{groupMeta.label}</h4>
                      <span className="ml-auto text-[10.5px] tabular-nums text-muted-foreground">
                        {groupTotal} gözləyir
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {items
                        .sort((a, b) => b.count - a.count)
                        .map(({ key, count }) => {
                          const m = TYPE_META[key] ?? TYPE_META.diger;
                          const Icon = m.icon;
                          const active = sp.tip === key;
                          return (
                            <Link
                              key={key}
                              href={buildHref(sp, { tip: active ? undefined : key })}
                              className={cn(
                                "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[10.5px] font-medium transition",
                                active
                                  ? "border-primary bg-primary text-primary-foreground"
                                  : "border-border bg-card hover:border-primary/40 hover:bg-secondary/40",
                              )}
                            >
                              <Icon className={cn("h-3 w-3", !active && m.color)} />
                              {m.label}
                              <span
                                className={cn(
                                  "ml-0.5 rounded-full px-1 text-[9px] font-bold tabular-nums",
                                  active ? "bg-primary-foreground/20" : "bg-secondary",
                                )}
                              >
                                {count}
                              </span>
                            </Link>
                          );
                        })}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>
      )}

      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-1 rounded-lg border border-border/60 bg-card/40 p-1">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = t.key === validTab;
          const href = buildHref(sp, { tab: t.key === "gozleyen" ? undefined : t.key });
          return (
            <Link
              key={t.key}
              href={href}
              className={cn(
                "inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-sm font-medium transition",
                active ? "bg-foreground text-background" : "text-muted-foreground hover:bg-secondary/40 hover:text-foreground"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {t.label}
              <span className={cn("ml-1 rounded-full px-1.5 text-[10px] tabular-nums", active ? "bg-background/20" : "bg-secondary/60")}>
                {t.key === "gozleyen" ? stats.gozleyen : ""}
              </span>
            </Link>
          );
        })}
      </div>

      {/* Bulk action bar (sticky when items selected) */}
      <BulkBar />

      {/* Filters — single row */}
      <form className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card/40 px-3 py-2">
        {sp.tab && <input type="hidden" name="tab" value={sp.tab} />}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            name="q"
            defaultValue={sp.q ?? ""}
            placeholder="Axtar..."
            className="h-9 w-full rounded-md border border-input bg-background pl-8 pr-3 text-sm"
          />
        </div>
        <select name="tip" defaultValue={sp.tip ?? ""} className="h-9 rounded-md border border-input bg-background px-2 text-sm">
          <option value="">Hər tip</option>
          {Object.entries(TYPE_META).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
        <select name="prioritet" defaultValue={sp.prioritet ?? ""} className="h-9 rounded-md border border-input bg-background px-2 text-sm">
          <option value="">Hər prioritet</option>
          <option value="kritik">Kritik</option>
          <option value="yuxsek">Yüksək</option>
          <option value="orta">Orta</option>
          <option value="asagi">Aşağı</option>
        </select>
        <button type="submit" className="h-9 rounded-md bg-foreground px-3 text-xs font-bold text-background">
          <Filter className="mr-1 inline h-3 w-3" />
          Süz
        </button>
      </form>

      {/* List */}
      {rows.length === 0 ? (
        <Card className="glass">
          <CardContent className="py-16 text-center">
            <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50" />
            <h3 className="font-semibold">{validTab === "gozleyen" ? "Təsdiq tələbi yoxdur" : "Bu tabda nəticə yoxdur"}</h3>
            <p className="mt-1 max-w-md mx-auto text-sm text-muted-foreground">
              {validTab === "gozleyen"
                ? "Konfiqurə olunmuş təsdiq qaydaları işlədikdə tələblər burada görünəcək."
                : "Filtrləri dəyişin və ya başqa tab seçin."}
            </p>
            {validTab === "gozleyen" && (
              <Link href="/tesdiq/ayarlar" className="mt-3 inline-flex items-center gap-1 text-xs text-primary hover:underline">
                <Settings className="h-3 w-3" />
                Qaydaları tənzimlə
              </Link>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => {
            const s = STATUS[r.status ?? "gozleyir"] ?? STATUS.gozleyir;
            const StatusIcon = s.icon;
            const type = TYPE_META[r.emeliyyat_nov] ?? TYPE_META.diger;
            const TypeIcon = type.icon;
            const isPending = (r.status ?? "gozleyir") === "gozleyir";

            return (
              <Card key={r.id} className={cn("glass transition hover:border-primary/30", isPending && "border-l-4 border-l-amber-500")}>
                <CardContent className="flex flex-wrap items-start gap-3 py-3">
                  {/* Selection checkbox (only for pending) */}
                  {isPending && (
                    <label className="mt-1 inline-flex cursor-pointer items-center">
                      <input
                        type="checkbox"
                        data-tesdiq-id={r.id}
                        className="h-4 w-4 rounded border-border accent-primary"
                      />
                    </label>
                  )}

                  {/* Type icon */}
                  <div className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-secondary/50", type.color)}>
                    <TypeIcon className="h-5 w-5" />
                  </div>

                  {/* Body */}
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={`/tesdiq/${r.id}`} className="font-semibold hover:underline">
                        {r.basliq ?? type.label}
                      </Link>
                      <Badge variant="outline" className={cn("text-[10px]", s.cls)}>
                        <StatusIcon className="mr-1 h-2.5 w-2.5" />
                        {s.label}
                      </Badge>
                      <Badge variant="outline" className={cn("text-[10px]", PRIORITY_CLS[r.prioritet ?? "orta"] ?? "")}>
                        {r.prioritet}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
                      <span className="font-medium text-foreground">{type.label}</span>
                      {r.resurs_nov && <span>· {r.resurs_nov}</span>}
                      {r.mebleg != null && (
                        <span className="font-bold text-foreground">· {formatMoney(Number(r.mebleg))}</span>
                      )}
                      {r.yaradildi && <span>· {formatDate(r.yaradildi, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span>}
                    </div>
                    {r.risk_sebeb && (
                      <p className="line-clamp-2 rounded-md bg-amber-500/5 px-2 py-1 text-xs text-amber-700 dark:text-amber-300">
                        ⚠ {r.risk_sebeb}
                      </p>
                    )}
                    {r.netice_qeyd && !isPending && (
                      <p className="line-clamp-2 text-[11px] text-muted-foreground">
                        <strong>Cavab:</strong> {r.netice_qeyd}
                      </p>
                    )}
                  </div>

                  {/* Right column: actions or detail link */}
                  <div className="flex flex-col items-end gap-2">
                    {isPending ? (
                      <ApprovalActions id={r.id} />
                    ) : (
                      <Link href={`/tesdiq/${r.id}`} className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                        Detal <ChevronRight className="h-3 w-3" />
                      </Link>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SubNav() {
  return (
    <nav className="inline-flex items-center gap-1 rounded-lg border border-border/60 bg-card/40 p-0.5">
      <span className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary/15 px-2.5 text-xs font-semibold text-primary">
        <ShieldCheck className="h-3 w-3" />
        Mərkəz
      </span>
      <Link href="/tesdiq/statistika" className="inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium text-muted-foreground hover:bg-secondary/40 hover:text-foreground">
        <BarChart3 className="h-3 w-3" />
        Statistika
      </Link>
      <Link href="/tesdiq/ayarlar" className="inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium text-muted-foreground hover:bg-secondary/40 hover:text-foreground">
        <Settings className="h-3 w-3" />
        Ayarlar
      </Link>
    </nav>
  );
}
