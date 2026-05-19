"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  total: number;
  pageSize: number;
  page: number;
  basePath: string;
};

export function Pagination({ total, pageSize, page, basePath }: Props) {
  const sp = useSearchParams();
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;

  function makeHref(p: number) {
    const params = new URLSearchParams(sp.toString());
    params.set("page", String(p));
    return `${basePath}?${params.toString()}`;
  }

  // Always show: first, last, current ± 1
  const pages: (number | "ellipsis")[] = [];
  const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

  if (totalPages <= 7) {
    pages.push(...range(1, totalPages));
  } else {
    pages.push(1);
    if (page > 3) pages.push("ellipsis");
    pages.push(...range(Math.max(2, page - 1), Math.min(totalPages - 1, page + 1)));
    if (page < totalPages - 2) pages.push("ellipsis");
    pages.push(totalPages);
  }

  return (
    <nav className="flex items-center justify-between gap-2 py-3 text-sm">
      <div className="text-xs text-muted-foreground">
        Səhifə <strong className="text-foreground">{page}</strong> / {totalPages}
        <span className="ml-2">({total} qeyd)</span>
      </div>

      <div className="flex items-center gap-1">
        <Link
          href={makeHref(Math.max(1, page - 1))}
          aria-disabled={page === 1}
          className={cn(
            "inline-flex h-8 items-center gap-1 rounded-md border border-border bg-card px-2.5 text-xs font-medium",
            page === 1 && "pointer-events-none opacity-40"
          )}
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Əvvəlki
        </Link>

        {pages.map((p, i) =>
          p === "ellipsis" ? (
            <span key={`e-${i}`} className="px-1 text-muted-foreground">
              <MoreHorizontal className="h-3 w-3" />
            </span>
          ) : (
            <Link
              key={p}
              href={makeHref(p)}
              className={cn(
                "inline-flex h-8 w-8 items-center justify-center rounded-md border text-xs font-medium",
                p === page
                  ? "border-primary/40 bg-primary/15 text-primary-light"
                  : "border-border bg-card text-muted-foreground hover:text-foreground"
              )}
            >
              {p}
            </Link>
          )
        )}

        <Link
          href={makeHref(Math.min(totalPages, page + 1))}
          aria-disabled={page === totalPages}
          className={cn(
            "inline-flex h-8 items-center gap-1 rounded-md border border-border bg-card px-2.5 text-xs font-medium",
            page === totalPages && "pointer-events-none opacity-40"
          )}
        >
          Sonrakı
          <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </nav>
  );
}
