"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ClipboardList, Save, Plus, Calendar, Flag, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { updateSaleNote, createTaskForSale } from "../satis-actions";
import { formatDate } from "@/lib/utils";

type Task = {
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
 * Editable internal note + linked-tasks panel for a sale. Note is plain
 * text, persisted via `updateSaleNote`. Tasks are stored in the
 * tapshiriqlar table and linked via tapshiriq_obyektleri (no schema change).
 */
export function SaleNotesTasks({
  saleId,
  initialNote,
  tasks,
}: {
  saleId: string;
  initialNote: string;
  tasks: Task[];
}) {
  const router = useRouter();
  const [note, setNote] = useState(initialNote);
  const [savedNote, setSavedNote] = useState(initialNote);
  const [pending, startTransition] = useTransition();

  const [taskOpen, setTaskOpen] = useState(false);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDeadline, setTaskDeadline] = useState("");
  const [taskPrio, setTaskPrio] = useState<"asagi" | "normal" | "yuksek" | "tecili">("normal");

  function saveNote() {
    startTransition(async () => {
      const r = await updateSaleNote(saleId, note);
      if (r.ok) {
        toast.success("Qeyd yadda saxlanıldı");
        setSavedNote(r.data.qeyd);
      } else toast.error(r.error);
    });
  }

  function createTask() {
    if (taskTitle.trim().length < 3) {
      toast.error("Başlıq ən az 3 simvol olmalıdır");
      return;
    }
    startTransition(async () => {
      const r = await createTaskForSale(
        saleId,
        taskTitle,
        taskDeadline || null,
        taskPrio,
      );
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

  const noteDirty = note !== savedNote;

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <Card className="glass">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Daxili qeyd</CardTitle>
          <p className="text-xs text-muted-foreground">
            Yalnız operatorlar görür — müştəri qəbzində görünmür.
          </p>
        </CardHeader>
        <CardContent>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={5}
            maxLength={4000}
            placeholder="Bu satış haqqında qısa qeyd..."
            className="w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
          />
          <div className="mt-2 flex items-center justify-between">
            <div className="text-[10px] text-muted-foreground">{note.length}/4000</div>
            <Button size="sm" onClick={saveNote} disabled={!noteDirty || pending}>
              {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Yadda saxla
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="glass">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <ClipboardList className="h-4 w-4 text-muted-foreground" />
              Bağlı tapşırıqlar
              <Badge variant="outline" className="text-[10px]">{tasks.length}</Badge>
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Bu satışla bağlı sonradan görüləcək işlər.
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={() => setTaskOpen(true)}>
            <Plus className="h-3.5 w-3.5" /> Yeni tapşırıq
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {tasks.length === 0 ? (
            <p className="px-4 py-6 text-center text-xs text-muted-foreground">
              Hələ tapşırıq yoxdur. "Yeni tapşırıq" ilə əlavə edin.
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
        </CardContent>
      </Card>

      <Dialog open={taskOpen} onOpenChange={setTaskOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Bu satış üçün tapşırıq</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="task-title">Başlıq</Label>
              <Input
                id="task-title"
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
                placeholder="məs: Müştəriyə zəng et və geri-əlaqə al"
                autoFocus
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label htmlFor="task-deadline">Bitmə vaxtı</Label>
                <Input
                  id="task-deadline"
                  type="date"
                  value={taskDeadline}
                  onChange={(e) => setTaskDeadline(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="task-prio">Prioritet</Label>
                <select
                  id="task-prio"
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
    </div>
  );
}
