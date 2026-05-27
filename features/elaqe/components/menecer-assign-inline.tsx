"use client";

import { useState, useTransition } from "react";
import { Check, ChevronDown, UserRoundCog, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { bulkAssignManager } from "@/features/elaqe/actions";
import { useRouter } from "next/navigation";

type Manager = { id: string; ad_soyad: string };

export function MenecerAssignInline({
  kontragentId,
  currentManagerId,
  currentManagerAd,
  managers,
  canEdit = true,
}: {
  kontragentId: string;
  currentManagerId: string | null;
  currentManagerAd: string | null;
  managers: Manager[];
  canEdit?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  if (!canEdit) {
    return (
      <span className="text-[10.5px] text-muted-foreground">
        Məsul: {currentManagerAd ?? "—"}
      </span>
    );
  }

  function assign(menecerId: string | null) {
    setOpen(false);
    startTransition(async () => {
      const res = await bulkAssignManager([kontragentId], menecerId);
      if (res.ok) {
        toast.success(menecerId ? "Menecer təyin olundu" : "Menecer ləğv olundu");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        disabled={pending}
        className="inline-flex items-center gap-1 rounded-md border border-border/40 bg-secondary/30 px-2 py-0.5 text-[10.5px] text-muted-foreground transition hover:bg-secondary/60 hover:text-foreground disabled:opacity-50"
      >
        {pending ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <UserRoundCog className="h-3 w-3" />
        )}
        <span>Məsul: <strong className="text-foreground">{currentManagerAd ?? "—"}</strong></span>
        <ChevronDown className="h-3 w-3" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-72 w-56 overflow-y-auto">
        <DropdownMenuLabel className="text-[10.5px]">Məsul menecer</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => assign(null)}
          className="text-[11px] text-muted-foreground"
        >
          {currentManagerId === null && <Check className="mr-1 h-3 w-3" />}
          — Təyin olunmayıb —
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {managers.length === 0 ? (
          <div className="px-2 py-3 text-center text-[10.5px] text-muted-foreground">
            İşçi yoxdur
          </div>
        ) : (
          managers.map((m) => (
            <DropdownMenuItem
              key={m.id}
              onClick={() => assign(m.id)}
              className="text-[11px]"
            >
              {currentManagerId === m.id && <Check className="mr-1 h-3 w-3 text-primary" />}
              {m.ad_soyad}
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
