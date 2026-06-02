"use client";

import { useTransition } from "react";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveLoyaltySettings } from "../actions";

type Settings = {
  auto_create: boolean;
  max_serf_pct: number;
  min_serf_meblegh: number;
  expire_ay: number;
};

export function LoyaltySettingsForm({ initial }: { initial: Settings }) {
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await saveLoyaltySettings(fd);
      if (res.ok) toast.success("Ayarlar yadda saxlandı");
      else toast.error(res.error);
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      {/* Auto-create */}
      <div className="rounded-lg border border-border bg-secondary/20 p-3">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            name="auto_create"
            value="1"
            defaultChecked={initial.auto_create}
            className="mt-1 h-4 w-4 rounded border-input"
            disabled={pending}
          />
          <div>
            <div className="font-semibold">📇 Yeni müştəri üçün avto-kart</div>
            <p className="text-[11.5px] text-muted-foreground">
              Yeni müştəri qeydiyyatdan keçəndə sistem ona unikal kart kodu (LK...) avtomatik yaradır.
              Söndürdükdə kartı əl ilə müştəri profilindən açırsan.
            </p>
          </div>
        </label>
      </div>

      {/* Maks sərf faizi */}
      <div className="space-y-1.5">
        <Label htmlFor="max_serf_pct">
          Səbətdən maksimum bonus istifadəsi (%)
        </Label>
        <div className="flex items-center gap-2">
          <Input
            id="max_serf_pct"
            name="max_serf_pct"
            type="number"
            min="0"
            max="100"
            defaultValue={initial.max_serf_pct}
            className="w-32"
            disabled={pending}
          />
          <span className="text-xs text-muted-foreground">% (məs. 30 — səbətin 30%-i bonusla ödənə bilər)</span>
        </div>
      </div>

      {/* Min sərf */}
      <div className="space-y-1.5">
        <Label htmlFor="min_serf_meblegh">
          Minimum bonus sərfi (₼)
        </Label>
        <div className="flex items-center gap-2">
          <Input
            id="min_serf_meblegh"
            name="min_serf_meblegh"
            type="number"
            min="0"
            step="0.01"
            defaultValue={initial.min_serf_meblegh}
            className="w-32"
            disabled={pending}
          />
          <span className="text-xs text-muted-foreground">₼ (xırdalanmadan qoruyur)</span>
        </div>
      </div>

      {/* Bonus expire */}
      <div className="space-y-1.5">
        <Label htmlFor="expire_ay">
          Bonus expire müddəti (ay)
        </Label>
        <div className="flex items-center gap-2">
          <Input
            id="expire_ay"
            name="expire_ay"
            type="number"
            min="0"
            max="120"
            defaultValue={initial.expire_ay}
            className="w-32"
            disabled={pending}
          />
          <span className="text-xs text-muted-foreground">ay (0 = heç vaxt expire olmasın)</span>
        </div>
        <p className="text-[10.5px] text-muted-foreground">
          Toplanan bonus bu müddətdən sonra silinir (FIFO). Cron işləyir.
        </p>
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-border/40 pt-4">
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          Yadda saxla
        </Button>
      </div>
    </form>
  );
}
