import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  ShieldAlert,
  ScanLine,
  ListTodo,
  Package,
  ShoppingCart,
  Wrench,
  Wallet,
  Contact2,
  MessagesSquare,
  Users,
  BarChart3,
  Sparkles,
  Lock,
  Building2,
  Settings,
  Store,
  FlaskConical,
  HelpCircle,
  Megaphone,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** When true, the sidebar opens this link in a new window/tab (target="_blank"). */
  external?: boolean;
  /** Visibility rule. If omitted, item is visible to anyone with auth. */
  requires?: {
    /** Show only when user has at least one of these permission codes. */
    anyPermission?: string[];
    /** Show only when user.rol_id is in this list (legacy — use roleNames instead). */
    roleIds?: number[];
    /** Show only when user.rol_ad is in this list (multi-tenant-safe). */
    roleNames?: string[];
    /** Show only when user.rol_ad === "admin" (system admin). */
    systemAdminOnly?: boolean;
  };
  /**
   * Additional path prefixes that should highlight this item as active.
   * Used when one sidebar entry owns multiple top-level routes (e.g. Nəzarət Mərkəzi
   * covers /xeberdarliqlar, /tesdiq, /avtomatlasdirma too).
   */
  alsoActiveFor?: string[];
};

export type NavSection = {
  label: string;
  items: NavItem[];
};

/**
 * Sidebar is organized into 3 simple sections:
 *  1. Əsas        — daily-use, dashboards, alerts, POS, tasks, reports, AI
 *  2. Əməliyyatlar — core ERP modules: warehouse, sales, finance, service, contacts, team
 *  3. Proseslər və Sistem — workflows, communication, integrations, admin, settings
 *
 * Audit log lives inside Ayarlar (settings), not in the sidebar.
 * Marketplace + Webhook are grouped under the third section as integrations.
 */
export const NAV_SECTIONS: NavSection[] = [
  {
    label: "Əsas",
    items: [
      {
        href: "/dashboard",
        label: "Dashboard",
        icon: LayoutDashboard,
        requires: { anyPermission: ["dashboard.oxu"] },
      },
      {
        href: "/nezaret-merkezi",
        label: "Nəzarət Mərkəzi",
        icon: ShieldAlert,
        alsoActiveFor: ["/xeberdarliqlar", "/tesdiq", "/avtomatlasdirma"],
        requires: { anyPermission: ["nezaret.oxu"] },
      },
      { href: "/pos", label: "POS / İsti satış", icon: ScanLine, external: true },
      { href: "/tapshiriqlar", label: "Tapşırıqlar", icon: ListTodo },
      { href: "/komekci", label: "Köməkçi + AI", icon: Sparkles, alsoActiveFor: ["/ai"] },
    ],
  },
  {
    label: "Əməliyyatlar",
    items: [
      { href: "/anbar", label: "Anbar", icon: Package },
      { href: "/ticaret", label: "Ticarət", icon: ShoppingCart },
      { href: "/maliyye", label: "Maliyyə", icon: Wallet },
      { href: "/servis", label: "Servis", icon: Wrench },
      { href: "/elaqe", label: "Əlaqələr", icon: Contact2 },
      { href: "/iscilier", label: "Əməkdaşlar", icon: Users },
      {
        href: "/kampaniyalar",
        label: "Kampaniyalar",
        icon: Megaphone,
        requires: { anyPermission: ["kampaniya.oxu"] },
      },
    ],
  },
  {
    label: "Proseslər və Sistem",
    items: [
      { href: "/team", label: "Team / Söhbət", icon: MessagesSquare },
      { href: "/crm", label: "CRM / Mesaj Mərkəzi", icon: Contact2 },
      { href: "/marketplace", label: "Marketplace & Webhook", icon: Store },
      {
        href: "/sahibkar",
        label: "Sahibkar bölməsi",
        icon: Lock,
        requires: { roleNames: ["sahibkar"] },
      },
      { href: "/360-lab", label: "360 LAB", icon: FlaskConical },
      { href: "/hesabatlar", label: "Hesabatlar", icon: BarChart3 },
      { href: "/ayarlar", label: "Ayarlar", icon: Settings },
      {
        href: "/platform-admin",
        label: "Platform Admin",
        icon: Building2,
        requires: { systemAdminOnly: true },
      },
    ],
  },
];

/** Flatten for command palette + breadcrumb resolution. */
export const FLAT_NAV: NavItem[] = NAV_SECTIONS.flatMap((s) => s.items);

/** Resolve current item by pathname prefix match. */
export function resolveNavItem(pathname: string): NavItem | undefined {
  // Exact match first
  const exact = FLAT_NAV.find((i) => i.href === pathname);
  if (exact) return exact;
  // Prefix match (longest first)
  return [...FLAT_NAV]
    .sort((a, b) => b.href.length - a.href.length)
    .find((i) => pathname.startsWith(i.href + "/"));
}

/** Whether a user with the given role/permissions can see this item. */
export function canSeeNavItem(
  item: NavItem,
  ctx: { rolId: number; rolAd?: string; icazeler: string[]; isSuperAdmin?: boolean }
): boolean {
  const req = item.requires;
  if (!req) return true;
  // Multi-tenant: ad üzrə yoxlama (rolId nömrəsi tenant-dan-tenanta dəyişir).
  // Super-admin (rol_id=1 və ya email allowlist) — server tərəfdə hesablanıb prop kimi gəlir.
  if (req.systemAdminOnly && !ctx.isSuperAdmin) return false;
  if (req.roleNames && (!ctx.rolAd || !req.roleNames.includes(ctx.rolAd))) return false;
  if (req.roleIds && !req.roleIds.includes(ctx.rolId)) return false;
  if (req.anyPermission && req.anyPermission.length) {
    // Sahibkar / admin / owner rolları icazə kataloqundan asılı olmadan
    // bütün modulları sidebar-da görür (route-gate ilə eyni davranış).
    const r = (ctx.rolAd ?? "").toLowerCase();
    if (r.includes("sahibkar") || r.includes("admin") || r.includes("owner")) return true;
    return req.anyPermission.some((p) => ctx.icazeler.includes(p));
  }
  return true;
}
