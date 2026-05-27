"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV_STACK_KEY } from "@/components/layout/navigation-tracker";

/**
 * Geri qaytarma düyməsi — istifadəçinin gerçək keçmiş ardıcıllığını izləyir.
 *
 * Strategiya (3 səviyyəli fallback):
 *  1. SessionStorage-da `NavigationTracker`-in yığdığı stack-dan əvvəlki URL.
 *     Bu, Next.js App Router-in soft naviqasiyalarını dəqiq tutur.
 *  2. `window.history.length > 1` olsa, brauzer back. (Stack boş olarsa)
 *  3. `fallback` URL-i — yeni tab-da açılma, ya stack/history boş olduqda.
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
    if (typeof window === "undefined") return;

    // 1) Naviqasiya stack-ından əvvəlki URL-i götür (cari URL-dən bir əvvəl).
    try {
      const raw = window.sessionStorage.getItem(NAV_STACK_KEY);
      if (raw) {
        const stack: string[] = JSON.parse(raw);
        // Stack: [..., previous, current]. Cari-i çıxar, əvvəlki-yə get.
        if (stack.length >= 2) {
          e.preventDefault();
          const prev = stack[stack.length - 2];
          // Cari-i pop edirik ki, gələcəkdə yenidən back basanda
          // əvvəlkindən də əvvələ gedə bilək.
          stack.pop();
          window.sessionStorage.setItem(NAV_STACK_KEY, JSON.stringify(stack));
          router.push(prev);
          return;
        }
      }
    } catch {
      /* sessionStorage disabled / quota */
    }

    // 2) Stack boşdursa, brauzer history-ə cəhd et.
    if (window.history.length > 1) {
      e.preventDefault();
      router.back();
      return;
    }

    // 3) Fallback URL-ə Link-in öz davranışı işləyir (preventDefault çağrılmadı).
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
