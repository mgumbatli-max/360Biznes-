"use client";
import { useState, useTransition } from "react";
import { setExpenseBudget } from "@/features/maliyye/xerc-budce-actions";
import { Input } from "@/components/ui/input";
import { Check, Loader2 } from "lucide-react";

/** Bir kateqoriya üçün aylıq büdcəni inline təyin edən input (blur/Enter-də yadda saxlayır). */
export function BudgetInput({ kateqoriyaId, initial }: { kateqoriyaId: number; initial: number }) {
  const [value, setValue] = useState(initial > 0 ? String(initial) : "");
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function commit() {
    const num = value.trim() === "" ? 0 : Number(value);
    if (!Number.isFinite(num) || num < 0) { setErr("Yanlış rəqəm"); return; }
    if (num === initial || (num === 0 && initial === 0)) return;
    setErr(null);
    startTransition(async () => {
      const r = await setExpenseBudget(kateqoriyaId, num);
      if (r.ok) { setSaved(true); setTimeout(() => setSaved(false), 1500); }
      else setErr(r.error);
    });
  }

  return (
    <div className="flex items-center gap-1.5">
      <div className="relative">
        <Input
          type="number"
          inputMode="decimal"
          min={0}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
          placeholder="Büdcə yox"
          className="h-8 w-28 text-right tabular-nums"
          aria-label="Aylıq büdcə"
        />
        {pending && <Loader2 className="absolute right-2 top-2 h-4 w-4 animate-spin text-muted-foreground" />}
        {saved && !pending && <Check className="absolute right-2 top-2 h-4 w-4 text-emerald-500" />}
      </div>
      {err && <span className="text-xs text-rose-500">{err}</span>}
    </div>
  );
}
