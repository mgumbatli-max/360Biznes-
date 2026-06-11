import Link from "next/link";
import { ScrollActiveIntoView } from "@/components/scroll-active-into-view";
import { useIcmalOn } from "@/features/shared/use-icmal";
import {
  LayoutDashboard,
  Package,
  Boxes,
  Tag,
  Layers,
  Bookmark,
  Handshake,
  Tags,
  ClipboardCheck,
  Truck,
  ArrowLeftRight,
  BarChart3,
  AlertTriangle,
  ClipboardList,
  Database,
  Workflow,
  Printer,
  type LucideIcon,
} from "lucide-react";

type AnbarTab = {
  href: string;
  label: string;
  Icon: LucideIcon;
  /** Path prefixes that should also mark this tab as active (e.g. detail pages) */
  alsoActiveFor?: string[];
};

type AnbarGroup = {
  key: string;
  label: string;
  Icon: LucideIcon;
  /** Group's own landing page (clickable group label). Optional. */
  href?: string;
  tabs: AnbarTab[];
};

/**
 * 4 məntiqi qrup. Dashboard ayrıca solo item.
 *
 *  • Kataloq — master data (məhsul, marka, kateqoriya, qiymət, import)
 *  • Stok — anbar vəziyyəti və qeydiyyatı (görüntü)
 *  • Əməliyyatlar — anbar hərəkətləri (sayım, transfer, bron, konsiqnasiya, satınalma, etiket)
 *  • Hesabat — analitika
 */
const DASHBOARD_TAB: AnbarTab = {
  href: "/anbar",
  label: "İcmal",
  Icon: LayoutDashboard,
};

const ANBAR_GROUPS: AnbarGroup[] = [
  {
    key: "kataloq",
    label: "Kataloq",
    Icon: Database,
    tabs: [
      { href: "/anbar/mehsullar",     label: "Məhsullar",     Icon: Package },
      { href: "/anbar/markalar",      label: "Markalar",      Icon: Tag },
      { href: "/anbar/kateqoriyalar", label: "Kateqoriyalar", Icon: Layers },
      { href: "/anbar/qiymet",        label: "Qiymət",        Icon: Tags },
    ],
  },
  {
    key: "stok",
    label: "Stok",
    Icon: Boxes,
    tabs: [
      { href: "/anbar/stok",       label: "Vəziyyət", Icon: Boxes },
      { href: "/anbar/hereketler", label: "Hərəkətlər", Icon: ArrowLeftRight },
      { href: "/anbar/anomali",    label: "Anomali", Icon: AlertTriangle },
      { href: "/anbar/defekt",     label: "Defekt", Icon: AlertTriangle },
    ],
  },
  {
    key: "emeliyyat",
    label: "Əməliyyatlar",
    Icon: Workflow,
    tabs: [
      { href: "/anbar/inventar",     label: "Sayım",        Icon: ClipboardCheck },
      { href: "/anbar/transfer",     label: "Transfer",     Icon: Truck },
      { href: "/anbar/bron",         label: "Bron",         Icon: Bookmark },
      { href: "/anbar/konsiqnasiya", label: "Konsiqnasiya", Icon: Handshake },
      { href: "/anbar/satinalma",    label: "Satınalma",    Icon: ClipboardList, alsoActiveFor: ["/satinalma"] },
      { href: "/anbar/etiket-cap",   label: "Etiket çapı",  Icon: Printer },
    ],
  },
  {
    key: "hesabat",
    label: "Hesabat",
    Icon: BarChart3,
    tabs: [
      { href: "/anbar/hesabat", label: "Anbar hesabatları", Icon: BarChart3 },
    ],
  },
];

function isTabActive(tab: AnbarTab, active: string): boolean {
  if (tab.href === active) return true;
  return tab.alsoActiveFor?.some((p) => active === p || active.startsWith(p + "/")) ?? false;
}

function findActiveGroup(active: string): AnbarGroup | null {
  if (active === DASHBOARD_TAB.href) return null;
  return ANBAR_GROUPS.find((g) => g.tabs.some((t) => isTabActive(t, active))) ?? null;
}

export function AnbarSubNav({ active }: { active: string }) {
  const activeGroup = findActiveGroup(active);
  const isDashboard = active === DASHBOARD_TAB.href;
  const icmalOn = useIcmalOn("anbar");

  return (
    <div className="space-y-2 mb-4" data-subnav>
      {/* Primary group bar — 5 buttons (Dashboard + 4 groups) */}
      <div className="flex min-w-0 rounded-xl border border-border bg-secondary/40 p-1">
        <ScrollActiveIntoView className="flex min-w-0 flex-1 gap-0.5 overflow-x-auto scrollbar-thin">
          {/* Dashboard solo button */}
          {(icmalOn || isDashboard) && (
          <Link
            href={DASHBOARD_TAB.href}
            data-active={isDashboard ? "true" : undefined}
            className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              isDashboard
                ? "bg-gradient-to-b from-background to-background/80 text-primary shadow-md shadow-primary/10 ring-1 ring-primary/15"
                : "text-muted-foreground hover:bg-background/60 hover:text-foreground hover:-translate-y-px active:translate-y-0"
            }`}
          >
            <DASHBOARD_TAB.Icon className="h-3.5 w-3.5" />
            <span>{DASHBOARD_TAB.label}</span>
          </Link>
          )}

          {/* Group buttons */}
          {ANBAR_GROUPS.map((g) => {
            const isOn = activeGroup?.key === g.key;
            const href = g.href ?? g.tabs[0]?.href ?? "/anbar";
            return (
              <Link
                key={g.key}
                href={href}
                data-active={isOn ? "true" : undefined}
                className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  isOn
                    ? "bg-gradient-to-b from-background to-background/80 text-primary shadow-md shadow-primary/10 ring-1 ring-primary/15"
                    : "text-muted-foreground hover:bg-background/60 hover:text-foreground hover:-translate-y-px active:translate-y-0"
                }`}
              >
                <g.Icon className="h-3.5 w-3.5" />
                <span>{g.label}</span>
              </Link>
            );
          })}
        </ScrollActiveIntoView>
      </div>

      {/* Secondary bar — only renders when a group is active and has 2+ tabs */}
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
                      ? "bg-primary/10 text-primary ring-1 ring-inset ring-primary/20 shadow-sm shadow-primary/10"
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
