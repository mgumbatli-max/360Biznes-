"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * Her naviqasiyada cari URL-i sessionStorage stack-ına push edir.
 * BackButton bu stack-ı oxuyaraq əvvəlki səhifəyə qayıdır — Next.js App
 * Router-in `router.back()` davranışından asılı olmadan dəqiq işləyir
 * (prefetch və soft navigation-in qarışdığı hallarda etibarlıdır).
 *
 * Stack tab-spesifikdir (sessionStorage), eyni domeyndə qalır.
 * Maks 50 entry — köhnələri kəsilir.
 */
export const NAV_STACK_KEY = "app:nav:stack";
const STACK_MAX = 50;

export function NavigationTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = pathname + (searchParams.toString() ? `?${searchParams}` : "");
    try {
      const raw = window.sessionStorage.getItem(NAV_STACK_KEY);
      const stack: string[] = raw ? JSON.parse(raw) : [];
      const top = stack[stack.length - 1];
      // Eyni URL-ə təkrar push etmə (re-render səbəbi ola bilər).
      if (top === url) return;
      stack.push(url);
      if (stack.length > STACK_MAX) stack.splice(0, stack.length - STACK_MAX);
      window.sessionStorage.setItem(NAV_STACK_KEY, JSON.stringify(stack));
    } catch {
      /* quota / disabled */
    }
  }, [pathname, searchParams]);

  // Route dəyişikliyində səhifə yuxarısına yumşaq scroll — uzun siyahıdan
  // detail səhifəyə keçəndə istifadəçi əvvəlki scroll mövqeyində qalmasın.
  // Yalnız pathname (segment) dəyişəndə işləyir — query/sort dəyişiklikləri
  // toxunulmaz.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.scrollY < 40) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
  }, [pathname]);

  return null;
}
