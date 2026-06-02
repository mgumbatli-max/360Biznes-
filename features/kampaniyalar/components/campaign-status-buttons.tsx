"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Power, PowerOff, Trash2, Loader2, Archive } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { toggleCampaignStatus, deleteCampaign } from "../actions";
import type { KampaniyaStatus } from "../types";

export function CampaignStatusButtons({ id, currentStatus }: { id: string; currentStatus: KampaniyaStatus }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function setStatus(s: "active" | "paused" | "archived") {
    startTransition(async () => {
      const res = await toggleCampaignStatus(id, s);
      if (res.ok) {
        toast.success(
          s === "active" ? "Aktivləşdirildi" :
          s === "paused" ? "Dayandırıldı" :
          "Arxivləşdirildi",
        );
        router.refresh();
      } else toast.error(res.error);
    });
  }

  function onDelete() {
    if (!confirm("Bu kampaniyanı silmək istədiyinizə əminsinizmi? Geri qaytarıla bilməz.")) return;
    startTransition(async () => {
      const res = await deleteCampaign(id);
      if (res.ok) {
        toast.success("Silindi");
        router.push("/kampaniyalar");
      } else toast.error(res.error);
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {currentStatus !== "active" ? (
        <Button size="sm" onClick={() => setStatus("active")} disabled={pending} className="font-semibold">
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Power className="h-3.5 w-3.5" />}
          Aktivləşdir
        </Button>
      ) : (
        <Button size="sm" variant="outline" onClick={() => setStatus("paused")} disabled={pending}>
          <PowerOff className="h-3.5 w-3.5" /> Dayandır
        </Button>
      )}
      <Button size="sm" variant="outline" onClick={() => setStatus("archived")} disabled={pending}>
        <Archive className="h-3.5 w-3.5" /> Arxivlə
      </Button>
      <Button size="sm" variant="ghost" onClick={onDelete} disabled={pending} className="text-rose-500 hover:bg-rose-500/10">
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
