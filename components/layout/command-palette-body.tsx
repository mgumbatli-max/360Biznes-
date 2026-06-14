"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2,
  Package,
  Users,
  ShoppingCart,
  Truck,
  Warehouse,
  Tag,
  Layers,
  ListTodo,
  History,
  ScanBarcode,
  UserCog,
  Clock,
} from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { NAV_SECTIONS, canSeeNavItem } from "@/lib/navigation";
import { useSession } from "next-auth/react";
import { usePermissions } from "@/components/providers/permissions-provider";
import {
  globalSearch,
  type GlobalSearchHit,
  type GlobalSearchResult,
  type GlobalSearchType,
} from "@/features/search/global-search-action";
import { verifySearchCode } from "@/features/sahibkar/secret-code";

const RECENT_KEY = "globalSearch.recent";
const RECENT_MAX = 8;

function loadRecent(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((s): s is string => typeof s === "string").slice(0, RECENT_MAX)
      : [];
  } catch {
    return [];
  }
}

function saveRecent(query: string) {
  if (typeof window === "undefined") return;
  try {
    const cur = loadRecent();
    const next = [query, ...cur.filter((q) => q !== query)].slice(0, RECENT_MAX);
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* quota / disabled */
  }
}

const TYPE_META: Record<
  GlobalSearchType,
  { label: string; icon: typeof Package; badge: string }
> = {
  mehsul: { label: "Məhsullar", icon: Package, badge: "Məhsul" },
  kontragent: { label: "Müştərilər / Təchizatçılar", icon: Users, badge: "Şəxs" },
  satis: { label: "Satışlar", icon: ShoppingCart, badge: "Satış" },
  alis: { label: "Alışlar", icon: Truck, badge: "Alış" },
  anbar: { label: "Anbarlar", icon: Warehouse, badge: "Anbar" },
  marka: { label: "Markalar", icon: Tag, badge: "Marka" },
  kateqoriya: { label: "Kateqoriyalar", icon: Layers, badge: "Kateq" },
  istifadeci: { label: "İstifadəçilər", icon: UserCog, badge: "User" },
  tapshiriq: { label: "Tapşırıqlar", icon: ListTodo, badge: "Tapşırıq" },
  audit: { label: "Audit log", icon: History, badge: "Audit" },
};

const TYPE_ORDER: GlobalSearchType[] = [
  "mehsul",
  "kontragent",
  "satis",
  "alis",
  "anbar",
  "marka",
  "kateqoriya",
  "istifadeci",
  "tapshiriq",
  "audit",
];

