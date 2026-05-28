"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Pencil, Loader2, Check, X } from "lucide-react";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

/**
 * Inline edit cell — cədvəl xanasında düzgün dəyər göstərir, klik edildikdə
 * input açır, Enter / blur ilə server-action çağırır, Esc ilə ləğv edir.
 *
 * İstifadə:
 * ```tsx
 * <InlineEditNumber
 *   value={p.satis_qiymeti}
 *   onSave={async (v) => setProductSalePrice({ id: p.id, value: v })}
 *   format={(v) => formatMoney(v)}
 *   suffix="₼"
 *   min={0}
 *   step={0.01}
 * />
 * ```
 *
 * canEdit=false olduqda yalnız read-only mətn göstərir.
 */
export function InlineEditNumber({
  value,
  onSave,
  format,
  suffix,
  min = 0,
  max,
  step,
  className,
  canEdit = true,
  ariaLabel = "Redaktə et",
}: {
  value: number;
  onSave: (v: number) => Promise<{ ok: true } | { ok: false; error: string }>;
  format?: (v: number) => string;
  suffix?: string;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
  canEdit?: boolean;
  ariaLabel?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  useEffect(() => {
    if (!editing) setDraft(String(value));
  }, [value, editing]);

  function commit() {
    const next = Number(draft.replace(",", "."));
    if (!Number.isFinite(next)) {
      toast.error("Yanlış rəqəm");
      setDraft(String(value));
      setEditing(false);
      return;
    }
    if (next === value) {
      setEditing(false);
      return;
    }
    startTransition(async () => {
      const res = await onSave(next);
      if (res.ok) {
        toast.success("Yadda saxlandı");
        setEditing(false);
      } else {
        toast.error(res.error);
      }
    });
  }

  function cancel() {
    setDraft(String(value));
    setEditing(false);
  }

  if (!canEdit) {
    return (
      <span className={cn("tabular-nums", className)}>
        {format ? format(value) : value}
        {suffix && <span className="text-muted-foreground"> {suffix}</span>}
      </span>
    );
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className={cn(
          "group inline-flex items-center gap-1 rounded px-1 -mx-1 transition hover:bg-secondary/40 tabular-nums",
          className,
        )}
        aria-label={ariaLabel}
      >
        <span>{format ? format(value) : value}</span>
        {suffix && <span className="text-muted-foreground">{suffix}</span>}
        <Pencil className="h-3 w-3 opacity-0 transition group-hover:opacity-60" />
      </button>
    );
  }

  return (
    <span className="inline-flex items-center gap-0.5">
      <input
        ref={inputRef}
        type="number"
        inputMode="decimal"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          } else if (e.key === "Escape") {
            e.preventDefault();
            cancel();
          }
        }}
        onBlur={() => {
          if (!pending) commit();
        }}
        min={min}
        max={max}
        step={step}
        disabled={pending}
        className="h-7 w-24 rounded border border-primary bg-background px-1.5 text-right text-sm tabular-nums outline-none focus:ring-2 focus:ring-primary/30"
      />
      {pending ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
      ) : (
        <>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              commit();
            }}
            className="grid h-5 w-5 place-items-center rounded text-emerald-600 hover:bg-emerald-100"
            aria-label="Yadda saxla"
          >
            <Check className="h-3 w-3" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              cancel();
            }}
            className="grid h-5 w-5 place-items-center rounded text-rose-600 hover:bg-rose-100"
            aria-label="Ləğv et"
          >
            <X className="h-3 w-3" />
          </button>
        </>
      )}
    </span>
  );
}
