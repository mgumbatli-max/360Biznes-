"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, AlertTriangle, CheckCheck } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type NotificationItem = {
  id: string;
  basliq: string;
  seviyye: string;
  kateqoriya_ad: string;
  kateqoriya_emoji: string | null;
  first_seen_at: string | null;
};

type Props = {
  items: NotificationItem[];
  unreadCount: number;
};

function timeAgo(iso: string | null): string {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "—";
  const diff = Math.max(0, Date.now() - t);
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "indi";
  if (mins < 60) return `${mins} dəq`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} saat`;
  const days = Math.floor(hrs / 24);
  return `${days} gün`;
}

const SEVERITY_TONE: Record<string, string> = {
  kritik: "bg-rose-500/15 text-rose-500",
  risk: "bg-amber-500/15 text-amber-500",
  xeber: "bg-blue-500/15 text-blue-400",
  info: "bg-secondary text-muted-foreground",
};

export function NotificationBell({ items, unreadCount }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function markAllRead() {
    startTransition(async () => {
      try {
        await fetch("/api/alerts/mark-all-read", { method: "POST" });
      } catch {
        /* noop */
      }
      router.refresh();
    });
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
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

      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between font-normal">
          <span className="text-sm font-semibold">Bildirişlər</span>
          <Badge variant="secondary" className="h-5 text-[10px]">
            {unreadCount} yeni
          </Badge>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        <div className="max-h-80 overflow-y-auto">
          {items.length === 0 ? (
            <div className="flex flex-col items-center gap-1 py-6 text-center text-xs text-muted-foreground">
              <CheckCheck className="h-5 w-5 text-success" />
              <span>Açıq bildiriş yoxdur.</span>
            </div>
          ) : (
            <ul className="space-y-1 px-1 py-1">
              {items.map((n) => (
                <li key={n.id}>
                  <Link
                    href={`/xeberdarliqlar/${n.id}`}
                    onClick={() => setOpen(false)}
                    className="flex items-start gap-2 rounded-md px-2 py-2 transition hover:bg-secondary"
                  >
                    <div className={cn("mt-0.5 grid h-7 w-7 flex-shrink-0 place-items-center rounded-md", SEVERITY_TONE[n.seviyye] ?? SEVERITY_TONE.info)}>
                      {n.kateqoriya_emoji ? (
                        <span className="text-sm">{n.kateqoriya_emoji}</span>
                      ) : (
                        <AlertTriangle className="h-3.5 w-3.5" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="line-clamp-1 text-xs font-medium">{n.basliq}</div>
                      <div className="text-[10.5px] text-muted-foreground">
                        {n.kateqoriya_ad} · {timeAgo(n.first_seen_at)}
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <DropdownMenuSeparator />
        <div className="flex items-center justify-between px-2 py-1.5 text-xs">
          <button
            type="button"
            onClick={markAllRead}
            disabled={pending || unreadCount === 0}
            className="text-primary-light hover:underline disabled:opacity-40"
          >
            Hamısını oxunmuş işarələ
          </button>
          <Link
            href="/xeberdarliqlar"
            onClick={() => setOpen(false)}
            className="font-medium text-primary-light hover:underline"
          >
            Bütün bildirişlər →
          </Link>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
