"use client";

import { useState, useTransition } from "react";
import { Ticket, Loader2, X, Check } from "lucide-react";
import { toast } from "sonner";
import { applyCouponAction } from "../actions";
import type { AppliedCampaign } from "../matcher";
import { formatMoney, cn } from "@/lib/utils";

type Props = {
  sebetCemi: number;
  kontragentId?: string | null;
  /** Kupon tətbiq olunduqda parent-ə bildir */
  onApply?: (applied: AppliedCampaign) => void;
  /** Endirim ləğv olunduqda */
  onClear?: () => void;
};

/**
 * POS-da promokod / kupon kod input. Səbət cəminə görə endirim hesablanır,
 * tətbiq olunduqda parent state-də saxlanır.
 */
export function PosCouponInput({ sebetCemi, kontragentId, onApply, onClear }: Props) {
  const [kod, setKod] = useState("");
  const [applied, setApplied] = useState<AppliedCampaign | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit() {
    const trimmed = kod.trim().toUpperCase();
    if (!trimmed) return;
    if (sebetCemi <= 0) {
      toast.error("Səbət boşdur — əvvəl məhsul əlavə et");
      return;
    }
    startTransition(async () => {
      try {
        const res = await applyCouponAction(trimmed, sebetCemi, kontragentId ?? null);
        if (res.ok) {
          setApplied(res.applied);
          toast.success(`Kupon tətbiq olundu: −${formatMoney(res.applied.endirim_mebleg)}`);
          onApply?.(res.applied);
        } else {
          toast.error(res.error);
        }
      } catch (err) {
        console.error("[pos-coupon] applyCouponAction throw:", err);
        toast.error("Server xətası — yenidən cəhd et");
      }
    });
  }

  function clear() {
    setApplied(null);
    setKod("");
    onClear?.();
  }

  if (applied) {
    return (
      <div className="rounded-md border border-emerald-500/40 bg-emerald-500/5 px-2 py-1.5 text-xs">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <Check className="h-3 w-3 text-emerald-600 flex-shrink-0" />
            <span className="font-bold text-emerald-700 dark:text-emerald-400 truncate">
              {applied.ad}
            </span>
          </div>
          <button
            type="button"
            onClick={clear}
            className="rounded p-0.5 text-emerald-600 hover:bg-emerald-500/10"
            aria-label="Ləğv"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
        <div className="mt-0.5 flex items-center justify-between text-[10.5px] text-muted-foreground">
          <span>{applied.qeyd}</span>
          <span className="font-semibold text-emerald-700 tabular-nums dark:text-emerald-400">
            −{formatMoney(applied.endirim_mebleg)}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <div className="relative flex-1">
        <Ticket className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          value={kod}
          onChange={(e) => setKod(e.target.value.toUpperCase())}
          placeholder="Endirim kodu / kupon..."
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), onSubmit())}
          className={cn(
            "h-8 w-full rounded-md border border-input bg-background pl-7 pr-2 font-mono text-xs uppercase",
            "focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500/30",
          )}
          disabled={pending}
          maxLength={30}
        />
      </div>
      <button
        type="button"
        onClick={onSubmit}
        disabled={pending || !kod.trim()}
        className="inline-flex h-8 items-center gap-1 rounded-md bg-violet-600 px-2 text-[11px] font-bold text-white hover:bg-violet-700 disabled:opacity-50"
      >
        {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Tətbiq"}
      </button>
    </div>
  );
}
