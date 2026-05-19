"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { changeServisStatus } from "../actions";
import { SERVIS_STATUS_LABELS, type ServisStatus } from "../types";

const NEXT_STAGES: Record<string, string[]> = {
  qebul_edildi: ["diaqnostikada", "redd_edildi"],
  diaqnostikada: ["teklif_gozleyir", "usta_baxir", "qaytarildi"],
  teklif_gozleyir: ["usta_baxir", "ehtiyat_hisse", "redd_edildi"],
  usta_baxir: ["ehtiyat_hisse", "temir_olunur"],
  ehtiyat_hisse: ["temir_olunur"],
  temir_olunur: ["temir_edildi"],
  temir_edildi: ["musteriye_tehvil"],
};

export function ServisStatusActions({ id, currentStatus }: { id: string; currentStatus: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [tehvilOpen, setTehvilOpen] = useState(false);
  const [extendWarranty, setExtendWarranty] = useState(false);
  const possibleNext = NEXT_STAGES[currentStatus] ?? [];

  if (possibleNext.length === 0) return null;

  function go(status: string, options?: { extendWarranty?: boolean }) {
    startTransition(async () => {
      const res = await changeServisStatus(id, status as ServisStatus, undefined, options);
      if (res.ok) {
        toast.success("Status dəyişdi");
        setTehvilOpen(false);
        router.refresh();
      } else toast.error(res.error);
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" disabled={pending}>
            {pending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <ArrowRight className="mr-1.5 h-3.5 w-3.5" />}
            Növbəti mərhələ
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {possibleNext.map((s) => (
            <DropdownMenuItem
              key={s}
              onSelect={() => {
                if (s === "musteriye_tehvil") {
                  setTehvilOpen(true);
                } else {
                  go(s);
                }
              }}
            >
              → {SERVIS_STATUS_LABELS[s]?.label ?? s}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={tehvilOpen} onOpenChange={setTehvilOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="h-4 w-4 text-emerald-400" /> Müştəriyə təhvil
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2 text-sm">
            <p className="text-muted-foreground">
              Bu servis tamamlanır. Müştərinin mövcud zəmanət müddəti 3 ay uzadılsın?
            </p>
            <label className="flex items-center gap-2 rounded-md border border-border/40 bg-card/30 p-2 text-sm">
              <input
                type="checkbox"
                checked={extendWarranty}
                onChange={(e) => setExtendWarranty(e.target.checked)}
                className="h-4 w-4"
              />
              <span>Zəmanət 3 ay uzadılsın</span>
            </label>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" size="sm" onClick={() => setTehvilOpen(false)} disabled={pending}>
              Ləğv
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => go("musteriye_tehvil", { extendWarranty })}
              disabled={pending}
            >
              {pending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
              Təhvil ver
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
