"use client";

import { memo, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  ScanLine,
  Users,
  Menu,
  Sparkles,
  LayoutGrid,
  ListTodo,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSidebar } from "@/stores/sidebar";
import { useAppMode } from "@/stores/app-mode";
import { useLiteMenu } from "@/stores/lite-menu";

type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  external?: boolean;
  /** Bu route prefiks-i altında olan səhifələrdə də aktiv görünsün. */
  alsoActive?: string[];
};

const PRO_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Əsas", icon: LayoutDashboard },
  { href: "/anbar", label: "Anbar", icon: Package, alsoActive: ["/anbar"] },
  { href: "/pos", label: "POS", icon: ScanLine, external: true },
  { href: "/elaqe", label: "Müştəri", icon: Users, alsoActive: ["/elaqe", "/crm"] },
];

/**
 * Mobil bottom navigation — yalnız `md:hidden`.
 * LITE: Əsas | POS | ✦AI (mərkəzi, qabarıq) | Tapşırıq | Modullar(grid).
 * PRO:  köhnə düzülüş + Menyu → sidebar drawer.
 */
function BottomNavComponent() {
  const pathname = usePathname();
  const setMobileOpen = useSidebar((s) => s.setMobileOpen);
  const setLiteMenuOpen = useLiteMenu((s) => s.setOpen);
  const mode = useAppMode((s) => s.mode);
  const hydrate = useAppMode((s) => s.hydrate);
  useEffect(() => {
    hydrate();
  }, [hydrate]);
  const lite = mode === "lite";

  const itemCls = (active: boolean) =>
    cn(
      "relative flex h-full w-full flex-col items-center justify-center gap-0.5 px-1 py-2",
      "text-[10px] font-medium transition-colors active:bg-secondary/40",
      active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
    );

  const ActiveBar = () => (
    <span
      aria-hidden
      className="absolute top-0 left-1/2 h-[3px] w-10 -translate-x-1/2 rounded-b-full"
      style={{ background: "var(--brand-gradient)" }}
    />
  );

  if (lite) {
    const isActive = (href: string, also?: string[]) =>
      pathname === href || (also?.some((p) => pathname === p || pathname.startsWith(p + "/")) ?? false);
    const aiActive = pathname.startsWith("/komekci");
    return (
      <nav
        aria-label="Əsas naviqasiya"
        className={cn(
          "fixed bottom-0 left-0 right-0 z-30 md:hidden",
          "border-t border-border/60 bg-card/95 backdrop-blur-lg",
          "pb-safe",
        )}
      >
        <ul className="flex h-15 items-stretch">
          <li className="flex-1">
            <Link href="/dashboard" prefetch className={itemCls(isActive("/dashboard"))}>
              {isActive("/dashboard") && <ActiveBar />}
              <LayoutDashboard className={cn("h-5 w-5", isActive("/dashboard") && "scale-110 text-primary-light")} />
              <span className="leading-none">Əsas</span>
            </Link>
          </li>
          <li className="flex-1">
            <Link href="/pos" target="_blank" rel="noopener" className={itemCls(false)}>
              <ScanLine className="h-5 w-5" />
              <span className="leading-none">POS</span>
            </Link>
          </li>
          {/* Mərkəzi AI — qabarıq, yuxarı qalxmış dairə */}
          <li className="relative flex-1">
            <Link
              href="/komekci?tab=biznes"
              prefetch
              aria-label="Süni İntellekt"
              className="flex h-full flex-col items-center justify-end pb-1.5 text-[10px] font-semibold"
            >
              <span
                className={cn(
                  "absolute -top-5 grid h-14 w-14 place-items-center rounded-full text-white shadow-lg",
                  "ring-4 ring-background transition-transform active:scale-95",
                  aiActive && "scale-105",
                )}
                style={{ background: "var(--brand-gradient)" }}
              >
                <Sparkles className="h-6 w-6" />
              </span>
              <span className={cn("leading-none", aiActive ? "text-foreground" : "text-muted-foreground")}>AI</span>
            </Link>
          </li>
          <li className="flex-1">
            <Link
              href="/tapshiriqlar"
              prefetch
              className={itemCls(isActive("/tapshiriqlar", ["/tapshiriqlar"]))}
            >
              {isActive("/tapshiriqlar", ["/tapshiriqlar"]) && <ActiveBar />}
              <ListTodo className={cn("h-5 w-5", isActive("/tapshiriqlar", ["/tapshiriqlar"]) && "scale-110 text-primary-light")} />
              <span className="leading-none">Tapşırıq</span>
            </Link>
          </li>
          <li className="flex-1">
            <button
              type="button"
              onClick={() => setLiteMenuOpen(true)}
              aria-label="Modullar"
              className={itemCls(false)}
            >
              <LayoutGrid className="h-5 w-5" />
              <span className="leading-none">Modullar</span>
            </button>
          </li>
        </ul>
      </nav>
    );
  }

  // ── PRO: köhnə düzülüş ──
  return (
    <nav
      aria-label="Əsas naviqasiya"
      className={cn(
        "fixed bottom-0 left-0 right-0 z-30 md:hidden",
        "border-t border-border/60 bg-card/95 backdrop-blur-lg",
        "pb-safe",
      )}
    >
      <ul className="flex h-15 items-stretch">
        {PRO_ITEMS.map((item) => {
          const Icon = item.icon;
          const active =
            pathname === item.href ||
            (item.alsoActive?.some((p) => pathname === p || pathname.startsWith(p + "/")) ?? false);
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                target={item.external ? "_blank" : undefined}
                rel={item.external ? "noopener" : undefined}
                prefetch={!item.external}
                className={itemCls(active)}
              >
                {active && <ActiveBar />}
                <Icon className={cn("h-5 w-5 transition-transform", active && "scale-110 text-primary-light")} />
                <span className="leading-none">{item.label}</span>
              </Link>
            </li>
          );
        })}
        <li className="flex-1">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label="Bütün menyu"
            className={itemCls(false)}
          >
            <Menu className="h-5 w-5" />
            <span className="leading-none">Menyu</span>
          </button>
        </li>
      </ul>
    </nav>
  );
}

export const BottomNav = memo(BottomNavComponent);
