"use client";

import Link from "next/link";
import { ScrollActiveIntoView } from "@/components/scroll-active-into-view";
import {
  LayoutDashboard,
  Activity,
  FileText,
  ShoppingCart,
  Truck,
  CreditCard,
  Undo2,
  ClipboardList,
  type LucideIcon,
} from "lucide-react";

type Tab = {
  href: string;
  label: string;
  Icon: LucideIcon;
  /** Detal səhifələri də aktiv et (məs. /ticaret/satislar/* → /ticaret/satislar) */
  alsoActiveFor?: string[];
};

type Group = {
  key: string;
  label: string;
  Icon: LucideIcon;
  tabs: Tab[];
};

const DASHBOARD_TAB: Tab = {
  href: "/ticaret",
  label: "Dashboard",
  Icon: LayoutDashboard,
};

const TICARET_GROUPS: Group[] = [
  {
    key: "senedler",
    label: "Sənədlər",
    Icon: ClipboardList,
    tabs: [
      { href: "/ticaret/emeliyyat", label: "Hamısı",   Icon: Activity },
      { href: "/ticaret/satislar",  label: "Satış",    Icon: ShoppingCart, alsoActiveFor: ["/ticaret/pipeline"] },
      { href: "/ticaret/teklif",    label: "Təkliflər", Icon: FileText },
      { href: "/ticaret/alislar",   label: "Alış",     Icon: Truck },
      { href: "/ticaret/kredit",    label: "Kreditlə", Icon: CreditCard, alsoActiveFor: ["/ticaret/kredit-yeni"] },
      { href: "/ticaret/qaytarma",  label: "Qaytarma", Icon: Undo2 },
    ],
  },
];

function isTabActive(tab: Tab, active: string): boolean {
  if (tab.href === active) return true;
  return tab.alsoActiveFor?.some((p) => active === p || active.startsWith(p + "/")) ?? false;
}

function findActiveGroup(active: string): Group | null {
  if (active === DASHBOARD_TAB.href) return null;
  return TICARET_GROUPS.find((g) => g.tabs.some((t) => isTabActive(t, active))) ?? null;
}

export function TicaretSubNav({ active }: { active: string }) {
  const activeGroup = findActiveGroup(active);
  const isDashboard = active === DASHBOARD_TAB.href;

  return (
    <div className="space-y-2 mb-4" data-subnav>
      {/* Primary group bar */}
      <div className="flex min-w-0 rounded-xl border border-border bg-secondary/40 p-1">
        <ScrollActiveIntoView className="flex min-w-0 flex-1 gap-0.5 overflow-x-auto scrollbar-thin">
          <Link
            href={DASHBOARD_TAB.href}
            data-active={isDashboard ? "true" : undefined}
            className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              isDashboard
                ? "bg-background text-primary shadow-sm"
                : "text-muted-foreground hover:bg-background/60 hover:text-foreground"
            }`}
          >
            <DASHBOARD_TAB.Icon className="h-3.5 w-3.5" />
            <span>{DASHBOARD_TAB.label}</span>
          </Link>

          {TICARET_GROUPS.map((g) => {
            const isOn = activeGroup?.key === g.key;
            const href = g.tabs[0]?.href ?? "/ticaret";
            return (
              <Link
                key={g.key}
                href={href}
                data-active={isOn ? "true" : undefined}
                className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  isOn
                    ? "bg-background text-primary shadow-sm"
                    : "text-muted-foreground hover:bg-background/60 hover:text-foreground"
                }`}
              >
                <g.Icon className="h-3.5 w-3.5" />
                <span>{g.label}</span>
              </Link>
            );
          })}
        </ScrollActiveIntoView>
      </div>

      {/* Secondary bar — qrupun alt-tab-ları (yalnız 2+ tab olduqda) */}
      {activeGroup && activeGroup.tabs.length > 1 && (
        <div className="flex min-w-0 items-center gap-2 pl-1">
          <span className="hidden text-[10px] font-semibold uppercase tracking-wider text-muted-foreground md:inline">
            {activeGroup.label}
          </span>
          <ScrollActiveIntoView className="flex min-w-0 flex-1 gap-1 overflow-x-auto scrollbar-thin">
            {activeGroup.tabs.map((t) => {
              const isOn = isTabActive(t, active);
              return (
                <Link
                  key={t.href}
                  href={t.href}
                  data-active={isOn ? "true" : undefined}
                  className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1 text-[11px] font-medium transition ${
                    isOn
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                  }`}
                >
                  <t.Icon className="h-3 w-3" />
                  <span>{t.label}</span>
                </Link>
              );
            })}
          </ScrollActiveIntoView>
        </div>
      )}
    </div>
  );
}
