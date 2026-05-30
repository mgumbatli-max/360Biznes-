"use client";

import { memo } from "react";
import { Menu } from "lucide-react";
import { useSidebar } from "@/stores/sidebar";
import { UserMenu } from "./user-menu";
import { Breadcrumb } from "./breadcrumb";
import { Clock } from "./clock";
import { CommandPaletteTrigger } from "./command-palette";
import { ThemeToggle } from "./theme-toggle";
import { NotificationBell, type NotificationItem } from "./notification-bell";
import { MyWork, type MyWorkData } from "./my-work";
import type { SessionUser } from "@/lib/auth/types";

type Props = {
  user: SessionUser;
  alerts?: NotificationItem[];
  unreadCount?: number;
  myWork?: MyWorkData;
};

const EMPTY_MY_WORK: MyWorkData = {
  myTasks: [],
  todayReminders: [],
  pendingApprovals: [],
  canSeeApprovals: false,
  totals: { tasks: 0, reminders: 0, approvals: 0 },
};

function TopbarComponent({ user, alerts = [], unreadCount = 0, myWork = EMPTY_MY_WORK }: Props) {
  const setMobileOpen = useSidebar((s) => s.setMobileOpen);

  return (
    <header className="glass sticky top-0 z-20 border-b border-border/60 pt-safe">
      <div className="flex h-14 items-center gap-2 px-4 md:px-6">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
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
          {/* Mobile: gizlət — yer az, command palette sidebar-da; tema dropdown-da */}
          <div className="hidden md:contents">
            <CommandPaletteTrigger />
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
