"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { saveEmployeeSchedule } from "../documents-actions";
import type { WorkScheduleRow } from "../documents-queries";

const DAYS = ["B.E.", "Ç.A.", "Çər.", "C.A.", "Cümə", "Şən.", "Bazar"];

export function SchedulePanel({
  istifadeciId,
  initial,
}: {
  istifadeciId: string;
  initial: WorkScheduleRow[];
}) {
  const router = useRouter();
  const [rows, setRows] = useState<WorkScheduleRow[]>(initial);
  const [pending, startTransition] = useTransition();

  function update(idx: number, patch: Partial<WorkScheduleRow>) {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }

  function onSave() {
    startTransition(async () => {
      const res = await saveEmployeeSchedule({
        istifadeci_id: istifadeciId,
        rows: rows.map((r) => ({
          hefte_gunu: r.hefte_gunu,
          baslama: r.istirahet ? null : r.baslama,
          bitme: r.istirahet ? null : r.bitme,
          istirahet: r.istirahet,
        })),
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Qrafik yeniləndi");
      router.refresh();
    });
  }

  return (
    <Card className="glass">
      <CardContent className="space-y-3 pt-4">
        <p className="text-xs text-muted-foreground">
          Hər həftə günü üçün iş saatları. İstirahət günlərini işarələyin.
        </p>
        <div className="space-y-1.5">
          {rows.map((r, i) => (
            <div
              key={r.hefte_gunu}
              className="grid grid-cols-[80px_1fr_1fr_auto] items-center gap-3 rounded-md border border-border/40 p-2 text-sm"
            >
              <div className="font-medium">{DAYS[r.hefte_gunu - 1]}</div>
              <input
                type="time"
                value={r.baslama ?? ""}
                onChange={(e) => update(i, { baslama: e.target.value })}
                disabled={r.istirahet || pending}
                className="h-8 rounded-md border border-input bg-background px-2 text-xs disabled:opacity-50"
              />
              <input
                type="time"
                value={r.bitme ?? ""}
                onChange={(e) => update(i, { bitme: e.target.value })}
                disabled={r.istirahet || pending}
                className="h-8 rounded-md border border-input bg-background px-2 text-xs disabled:opacity-50"
              />
              <label className="flex items-center gap-1.5 text-xs">
                <input
                  type="checkbox"
                  checked={r.istirahet}
                  onChange={(e) => update(i, { istirahet: e.target.checked })}
                  disabled={pending}
                  className="h-4 w-4 accent-primary"
                />
                İstirahət
              </label>
            </div>
          ))}
        </div>

        <div className="flex justify-end">
          <Button size="sm" onClick={onSave} disabled={pending}>
            {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Yadda saxla
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
