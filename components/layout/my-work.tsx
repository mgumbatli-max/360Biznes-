"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { ClipboardList } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type MyWorkItem = {
  id: string;
  basliq: string;
  meta: string | null;
  href: string;
};

export type MyWorkData = {
  myTasks: MyWorkItem[];
  todayReminders: MyWorkItem[];
  pendingApprovals: MyWorkItem[];
  canSeeApprovals: boolean;
  totals: { tasks: number; reminders: number; approvals: number };
};

// Body 300+ sətir + dismissReminder/snoozeReminder server-action import-ları
// var. Yalnız dropdown açıldıqda yüklənir → topbar bundle 15-20 KB azalır.
const MyWorkBody = dynamic(() => import("./my-work-body"), { ssr: false });

type Props = { data: MyWorkData };

export function MyWork({ data }: Props) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const badgeCount =
    data.totals.reminders + (data.canSeeApprovals ? data.totals.approvals : 0);

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
          aria-label="Mənim işim"
          className="relative inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition hover:bg-secondary hover:text-foreground"
        >
          <ClipboardList className="h-4 w-4" />
          {badgeCount > 0 && (
            <span
              className="absolute -right-0.5 -top-0.5 grid h-4 min-w-[1rem] place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold text-white"
              aria-label={`${badgeCount} aktiv element`}
            >
              {badgeCount > 9 ? "9+" : badgeCount}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      {mounted && <MyWorkBody data={data} onClose={() => setOpen(false)} />}
    </DropdownMenu>
  );
}
