"use client";

import { memo, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { X, PanelLeftClose, PanelLeftOpen, Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV_SECTIONS, canSeeNavItem, type NavItem } from "@/lib/navigation";
import { useSidebar } from "@/stores/sidebar";
import { usePermissions } from "@/components/providers/permissions-provider";
import { ThemeToggle } from "./theme-toggle";
import type { SessionUser } from "@/lib/auth/types";

/** Sidebar açıq vəziyyətdə sola-swipe ilə bağlanma — mobile gesture.
 *  Live drag preview (translateX), 60px və ya 25% drawer-genişliyi threshold. */
function useSwipeToClose(open: boolean, close: () => void) {
  const startX = useRef<number | null>(null);
  const [dragX, setDragX] = useState(0);
  const dragging = useRef(false);

  useEffect(() => {
    if (!open) {
      setDragX(0);
      return;
    }
    const onStart = (e: TouchEvent) => {
      startX.current = e.touches[0]?.clientX ?? null;
      dragging.current = true;
    };
    const onMove = (e: TouchEvent) => {
      if (!dragging.current || startX.current === null) return;
      const x = e.touches[0]?.clientX ?? 0;
      const delta = x - startX.current;
      // Yalnız sola sürüş — sağa pozitiv olur, biz onu ignor edirik
      if (delta < 0) {
        setDragX(Math.max(-288, delta)); // max sidebar width (w-72 = 288px)
      } else {
        setDragX(0);
      }
    };
    const onEnd = () => {
      if (!dragging.current) return;
      dragging.current = false;
      startX.current = null;
      // 60px və ya drawer-width-in 25%-i — hansı kiçikdir
      const threshold = Math.min(60, 288 * 0.25);
      if (dragX < -threshold) {
        close();
      }
      setDragX(0);
    };
    document.addEventListener("touchstart", onStart, { passive: true });
    document.addEventListener("touchmove", onMove, { passive: true });
    document.addEventListener("touchend", onEnd, { passive: true });
    document.addEventListener("touchcancel", onEnd, { passive: true });
    return () => {
      document.removeEventListener("touchstart", onStart);
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", onEnd);
      document.removeEventListener("touchcancel", onEnd);
    };
  }, [open, dragX, close]);

  return dragX;
}

type Props = {
  user: SessionUser;
  badges?: Record<string, { count: number; tone?: "rose" | "emerald" | "amber" }>;
  /** When false, the "Sahibkar bölməsi" item is removed from the sidebar entirely. */
  sahibkarVisible?: boolean;
  /** Lite-da gizlədilmiş modul kodları (href ilk seqmenti); Pro-da boş. */
  hiddenModules?: string[];
};

function SidebarComponent({ user, badges, sahibkarVisible = true, hiddenModules = [] }: Props) {
  const pathname = usePathname();
  const icazeler = usePermissions();
  const { collapsed, mobileOpen, setMobileOpen, toggleCollapsed } = useSidebar();
  const dragX = useSwipeToClose(mobileOpen, () => setMobileOpen(false));

  // NAV_SECTIONS filtering — yalnız rol/icazələr/sahibkar görünüş dəyişəndə yenidən hesabla.
  // Hər navigation-da 30+ nav item üçün canSeeNavItem() çağırışını qənaət edir.
  const sections = useMemo(() => {
    const ctx = { rolId: user.rol_id, rolAd: user.rol_ad, icazeler };
    return NAV_SECTIONS.map((sec) => ({
      ...sec,
      items: sec.items.filter((i) => {
        // Lite-da gizlədilmiş modul (href ilk seqmenti registry kodu ilə uyğun).
        const modul = i.href.split("/")[1] ?? "";
        if (hiddenModules.includes(modul)) return false;
        if (!canSeeNavItem(i, ctx)) return false;
        if (i.href === "/sahibkar" && !sahibkarVisible) return false;
        return true;
      }),
    })).filter((sec) => sec.items.length > 0);
  }, [user.rol_id, user.rol_ad, icazeler, sahibkarVisible, hiddenModules]);

  return (
    <>
      {/* Mobile backdrop */}
      {mobileOpen && (
        <button
          type="button"
          aria-label="Sidebar bağla"
          className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        style={
          // Live drag preview yalnız mobile-da, drag aktiv olduqda
          mobileOpen && dragX !== 0
            ? { transform: `translateX(${dragX}px)`, transition: "none" }
            : undefined
        }
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width,transform] duration-200",
          "md:sticky md:top-0 md:h-screen md:translate-x-0",
          collapsed ? "md:w-[72px]" : "md:w-64",
          "w-72 pt-safe pb-safe", // iOS notch + home bar
          mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}
      >
        <div className="flex h-14 items-center justify-between border-b border-sidebar-border px-3">
          <Link
            href="/dashboard"
            className={cn("flex items-center gap-2.5 overflow-hidden", collapsed && "md:justify-center md:w-full")}
          >
            <div className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-lg" style={{ background: "var(--brand-gradient)" }}>
              <span className="text-sm font-bold text-white">3</span>
            </div>
            {!collapsed && (
              <div className="flex flex-col leading-tight">
                <span className="brand-text text-base font-bold">360Biznes</span>
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {user.sahibkar_ad}
                </span>
              </div>
            )}
          </Link>

          {/* Mobile close — 44px touch target */}
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="inline-flex h-11 w-11 items-center justify-center rounded-md text-muted-foreground hover:bg-sidebar-accent hover:text-foreground active:bg-sidebar-accent/80 md:hidden"
            aria-label="Bağla"
          >
            <X className="h-5 w-5" />
          </button>

          {/* Desktop collapse */}
          <button
            type="button"
            onClick={toggleCollapsed}
            className={cn(
              "hidden rounded-md p-1.5 text-muted-foreground hover:bg-sidebar-accent hover:text-foreground md:inline-flex",
              collapsed && "md:hidden"
            )}
            aria-label="Yığ"
          >
            <PanelLeftClose className="h-4 w-4" />
          </button>
        </div>

        {/* Collapsed expand button */}
        {collapsed && (
          <button
            type="button"
            onClick={toggleCollapsed}
            className="mx-auto mt-2 hidden rounded-md p-1.5 text-muted-foreground hover:bg-sidebar-accent hover:text-foreground md:inline-flex"
            aria-label="Aç"
          >
            <PanelLeftOpen className="h-4 w-4" />
          </button>
        )}

        <nav className="flex-1 space-y-4 overflow-y-auto px-2 py-3">
          {sections.map((section) => (
            <div key={section.label}>
              {!collapsed && (
                <div className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/80">
                  {section.label}
                </div>
              )}
              <ul className="space-y-0.5">
                {section.items.map((item) => {
                  const matchesHref = pathname === item.href || pathname.startsWith(item.href + "/");
                  const matchesAlso = item.alsoActiveFor?.some(
                    (p) => pathname === p || pathname.startsWith(p + "/")
                  ) ?? false;
                  return (
                    <SidebarLink
                      key={item.href}
                      item={item}
                      active={matchesHref || matchesAlso}
                      collapsed={collapsed}
                      onClick={() => setMobileOpen(false)}
                      badge={badges?.[item.href]}
                    />
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className={cn("border-t border-sidebar-border px-2 py-2", collapsed && "md:px-1")}>
          <SidebarThemeButton collapsed={collapsed} />
        </div>
      </aside>
    </>
  );
}

// Layout hər navigation-da re-render olur; props stabil olduqda Sidebar
// (150+ LOC, 30+ nav item) yenidən hesablanmasın deyə memo.
export const Sidebar = memo(SidebarComponent);

function SidebarThemeButton({ collapsed }: { collapsed: boolean }) {
  return (
    <div className={cn("flex items-center gap-1 text-[11px] text-muted-foreground", collapsed && "md:justify-center")}>
      {!collapsed && <span className="ml-1 hidden md:inline">Tema</span>}
      <div className={cn("ml-auto", collapsed && "md:ml-0")}>
        <ThemeToggle />
      </div>
    </div>
  );
}

function SidebarLink({
  item,
  active,
  collapsed,
  onClick,
  badge,
}: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
  onClick: () => void;
  badge?: { count: number; tone?: "rose" | "emerald" | "amber" };
}) {
  const Icon = item.icon;
  const showBadge = badge && badge.count > 0;
  const toneClass =
    badge?.tone === "emerald"
      ? "bg-emerald-500 text-white"
      : badge?.tone === "amber"
      ? "bg-amber-500 text-white"
      : "bg-rose-500 text-white";
  return (
    <li>
      <Link
        href={item.href}
        prefetch={item.external ? false : true}
        onClick={onClick}
        title={collapsed ? item.label : undefined}
        target={item.external ? "_blank" : undefined}
        rel={item.external ? "noopener" : undefined}
        className={cn(
          "group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-all",
          active
            ? "sidebar-active-glow font-semibold text-foreground shadow-sm"
            : "text-muted-foreground hover:translate-x-0.5 hover:bg-sidebar-accent/60 hover:text-foreground",
          collapsed && "md:justify-center md:px-2"
        )}
      >
        {/* Active accent bar — wider with gradient */}
        {active && (
          <span
            aria-hidden
            className="absolute left-0 top-1/2 h-7 w-[3px] -translate-y-1/2 rounded-r-full shadow-md"
            style={{ background: "var(--brand-gradient)" }}
          />
        )}
        <span className="relative flex-shrink-0">
          <Icon className={cn("h-4 w-4", active && "text-primary-light")} />
          {showBadge && collapsed && (
            <span
              className={cn(
                "absolute -right-1.5 -top-1.5 grid h-3.5 w-3.5 place-items-center rounded-full text-[8px] font-bold",
                toneClass
              )}
              aria-label={`${badge.count} xatırlatma`}
            >
              {badge.count > 9 ? "9+" : badge.count}
            </span>
          )}
        </span>
        {!collapsed && (
          <>
            <span className="flex-1 truncate">{item.label}</span>
            {showBadge && (
              <span
                className={cn(
                  "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                  toneClass
                )}
                aria-label={`${badge.count} xatırlatma`}
                title={`${badge.count} aktiv xatırlatma`}
              >
                <Bell className="h-2.5 w-2.5" />
                {badge.count > 99 ? "99+" : badge.count}
              </span>
            )}
          </>
        )}
      </Link>
    </li>
  );
}
