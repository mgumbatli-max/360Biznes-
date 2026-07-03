"use client";

import Link from "next/link";
import { MessageSquare, CheckSquare, Eye } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { useMounted } from "@/lib/hooks/use-mounted";
import { PriorityBadge, TaskStatusBadge } from "./task-badges";
import { QuickStatusButtons } from "./quick-status-buttons";
import { DeadlineCountdown } from "./deadline-countdown";
import { colorHexFor } from "./color-picker";
import type { TaskListItem } from "../queries";

export function TaskRow({ task }: { task: TaskListItem }) {
  const mounted = useMounted();
  const overdue = mounted && task.deadline && task.deadline < new Date() && task.status !== "tamamlandi" && task.status !== "legv";
  const checklistRatio = task.checklist_total > 0 ? task.checklist_done / task.checklist_total : 0;
  const reng = colorHexFor(task.reng);

  return (
    <div className="group relative grid grid-cols-[auto_1fr_auto] gap-3 border-b border-border/40 px-3 py-3 transition hover:bg-secondary/40">
      {reng && (
        <span
          className="absolute left-0 top-0 bottom-0 w-1"
          style={{ background: reng }}
          aria-hidden
        />
      )}
      <div className="flex h-7 items-center pl-1">
        <span
          className={cn(
            "h-2 w-2 rounded-full",
            task.prioritet === "tecili" && "bg-danger animate-pulse-glow",
            task.prioritet === "yuksek" && "bg-warning",
            task.prioritet === "normal" && "bg-info",
            task.prioritet === "asagi" && "bg-muted-foreground"
          )}
        />
      </div>

      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <TaskStatusBadge value={task.status} />
          <PriorityBadge value={task.prioritet} />
          {overdue && (
            <span className="inline-flex items-center rounded-full bg-danger/15 px-2 py-0.5 text-[10.5px] font-medium text-danger">
              Gecikib
            </span>
          )}
          {task.viewers_gizlilik === "yalniz_alan" && (
            <span
              className="inline-flex items-center gap-0.5 rounded-full bg-slate-500/15 px-1.5 py-0.5 text-[9.5px] font-medium text-slate-600"
              title="Yalnız alan görür"
            >
              <Eye className="h-2.5 w-2.5" /> private
            </span>
          )}
        </div>
        <Link
          href={`/tapshiriqlar/${task.id}`}
          className={cn(
            "block font-medium transition hover:text-primary-light",
            task.status === "tamamlandi" && "line-through text-muted-foreground",
            task.status === "legv" && "line-through text-muted-foreground/60"
          )}
        >
          {task.basliq}
        </Link>
        {task.tesvir && (
          <div className="line-clamp-1 text-xs text-muted-foreground">{task.tesvir}</div>
        )}
        <div className="flex flex-wrap items-center gap-3 pt-0.5 text-[11px] text-muted-foreground">
          {task.deadline && (
            <DeadlineCountdown
              deadline={task.deadline}
              completed={task.status === "tamamlandi" || task.status === "legv"}
              compact
            />
          )}
          {task.mesul_ad && (
            <span>
              Məsul: <span className="text-foreground">{task.mesul_ad}</span>
            </span>
          )}
          <span>
            Yaratdı: <span className="text-foreground">{task.yaradan_ad}</span>
          </span>
          {task.comment_count > 0 && (
            <span className="inline-flex items-center gap-1">
              <MessageSquare className="h-3 w-3" />
              {task.comment_count}
            </span>
          )}
          {task.checklist_total > 0 && (
            <span className="inline-flex items-center gap-1">
              <CheckSquare className="h-3 w-3" />
              {task.checklist_done}/{task.checklist_total}
            </span>
          )}
        </div>
        {task.checklist_total > 0 && (
          <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-secondary">
            <div className="h-full bg-primary" style={{ width: `${checklistRatio * 100}%` }} />
          </div>
        )}
      </div>

      <div className="flex flex-col items-end gap-1.5">
        <div className="flex items-start gap-0.5">
          {task.icracilar.slice(0, 3).map((i) => (
            <Avatar key={i.id} className="-ml-2 h-7 w-7 border-2 border-card first:ml-0" title={i.ad_soyad}>
              <AvatarFallback className="bg-secondary text-[10px] font-semibold">
                {i.ad_soyad
                  .split(" ")
                  .map((p) => p[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase()}
              </AvatarFallback>
            </Avatar>
          ))}
          {task.icracilar.length > 3 && (
            <span className="ml-1 inline-flex h-6 items-center rounded-full bg-secondary px-1.5 text-[10px] text-muted-foreground">
              +{task.icracilar.length - 3}
            </span>
          )}
        </div>
        <QuickStatusButtons taskId={task.id} currentStatus={task.status} />
      </div>
    </div>
  );
}
