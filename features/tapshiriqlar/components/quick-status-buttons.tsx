"use client";

import { useTransition } from "react";
import { Play, Pause, Check, X as XIcon, Eye } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { changeTaskStatus } from "../actions";

type Status = "yeni" | "icrada" | "gozlemede" | "tamamlandi" | "legv";

const ACTIONS: Array<{
  key: Status;
  label: string;
  icon: typeof Play;
  cls: string;
  short: string;
}> = [
  { key: "icrada", label: "Başla", short: "İcradadır", icon: Play, cls: "text-sky-600 hover:bg-sky-500/15" },
  { key: "gozlemede", label: "Yoxlamaya ver", short: "Yoxlamada", icon: Eye, cls: "text-violet-600 hover:bg-violet-500/15" },
  { key: "yeni", label: "Dayandır", short: "Gözləyir", icon: Pause, cls: "text-amber-600 hover:bg-amber-500/15" },
  { key: "tamamlandi", label: "Tamamla", short: "Tamamlandı", icon: Check, cls: "text-emerald-600 hover:bg-emerald-500/15" },
  { key: "legv", label: "Ləğv et", short: "Ləğv", icon: XIcon, cls: "text-rose-600 hover:bg-rose-500/15" },
];

type Props = {
  taskId: string;
  currentStatus: string;
  compact?: boolean;
};

export function QuickStatusButtons({ taskId, currentStatus, compact }: Props) {
  const [pending, startTransition] = useTransition();

  function run(status: Status, label: string) {
    if (status === currentStatus) return;
    startTransition(async () => {
      const res = await changeTaskStatus(taskId, status);
      if (res.ok) toast.success(label);
      else toast.error("Status dəyişdirilmədi");
    });
  }

  return (
    <div className={cn("inline-flex items-center gap-0.5 rounded-md border border-border/60 bg-card/40 p-0.5", compact && "p-0")}>
      {ACTIONS.map((a) => {
        const Icon = a.icon;
        const isCurrent = a.key === currentStatus;
        return (
          <button
            key={a.key}
            type="button"
            disabled={pending || isCurrent}
            onClick={() => run(a.key, a.short)}
            title={a.label}
            className={cn(
              "grid place-items-center rounded transition",
              compact ? "h-5 w-5" : "h-6 w-6",
              a.cls,
              isCurrent && "bg-secondary/60 cursor-default opacity-60",
              pending && "opacity-50"
            )}
            aria-label={a.label}
          >
            <Icon className={cn(compact ? "h-2.5 w-2.5" : "h-3 w-3")} />
          </button>
        );
      })}
    </div>
  );
}
