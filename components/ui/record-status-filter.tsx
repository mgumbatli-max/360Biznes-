"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useTransition } from "react";
import { Check, Trash2, Eye, Loader2 } from "lucide-react";
import { cn, formatDate } from "@/lib/utils";

/**
 * Vahid soft-delete filter UI — bütün siyahılarda istifadə üçün.
 *
 * Davranış:
 *   - URL search-param `status_filter` dəyişdirir (default "aktiv")
 *   - İcazəsi olmayan istifadəçidə yalnız "Aktivlər" görünür (tək toggle, dəyişməz)
 *
 * İcazə yoxlaması SERVER-də olur (`readRecordStatusFromSearch`),
 * burada yalnız UI gizlədilir — backend gate əsasdır.
 */
export function RecordStatusFilter({
  canSeeDeleted,
  paramName = "status_filter",
}: {
  canSeeDeleted: boolean;
  paramName?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  if (!canSeeDeleted) return null;

  const current =
    (searchParams.get(paramName) as "aktiv" | "silinmis" | "hamisi" | null) ?? "aktiv";

  function setFilter(value: "aktiv" | "silinmis" | "hamisi") {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "aktiv") {
      params.delete(paramName);
    } else {
      params.set(paramName, value);
    }
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  }

  const options = [
    { value: "aktiv" as const, label: "Aktiv", icon: Check, color: "emerald" },
    { value: "silinmis" as const, label: "Silinmiş", icon: Trash2, color: "rose" },
    { value: "hamisi" as const, label: "Hamısı", icon: Eye, color: "slate" },
  ];

  return (
    <div className="inline-flex rounded-lg border border-border bg-secondary/30 p-0.5">
      {pending && (
        <Loader2 className="mx-1 h-3 w-3 animate-spin self-center text-muted-foreground" />
      )}
      {options.map((opt) => {
        const active = current === opt.value;
        const Icon = opt.icon;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => setFilter(opt.value)}
            disabled={pending}
            className={cn(
              "inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[11.5px] font-medium transition-colors",
              active
                ? "bg-card text-foreground shadow-sm ring-1 ring-inset ring-border/60"
                : "text-muted-foreground hover:bg-card/60 hover:text-foreground",
            )}
          >
            <Icon className="h-3 w-3" />
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Silinmiş sətir badge — siyahıda hər silinmiş row sonunda istifadə üçün.
 */
export function DeletedBadge({
  deletedAt,
  deletedBy,
  reason,
  className,
}: {
  deletedAt: Date | string | null;
  deletedBy?: string | null;
  reason?: string | null;
  className?: string;
}) {
  if (!deletedAt) return null;
  const dateStr = formatDate(deletedAt);
  const title = [
    `Silinib: ${dateStr}`,
    deletedBy ? `Silən: ${deletedBy}` : null,
    reason ? `Səbəb: ${reason}` : null,
  ]
    .filter(Boolean)
    .join("\n");
  return (
    <span
      title={title}
      className={cn(
        "inline-flex items-center gap-1 rounded-md border border-rose-500/40 bg-rose-500/10 px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wider text-rose-700 dark:text-rose-400",
        className,
      )}
    >
      <Trash2 className="h-2.5 w-2.5" />
      Silinib
    </span>
  );
}
