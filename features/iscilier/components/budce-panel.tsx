"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatMoney } from "@/lib/utils";
import { saveSobePlan, deleteSobePlan } from "../budce-actions";
import type { BudceSobe } from "../budce-queries";

export function BudcePanel({ sobeler }: { sobeler: BudceSobe[] }) {
  return (
    <Card className="glass">
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border/60 text-left text-[10.5px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-3 py-2.5">Şöbə / Vəzifə</th>
                <th className="px-3 py-2.5 text-right">Cari headcount</th>
                <th className="px-3 py-2.5 text-right">Aylıq büdcə</th>
                <th className="px-3 py-2.5 text-right">Açıq vakansiya</th>
                <th className="px-3 py-2.5 text-right">Yeni (plan)</th>
                <th className="px-3 py-2.5 text-right">Əvəzləmə (plan)</th>
                <th className="px-3 py-2.5 text-right">Forecast (kvartal)</th>
                <th className="px-3 py-2.5">Delta</th>
                <th className="px-3 py-2.5 w-24"></th>
              </tr>
            </thead>
            <tbody>
              {sobeler.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-sm text-muted-foreground">
                    Şöbə yoxdur. Vəzifə qeyd olunan işçi əlavə etdikdən sonra burada görünəcək.
                  </td>
                </tr>
              ) : (
                sobeler.map((s) => {
                  const delta = (s.planned_hire + s.acig_vakansiya) - s.planned_replace;
                  return (
                    <tr key={s.sobe} className="border-b border-border/30">
                      <td className="px-3 py-2.5 font-medium">{s.sobe}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{s.cari_headcount}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{formatMoney(s.cari_budget)}</td>
                      <td className="px-3 py-2.5 text-right">
                        {s.acig_vakansiya > 0 ? <Badge variant="outline" className="text-[10px] border-warning/30 text-warning">{s.acig_vakansiya}</Badge> : "—"}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-success">{s.planned_hire || "—"}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{s.planned_replace || "—"}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{s.forecast_qtr}</td>
                      <td className="px-3 py-2.5">
                        {delta === 0 ? (
                          <Badge variant="outline" className="text-[10px]">0</Badge>
                        ) : (
                          <Badge variant="outline" className={"text-[10px] " + (delta > 0 ? "border-success/30 text-success" : "border-danger/30 text-danger")}>
                            {delta > 0 ? "+" : ""}{delta}
                          </Badge>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <PlanActions sobe={s} />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function PlanActions({ sobe }: { sobe: BudceSobe }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("sobe", sobe.sobe);
    startTransition(async () => {
      const res = await saveSobePlan(fd);
      if (res.ok) {
        toast.success("Yenilənildi");
        setOpen(false);
        router.refresh();
      } else toast.error(res.error);
    });
  }

  function onDelete() {
    if (!confirm(`${sobe.sobe} planı silinsin?`)) return;
    startTransition(async () => {
      const fd = new FormData();
      fd.set("sobe", sobe.sobe);
      const res = await deleteSobePlan(fd);
      if (res.ok) toast.success("Silindi");
      else toast.error(res.error);
      router.refresh();
    });
  }

  const hasPlan = sobe.planned_hire > 0 || sobe.planned_replace > 0;

  return (
    <div className="flex items-center gap-1">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button size="sm" variant="ghost"><Pencil className="h-3.5 w-3.5" /></Button>
        </DialogTrigger>
        <DialogContent className="md:max-w-md">
          <DialogHeader><DialogTitle>{sobe.sobe} — plan</DialogTitle></DialogHeader>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="planned_hire">Yeni işə alma (gələn rüb)</Label>
                <Input id="planned_hire" name="planned_hire" type="number" min="0" max="1000" defaultValue={sobe.planned_hire} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="planned_replace">Əvəzləmə (gələn rüb)</Label>
                <Input id="planned_replace" name="planned_replace" type="number" min="0" max="1000" defaultValue={sobe.planned_replace} />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>İmtina</Button>
              <Button type="submit" disabled={pending}>{pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Yadda saxla</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      {hasPlan && (
        <Button size="sm" variant="ghost" onClick={onDelete} disabled={pending} className="text-danger">
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}
