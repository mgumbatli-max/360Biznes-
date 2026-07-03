"use client";

import { useState, useTransition } from "react";
import { ArrowUpRight, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { changeSubscriptionPlan } from "@/features/ayarlar/abune-actions";
import { formatNumber } from "@/lib/utils";

type Plan = {
  id: number;
  kod: string;
  ad: string;
  ayl_q_qiymet: number;
  illik_qiymet: number | null;
  max_istifadeci: number | null;
  max_mehsul: number | null;
  max_mesaj_ayl_q: number | null;
  aktiv: boolean;
};

function formatMoney(n: number) {
  return formatNumber(Math.round(n), 0) + " ₼";
}

export function PlanChangeDialog({ plans, currentPlanId }: { plans: Plan[]; currentPlanId: number | null }) {
  const [open, setOpen] = useState(false);
  const [novu, setNovu] = useState<"ayl_q" | "illik">("ayl_q");
  const [pending, start] = useTransition();

  function onSelect(planId: number) {
    if (planId === currentPlanId) {
      toast.message("Hazırda bu plandasınız");
      return;
    }
    if (!confirm("Planı dəyişmək istədiyinizə əminsinizmi?")) return;
    start(async () => {
      const r = await changeSubscriptionPlan(planId, novu);
      if (r.ok) {
        toast.success("Plan dəyişdirildi");
        setOpen(false);
      } else toast.error(r.error);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <ArrowUpRight className="h-3.5 w-3.5" /> Plan dəyiş
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Plan seçin</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="inline-flex rounded-md border border-border bg-card/40 p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setNovu("ayl_q")}
              className={`px-3 py-1.5 rounded ${novu === "ayl_q" ? "bg-secondary font-semibold" : "text-muted-foreground"}`}
            >
              Aylıq
            </button>
            <button
              type="button"
              onClick={() => setNovu("illik")}
              className={`px-3 py-1.5 rounded ${novu === "illik" ? "bg-secondary font-semibold" : "text-muted-foreground"}`}
            >
              İllik (2 ay endirim)
            </button>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {plans.filter((p) => p.aktiv).map((p) => {
              const isCurrent = p.id === currentPlanId;
              const qiymet = novu === "illik" ? Number(p.illik_qiymet ?? p.ayl_q_qiymet * 10) : Number(p.ayl_q_qiymet);
              return (
                <div key={p.id} className={`rounded-lg border p-4 transition ${isCurrent ? "border-success/40 bg-success/5" : "border-border hover:border-primary/30"}`}>
                  <div className="flex items-center justify-between">
                    <div className="font-semibold">{p.ad}</div>
                    {isCurrent && <Badge variant="outline" className="border-success/30 text-[10px] text-success">cari plan</Badge>}
                  </div>
                  <div className="mt-2 text-2xl font-bold tabular-nums">{formatMoney(qiymet)}</div>
                  <div className="text-[10.5px] text-muted-foreground">/{novu === "illik" ? "il" : "ay"}</div>
                  <ul className="mt-3 space-y-1 text-xs">
                    <li className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3 text-success" /> İstifadəçi: {p.max_istifadeci ?? "∞"}</li>
                    <li className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3 text-success" /> Məhsul: {p.max_mehsul ?? "∞"}</li>
                    <li className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3 text-success" /> Mesaj/ay: {p.max_mesaj_ayl_q ?? "∞"}</li>
                  </ul>
                  <Button
                    disabled={pending || isCurrent}
                    onClick={() => onSelect(p.id)}
                    className="mt-3 w-full"
                    size="sm"
                    variant={isCurrent ? "outline" : "default"}
                  >
                    {isCurrent ? "Cari plan" : pending ? "Yenilənir…" : "Bu planı seç"}
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
