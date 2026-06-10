"use client";

import { memo, useEffect, useRef, useState } from "react";
import { Menu } from "lucide-react";
import { useSidebar } from "@/stores/sidebar";
import { useAppMode } from "@/stores/app-mode";
import { useLiteMenu } from "@/stores/lite-menu";
import { cn } from "@/lib/utils";

/**
 * Mobile scroll-direction hook — istifadəçi aşağı scroll edirsə topbar-ı
 * gizlət, yuxarı scroll edəndə geri göstər. Daha çox content görünür.
 * Yalnız mobile-da fəaldır (768px-dən aşağı).
 */
function useHideOnScrollDown() {
  const [hidden, setHidden] = useState(false);
  const lastY = useRef(0);
  const ticking = useRef(false);

  useEffect(() => {
    // Yalnız mobil
    if (window.matchMedia("(min-width: 768px)").matches) return;

    const onScroll = () => {
      if (ticking.current) return;
      ticking.current = true;
      window.requestAnimationFrame(() => {
        const y = window.scrollY;
        const delta = y - lastY.current;
        // 80px-dən az scroll-da topbar həmişə görünsün
        if (y < 80) setHidden(false);
        else if (delta > 6) setHidden(true);
        else if (delta < -6) setHidden(false);
        lastY.current = y;
        ticking.current = false;
      });
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return hidden;
}
import { UserMenu } from "./user-menu";
import { Breadcrumb } from "./breadcrumb";
import { Clock } from "./clock";
import { CommandPaletteTrigger } from "./command-palette";
import { ThemeToggle } from "./theme-toggle";
import { NotificationBell, type NotificationItem } from "./notification-bell";
import { MyWork, type MyWorkData } from "./my-work";
import { AppModeToggle } from "./app-mode-toggle";
import type { AppMode } from "@/stores/app-mode";
import type { SessionUser } from "@/lib/auth/types";

type Props = {
  user: SessionUser;
  alerts?: NotificationItem[];
  unreadCount?: number;
  myWork?: MyWorkData;
  appMode?: AppMode;
};

const EMPTY_MY_WORK: MyWorkData = {
  myTasks: [],
  todayReminders: [],
  pendingApprovals: [],
  canSeeApprovals: false,
  totals: { tasks: 0, reminders: 0, approvals: 0 },
};

function TopbarComponent({ user, alerts = [], unreadCount = 0, myWork = EMPTY_MY_WORK, appMode }: Props) {
  const setMobileOpen = useSidebar((s) => s.setMobileOpen);
  const setLiteMenuOpen = useLiteMenu((s) => s.setOpen);
  const clientMode = useAppMode((s) => s.mode);
  const hidden = useHideOnScrollDown();
  // Lite-da mobil hamburger yan drawer ƏVƏZİNƏ sadə modul grid-ini açır
  const liteNow = (clientMode ?? appMode) === "lite";

  return (
    <header
      className={cn(
        "glass sticky top-0 z-20 border-b border-border/60 pt-safe transition-transform duration-200",
        // Mobile-da scroll-down zamanı yuxarı sürüş — md+-də həmişə görünür
        hidden && "-translate-y-full md:translate-y-0",
      )}
    >
      <div className="flex h-14 items-center gap-2 px-4 md:px-6">
        <button
          type="button"
          onClick={() => (liteNow ? setLiteMenuOpen(true) : setMobileOpen(true))}
          className="inline-flex h-11 w-11 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground active:bg-secondary/80 md:hidden"
          aria-label="Naviqasiya menyusu"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="hidden lg:block">
          <Breadcrumb />
        </div>
        <div className="lg:hidden">
          <Breadcrumb compact />
        </div>

        <div className="ml-auto flex items-center gap-1.5">
          {/* Qlobal Lite/Pro keçidi — hər səhifədə görünür */}
          <AppModeToggle serverMode={appMode} />
          {/* Axtarış həmişə görünür — mobildə kompakt ikon, md+-də enli qutu (komponentin öz daxili variantı) */}
          <CommandPaletteTrigger />
          {/* Tema mobildə gizli — user dropdown-da var */}
          <div className="hidden md:contents">
            <ThemeToggle />
          </div>
          <MyWork data={myWork} />
          <NotificationBell items={alerts} unreadCount={unreadCount} />
          <div className="hidden sm:contents">
            <Clock />
          </div>
          <UserMenu user={user} />
        </div>
      </div>
    </header>
  );
}

// Layout hər navigation-da re-render olur; props (user/alerts/myWork) stabil
// olduqda Topbar yenidən render olmasın.
export const Topbar = memo(TopbarComponent);
