"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { saveMobileWidgets } from "../mobile-widget-actions";
import {
  ArrowRight, ClipboardList, StickyNote, Building2, FileText, Camera, Activity,
  Settings, Check, RotateCcw, Truck, Wallet, Lock, FolderArchive, GitCompare, EyeOff, Database, Smartphone, Sparkles,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatMoney, formatNumber } from "@/lib/utils";

type Hub = {
  today_revenue: number;
  today_orders: number;
  avg_ticket: number;
  today_cash: number;
  today_new_customers: number;
  open_tasks: number;
  active_isci: number;
};

type WidgetKey =
  | "revenue" | "cash" | "customers" | "tasks" | "staff" | "avg_ticket" | "orders"
  | "tapshiriq" | "qeyd" | "filiallar" | "snapshot" | "hesabat" | "data" | "partiya"
  | "maya" | "gizli" | "senedler" | "filial_muqayise" | "gizli_mod" | "backup" | "ai";

type WidgetDef = {
  key: WidgetKey;
  label: string;
  kind: "stat" | "link";
  href?: string;
  icon: typeof ClipboardList;
};

const ALL_WIDGETS: WidgetDef[] = [
  { key: "revenue", label: "Bu günkü gəlir", kind: "stat", icon: Wallet },
  { key: "cash", label: "Kassa qalığı", kind: "stat", icon: Wallet },
  { key: "orders", label: "Sifariş sayı", kind: "stat", icon: ClipboardList },
  { key: "avg_ticket", label: "Ortalama çek", kind: "stat", icon: Activity },
  { key: "customers", label: "Yeni müştəri", kind: "stat", icon: Building2 },
  { key: "tasks", label: "Açıq tapşırıq", kind: "stat", icon: ClipboardList },
  { key: "staff", label: "Aktiv işçi", kind: "stat", icon: Building2 },
  { key: "tapshiriq", label: "Tapşırıqlar", kind: "link", href: "/sahibkar/tapshiriq", icon: ClipboardList },
  { key: "qeyd", label: "Qeydlər", kind: "link", href: "/sahibkar/qeyd", icon: StickyNote },
  { key: "filiallar", label: "Filiallar", kind: "link", href: "/sahibkar/filiallar", icon: Building2 },
  { key: "filial_muqayise", label: "Filial müqayisə", kind: "link", href: "/sahibkar/filial-muqayise", icon: GitCompare },
  { key: "snapshot", label: "Snapshot", kind: "link", href: "/sahibkar/snapshot", icon: Camera },
  { key: "hesabat", label: "Hesabat", kind: "link", href: "/sahibkar/hesabat", icon: FileText },
  { key: "maya", label: "Maya analizi", kind: "link", href: "/sahibkar/maya", icon: Wallet },
  { key: "partiya", label: "Partiyalar", kind: "link", href: "/sahibkar/partiya", icon: Truck },
  { key: "gizli", label: "Gizli əlaqələr", kind: "link", href: "/sahibkar/gizli-elaqe", icon: Lock },
  { key: "senedler", label: "Sənədlər", kind: "link", href: "/sahibkar/senedler", icon: FolderArchive },
  { key: "data", label: "Data sağlamlığı", kind: "link", href: "/sahibkar/data-saglamligi", icon: Activity },
  { key: "gizli_mod", label: "Gizli mod", kind: "link", href: "/sahibkar/gizli-mod", icon: EyeOff },
  { key: "backup", label: "Backup", kind: "link", href: "/sahibkar/backup", icon: Database },
  { key: "ai", label: "Sahibkar AI", kind: "link", href: "/sahibkar/ai", icon: Sparkles },
];

const DEFAULT_KEYS: WidgetKey[] = [
  "revenue", "cash", "orders", "avg_ticket", "tasks", "staff",
  "ai", "tapshiriq", "qeyd", "filiallar", "snapshot", "hesabat", "maya", "data",
];

const STORAGE_KEY = "sahibkar-mobile-widgets-v1"; // offline cache yalnız, source of truth — DB

