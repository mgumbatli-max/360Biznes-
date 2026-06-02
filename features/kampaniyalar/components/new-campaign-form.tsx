"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createCampaign } from "../actions";
import { TIP_META, type KampaniyaTip } from "../types";
import { cn } from "@/lib/utils";

const TIP_OPTIONS: KampaniyaTip[] = [
  "percent_endirim", "sabit_endirim", "bogo", "pillevari",
  "sebet_endirim", "pulsuz_catdirilma", "loyalty", "coupon",
  "gift_card", "flash_sale", "doğum_gunu", "welcome", "reaktivlesdir",
];

export function NewCampaignForm({ initialTip }: { initialTip?: KampaniyaTip } = {}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [tip, setTip] = useState<KampaniyaTip>(initialTip ?? "percent_endirim");
  const [discountPct, setDiscountPct] = useState("10");
  const [minCart, setMinCart] = useState("");

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("tip", tip);

    // Tip-ə görə action_json + rules_json qur
    const action: Record<string, unknown> = {};
    const rules: Record<string, unknown> = {};

    if (tip === "percent_endirim" || tip === "sebet_endirim" || tip === "flash_sale" || tip === "doğum_gunu" || tip === "welcome" || tip === "reaktivlesdir" || tip === "coupon") {
      action.discount_type = "percent";
      action.value = Number(discountPct);
    }
    if (tip === "sabit_endirim") {
      action.discount_type = "fixed";
      action.value = Number(discountPct);
    }
    if (tip === "pulsuz_catdirilma") {
      action.free_shipping = true;
    }
    if (tip === "loyalty") {
      action.bonus_pct = Number(discountPct);
    }
    if (minCart) {
      rules.min_cart = Number(minCart);
    }

    fd.set("rules_json", JSON.stringify(rules));
    fd.set("action_json", JSON.stringify(action));

    startTransition(async () => {
      const res = await createCampaign(fd);
      if (res.ok && res.id) {
        toast.success("Kampaniya yaradıldı");
        router.push(`/kampaniyalar/${res.id}`);
      } else if (!res.ok) {
        toast.error(res.error);
      }
    });
  }

  const showDiscountField = tip !== "pulsuz_catdirilma" && tip !== "bogo" && tip !== "pillevari" && tip !== "gift_card";

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>Kampaniya tipi *</Label>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
          {TIP_OPTIONS.map((t) => {
            const m = TIP_META[t];
            const active = tip === t;
            return (
              <button
                key={t}
                type="button"
                onClick={() => setTip(t)}
                disabled={pending}
                className={cn(
                  "flex items-start gap-2 rounded-lg border px-2.5 py-2 text-left transition",
                  active
                    ? "border-violet-500 bg-violet-500/5 ring-2 ring-violet-500/30"
                    : "border-border hover:border-primary/40 hover:bg-secondary/40",
                )}
              >
                <span className="text-lg">{m.emoji}</span>
                <div className="min-w-0">
                  <div className="text-xs font-bold">{m.ad}</div>
                  <div className="line-clamp-1 text-[10px] text-muted-foreground">{m.tesvir}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="ad">Kampaniya adı *</Label>
        <Input id="ad" name="ad" required maxLength={200} placeholder="məs. Novruz 20% endirim" disabled={pending} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="aciqlamaq">Açıqlama</Label>
        <textarea
          id="aciqlamaq"
          name="aciqlamaq"
          rows={2}
          maxLength={2000}
          className="flex w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
          placeholder="Müştəri üçün qısa təsvir"
          disabled={pending}
        />
      </div>

      {showDiscountField && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="discount">
              {tip === "loyalty" ? "Bonus faizi (%)" : tip === "sabit_endirim" ? "Endirim məbləği (₼)" : "Endirim faizi (%)"}
            </Label>
            <Input
              id="discount"
              type="number"
              min="0"
              max="100"
              step="0.1"
              value={discountPct}
              onChange={(e) => setDiscountPct(e.target.value)}
              disabled={pending}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="min_cart">Min səbət dəyəri (opsional ₼)</Label>
            <Input
              id="min_cart"
              type="number"
              min="0"
              step="0.01"
              value={minCart}
              onChange={(e) => setMinCart(e.target.value)}
              placeholder="0 = limitsiz"
              disabled={pending}
            />
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="baslama">Başlama tarixi</Label>
          <Input id="baslama" name="baslama" type="datetime-local" disabled={pending} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="bitme">Bitmə tarixi (opsional)</Label>
          <Input id="bitme" name="bitme" type="datetime-local" disabled={pending} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="prioritet">Prioritet (0-100)</Label>
          <Input id="prioritet" name="prioritet" type="number" min="0" max="100" defaultValue="50" disabled={pending} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="max_uses">Maks istifadə (cəm)</Label>
          <Input id="max_uses" name="max_uses" type="number" min="1" placeholder="limitsiz" disabled={pending} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="max_per_user">Müştəri başına</Label>
          <Input id="max_per_user" name="max_per_user" type="number" min="1" placeholder="limitsiz" disabled={pending} />
        </div>
      </div>

      <label className="flex items-center gap-2 rounded-md border border-border bg-secondary/30 px-3 py-2 text-sm cursor-pointer">
        <input type="checkbox" name="stackable" value="1" className="h-4 w-4 rounded border-input" disabled={pending} />
        <span>🔀 Stack icazəli — başqa kampaniyalarla birləşə bilər</span>
      </label>

      <input type="hidden" name="status" value="draft" />

      <div className="flex items-center justify-end gap-2 border-t border-border/40 pt-4">
        <Button type="button" variant="ghost" onClick={() => router.back()} disabled={pending}>
          Ləğv
        </Button>
        <Button type="submit" disabled={pending} className="font-semibold">
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
          Yarat (qaralama)
        </Button>
      </div>
    </form>
  );
}
