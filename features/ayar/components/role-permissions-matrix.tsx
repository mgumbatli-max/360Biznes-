"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { ChevronDown, ChevronRight, Save, Loader2, Search, CheckCheck, X, Filter, Power, PowerOff } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { saveRolePerms } from "@/features/ayar/actions";
import { getPermissionInfo } from "@/lib/permission-info";
import { PERMISSION_MODULES, findModuleForGroup, OTHER_MODULE, type PermissionModule } from "@/lib/permission-modules";

type Perm = { id: number; kod: string; ad: string; aciqlamaq: string | null };
type Group = { qrup: string; items: Perm[] };
type FilterMode = "all" | "selected" | "unselected";

export function RolePermissionsMatrix({
  rolId,
  isSystem,
  initialIds,
  groups,
  onSelectionChange,
}: {
  rolId: number;
  isSystem: boolean;
  initialIds: number[];
  groups: Group[];
  /** Hər ids dəyişəndə çağrılır — preview panel canlı yenilənmək üçün */
  onSelectionChange?: (ids: Set<number>) => void;
}) {
  const [ids, setIds] = useState<Set<number>>(new Set(initialIds));
  // Modulları qrupların hansı modula daxil olmasına görə hesabla. Default-da
  // ən azı bir seçili icazəsi olan modullar açıq, qalanı bağlı.
  const moduleStructure = useMemo(() => {
    const map = new Map<string, { mod: PermissionModule; groups: Group[] }>();
    for (const g of groups) {
      const m = findModuleForGroup(g.qrup) ?? OTHER_MODULE;
      const entry = map.get(m.key) ?? { mod: m, groups: [] };
      entry.groups.push(g);
      map.set(m.key, entry);
    }
    // Modulları PERMISSION_MODULES sırasına görə düz — ardıcıllıq sabitdir
    const ordered: { mod: PermissionModule; groups: Group[] }[] = [];
    for (const m of PERMISSION_MODULES) {
      const e = map.get(m.key);
      if (e) ordered.push(e);
    }
    // Other-i sonuna əlavə et
    const other = map.get(OTHER_MODULE.key);
    if (other) ordered.push(other);
    return ordered;
  }, [groups]);

  const [openModules, setOpenModules] = useState<Set<string>>(() => {
    const initSet = new Set(initialIds);
    const open = new Set<string>();
    for (const { mod, groups: gs } of moduleStructure) {
      const hasSel = gs.some((g) => g.items.some((i) => initSet.has(i.id)));
      if (hasSel) open.add(mod.key);
    }
    return open;
  });

  const [filter, setFilter] = useState("");
  const [mode, setMode] = useState<FilterMode>("all");
  const [isPending, start] = useTransition();
  const totalAvailable = useMemo(() => groups.reduce((s, g) => s + g.items.length, 0), [groups]);

  // ids dəyişəndə parent-i məlumatlandır (preview üçün)
  useEffect(() => {
    onSelectionChange?.(ids);
  }, [ids, onSelectionChange]);

  const initialSet = useMemo(() => new Set(initialIds), [initialIds]);
  const isDirty = useMemo(() => {
    if (ids.size !== initialSet.size) return true;
    for (const id of ids) if (!initialSet.has(id)) return true;
    return false;
  }, [ids, initialSet]);

  // Saxlanmamış dəyişikliklər varsa, səhifədən çıxış cəhdində xəbərdarlıq.
  // Reload, tab close, geri/qabaq düymələri bütün hallar üçün işləyir.
  useEffect(() => {
    if (isSystem || !isDirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isDirty, isSystem]);

  const filtered: Group[] = useMemo(() => {
    const term = filter.trim().toLowerCase();
    return groups
      .map((g) => ({
        ...g,
        items: g.items.filter((i) => {
          // Mode filter
          if (mode === "selected" && !ids.has(i.id)) return false;
          if (mode === "unselected" && ids.has(i.id)) return false;
          // Text filter
          if (!term) return true;
          return (
            i.ad.toLowerCase().includes(term) ||
            i.kod.toLowerCase().includes(term) ||
            (i.aciqlamaq ?? "").toLowerCase().includes(term)
          );
        }),
      }))
      .filter((g) => g.items.length > 0);
  }, [groups, filter, mode, ids]);

  function toggle(id: number) {
    if (isSystem) return;
    setIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll(selectAll: boolean) {
    if (isSystem) return;
    if (selectAll) {
      const all = new Set<number>();
      for (const g of groups) for (const i of g.items) all.add(i.id);
      setIds(all);
    } else {
      setIds(new Set());
    }
  }

  function toggleGroup(qrup: string, selectAll: boolean) {
    if (isSystem) return;
    const group = groups.find((g) => g.qrup === qrup);
    if (!group) return;
    setIds((prev) => {
      const next = new Set(prev);
      if (selectAll) for (const i of group.items) next.add(i.id);
      else for (const i of group.items) next.delete(i.id);
      return next;
    });
  }

  function save() {
    if (isSystem) return;
    const fd = new FormData();
    fd.set("rol_id", String(rolId));
    fd.set("icaze_ids", Array.from(ids).join(","));
    start(async () => {
      const r = await saveRolePerms(fd);
      if (r.ok) toast.success("Yadda saxlandı");
      else toast.error(r.error);
    });
  }

  function expandAll(open: boolean) {
    setOpenModules(open ? new Set(moduleStructure.map((m) => m.mod.key)) : new Set());
  }

  function reset() {
    setIds(new Set(initialIds));
    toast.info("Saxlanmamış dəyişikliklər ləğv olundu");
  }

  const selectedPct = totalAvailable > 0 ? Math.round((ids.size / totalAvailable) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* Sticky toolbar — axtarış, filter modu, seçim cəmi, save */}
      <div className="sticky top-2 z-10 rounded-xl border border-border bg-card/95 p-3 shadow-sm backdrop-blur">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="İcazə adında axtar..."
              className="h-9 pl-8"
            />
            {filter && (
              <button
                type="button"
                onClick={() => setFilter("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-muted-foreground hover:bg-secondary"
                aria-label="Təmizlə"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>

          {/* Filter mode toggle */}
          <div className="inline-flex rounded-md border border-border bg-secondary/40 p-0.5 text-xs">
            {([
              { v: "all", label: "Hamısı" },
              { v: "selected", label: "Seçili" },
              { v: "unselected", label: "Seçilməyən" },
            ] as const).map((m) => (
              <button
                key={m.v}
                type="button"
                onClick={() => setMode(m.v)}
                className={cn(
                  "rounded-sm px-2.5 py-1 transition",
                  mode === m.v ? "bg-background font-semibold text-foreground shadow-sm" : "text-muted-foreground",
                )}
              >
                {m.label}
              </button>
            ))}
          </div>

          {!isSystem && (
            <>
              {isDirty && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={reset}
                  disabled={isPending}
                  title="Saxlanmamış dəyişiklikləri ləğv et"
                >
                  <X className="h-3.5 w-3.5" /> Sıfırla
                </Button>
              )}
              <Button
                size="sm"
                onClick={save}
                disabled={!isDirty || isPending}
                className={cn(isDirty && "shadow-md ring-2 ring-primary/30")}
              >
                {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                {isDirty ? "Saxla" : "Saxlandı"}
              </Button>
            </>
          )}
        </div>

        {/* Dirty xəbərdarlığı — istifadəçi səhifəni tərk edərkən qarşısı alınır */}
        {isDirty && !isSystem && (
          <div className="mt-2 flex items-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-2.5 py-1.5 text-[11px] text-amber-700 dark:text-amber-400">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-amber-500" />
            </span>
            Saxlanmamış dəyişikliklər var — Saxla basana qədər heç bir əməkdaşa təsir etməyəcək.
          </div>
        )}

        {/* Progress + global action row */}
        <div className="mt-2.5 flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-[180px]">
            <div className="flex items-center justify-between text-[10.5px] text-muted-foreground">
              <span>
                <b className="text-foreground">{ids.size}</b> / {totalAvailable} icazə seçili
              </span>
              <span>{selectedPct}%</span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full rounded-full bg-gradient-to-r from-primary to-primary/70 transition-[width] duration-500"
                style={{ width: `${selectedPct}%` }}
              />
            </div>
          </div>

          {!isSystem && (
            <div className="flex items-center gap-1.5 text-xs">
              <Button size="sm" variant="outline" onClick={() => toggleAll(true)}>
                <CheckCheck className="h-3 w-3" /> Hamısını seç
              </Button>
              <Button size="sm" variant="outline" onClick={() => toggleAll(false)}>
                <X className="h-3 w-3" /> Təmizlə
              </Button>
              <button
                type="button"
                onClick={() => expandAll(true)}
                className="text-[11px] text-muted-foreground hover:text-foreground"
              >
                Hamısını aç
              </button>
              <span className="text-muted-foreground/40">·</span>
              <button
                type="button"
                onClick={() => expandAll(false)}
                className="text-[11px] text-muted-foreground hover:text-foreground"
              >
                Hamısını bağla
              </button>
            </div>
          )}
        </div>
      </div>

      {isSystem && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2.5 text-xs">
          <Filter className="mt-0.5 h-3.5 w-3.5 text-amber-500" />
          <div>
            <div className="font-semibold text-amber-700 dark:text-amber-400">Sistem rolu kilidlidir</div>
            <div className="text-muted-foreground">
              Bu rolun icazələri dəyişdirilə bilməz. İcazələri özünə uyğun qurmaq istəyirsənsə, «Klonla» düyməsi ilə kopiya yarat və onu redaktə et.
            </div>
          </div>
        </div>
      )}

      {/* İcazələr — modullar → qruplar → icazələr */}
      <div className="space-y-3">
        {filtered.length === 0 && (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
            <Search className="h-5 w-5 opacity-50" />
            <p>Bu filtr üçün nəticə yoxdur</p>
          </div>
        )}

        {/* Filterli qrupları modul-da-tap */}
        {(() => {
          const filteredByGroup = new Map<string, Group>();
          for (const g of filtered) filteredByGroup.set(g.qrup, g);
          const visibleModules = moduleStructure
            .map(({ mod, groups: gs }) => ({
              mod,
              groups: gs
                .map((g) => filteredByGroup.get(g.qrup))
                .filter((g): g is Group => !!g),
            }))
            .filter((m) => m.groups.length > 0);

          return visibleModules.map(({ mod, groups: modGroups }) => {
            // Modul səviyyəsində statistika
            const modAllItems = modGroups.flatMap((g) => g.items);
            const modSel = modAllItems.filter((i) => ids.has(i.id)).length;
            const modAll = modAllItems.length;
            const modPct = modAll > 0 ? modSel / modAll : 0;
            const modState = modPct === 1 ? "full" : modPct > 0 ? "partial" : "empty";
            const isOpen = openModules.has(mod.key);
            const ModIcon = mod.icon;

            return (
              <div
                key={mod.key}
                className={cn(
                  "overflow-hidden rounded-2xl border bg-card/40 transition shadow-sm",
                  modState === "full" ? "border-emerald-500/30" :
                  modState === "partial" ? "border-primary/30" :
                  "border-border",
                )}
              >
                {/* Modul header — gradient + collapsible */}
                <button
                  type="button"
                  className="flex w-full items-stretch gap-0 text-left transition hover:opacity-95"
                  onClick={() => {
                    setOpenModules((p) => {
                      const next = new Set(p);
                      if (next.has(mod.key)) next.delete(mod.key);
                      else next.add(mod.key);
                      return next;
                    });
                  }}
                >
                  {/* Sol gradient kolonu */}
                  <div className={cn("flex w-12 items-center justify-center bg-gradient-to-br text-white shadow-sm", mod.color)}>
                    <ModIcon className="h-5 w-5" />
                  </div>
                  <div className="flex flex-1 items-center gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-bold capitalize">{mod.label}</h3>
                        <Badge
                          variant="outline"
                          className={cn(
                            "h-5 text-[10px] tabular-nums",
                            modState === "full" ? "border-emerald-500/40 text-emerald-600 dark:text-emerald-400" :
                            modState === "partial" ? "border-primary/40 text-primary" :
                            "",
                          )}
                        >
                          {modSel}/{modAll}
                        </Badge>
                      </div>
                      <p className="mt-0.5 line-clamp-1 text-[11px] text-muted-foreground">{mod.desc}</p>
                      {/* Mini progress bar */}
                      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-foreground/5">
                        <div
                          className={cn(
                            "h-full transition-[width] duration-500",
                            modState === "full" ? "bg-emerald-500" :
                            modState === "partial" ? "bg-primary" :
                            "bg-muted-foreground/20",
                          )}
                          style={{ width: `${modPct * 100}%` }}
                        />
                      </div>
                    </div>

                    {/* Modul səviyyəsində bulk actions */}
                    {!isSystem && (
                      <span className="hidden md:flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          title={`«${mod.label}» modulunun bütün icazələrini seç`}
                          className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 transition hover:bg-emerald-500/20 dark:text-emerald-400"
                          onClick={() => {
                            setIds((prev) => {
                              const next = new Set(prev);
                              for (const i of modAllItems) next.add(i.id);
                              return next;
                            });
                          }}
                        >
                          Modulu tam ver
                        </button>
                        <button
                          type="button"
                          title={`«${mod.label}» modulundan bütün icazələri çıxar`}
                          className="rounded-md border border-border bg-secondary/40 px-2 py-0.5 text-[10px] text-muted-foreground transition hover:bg-secondary"
                          onClick={() => {
                            setIds((prev) => {
                              const next = new Set(prev);
                              for (const i of modAllItems) next.delete(i.id);
                              return next;
                            });
                          }}
                        >
                          Modulu boşalt
                        </button>
                      </span>
                    )}

                    {isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                  </div>
                </button>

                {/* Modul içi — qruplar və icazələr */}
                {isOpen && (
                  <div className="border-t border-border/40 bg-background/40">
                    {modGroups.map((g, gIdx) => {
                      const gSel = g.items.filter((i) => ids.has(i.id)).length;
                      const gAll = g.items.length;
                      return (
                        <div key={g.qrup} className={cn(gIdx > 0 && "border-t border-border/30")}>
                          {/* Qrup sub-header — bir modul daxilində alt bölmə */}
                          <div className="flex items-center justify-between gap-2 bg-secondary/40 px-3 py-1.5">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                                {g.qrup}
                              </span>
                              <span className="text-[10px] tabular-nums text-muted-foreground/70">
                                {gSel}/{gAll}
                              </span>
                            </div>
                            {!isSystem && (
                              <span className="flex items-center gap-1">
                                <button
                                  type="button"
                                  title="Bu qrupun hamısını seç"
                                  className="rounded border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[9.5px] font-semibold text-emerald-600 transition hover:bg-emerald-500/20 dark:text-emerald-400"
                                  onClick={() => toggleGroup(g.qrup, true)}
                                >
                                  Hamısı
                                </button>
                                <button
                                  type="button"
                                  title="Bu qrupdan hamısını çıxar"
                                  className="rounded border border-border bg-background/40 px-1.5 py-0.5 text-[9.5px] text-muted-foreground transition hover:bg-secondary"
                                  onClick={() => toggleGroup(g.qrup, false)}
                                >
                                  Boşalt
                                </button>
                              </span>
                            )}
                          </div>
                          {/* İcazələr */}
                          <div className="divide-y divide-border/20">
                            {g.items.map((i) => {
                              const on = ids.has(i.id);
                              const info = getPermissionInfo({ kod: i.kod, ad: i.ad, aciqlamaq: i.aciqlamaq });
                              return (
                                <label
                                  key={i.id}
                                  className={cn(
                                    "flex cursor-pointer items-start gap-3 px-3 py-3 text-sm transition",
                                    on
                                      ? "bg-emerald-500/[0.04] hover:bg-emerald-500/[0.08]"
                                      : "hover:bg-secondary/40",
                                    isSystem && "cursor-not-allowed",
                                  )}
                                >
                                  <span
                                    className={cn(
                                      "mt-0.5 grid h-4 w-4 flex-shrink-0 place-items-center rounded border transition",
                                      on
                                        ? "border-emerald-500 bg-emerald-500 text-white"
                                        : "border-border bg-background",
                                    )}
                                  >
                                    {on && <CheckCheck className="h-2.5 w-2.5" />}
                                    <input
                                      type="checkbox"
                                      checked={on}
                                      disabled={isSystem}
                                      onChange={() => toggle(i.id)}
                                      className="absolute h-4 w-4 opacity-0"
                                      aria-label={i.ad}
                                    />
                                  </span>
                                  <div className="min-w-0 flex-1 space-y-1">
                                    <div className={cn("font-medium leading-snug", on && "text-foreground")}>{i.ad}</div>

                                    <div className={cn(
                                      "flex items-start gap-1.5 rounded-md border px-2 py-1 text-[11px] leading-snug",
                                      on
                                        ? "border-emerald-500/30 bg-emerald-500/5"
                                        : "border-border/40 bg-secondary/20 opacity-70",
                                    )}>
                                      <Power className={cn("mt-0.5 h-3 w-3 flex-shrink-0", on ? "text-emerald-500" : "text-muted-foreground")} />
                                      <div>
                                        <span className={cn("font-semibold", on ? "text-emerald-700 dark:text-emerald-400" : "text-muted-foreground")}>
                                          Açıq olanda:
                                        </span>
                                        <span className="ml-1 text-foreground/80">{info.whenOn}</span>
                                      </div>
                                    </div>

                                    <div className={cn(
                                      "flex items-start gap-1.5 rounded-md border px-2 py-1 text-[11px] leading-snug",
                                      !on
                                        ? "border-rose-500/30 bg-rose-500/5"
                                        : "border-border/40 bg-secondary/20 opacity-70",
                                    )}>
                                      <PowerOff className={cn("mt-0.5 h-3 w-3 flex-shrink-0", !on ? "text-rose-500" : "text-muted-foreground")} />
                                      <div>
                                        <span className={cn("font-semibold", !on ? "text-rose-700 dark:text-rose-400" : "text-muted-foreground")}>
                                          Söndürüləndə:
                                        </span>
                                        <span className="ml-1 text-foreground/80">{info.whenOff}</span>
                                      </div>
                                    </div>

                                    <code className="inline-block rounded bg-foreground/5 px-1 py-0.5 text-[9.5px] text-muted-foreground/80">
                                      {i.kod}
                                    </code>
                                  </div>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          });
        })()}
      </div>
    </div>
  );
}
