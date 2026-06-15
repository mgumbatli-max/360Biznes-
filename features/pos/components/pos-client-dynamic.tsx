"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import type { PosClient as PosClientType } from "@/features/pos/components/pos-client";

/**
 * SÜRƏT: PosClient nəhəng client komponentidir (kassa interfeysi, səbət, ödəniş,
 * barkod skaneri və s.). Server Component-də `next/dynamic({ ssr: false })`
 * İCAZƏLİ DEYİL (Next.js 16 — bax docs/lazy-loading.md: "ssr: false is not
 * allowed with next/dynamic in Server Components. Please move it into a Client
 * Component."). Ona görə bu nazik client wrapper-də edirik: PosClient SSR-də
 * render olunmur (server HTML-i + ilk paint yüngülləşir), client-də skeleton
 * fallback ilə yüklənir. Props 1:1 ötürülür (ComponentProps) → davranış eyni.
 */
const PosClientImpl = dynamic(
  () => import("@/features/pos/components/pos-client").then((m) => m.PosClient),
  {
    ssr: false,
    loading: () => (
      <div className="space-y-4" aria-busy="true" aria-live="polite">
        <Skeleton className="h-16 w-full" />
        <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
          <div className="space-y-3">
            <Skeleton className="h-11 w-full" />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          </div>
          <div className="space-y-3">
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        </div>
      </div>
    ),
  },
);

/**
 * PosClient — server səhifəsi üçün eyni adlı/eyni props-lu re-export.
 * Server page yalnız import yolunu dəyişir; JSX və ötürülən props eynidir.
 */
export function PosClient(props: ComponentProps<typeof PosClientType>) {
  return <PosClientImpl {...props} />;
}
