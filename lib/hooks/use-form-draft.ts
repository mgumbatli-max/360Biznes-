"use client";

import { useEffect, useRef } from "react";

/**
 * Form draft auto-save — istifadəçinin yarımçıq doldurduğu formanı localStorage-da saxlayır.
 *
 * İstifadə:
 * ```tsx
 * const [values, setValues] = useState({ ad: "", telefon: "" });
 * useFormDraft("contact-new", values, setValues);
 * ```
 *
 * Davranış:
 *  - mount-da localStorage-dan oxuyub setValues(draft) çağırır (əgər draft varsa)
 *  - hər values dəyişikliyində debounced (500ms) localStorage-a yazır
 *  - `clearFormDraft(key)` çağırılanda draft silinir (uğurlu submit-dən sonra çağır)
 *
 * Limitlər:
 *  - JSON serializable values
 *  - Per-tab paylaşılmır (localStorage), amma user-spesifik deyil — eyni brauzerdə
 *    eyni key paylaşılır. Sensitiv data üçün istifadə etməyin.
 */
const DRAFT_PREFIX = "draft:";

export function useFormDraft<T>(
  key: string,
  values: T,
  setValues: (v: T) => void,
  options: { skip?: boolean; debounceMs?: number } = {},
) {
  const { skip = false, debounceMs = 500 } = options;
  const hydrated = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Hydrate from storage once on mount.
  useEffect(() => {
    if (skip || hydrated.current) return;
    hydrated.current = true;
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(DRAFT_PREFIX + key);
      if (raw) {
        const parsed = JSON.parse(raw) as T;
        setValues(parsed);
      }
    } catch {
      /* corrupt draft — ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, skip]);

  // Debounced write whenever values change.
  useEffect(() => {
    if (skip || !hydrated.current) return;
    if (typeof window === "undefined") return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      try {
        window.localStorage.setItem(DRAFT_PREFIX + key, JSON.stringify(values));
      } catch {
        /* quota / disabled */
      }
    }, debounceMs);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [key, values, skip, debounceMs]);
}

/** Submit-dən sonra çağır — draft-ı silir. */
export function clearFormDraft(key: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(DRAFT_PREFIX + key);
  } catch {
    /* */
  }
}

/** Manuel "Drafti sıfırla" düyməsi üçün — draft varsa silər və ilkin dəyərə qaytarır. */
export function hasFormDraft(key: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(DRAFT_PREFIX + key) !== null;
  } catch {
    return false;
  }
}
