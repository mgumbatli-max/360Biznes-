"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarClock, MessageSquare, CheckSquare, Bell, Plus } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { az } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn, formatDate } from "@/lib/utils";
import { useMounted } from "@/lib/hooks/use-mounted";
import { toast } from "sonner";
import { PriorityBadge } from "./task-badges";
import { ReminderDialog } from "./reminder-dialog";
import { QuickStatusButtons } from "./quick-status-buttons";
import { colorHexFor } from "./color-picker";
import type { TaskListItem } from "../queries";

const COLUMNS = [
  { key: "icrada", title: "İcradadır", tone: "border-warning/40 bg-warning/5" },
  { key: "yeni", title: "Gözləyir", tone: "border-info/40 bg-info/5" },
  { key: "gozlemede", title: "Yoxlanılır", tone: "border-primary/40 bg-primary/5" },
  { key: "tamamlandi", title: "Tamamlandı", tone: "border-success/40 bg-success/5" },
  { key: "legv", title: "Ləğv", tone: "border-muted bg-muted/5" },
] as const;

type ReminderState = { taskId: string; basliq: string; defaultDt: string | null } | null;

type UserOpt = { id: string; ad_soyad: string; vezife?: string | null };

export function KanbanBoard({ items, users = [] }: { items: TaskListItem[]; users?: UserOpt[] }) {
  const [reminder, setReminder] = useState<ReminderState>(null);

  const buckets = new Map<string, TaskListItem[]>();
  for (const c of COLUMNS) buckets.set(c.key, []);
  for (const t of items) {
    const key = buckets.has(t.status) ? t.status : "yeni";
    buckets.get(key)!.push(t);
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {COLUMNS.map((col) => {
          const list = buckets.get(col.key) ?? [];
          return (
            <div
              key={col.key}
              className={cn("flex min-h-[160px] flex-col rounded-xl border p-2", col.tone)}
            >
              <header className="mb-2 flex items-center justify-between px-1.5">
                <h3 className="text-xs font-semibold uppercase tracking-wider">{col.title}</h3>
                <Badge variant="outline" className="text-[10px]">{list.length}</Badge>
              </header>
              <div className="space-y-2">
                {list.length === 0 ? (
                  <div className="px-2 py-4 text-center text-[10.5px] text-muted-foreground">—</div>
                ) : (
                  list.map((t) => (
                    <KanbanCard
                      key={t.id}
                      task={t}
                      onReminder={() =>
                        setReminder({
                          taskId: t.id,
                          basliq: t.basliq,
                          defaultDt: t.xatirlatma ? t.xatirlatma.toISOString() : null,
                        })
                      }
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}

        <button
          type="button"
          onClick={() => toast.info("Custom sütunlar tezliklə əlavə olunacaq")}
          className="flex min-h-[160px] flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-border/60 bg-card/20 p-3 text-xs text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
        >
          <Plus className="h-5 w-5" />
          <span>Yeni sütun</span>
        </button>
      </div>

      {reminder && (
        <ReminderDialog
          open={true}
          onOpenChange={(o) => !o && setReminder(null)}
          taskId={reminder.taskId}
          taskBasliq={reminder.basliq}
          defaultDatetime={reminder.defaultDt}
          users={users}
        />
      )}
    </>
  );
}

function reminderTone(t: TaskListItem, now: Date, mounted: boolean): { color: string; tip: string } {
  if (!t.xatirlatma) {
    return { color: "text-slate-400 hover:text-slate-600", tip: "Xatırlatma qoy" };
  }
  // "keçib" render-də cari vaxtla müqayisə → SSR/hidratasiya fərqi (React #418).
  // Mount-dan əvvəl neytral "planlaşdırılıb", sonra brauzerdə cari vaxta görə yenilənir.
  if (mounted && t.xatirlatma.getTime() < now.getTime()) {
    return { color: "text-rose-500", tip: "Xatırlatma vaxtı keçib" };
  }
  return { color: "text-emerald-500", tip: "Xatırlatma planlaşdırılıb" };
}

function KanbanCard({ task, onReminder }: { task: TaskListItem; onReminder: () => void }) {
  const mounted = useMounted();
  const now = new Date();
  const overdue =
    mounted &&
    task.deadline &&
    task.deadline < now &&
    task.status !== "tamamlandi" &&
    task.status !== "legv";
  const rem = reminderTone(task, now, mounted);
  const reng = colorHexFor(task.reng);

  return (
    <div
      className="group relative rounded-md border border-border bg-card/80 p-2 text-sm shadow-sm transition hover:border-primary/40 hover:shadow"
      style={reng ? { borderLeftWidth: 3, borderLeftColor: reng } : undefined}
    >
      <Link href={`/tapshiriqlar/${task.id}`} className="block">
        <div className="flex items-start justify-between gap-2 pr-6">
          <PriorityBadge value={task.prioritet} />
          {overdue && (
            <span className="inline-flex items-center rounded-full bg-danger/15 px-1.5 py-0.5 text-[9px] font-medium text-danger">
              Gecikib
            </span>
          )}
        </div>
        <div className="mt-1 line-clamp-2 text-xs font-medium">{task.basliq}</div>
        <div className="mt-2 flex items-center justify-between gap-1 text-[10px] text-muted-foreground">
          <div className="flex items-center gap-1.5">
            {task.deadline && (
              <span className={cn("inline-flex items-center gap-0.5", overdue && "text-danger")}>
                <CalendarClock className="h-2.5 w-2.5" />
                {mounted ? formatDistanceToNow(task.deadline, { addSuffix: true, locale: az }) : formatDate(task.deadline)}
              </span>
            )}
            {task.comment_count > 0 && (
              <span className="inline-flex items-center gap-0.5">
                <MessageSquare className="h-2.5 w-2.5" />
                {task.comment_count}
              </span>
            )}
            {task.checklist_total > 0 && (
              <span className="inline-flex items-center gap-0.5">
                <CheckSquare className="h-2.5 w-2.5" />
                {task.checklist_done}/{task.checklist_total}
              </span>
            )}
          </div>
          {task.mesul_ad && (
            <Avatar className="h-5 w-5" title={task.mesul_ad}>
              <AvatarFallback className="bg-secondary text-[9px]">
                {task.mesul_ad
                  .split(" ")
                  .map((p) => p[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase()}
              </AvatarFallback>
            </Avatar>
          )}
        </div>
      </Link>

      <div className="mt-2 flex items-center justify-between">
        <QuickStatusButtons taskId={task.id} currentStatus={task.status} compact />
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onReminder();
          }}
          className={cn(
            "grid h-5 w-5 place-items-center rounded transition",
            rem.color,
            "hover:bg-secondary/60"
          )}
          title={rem.tip}
          aria-label={rem.tip}
        >
          <Bell className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}
