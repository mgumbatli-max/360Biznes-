"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCheck, ListTodo, Mail } from "lucide-react";
import { markAllBildirisRead } from "@/features/bildirisler/actions";
import {
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { NotificationItem } from "./notification-bell";

type Props = {
  items: NotificationItem[];
  unreadCount: number;
  onClose: () => void;
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

export default function NotificationBellBody({ items, unreadCount, onClose }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function markAllRead() {
    startTransition(async () => {
      // Həm alert-ləri, həm də şəxsi bildirişləri oxunmuş et
      try {
        await Promise.all([
          fetch("/api/alerts/mark-all-read", { method: "POST" }),
          markAllBildirisRead(),
        ]);
      } catch {
        /* noop */
      }
      router.refresh();
    });
  }

  function pickIcon(n: NotificationItem) {
    if (n.is_personal) {
      if (n.nov === "tapshiriq_yeni" || n.nov === "tapshiriq_status" || n.nov === "tapshiriq_xatirlatma" || n.nov === "tapshiriq_gecikdi") {
        return <ListTodo className="h-3.5 w-3.5" />;
      }
      return <Mail className="h-3.5 w-3.5" />;
    }
    if (n.kateqoriya_emoji) return <span className="text-sm">{n.kateqoriya_emoji}</span>;
    return <AlertTriangle className="h-3.5 w-3.5" />;
  }

  return (
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
            {items.map((n) => {
              const href = n.is_personal && n.link ? n.link : `/xeberdarliqlar/${n.id}`;
              return (
                <li key={`${n.is_personal ? "b" : "a"}-${n.id}`}>
                  <Link
                    href={href}
                    onClick={onClose}
                    className={cn(
                      "flex items-start gap-2 rounded-md px-2 py-2 transition hover:bg-secondary",
                      n.is_personal && !n.oxundu && "bg-primary/[0.04]",
                    )}
                  >
                    <div className={cn("mt-0.5 grid h-7 w-7 flex-shrink-0 place-items-center rounded-md", SEVERITY_TONE[n.seviyye] ?? SEVERITY_TONE.info)}>
                      {pickIcon(n)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className={cn("line-clamp-1 text-xs", !n.oxundu ? "font-semibold" : "font-medium")}>
                        {n.basliq}
                      </div>
                      <div className="text-[10.5px] text-muted-foreground">
                        {n.kateqoriya_ad} · {timeAgo(n.first_seen_at)}
                      </div>
                    </div>
                    {n.is_personal && !n.oxundu && (
                      <span className="ml-1 mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary" aria-label="yeni" />
                    )}
                  </Link>
                </li>
              );
            })}
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
          onClick={onClose}
          className="font-medium text-primary-light hover:underline"
        >
          Bütün bildirişlər →
        </Link>
      </div>
    </DropdownMenuContent>
  );
}
