"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Stethoscope,
  PackageOpen,
  Wrench,
  CheckCircle2,
  PhoneCall,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { changeServisStatus, addRepairNote } from "../actions";
import type { ServisStatus } from "../types";

type Action = {
  key: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  status?: ServisStatus;
  callMode?: boolean;
};

export function QuickStatusBar({
  id,
  currentStatus,
  telefon,
}: {
  id: string;
  currentStatus: string;
  telefon: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const actions: Action[] = [
    { key: "diag", label: "Diaqnostika başla", icon: Stethoscope, status: "diaqnostikada" },
    { key: "part", label: "Hissə gözlə", icon: PackageOpen, status: "ehtiyat_hisse" },
    { key: "rep", label: "Təmir başla", icon: Wrench, status: "temir_olunur" },
    { key: "ready", label: "Hazır", icon: CheckCircle2, status: "temir_edildi" },
    { key: "call", label: "Müştəriyə zəng", icon: PhoneCall, callMode: true },
  ];

  function go(a: Action) {
    if (a.callMode) {
      // log a repair note + open tel:
      const fd = new FormData();
      fd.set("id", id);
      fd.set("qeyd", `Müştəriyə zəng edildi (${new Date().toLocaleString("az-AZ")})`);
      startTransition(async () => {
        const res = await addRepairNote(fd);
        if (res.ok) toast.success("Zəng qeyd edildi");
        else toast.error(res.error);
        if (telefon) window.location.href = `tel:${telefon}`;
        router.refresh();
      });
      return;
    }
    if (!a.status) return;
    if (a.status === currentStatus) {
      toast.info("Artıq bu statusdadır");
      return;
    }
    startTransition(async () => {
      const res = await changeServisStatus(id, a.status as ServisStatus);
      if (res.ok) {
        toast.success("Status dəyişdi");
        router.refresh();
      } else toast.error(res.error);
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-border bg-card/40 p-2">
      <span className="mr-1 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
        Sürətli:
      </span>
      {actions.map((a) => {
        const Icon = a.icon;
        const isCurrent = a.status === currentStatus;
        return (
          <Button
            key={a.key}
            size="sm"
            variant="outline"
            onClick={() => go(a)}
            disabled={pending || isCurrent}
            className="h-7 gap-1 px-2 text-[11px]"
            title={a.label}
          >
            {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Icon className="h-3 w-3" />}
            {a.label}
          </Button>
        );
      })}
    </div>
  );
}
