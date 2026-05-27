"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Geri qaytarma düyməsi — istifadəçinin gerçək keçmiş ardıcıllığını izləyir.
 *
 * Strategiya:
 *  1. Əgər brauzer tarixçəsində səhifə varsa (`history.length > 1`),
 *     `router.back()` çağrılır — istifadəçi haradan gəldisə oraya qayıdır.
 *  2. Əks halda (məs. yeni tab-da açılıb), `fallback` URL-ə yönləndirilir.
 *
 * Bu, statik `<Link href="...">` ilə əvəzlənmək üçün nəzərdə tutulub.
 */
export function BackButton({
  fallback,
  label,
  className,
  title = "Geri",
  ariaLabel = "Geri qayıt",
}: {
  fallback: string;
  /** Mətn göstərilirsə (məs. "Geri", "İşçilərə qayıt"), düymə inline stilə keçir. */
  label?: string;
  className?: string;
  title?: string;
  ariaLabel?: string;
}) {
  const router = useRouter();

  function onClick(e: React.MouseEvent<HTMLAnchorElement>) {
    if (typeof window !== "undefined" && window.history.length > 1) {
      e.preventDefault();
      router.back();
    }
  }

  if (label) {
    return (
      <Link
        href={fallback}
        onClick={onClick}
        title={title}
        aria-label={ariaLabel}
        className={cn(
          "inline-flex items-center gap-1.5 text-sm text-muted-foreground transition hover:text-foreground",
          className,
        )}
      >
        <ArrowLeft className="h-4 w-4" />
        <span>{label}</span>
      </Link>
    );
  }

  return (
    <Link
      href={fallback}
      onClick={onClick}
      title={title}
      aria-label={ariaLabel}
      className={cn(
        "grid h-9 w-9 place-items-center rounded-md border border-border bg-card text-muted-foreground transition hover:bg-secondary hover:text-foreground",
        className,
      )}
    >
      <ArrowLeft className="h-4 w-4" />
    </Link>
  );
}
