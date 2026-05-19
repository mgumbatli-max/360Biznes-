"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  initial: boolean;
  action: (formData: FormData) => Promise<{ ok: true } | { ok: false; error: string }>;
  fields: Record<string, string | number | boolean>;
  size?: "sm" | "md";
  title?: string;
  description?: string;
  successMessage?: string;
};

export function LiveToggle({
  initial,
  action,
  fields,
  size = "md",
  title,
  description,
  successMessage = "Yadda saxlanıldı",
}: Props) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(initial);
  const [pending, startTransition] = useTransition();

  function toggle() {
    const newVal = !enabled;
    setEnabled(newVal); // optimistic
    startTransition(async () => {
      const fd = new FormData();
      for (const [k, v] of Object.entries(fields)) fd.set(k, String(v));
      // The toggled field is in fields as the new value
      const valueKey = "value";
      fd.set(valueKey, String(newVal));
      const res = await action(fd);
      if (!res.ok) {
        setEnabled(!newVal); // rollback
        toast.error(res.error);
      } else {
        toast.success(successMessage);
        router.refresh();
      }
    });
  }

  const isSm = size === "sm";

  if (title || description) {
    return (
      <div className="flex items-start justify-between gap-3 rounded-lg border border-border/50 px-3 py-2.5">
        <div>
          {title && <div className="text-sm font-semibold">{title}</div>}
          {description && <div className="text-xs text-muted-foreground">{description}</div>}
        </div>
        <ToggleSwitch enabled={enabled} pending={pending} onClick={toggle} size={size} />
      </div>
    );
  }

  return <ToggleSwitch enabled={enabled} pending={pending} onClick={toggle} size={size} />;
}

function ToggleSwitch({
  enabled,
  pending,
  onClick,
  size,
}: {
  enabled: boolean;
  pending: boolean;
  onClick: () => void;
  size: "sm" | "md";
}) {
  const isSm = size === "sm";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className={cn(
        "relative inline-flex shrink-0 items-center rounded-full transition",
        enabled ? "bg-emerald-500" : "bg-muted",
        isSm ? "h-4 w-7" : "h-5 w-9",
        pending && "opacity-60"
      )}
      aria-pressed={enabled}
    >
      <span
        className={cn(
          "inline-block rounded-full bg-white shadow transition",
          isSm ? "ml-0.5 h-3 w-3" : "ml-0.5 h-4 w-4",
          enabled
            ? isSm
              ? "translate-x-3"
              : "translate-x-4"
            : "translate-x-0"
        )}
      />
      {pending && (
        <Loader2 className={cn("absolute inset-0 m-auto animate-spin text-white", isSm ? "h-2.5 w-2.5" : "h-3 w-3")} />
      )}
    </button>
  );
}