export default function CommandPaletteBody({
  open,
  onOpenChange,
  hiddenModules = [],
  isSuperAdmin = false,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  hiddenModules?: string[];
  isSuperAdmin?: boolean;
}) {
  const router = useRouter();
  const { data: session } = useSession();
  const user = session?.user;
  const icazeler = usePermissions();

  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<GlobalSearchResult | null>(null);
  const [recent, setRecent] = useState<string[]>([]);
  const reqId = useRef(0);

  useEffect(() => {
    if (open) {
      setRecent(loadRecent());
      setQ("");
      setData(null);
    }
  }, [open]);

  useEffect(() => {
    const trimmed = q.trim();
    if (trimmed.length < 2) {
      setData(null);
      setLoading(false);
      return;
    }

    if (/^\d{4,8}$/.test(trimmed)) {
      let cancelled = false;
      (async () => {
        try {
          const res = await verifySearchCode(trimmed);
          if (cancelled) return;
          if (res.ok) {
            onOpenChange(false);
            router.push(res.redirect);
            router.refresh();
          }
        } catch {
          /* silent */
        }
      })();
      return () => {
        cancelled = true;
      };
    }

    setLoading(true);
    const myId = ++reqId.current;
    const id = setTimeout(async () => {
      try {
        const res = await globalSearch(trimmed);
        if (myId === reqId.current) setData(res);
      } catch {
        if (myId === reqId.current) setData(null);
      } finally {
        if (myId === reqId.current) setLoading(false);
      }
    }, 200);
    return () => clearTimeout(id);
  }, [q, router, onOpenChange]);

  const handleSelect = useCallback(
    (hit: Pick<GlobalSearchHit, "href"> & { external?: boolean }) => {
      if (q.trim().length >= 2) saveRecent(q.trim());
      onOpenChange(false);
      if (hit.external) {
        window.open(hit.href, "_blank", "noopener");
      } else {
        router.push(hit.href);
      }
    },
    [router, onOpenChange, q],
  );

  const visibleModuleSections = useMemo(() => {
    if (!user) return [];
    return NAV_SECTIONS.map((section) => ({
      label: section.label,
      items: section.items.filter((i) => {
        // Lite-da gizlədilmiş modul (sidebar ilə eyni məntiq) — Cmd+K-da da gizlət.
        const modul = i.href.split("/")[1] ?? "";
        if (hiddenModules.includes(modul)) return false;
        return canSeeNavItem(i, { rolId: user.rol_id, rolAd: user.rol_ad, icazeler, isSuperAdmin });
      }),
    })).filter((s) => s.items.length > 0);
  }, [user, icazeler, hiddenModules, isSuperAdmin]);

  const filteredModules = useMemo(() => {
    const tq = q.trim().toLowerCase();
    if (tq.length < 2) return visibleModuleSections;
    return visibleModuleSections
      .map((s) => ({
        label: s.label,
        items: s.items.filter((i) => i.label.toLowerCase().includes(tq)),
      }))
      .filter((s) => s.items.length > 0);
  }, [visibleModuleSections, q]);

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden p-0 md:max-w-2xl">
        <DialogTitle className="sr-only">Qlobal axtarış</DialogTitle>
        <Command shouldFilter={false} className="bg-popover">
          <div className="relative">
            <CommandInput
              value={q}
              onValueChange={setQ}
              placeholder="Hər şey axtar — məhsul, müştəri, satış, modul, tapşırıq..."
            />
            {loading && (
              <Loader2 className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
            )}
          </div>

          <CommandList>
            <CommandEmpty>Nəticə tapılmadı.</CommandEmpty>

            {filteredModules.map((section) => (
              <CommandGroup
                key={`mod-${section.label}`}
                heading={
                  <SectionHeading
                    label={section.label === "Əsas" ? "Modullar" : section.label}
                    count={section.items.length}
                  />
                }
              >
                {section.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <CommandItem
                      key={item.href}
                      value={`mod-${item.href}`}
                      onSelect={() =>
                        handleSelect({ href: item.href, external: item.external })
                      }
                    >
                      <Icon className="h-4 w-4 text-rose-500" />
                      <span className="flex-1">{item.label}</span>
                      <span className="rounded border border-border/60 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                        Modul
                      </span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            ))}

            {q.trim().length < 2 && recent.length > 0 && (
              <CommandGroup
                heading={
                  <SectionHeading label="Son axtarışlar" count={recent.length} />
                }
              >
                {recent.map((r) => (
                  <CommandItem
                    key={`recent-${r}`}
                    value={`recent-${r}`}
                    onSelect={() => setQ(r)}
                  >
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="flex-1">{r}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {data &&
              TYPE_ORDER.map((type) => {
                const hits = data.groups[type];
                if (!hits || hits.length === 0) return null;
                const meta = TYPE_META[type];
                const Icon = meta.icon;
                return (
                  <CommandGroup
                    key={type}
                    heading={
                      <SectionHeading label={meta.label} count={hits.length} />
                    }
                  >
                    {hits.map((hit) => (
                      <CommandItem
                        key={`${type}-${hit.id}`}
                        value={`${type}-${hit.id}-${hit.title}`}
                        onSelect={() => handleSelect(hit)}
                      >
                        <Icon className="h-4 w-4 text-rose-500" />
                        <div className="flex min-w-0 flex-1 flex-col">
                          <span className="truncate text-sm">{hit.title}</span>
                          {hit.subtitle && (
                            <span className="truncate text-xs text-muted-foreground">
                              {hit.subtitle}
                            </span>
                          )}
                        </div>
                        {hit.badge && (
                          <span className="rounded border border-border/60 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                            {hit.badge}
                          </span>
                        )}
                        <span className="rounded border border-border/60 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                          {meta.badge}
                        </span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                );
              })}
          </CommandList>

          <div className="flex items-center justify-between border-t border-border/60 bg-card/50 px-3 py-2 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <ScanBarcode className="h-3 w-3" />
              ↑↓ naviqasiya · Enter aç · Esc bağla
            </span>
            <span>⌘K istənilən yerdə açır</span>
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  );
}

function SectionHeading({ label, count }: { label: string; count: number }) {
  return (
    <span className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-wider">
      <span>{label}</span>
      <span className="rounded-full bg-secondary px-1.5 py-px text-[9.5px] font-medium text-muted-foreground">
        {count}
      </span>
    </span>
  );
}
