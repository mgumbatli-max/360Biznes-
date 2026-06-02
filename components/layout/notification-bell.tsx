"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Bell } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type NotificationItem = {
  id: string;
  basliq: string;
  seviyye: string;
  kateqoriya_ad: string;
  kateqoriya_emoji: string | null;
  first_seen_at: string | null;
  /** Şəxsi bildiriş (bildirisler-dən gəlir) — alert ilə əlaqəsiz */
  is_personal?: boolean;
  /** Şəxsi bildiriş üçün hədəf link (məs. /tapshiriqlar/123) */
  link?: string | null;
  /** Şəxsi bildirişin oxunma vəziyyəti */
  oxundu?: boolean;
  /** Şəxsi bildirişin tipi (tapshiriq_yeni, tapshiriq_status, tapshiriq_xatirlatma, tapshiriq_gecikdi) */
  nov?: string;
};

type Props = {
  items: NotificationItem[];
  unreadCount: number;
};

const NotificationBellBody = dynamic(() => import("./notification-bell-body"), {
  ssr: false,
});

export function NotificationBell({ items, unreadCount }: Props) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  return (
    <DropdownMenu
      open={open}
      onOpenChange={(v) => {
        if (v) setMounted(true);
        setOpen(v);
      }}
    >
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Bildirişlər"
          className="relative inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition hover:bg-secondary hover:text-foreground"
          data-notification-bell
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span
              className="absolute -right-0.5 -top-0.5 grid h-4 min-w-[1rem] place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold text-white animate-pulse-glow"
              aria-label={`${unreadCount} oxunmamış`}
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      {mounted && (
        <NotificationBellBody
          items={items}
          unreadCount={unreadCount}
          onClose={() => setOpen(false)}
        />
      )}
    </DropdownMenu>
  );
}
