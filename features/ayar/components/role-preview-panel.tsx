"use client";

import { useMemo } from "react";
import { Eye, EyeOff, Check, X, Sparkles, LayoutDashboard, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV_SECTIONS, canSeeNavItem, type NavItem } from "@/lib/navigation";

type Perm = { id: number; kod: string; ad: string };
type Group = { qrup: string; items: Perm[] };

type Props = {
  rolId: number;
  /** Cari seçilmiş icazə ID-ləri — matris dəyişəndə canlı yenilənmək üçün */
  selectedIds: Set<number>;
  /** Bütün icazələrin id→kod mapı (matrixdən gəlir) */
  groups: Group[];
};

/**
 * Sahibkara "bu rolla əməkdaş nə görəcək?" sualının canlı cavabını verir.
 * Üç qatlı preview:
 *   1. Sidebar elementləri
 *   2. Dashboard bölmələri (dashboard.* alt-icazələri)
 *   3. Əsas modul icazələri
 */
export function RolePreviewPanel({ rolId, selectedIds, groups }: Props) {
  // İd → kod mapı
  const idToKod = useMemo(() => {
    const m = new Map<number, string>();
    for (const g of groups) for (const i of g.items) m.set(i.id, i.kod);
    return m;
  }, [groups]);

  const kodlar = useMemo(() => {
    const arr: string[] = [];
    selectedIds.forEach((id) => {
      const k = idToKod.get(id);
      if (k) arr.push(k);
    });
    return arr;
  }, [selectedIds, idToKod]);

  // 1) Sidebar elementləri — rolId 9 (sahibkar) və 1 (admin) üçün xüsusi olur
  const sidebarItems = useMemo(() => {
    const allItems: { item: NavItem; section: string }[] = [];
    for (const sec of NAV_SECTIONS) {
      for (const it of sec.items) {
        allItems.push({ item: it, section: sec.label });
      }
    }
    return allItems.map(({ item, section }) => {
      const can = canSeeNavItem(item, { rolId, icazeler: kodlar });
      return { ...item, section, can };
    });
  }, [rolId, kodlar]);

  // 2) Dashboard bölmələri — dashboard.* alt-icazələri
  const DASHBOARD_SECTIONS: { kod: string; label: string; isMaster?: boolean }[] = [
    { kod: "dashboard.oxu", label: "Dashboard-a giriş", isMaster: true },
    { kod: "dashboard.insight", label: "Günün analitikası" },
    { kod: "dashboard.kpi", label: "Gəlir/xərc/mənfəət KPI" },
    { kod: "dashboard.cashflow", label: "Bu gün pul axını" },
    { kod: "dashboard.tapshiriq", label: "Mənim işim kartı" },
    { kod: "dashboard.aktivlik", label: "Son satış və hadisələr" },
    { kod: "dashboard.stok", label: "Aşağı stok paneli" },
    { kod: "dashboard.top5", label: "Top 5 reytinqlər" },
    { kod: "dashboard.alerts", label: "Diqqət lazımdır banner" },
    { kod: "dashboard.charts", label: "30 günlük qrafiklər" },
    { kod: "dashboard.feed", label: "Biznes feed" },
    { kod: "dashboard.sync", label: "Marketplace sync" },
  ];

  const dashboardOk = kodlar.includes("dashboard.oxu");
  const dashboardSections = DASHBOARD_SECTIONS.map((d) => ({
    ...d,
    can: kodlar.includes(d.kod),
  }));

  // 3) Əsas modul icazələri qruplandırma
  const moduleGroups = useMemo(() => {
    const map = new Map<string, { total: number; selected: number }>();
    for (const g of groups) {
      // Dashboard qrupu ayrı göstərilir
      if (g.qrup === "Dashboard") continue;
      const sel = g.items.filter((i) => selectedIds.has(i.id)).length;
      map.set(g.qrup, { total: g.items.length, selected: sel });
    }
    return Array.from(map.entries())
      .map(([qrup, v]) => ({ qrup, ...v }))
      .sort((a, b) => b.selected / Math.max(1, b.total) - a.selected / Math.max(1, a.total));
  }, [groups, selectedIds]);

  const visibleSidebar = sidebarItems.filter((s) => s.can);
  const hiddenSidebar = sidebarItems.filter((s) => !s.can);

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2.5 text-xs">
        <Sparkles className="mt-0.5 h-3.5 w-3.5 text-primary flex-shrink-0" />
        <div>
          <div className="font-semibold text-primary">Canlı önizləmə</div>
          <div className="text-muted-foreground">
            Aşağıda bu rola sahib əməkdaşın sistemdə görəcəyi və görməyəcəyi göstərilir. Yuxarıdakı matrisdə dəyişiklik etdikcə bura dərhal yenilənir (Saxla basana qədər yalnız önizləmədir).
          </div>
        </div>
      </div>

      {/* SIDEBAR */}
      <div className="rounded-xl border border-border bg-card/40 p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Eye className="h-3.5 w-3.5 text-emerald-500" />
            <h4 className="text-sm font-bold">Sidebar elementləri</h4>
          </div>
          <span className="text-[10.5px] text-muted-foreground">
            <b className="text-emerald-500">{visibleSidebar.length}</b> görünən
            <span className="mx-1.5 text-muted-foreground/40">·</span>
            <b className="text-rose-500">{hiddenSidebar.length}</b> gizli
          </span>
        </div>
        <div className="grid grid-cols-2 gap-1.5 md:grid-cols-3">
          {sidebarItems.map((s) => {
            const Icon = s.icon;
            return (
              <div
                key={s.href}
                className={cn(
                  "flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition",
                  s.can
                    ? "border border-emerald-500/30 bg-emerald-500/5 text-foreground"
                    : "border border-border bg-secondary/20 text-muted-foreground line-through decoration-rose-500/40",
                )}
              >
                <Icon className={cn("h-3 w-3 flex-shrink-0", s.can ? "text-emerald-500" : "text-muted-foreground/50")} />
                <span className="truncate">{s.label}</span>
                {s.can ? (
                  <Check className="ml-auto h-3 w-3 flex-shrink-0 text-emerald-500" />
                ) : (
                  <X className="ml-auto h-3 w-3 flex-shrink-0 text-rose-500/60" />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* DASHBOARD */}
      <div className={cn(
        "rounded-xl border p-4 transition",
        dashboardOk ? "border-border bg-card/40" : "border-rose-500/30 bg-rose-500/[0.03]",
      )}>
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <LayoutDashboard className={cn("h-3.5 w-3.5", dashboardOk ? "text-primary" : "text-rose-500")} />
            <h4 className="text-sm font-bold">Dashboard bölmələri</h4>
          </div>
          {dashboardOk ? (
            <span className="text-[10.5px] text-muted-foreground">
              <b className="text-emerald-500">{dashboardSections.filter((d) => d.can).length}/{dashboardSections.length}</b> bölmə açıq
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-2 py-0.5 text-[10px] font-semibold text-rose-500">
              <AlertCircle className="h-3 w-3" /> Dashboard bağlıdır
            </span>
          )}
        </div>

        {!dashboardOk && (
          <p className="mb-3 rounded-md bg-rose-500/5 px-2.5 py-1.5 text-[11px] text-rose-600 dark:text-rose-400">
            <strong>«Dashboard-a giriş»</strong> icazəsi yoxdur — bu rolda olan əməkdaş dashboard səhifəsini açmağa cəhd etsə, <code>/tapshiriqlar</code>-a yönləndirilir.
          </p>
        )}

        <div className="grid grid-cols-1 gap-1.5 md:grid-cols-2">
          {dashboardSections.map((d) => (
            <div
              key={d.kod}
              className={cn(
                "flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition",
                d.can
                  ? "border border-emerald-500/30 bg-emerald-500/5"
                  : "border border-border bg-secondary/20 opacity-70",
                d.isMaster && "font-semibold",
              )}
            >
              {d.can ? (
                <Check className="h-3 w-3 flex-shrink-0 text-emerald-500" />
              ) : (
                <X className="h-3 w-3 flex-shrink-0 text-muted-foreground" />
              )}
              <span className={cn("truncate", !d.can && "text-muted-foreground line-through decoration-rose-500/40")}>
                {d.label}
              </span>
              {d.isMaster && (
                <span className="ml-auto rounded bg-primary/15 px-1 py-0.5 text-[8.5px] font-bold uppercase tracking-wider text-primary">
                  master
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* MODULES */}
      <div className="rounded-xl border border-border bg-card/40 p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
            <h4 className="text-sm font-bold">Modul icazələri</h4>
          </div>
          <span className="text-[10.5px] text-muted-foreground">qrup üzrə ümumi göstərici</span>
        </div>
        <div className="grid grid-cols-1 gap-1.5 md:grid-cols-2">
          {moduleGroups.map((m) => {
            const pct = m.total > 0 ? (m.selected / m.total) * 100 : 0;
            const state = pct === 100 ? "full" : pct > 0 ? "partial" : "empty";
            return (
              <div
                key={m.qrup}
                className={cn(
                  "rounded-md border px-2.5 py-1.5 text-xs",
                  state === "full" ? "border-emerald-500/30 bg-emerald-500/5" :
                  state === "partial" ? "border-primary/20 bg-primary/[0.03]" :
                  "border-border bg-secondary/10",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className={cn(
                    "truncate font-medium",
                    state === "empty" && "text-muted-foreground",
                  )}>
                    {m.qrup}
                  </span>
                  <span className={cn(
                    "tabular-nums text-[10.5px] font-semibold",
                    state === "full" ? "text-emerald-500" :
                    state === "partial" ? "text-primary" :
                    "text-muted-foreground",
                  )}>
                    {m.selected}/{m.total}
                  </span>
                </div>
                <div className="mt-1 h-0.5 overflow-hidden rounded-full bg-foreground/5">
                  <div
                    className={cn(
                      "h-full transition-[width] duration-500",
                      state === "full" ? "bg-emerald-500" :
                      state === "partial" ? "bg-primary" :
                      "bg-muted-foreground/20",
                    )}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