export function MobilePanel({ hub, initialActive }: { hub: Hub; initialActive?: string[] }) {
  const [editing, setEditing] = useState(false);
  const [active, setActive] = useState<WidgetKey[]>(() => {
    if (initialActive && initialActive.length > 0) {
      return initialActive.filter((k) => ALL_WIDGETS.some((w) => w.key === k)) as WidgetKey[];
    }
    return DEFAULT_KEYS;
  });
  const [, startTransition] = useTransition();

  // DB → state; localStorage yalnız offline cache kimi qalır (cihaz internetsiz olarsa).
  useEffect(() => {
    if (initialActive && initialActive.length > 0) return;
    // Server initial vermədisə, localStorage-i fallback olaraq oxu
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as WidgetKey[];
        if (Array.isArray(parsed) && parsed.every((k) => typeof k === "string")) {
          setActive(parsed.filter((k) => ALL_WIDGETS.some((w) => w.key === k)));
        }
      }
    } catch { /* silent */ }
  }, [initialActive]);

  function persist(next: WidgetKey[]) {
    setActive(next);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* silent */ }
    // DB-də saxla — cihazlar arası sinxron
    startTransition(async () => {
      try { await saveMobileWidgets(next); } catch { /* silent */ }
    });
  }

  function toggle(key: WidgetKey) {
    persist(active.includes(key) ? active.filter((k) => k !== key) : [...active, key]);
  }

  function reset() {
    persist(DEFAULT_KEYS);
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* silent */ }
  }

  const activeWidgets = useMemo(
    () => active.map((k) => ALL_WIDGETS.find((w) => w.key === k)).filter((w): w is WidgetDef => !!w),
    [active]
  );

  const stats = activeWidgets.filter((w) => w.kind === "stat");
  const links = activeWidgets.filter((w) => w.kind === "link");

  return (
    <div className="mx-auto max-w-md space-y-4">
      <header className="space-y-1">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground">Bu gün biznesim</p>
            <h1 className="text-3xl font-bold tracking-tight">{formatMoney(hub.today_revenue)}</h1>
            <p className="text-xs text-muted-foreground">{hub.today_orders} sifariş · Ortalama {formatMoney(hub.avg_ticket)}</p>
          </div>
          <Button
            variant={editing ? "default" : "outline"}
            size="sm"
            onClick={() => setEditing((v) => !v)}
            className="shrink-0"
          >
            {editing ? <><Check className="h-3.5 w-3.5" /> Bitir</> : <><Settings className="h-3.5 w-3.5" /> Düzəlt</>}
          </Button>
        </div>
      </header>

      {editing && (
        <Card className="glass border-primary/30">
          <CardContent className="space-y-2 py-3">
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-1.5 text-sm font-semibold">
                <Smartphone className="h-3.5 w-3.5 text-primary" /> Widget seçimi
              </h3>
              <Button variant="ghost" size="sm" onClick={reset} className="h-7 px-2 text-[11px]">
                <RotateCcw className="h-3 w-3" /> Defolt
              </Button>
            </div>
            <p className="text-[10.5px] text-muted-foreground">Hansı widget-ləri panelinizdə görmək istəyirsiniz?</p>
            <div className="grid grid-cols-2 gap-1.5">
              {ALL_WIDGETS.map((w) => {
                const isOn = active.includes(w.key);
                const Icon = w.icon;
                return (
                  <button
                    key={w.key}
                    type="button"
                    onClick={() => toggle(w.key)}
                    className={`flex items-center justify-between gap-1.5 rounded-md border px-2 py-1.5 text-left text-xs transition ${
                      isOn ? "border-primary/40 bg-primary/10" : "border-border/40 hover:bg-secondary/40"
                    }`}
                  >
                    <span className="flex min-w-0 items-center gap-1.5">
                      <Icon className="h-3 w-3 shrink-0" />
                      <span className="truncate">{w.label}</span>
                    </span>
                    {isOn && <Check className="h-3 w-3 shrink-0 text-primary" />}
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {stats.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {stats.map((w) => (
            <BigStat key={w.key} label={w.label} value={statValue(w.key, hub)} />
          ))}
        </div>
      )}

      {links.length > 0 && (
        <div className="space-y-2">
          {links.map((w) => (
            <MobileLink key={w.key} href={w.href!} icon={w.icon} title={w.label} />
          ))}
        </div>
      )}
    </div>
  );
}

function statValue(key: WidgetKey, hub: Hub): string {
  switch (key) {
    case "revenue": return formatMoney(hub.today_revenue);
    case "cash": return formatMoney(hub.today_cash);
    case "orders": return formatNumber(hub.today_orders);
    case "avg_ticket": return formatMoney(hub.avg_ticket);
    case "customers": return formatNumber(hub.today_new_customers);
    case "tasks": return formatNumber(hub.open_tasks);
    case "staff": return formatNumber(hub.active_isci);
    default: return "—";
  }
}

function BigStat({ label, value }: { label: string; value: string }) {
  return (
    <Card className="glass">
      <CardContent className="space-y-1 py-4">
        <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="text-xl font-bold tabular-nums">{value}</div>
      </CardContent>
    </Card>
  );
}

function MobileLink({ href, icon: Icon, title }: { href: string; icon: typeof ClipboardList; title: string }) {
  return (
    <Link href={href}>
      <Card className="glass transition active:scale-[0.98]">
        <CardContent className="flex items-center justify-between py-4">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-md bg-secondary">
              <Icon className="h-4 w-4" />
            </div>
            <span className="text-sm font-semibold">{title}</span>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground" />
        </CardContent>
      </Card>
    </Link>
  );
}
