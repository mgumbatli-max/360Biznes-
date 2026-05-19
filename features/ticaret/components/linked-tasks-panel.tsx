"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ClipboardList,
  Plus,
  Calendar,
  Flag,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  createTaskForPurchase,
  createTaskForFinanceOp,
} from "../alis-actions";
import { formatDate } from "@/lib/utils";

export type LinkedTask = {
  id: string;
  basliq: string;
  status: string | null;
  prioritet: string | null;
  deadline: Date | null;
  yaradildi: Date | null;
};

const PRIORITET_LABEL: Record<string, { label: string; cls: string }> = {
  asagi: { label: "Aşağı", cls: "text-muted-foreground" },
  normal: { label: "Normal", cls: "text-info" },
  yuksek: { label: "Yüksək", cls: "text-warning" },
  tecili: { label: "Təcili", cls: "text-danger" },
};

const STATUS_LABEL: Record<string, string> = {
  yeni: "Yeni",
  prosesde: "Prosesdə",
  tamamlandi: "Tamamlandı",
  legv: "Ləğv",
};

/**
 * Generic linked-tasks panel — used by purchase detail page + finance operation
 * drawer. Tasks are linked via `tapshiriq_obyektleri` (obyekt_nov determines
 * which server action handles creation).
 */
export function LinkedTasksPanel({
  contextType,
  contextId,
  tasks,
  compact,
}: {
  contextType: "alis_sifarisi" | "finance_operations";
  contextId: string;
  tasks: LinkedTask[];
  compact?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [taskOpen, setTaskOpen] = useState(false);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDeadline, setTaskDeadline] = useState("");
  const [taskPrio, setTaskPrio] = useState<"asagi" | "normal" | "yuksek" | "tecili">("normal");

  function createTask() {
    if (taskTitle.trim().length < 3) {
      toast.error("Başlıq ən az 3 simvol olmalıdır");
      return;
    }
    startTransition(async () => {
      const fn = contextType === "alis_sifarisi" ? createTaskForPurchase : createTaskForFinanceOp;
      const r = await fn(contextId, taskTitle, taskDeadline || null, taskPrio);
      if (r.ok) {
        toast.success("Tapşırıq yaradıldı");
        setTaskOpen(false);
        setTaskTitle("");
        setTaskDeadline("");
        setTaskPrio("normal");
        router.refresh();
      } else toast.error(r.error);
    });
  }

  const headerLabel = contextType === "alis_sifarisi" ? "Bu alış üçün tapşırıq" : "Bu əməliyyat üçün tapşırıq";

  const body = (
    <>
      {tasks.length === 0 ? (
        <p className="px-4 py-6 text-center text-xs text-muted-foreground">
          Hələ tapşırıq yoxdur. &quot;Yeni tapşırıq&quot; ilə əlavə edin.
        </p>
      ) : (
        <ul className="divide-y divide-border/40">
          {tasks.map((t) => {
            const prio = PRIORITET_LABEL[t.prioritet ?? "normal"] ?? PRIORITET_LABEL.normal;
            const done = t.status === "tamamlandi";
            return (
              <li key={t.id} className="flex items-start gap-3 px-4 py-2.5">
                <CheckCircle2
                  className={`mt-0.5 h-3.5 w-3.5 flex-shrink-0 ${done ? "text-success" : "text-muted-foreground/40"}`}
                />
                <div className="min-w-0 flex-1">
                  <div className={`text-sm font-medium ${done ? "line-through opacity-60" : ""}`}>{t.basliq}</div>
                  <div className="mt-0.5 flex items-center gap-2 text-[10.5px] text-muted-foreground">
                    <span className={`inline-flex items-center gap-1 ${prio.cls}`}>
                      <Flag className="h-2.5 w-2.5" />
                      {prio.label}
                    </span>
                    <span>· {STATUS_LABEL[t.status ?? "yeni"] ?? t.status}</span>
                    {t.deadline && (
                      <span className="inline-flex items-center gap-1">
                        · <Calendar className="h-2.5 w-2.5" /> {formatDate(t.deadline)}
                      </span>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );

  const dialog = (
    <Dialog open={taskOpen} onOpenChange={setTaskOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{headerLabel}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="ltp-task-title">Başlıq</Label>
            <Input
              id="ltp-task-title"
              value={taskTitle}
              onChange={(e) => setTaskTitle(e.target.value)}
              placeholder="məs: Qaiməni təsdiqə göndər"
              autoFocus
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label htmlFor="ltp-task-deadline">Bitmə vaxtı</Label>
              <Input
                id="ltp-task-deadline"
                type="date"
                value={taskDeadline}
                onChange={(e) => setTaskDeadline(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ltp-task-prio">Prioritet</Label>
              <select
                id="ltp-task-prio"
                value={taskPrio}
                onChange={(e) => setTaskPrio(e.target.value as typeof taskPrio)}
                className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
              >
                <option value="asagi">Aşağı</option>
                <option value="normal">Normal</option>
                <option value="yuksek">Yüksək</option>
                <option value="tecili">Təcili</option>
              </select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setTaskOpen(false)} disabled={pending}>
            Ləğv et
          </Button>
          <Button onClick={createTask} disabled={pending || taskTitle.trim().length < 3}>
            {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            Yarat
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  if (compact) {
    return (
      <div className="space-y-2 rounded-lg border border-border/50 bg-card/30 p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
            <ClipboardList className="h-3 w-3" />
            Bağlı tapşırıqlar
            <Badge variant="outline" className="text-[9px]">{tasks.length}</Badge>
          </div>
          <button
            type="button"
            onClick={() => setTaskOpen(true)}
            className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-0.5 text-[10.5px] font-semibold hover:bg-secondary"
          >
            <Plus className="h-3 w-3" /> Yeni
          </button>
        </div>
        {tasks.length === 0 ? (
          <p className="text-xs text-muted-foreground">Tapşırıq yoxdur</p>
        ) : (
          <ul className="space-y-1.5 text-xs">
            {tasks.map((t) => {
              const prio = PRIORITET_LABEL[t.prioritet ?? "normal"] ?? PRIORITET_LABEL.normal;
              const done = t.status === "tamamlandi";
              return (
                <li key={t.id} className="flex items-start gap-2">
                  <CheckCircle2 className={`mt-0.5 h-3 w-3 flex-shrink-0 ${done ? "text-success" : "text-muted-foreground/40"}`} />
                  <div className="min-w-0 flex-1">
                    <div className={`text-[11.5px] font-medium ${done ? "line-through opacity-60" : ""}`}>{t.basliq}</div>
                    <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                      <span className={prio.cls}>{prio.label}</span>
                      <span>· {STATUS_LABEL[t.status ?? "yeni"] ?? t.status}</span>
                      {t.deadline && <span>· {formatDate(t.deadline)}</span>}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {dialog}
      </div>
    );
  }

  return (
    <Card className="glass">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
            Bağlı tapşırıqlar
            <Badge variant="outline" className="text-[10px]">{tasks.length}</Badge>
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Bu alışla bağlı sonradan görüləcək işlər.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => setTaskOpen(true)}>
          <Plus className="h-3.5 w-3.5" /> Yeni tapşırıq
        </Button>
      </CardHeader>
      <CardContent className="p-0">{body}</CardContent>
      {dialog}
    </Card>
  );
}
