"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Ban, Play, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { setTenantStatus, extendSubscription } from "../actions";

type Props = {
  tenantId: string;
  currentStatus: string;
};

export function TenantActions({ tenantId, currentStatus }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function changeStatus(s: "aktiv" | "dayandirildi") {
    startTransition(async () => {
      const res = await setTenantStatus(tenantId, s);
      if (res.ok) {
        toast.success("Status dəyişdirildi");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  function extend(days: number) {
    startTransition(async () => {
      const res = await extendSubscription(tenantId, days);
      if (res.ok) {
        toast.success(`Abunə ${days} gün uzadıldı`);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <div className="flex items-center gap-2">
      {currentStatus === "aktiv" ? (
        <Button variant="outline" size="sm" disabled={pending} onClick={() => changeStatus("dayandirildi")}>
          <Ban className="h-3.5 w-3.5" /> Dayandır
        </Button>
      ) : (
        <Button variant="outline" size="sm" disabled={pending} onClick={() => changeStatus("aktiv")}>
          <Play className="h-3.5 w-3.5" /> Aktivləşdir
        </Button>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" disabled={pending}>
            <Plus className="h-3.5 w-3.5" /> Abunəni uzat
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => extend(7)}>+7 gün</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => extend(15)}>+15 gün</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => extend(30)}>+30 gün (1 ay)</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => extend(90)}>+90 gün</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => extend(365)}>+365 gün (1 il)</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
