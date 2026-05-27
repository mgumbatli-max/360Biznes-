"use client";

import { useCallback, useEffect, useState } from "react";

export type SavedFilter<T> = {
  id: string;
  name: string;
  values: T;
  createdAt: number;
};

const PREFIX = "saved-filters:";

/**
 * Cədvəl filtrlərini saxlamaq üçün hook. Per-istifadəçi deyil — eyni brauzerdə
 * eyni `key` paylaşılır. Sensitiv data üçün istifadə etməyin.
 *
 * İstifadə:
 * ```tsx
 * const { filters, save, remove, apply } = useSavedFilters<MusteriFilter>("musteriler");
 * ```
 */
export function useSavedFilters<T>(key: string) {
  const fullKey = PREFIX + key;
  const [filters, setFilters] = useState<SavedFilter<T>[]>([]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(fullKey);
      if (raw) setFilters(JSON.parse(raw));
    } catch {
      /* */
    }
  }, [fullKey]);

  const persist = useCallback(
    (next: SavedFilter<T>[]) => {
      setFilters(next);
      try {
        window.localStorage.setItem(fullKey, JSON.stringify(next));
      } catch {
        /* */
      }
    },
    [fullKey],
  );

  const save = useCallback(
    (name: string, values: T) => {
      const next: SavedFilter<T>[] = [
        ...filters,
        {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          name,
          values,
          createdAt: Date.now(),
        },
      ];
      persist(next);
    },
    [filters, persist],
  );

  const remove = useCallback(
    (id: string) => {
      persist(filters.filter((f) => f.id !== id));
    },
    [filters, persist],
  );

  const rename = useCallback(
    (id: string, name: string) => {
      persist(filters.map((f) => (f.id === id ? { ...f, name } : f)));
    },
    [filters, persist],
  );

  return { filters, save, remove, rename };
}
