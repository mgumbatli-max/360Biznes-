"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ClipboardList, ArrowRight, ListTodo, AlarmClock, ShieldCheck, Check, Clock, Sunrise, Loader2, EyeOff } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { dismissReminder, snoozeReminder, dismissAllReminders } from "@/features/tapshiriqlar/reminder-ack";

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

type Props = { data: MyWorkData };

export function MyWork({ data }: Props) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const [bulkPending, startBulk] = useTransition();
  const badgeCount =
    data.totals.reminders + (data.canSeeApprovals ? data.totals.approvals : 0);

  const handleDismissAll = () => {
    startBulk(async () => {
      await dismissAllReminders();
      router.refresh();
    });
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
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

      <DropdownMenuContent align="end" className="w-[24rem]">
        <DropdownMenuLabel className="flex items-center justify-between font-normal">
          <span className="text-sm font-semibold">Mənim işim</span>
          <Badge variant="secondary" className="h-5 text-[10px]">
            {data.totals.tasks} açıq tapşırıq
          </Badge>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        <div className="max-h-[28rem] overflow-y-auto px-1 py-1">
          <Section
            title="Mənə təyin olunmuş"
            icon={<ListTodo className="h-3.5 w-3.5 text-rose-500" />}
            items={data.myTasks}
            total={data.totals.tasks}
            seeAllHref="/tapshiriqlar?mesul_id=me"
            onNavigate={() => setOpen(false)}
            emptyText="Açıq tapşırıq yoxdur."
          />

          <SectionDivider />

          <ReminderSection
            items={data.todayReminders}
            total={data.totals.reminders}
            onNavigate={() => setOpen(false)}
            onDismissAll={handleDismissAll}
            bulkPending={bulkPending}
          />

          {data.canSeeApprovals && (
            <>
              <SectionDivider />
              <Section
                title="Təsdiqimi gözləyən"
                icon={<ShieldCheck className="h-3.5 w-3.5 text-violet-500" />}
                items={data.pendingApprovals}
                total={data.totals.approvals}
                seeAllHref="/tesdiq"
                onNavigate={() => setOpen(false)}
                emptyText="Gözləyən sorğu yoxdur."
              />
            </>
          )}
        </div>

        <DropdownMenuSeparator />
        <div className="flex items-center justify-between px-2 py-1.5 text-xs">
          <span className="text-muted-foreground">Tez giriş üçün</span>
          <Link
            href="/tapshiriqlar?mesul_id=me"
            onClick={() => setOpen(false)}
            className="inline-flex items-center gap-1 font-medium text-primary-light hover:underline"
          >
            Hamısını gör <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function SectionDivider() {
  return <div className="my-1 h-px bg-border/60" />;
}

function ReminderSection({
  items,
  total,
  onNavigate,
  onDismissAll,
  bulkPending,
}: {
  items: MyWorkItem[];
  total: number;
  onNavigate: () => void;
  onDismissAll: () => void;
  bulkPending: boolean;
}) {
  return (
    <div className="px-1.5 py-1">
      <div className="mb-1 flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
          <AlarmClock className="h-3.5 w-3.5 text-amber-500" />
          Xatırlatmalar
        </span>
        <div className="flex items-center gap-1.5">
          {total > 0 && (
            <span className="rounded-full bg-secondary px-1.5 py-px text-[9.5px] font-medium text-muted-foreground">
              {total}
            </span>
          )}
          {total > 0 && (
            <button
              type="button"
              onClick={onDismissAll}
              disabled={bulkPending}
              className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-1.5 py-0.5 text-[9.5px] font-semibold text-muted-foreground hover:border-emerald-500/40 hover:text-emerald-500 disabled:opacity-50"
              title="Bütün xatırlatmaları gizlət"
            >
              {bulkPending ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <EyeOff className="h-2.5 w-2.5" />}
              Hamısı
            </button>
          )}
        </div>
      </div>
      {items.length === 0 ? (
        <p className="px-1.5 py-1 text-xs text-muted-foreground">Aktiv xatırlatma yoxdur.</p>
      ) : (
        <ul className="space-y-1">
          {items.map((it) => (
            <ReminderRow key={it.id} item={it} onNavigate={onNavigate} />
          ))}
        </ul>
      )}
      {total > items.length && (
        <Link
          href="/tapshiriqlar?mesul_id=me&sort=xatirlatma"
          onClick={onNavigate}
          className="mt-1 inline-flex w-full items-center justify-end gap-1 px-2 py-1 text-[10.5px] text-primary-light hover:underline"
        >
          Daha çox ({total - items.length}) <ArrowRight className="h-3 w-3" />
        </Link>
      )}
    </div>
  );
}

function ReminderRow({ item, onNavigate }: { item: MyWorkItem; onNavigate: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const handleDismiss = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    startTransition(async () => {
      await dismissReminder(item.id);
      router.refresh();
    });
  };

  const handleSnooze = (e: React.MouseEvent, mode: "1h" | "4h" | "sabah") => {
    e.preventDefault();
    e.stopPropagation();
    startTransition(async () => {
      await snoozeReminder(item.id, mode);
      router.refresh();
    });
  };

  return (
    <li className="group rounded-md border border-border/40 px-2 py-1.5 transition hover:border-amber-500/40 hover:bg-amber-500/5">
      <Link
        href={item.href}
        onClick={onNavigate}
        className="block"
      >
        <span className="line-clamp-1 text-xs font-medium">{item.basliq}</span>
        {item.meta && (
          <span className="line-clamp-1 text-[10.5px] text-muted-foreground">
            {item.meta}
          </span>
        )}
      </Link>
      <div className="mt-1.5 flex items-center gap-1">
        <button
          type="button"
          onClick={handleDismiss}
          disabled={pending}
          title="Görüldü — xatırlatmanı gizlət"
          className="inline-flex h-6 items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/5 px-1.5 text-[10px] font-semibold text-emerald-500 hover:bg-emerald-500/15 disabled:opacity-50"
        >
          {pending ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Check className="h-2.5 w-2.5" />}
          Görüldü
        </button>
        <div className="flex h-6 overflow-hidden rounded-md border border-border/60 bg-card">
          <button
            type="button"
            onClick={(e) => handleSnooze(e, "1h")}
            disabled={pending}
            title="1 saat sonra xatırlat"
            className="inline-flex items-center gap-0.5 px-1.5 text-[10px] font-medium text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-50"
          >
            <Clock className="h-2.5 w-2.5" />
            1s
          </button>
          <div className="h-full w-px bg-border/60" />
          <button
            type="button"
            onClick={(e) => handleSnooze(e, "4h")}
            disabled={pending}
            title="4 saat sonra xatırlat"
            className="inline-flex items-center gap-0.5 px-1.5 text-[10px] font-medium text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-50"
          >
            4s
          </button>
          <div className="h-full w-px bg-border/60" />
          <button
            type="button"
            onClick={(e) => handleSnooze(e, "sabah")}
            disabled={pending}
            title="Sabah 09:00-da xatırlat"
            className="inline-flex items-center gap-0.5 px-1.5 text-[10px] font-medium text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-50"
          >
            <Sunrise className="h-2.5 w-2.5" />
            Sabah
          </button>
        </div>
      </div>
    </li>
  );
}

function Section({
  title,
  icon,
  items,
  total,
  seeAllHref,
  onNavigate,
  emptyText,
}: {
  title: string;
  icon: React.ReactNode;
  items: MyWorkItem[];
  total: number;
  seeAllHref: string;
  onNavigate: () => void;
  emptyText: string;
}) {
  return (
    <div className="px-1.5 py-1">
      <div className="mb-1 flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
          {icon}
          {title}
        </span>
        {total > 0 && (
          <span className="rounded-full bg-secondary px-1.5 py-px text-[9.5px] font-medium text-muted-foreground">
            {total}
          </span>
        )}
      </div>
      {items.length === 0 ? (
        <p className="px-1.5 py-1 text-xs text-muted-foreground">{emptyText}</p>
      ) : (
        <ul className="space-y-0.5">
          {items.map((it) => (
            <li key={it.id}>
              <Link
                href={it.href}
                onClick={onNavigate}
                className="flex flex-col gap-0.5 rounded-md px-2 py-1.5 transition hover:bg-secondary"
              >
                <span className="line-clamp-1 text-xs font-medium">{it.basliq}</span>
                {it.meta && (
                  <span className="line-clamp-1 text-[10.5px] text-muted-foreground">
                    {it.meta}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
      {total > items.length && (
        <Link
          href={seeAllHref}
          onClick={onNavigate}
          className="mt-1 inline-flex w-full items-center justify-end gap-1 px-2 py-1 text-[10.5px] text-primary-light hover:underline"
        >
          Daha çox ({total - items.length}) <ArrowRight className="h-3 w-3" />
        </Link>
      )}
    </div>
  );
}
