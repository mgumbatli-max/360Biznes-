"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateCampaignDiscount } from "../actions";
import { cn } from "@/lib/utils";

type Props = {
  campaignId: string;
  currentType?: "percent" | "fixed" | null;
  currentValue?: number | null;
  /** action_json boş və ya natamamdırsa "fix" mövzu, doludursa "edit" mövzu */
  isMissing: boolean;
};

export function CampaignDiscountFix({ campaignId, currentType, currentValue, isMissing }: Props) {
  const [tip, setTip] = useState<"percent" | "fixed">(currentType ?? "percent");
  const [value, setValue] = useState(String(currentValue ?? 10));
  const [pending, startTransition] = useTransition();

  function onSave() {
    const v = Number(value);
    if (!Number.isFinite(v) || v <= 0) {
      toast.error("Düzgün dəyər daxil edin");
      return;
    }
    startTransition(async () => {
      try {
        const res = await updateCampaignDiscount(campaignId, tip, v);
        if (res.ok) {
          toast.success("Endirim parametri yadda saxlandı");
        } else {
          toast.error(res.error);
        }
      } catch (err) {
        console.error("[campaign-fix]", err);
        toast.error("Server xətası");
      }
    });
  }

  return (
    <div className={cn(
      "rounded-lg border p-3",
      isMissing
        ? "border-rose-500/40 bg-rose-500/5"
        : "border-border bg-card/40",
    )}>
      {isMissing && (
        <div className="mb-2 flex items-start gap-1.5 text-xs text-rose-600 dark:text-rose-400">
          <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
          <span>
            <strong>Endirim parametri təyin edilməyib</strong> — bu kampaniya POS-da işləməyəcək. Aşağıdan düzəlt:
          </span>
        </div>
      )}
      <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
        <div className="space-y-1">
          <Label className="text-[10.5px] uppercase tracking-wider text-muted-foreground">Növ</Label>
          <select
            value={tip}
            onChange={(e) => setTip(e.target.value as "percent" | "fixed")}
            disabled={pending}
            className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
          >
            <option value="percent">% Faiz</option>
            <option value="fixed">Sabit ₼</option>
          </select>
        </div>
        <div className="space-y-1">
          <Label className="text-[10.5px] uppercase tracking-wider text-muted-foreground">
            {tip === "percent" ? "Endirim faizi" : "Endirim məbləği"}
          </Label>
          <Input
            type="number"
            min="0"
            max={tip === "percent" ? "100" : undefined}
            step="0.1"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            disabled={pending}
            className="h-9"
          />
        </div>
        <div className="flex items-end">
          <Button
            type="button"
            onClick={onSave}
            disabled={pending}
            size="sm"
            className="h-9 w-full font-semibold"
          >
            {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><Save className="h-3.5 w-3.5" /> Yadda saxla</>}
          </Button>
        </div>
      </div>
    </div>
  );
}
