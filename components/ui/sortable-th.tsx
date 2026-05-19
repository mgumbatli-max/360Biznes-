"use client";

import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

export type SortDir = "asc" | "desc";

type Props = {
  label: string;
  /** The currently active sort key (from URL) */
  current: string;
  /** The column's sort key */
  sortKey: string;
  /** The currently active sort direction */
  dir: SortDir;
  /** Click handler — receives the column's key */
  onClick: (key: string) => void;
  align?: "left" | "right" | "center";
  className?: string;
  title?: string;
};

export function SortableTh({
  label,
  current,
  sortKey,
  dir,
  onClick,
  align = "left",
  className,
  title,
}: Props) {
  const active = current === sortKey;
  const alignCls =
    align === "right" ? "text-right" : align === "center" ? "text-center" : "";
  const flexCls =
    align === "right"
      ? "flex-row-reverse"
      : align === "center"
      ? "justify-center"
      : "";
  return (
    <th className={cn("px-3 py-2.5", alignCls, className)} title={title}>
      <button
        type="button"
        onClick={() => onClick(sortKey)}
        className={cn(
          "inline-flex items-center gap-1 transition hover:text-foreground",
          active && "text-primary-light",
          flexCls,
        )}
      >
        {label}
        {active ? (
          dir === "asc" ? (
            <ArrowUp className="h-3 w-3" />
          ) : (
            <ArrowDown className="h-3 w-3" />
          )
        ) : (
          <ArrowUpDown className="h-3 w-3 opacity-30" />
        )}
      </button>
    </th>
  );
}
