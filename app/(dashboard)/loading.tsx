/**
 * Dashboard global loading skeleton.
 * Naviqasiya zamanı dərhal göstərilir — yeni səhifə render olunana qədər
 * istifadəçi "donmuş" hiss etməsin.
 *
 * Suspense boundary-ləri yoxdursa, bu fallback bütün route segment-i üçün
 * göstərilir (Next 16 default behavior).
 */
export default function DashboardLoading() {
  return (
    <div className="mx-auto max-w-7xl space-y-4 px-1">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-7 w-48 animate-pulse rounded-md bg-muted/40" />
          <div className="h-3 w-32 animate-pulse rounded bg-muted/30" />
        </div>
        <div className="h-9 w-28 animate-pulse rounded-md bg-muted/40" />
      </div>

      {/* KPI grid skeleton */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-xl bg-muted/30" />
        ))}
      </div>

      {/* Body skeleton */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="h-[260px] animate-pulse rounded-xl bg-muted/30 lg:col-span-2" />
        <div className="h-[260px] animate-pulse rounded-xl bg-muted/30" />
      </div>

      <div className="h-[320px] animate-pulse rounded-xl bg-muted/30" />
    </div>
  );
}
