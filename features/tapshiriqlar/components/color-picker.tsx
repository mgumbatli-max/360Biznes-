"use client";

import { useState } from "react";
import { Check, Palette } from "lucide-react";
import { cn } from "@/lib/utils";

export const TASK_COLOR_OPTIONS = [
  { value: "", label: "Default", hex: "transparent", ring: "ring-slate-300" },
  { value: "rose", label: "Rose", hex: "#f43f5e", ring: "ring-rose-300" },
  { value: "amber", label: "Amber", hex: "#f59e0b", ring: "ring-amber-300" },
  { value: "emerald", label: "Emerald", hex: "#10b981", ring: "ring-emerald-300" },
  { value: "sky", label: "Sky", hex: "#0ea5e9", ring: "ring-sky-300" },
  { value: "violet", label: "Violet", hex: "#8b5cf6", ring: "ring-violet-300" },
  { value: "fuchsia", label: "Fuchsia", hex: "#d946ef", ring: "ring-fuchsia-300" },
  { value: "slate", label: "Slate", hex: "#64748b", ring: "ring-slate-300" },
  { value: "cyan", label: "Cyan", hex: "#06b6d4", ring: "ring-cyan-300" },
] as const;

export function colorHexFor(value: string | null | undefined): string | null {
  if (!value) return null;
  if (value.startsWith("#")) return value;
  const found = TASK_COLOR_OPTIONS.find((o) => o.value === value);
  return found?.hex ?? null;
}

type Props = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
};

export function TaskColorPicker({ value, onChange, disabled }: Props) {
  const [customHex, setCustomHex] = useState<string>("");

  function applyCustom() {
    const v = customHex.trim();
    if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v)) {
      onChange(v);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {TASK_COLOR_OPTIONS.map((opt) => {
          const isActive = value === opt.value;
          return (
            <button
              key={opt.value || "none"}
              type="button"
              onClick={() => onChange(opt.value)}
              disabled={disabled}
              title={opt.label}
              className={cn(
                "relative grid h-7 w-7 place-items-center rounded-full border border-border/60 transition hover:scale-110 disabled:opacity-50",
                isActive && `ring-2 ${opt.ring}`
              )}
              style={{ background: opt.hex === "transparent" ? "transparent" : opt.hex }}
            >
              {opt.value === "" && <Palette className="h-3.5 w-3.5 text-muted-foreground" />}
              {isActive && opt.value !== "" && <Check className="h-3.5 w-3.5 text-white" />}
            </button>
          );
        })}
      </div>
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={customHex}
          onChange={(e) => setCustomHex(e.target.value)}
          placeholder="#ff0080"
          maxLength={7}
          disabled={disabled}
          className="flex h-7 w-24 rounded-md border border-input bg-background px-2 text-xs shadow-sm"
        />
        <button
          type="button"
          onClick={applyCustom}
          disabled={disabled || !customHex.trim()}
          className="rounded-md border border-border bg-secondary/40 px-2 py-1 text-[11px] hover:bg-secondary disabled:opacity-50"
        >
          Custom tətbiq et
        </button>
        {value && value.startsWith("#") && (
          <span
            className="inline-block h-4 w-4 rounded-full border border-border"
            style={{ background: value }}
          />
        )}
      </div>
    </div>
  );
}
