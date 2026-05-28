"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { SavedFiltersBar } from "@/components/ui/saved-filters-bar";

/**
 * URL search-params-based saxlanmış filtrlər. Müştəri / satış kimi server-fetched
 * cədvəllərdə istifadə edilir — filterlər URL-də qaldığı üçün burada URL string-i
 * yaddaşa veririk.
 *
 * `storageKey` modul üçün unikaldır (məs. "musteriler"). `basePath` filter applied
 * olduqda hara naviqasiya etsin (məs. "/elaqe/musteriler").
 */
export function SavedUrlFiltersChip({
  storageKey,
  basePath,
}: {
  storageKey: string;
  basePath: string;
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const currentQuery = sp.toString();

  return (
    <SavedFiltersBar<string>
      storageKey={storageKey}
      currentValues={currentQuery}
      onApply={(q) => router.push(q ? `${basePath}?${q}` : basePath)}
      isActive={(f) => f.values === currentQuery}
    />
  );
}
