"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { ScrollActiveIntoView } from "@/components/scroll-active-into-view";
import {
  Activity,
  Wallet,
  ArrowDownCircle,
  ArrowUpCircle,
  ReceiptText,
  Truck,
  Receipt,
  BarChart3,
  Plus,
  Repeat2,
  Calculator,
  LayoutDashboard,
  TrendingUp,
  ClipboardList,
  Store,
  Sunset,
  Users,
  Banknote,
  Coins,
  Landmark,
  type LucideIcon,
} from "lucide-react";

type Tab = {
  href: string;
  label: string;
  Icon: LucideIcon;
  /** Detal səhifələri də qrupu aktiv et */
  alsoActiveFor?: string[];
};

type Group = {
  key: string;
  label: string;
  Icon: LucideIcon;
  tabs: Tab[];
};

export type FinQuickKey =
  | "qaime"
  | "xercler"
  | "maas"
  | "avans"
  | "bonus"
  | "cerime"
  | "tesisci_pul"
  | "tehtl_hesab"
  | "transfer"
  | "valyuta_mubadile"
  | "dividend"
  | "borc_silinme"
  | "artirma"
  | "azaltma"
  | "barter";

/**
 * Maliyyə subnav 5 qrupa bölünüb (Anbar/Ticarət strukturuna uyğun):
 *   • Əməliyyatlar — bütün maliyyə hərəkətləri jurnalı
 *   • Hesablar    — kassa/bank/digər vahid + gün-sonu + marketplace
 *   • Borclar     — debitor/kreditor
 *   • Hesabat     — P&L, Balans, müfəssəl hesabatlar
 *   • Vergi       — ƏDV, yol vergisi, xərc maddələri
 *
 * Köhnə bank/kassalar səhifələri /hesab-a redirect olunub — subnav-də yoxdur.
 */
const DASHBOARD_TAB: Tab = {
  href: "/maliyye",
  label: "Dashboard",
  Icon: LayoutDashboard,
};

const MALIYYE_GROUPS: Group[] = [
  {
    key: "emeliyyat",
    label: "Əməliyyatlar",
    Icon: Activity,
    tabs: [
      { href: "/maliyye/emeliyyat",  label: "Jurnal",         Icon: ClipboardList,
        alsoActiveFor: ["/maliyye/emeliyyat/yeni"] },
      { href: "/maliyye/pul-axini",  label: "Pul axını",      Icon: TrendingUp },
      { href: "/maliyye/recurring",  label: "Təkrarlananlar", Icon: Repeat2 },
    ],
  },
  {
    key: "hesablar",
    label: "Hesablar",
    Icon: Wallet,
    tabs: [
      { href: "/maliyye/hesab",       label: "Hesablar",        Icon: Wallet },
      { href: "/maliyye/kassalar",    label: "Kassa sessiya",   Icon: Coins },
      { href: "/maliyye/bank",        label: "Bank çıxarışı",    Icon: Landmark },
      { href: "/maliyye/gun-sonu",    label: "Gün sonu",        Icon: Sunset },
      { href: "/maliyye/marketplace", label: "Marketplace ödənişlər", Icon: Store },
    ],
  },
  {
    key: "borclar",
    label: "Borclar",
    Icon: Users,
    tabs: [
      { href: "/maliyye/debitor",  label: "Debitor",  Icon: ArrowDownCircle },
      { href: "/maliyye/kreditor", label: "Kreditor", Icon: ArrowUpCircle },
    ],
  },
  {
    key: "hesabat",
    label: "Hesabat",
    Icon: Calculator,
    tabs: [
      { href: "/maliyye/pl-balans", label: "P&L / Balans", Icon: Banknote,
        alsoActiveFor: ["/maliyye/pl-baalanc"] },
      { href: "/maliyye/hesabat",   label: "Detallı hesabatlar", Icon: BarChart3 },
    ],
  },
  {
    key: "vergi",
    label: "Vergi",
    Icon: ReceiptText,
    tabs: [
      { href: "/maliyye/edv",         label: "ƏDV",            Icon: ReceiptText },
      { href: "/maliyye/yol-vergisi", label: "Yol vergisi",    Icon: Truck },
      { href: "/maliyye/xercler",     label: "Xərc maddələri", Icon: Receipt },
    ],
  },
];

function isTabActive(tab: Tab, active: string): boolean {
  if (tab.href === active) return true;
  return tab.alsoActiveFor?.some((p) => active === p || active.startsWith(p + "/")) ?? false;
}

function findActiveGroup(active: string): Group | null {
  if (active === DASHBOARD_TAB.href) return null;
  return MALIYYE_GROUPS.find((g) => g.tabs.some((t) => isTabActive(t, active))) ?? null;
}

export function MaliyyeSubNav({ active }: { active: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const activeGroup = findActiveGroup(active);
  const isDashboard = active === DASHBOARD_TAB.href;

  const handleNewOp = () => {
    if (pathname === "/maliyye") {
      window.dispatchEvent(new CustomEvent("maliyye:new-op"));
    } else {
      router.push("/maliyye?yeni=open");
    }
  };

  return (
    <div className="space-y-2 mb-4" data-subnav>
      <div className="flex items-center gap-2">
        {/* Primary group bar */}
        <div className="flex min-w-0 flex-1 rounded-xl border border-border bg-secondary/40 p-1">
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

            {MALIYYE_GROUPS.map((g) => {
              const isOn = activeGroup?.key === g.key;
              const href = g.tabs[0]?.href ?? "/maliyye";
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

        {/* "Yeni əməliyyat" — vahid yeradılış nöqtəsi */}
        <button
          type="button"
          onClick={handleNewOp}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-white shadow-sm hover:shadow"
          style={{ background: "var(--brand-gradient)" }}
        >
          <Plus className="h-3.5 w-3.5" />
          <span>Yeni əməliyyat</span>
        </button>
      </div>

      {/* Secondary bar — qrupun alt-tab-ları */}
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
