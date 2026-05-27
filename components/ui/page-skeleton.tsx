import { Skeleton } from "./skeleton";

/**
 * Ümumi səhifə skeleton — header + 4 KPI kart + table.
 * Perceived speed üçün loading.tsx-də istifadə olunur.
 */
export function PageSkeleton({
  kpiCount = 4,
  showTable = true,
  rowCount = 10,
}: { kpiCount?: number; showTable?: boolean; rowCount?: number }) {
  return (
    <div className="mx-auto max-w-7xl space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-9 w-24" />
      </div>

      {/* KPI strip */}
      {kpiCount > 0 && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {Array.from({ length: kpiCount }).map((_, i) => (
            <div key={i} className="space-y-2 rounded-xl border border-border/40 bg-card/40 p-4">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-6 w-24" />
              <Skeleton className="h-3 w-20" />
            </div>
          ))}
        </div>
      )}

      {/* Table */}
      {showTable && (
        <div className="overflow-hidden rounded-xl border border-border/40">
          <div className="border-b border-border/40 bg-secondary/20 px-3 py-2.5">
            <Skeleton className="h-3 w-20" />
          </div>
          <div className="divide-y divide-border/30">
            {Array.from({ length: rowCount }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-3 py-2.5">
                <Skeleton className="h-8 w-8 rounded-md" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3 w-40" />
                  <Skeleton className="h-2.5 w-24" />
                </div>
                <Skeleton className="h-6 w-16" />
                <Skeleton className="h-6 w-20" />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** Sadə tam-ekran kart skeleton — detal səhifələri üçün */
export function DetailPageSkeleton() {
  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex items-start gap-3">
        <Skeleton className="h-9 w-9 rounded-md" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-7 w-64" />
          <Skeleton className="h-3 w-40" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    </div>
  );
}
