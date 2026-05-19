import { Suspense } from "react";

/**
 * Wrapper that catches async errors from children server components and shows
 * a small inline fallback. Prevents a single widget crash from breaking the
 * whole page.
 *
 * Note: React Server Components-də sync render xətalarını tutmaq üçün
 * `<ErrorBoundary>` adi React komponenti kimi istifadə oluna bilməz — onlar
 * yalnız client tərəfdə işləyir. Bu komponent async server data fetch
 * xətalarını try-catch ilə tutur və fallback göstərir.
 */
export async function ErrorSilentWrapper({
  children,
  name,
  fallback,
}: {
  children: React.ReactNode;
  name?: string;
  fallback?: React.ReactNode;
}) {
  try {
    return <Suspense fallback={null}>{children}</Suspense>;
  } catch (e) {
    console.warn(`[ErrorSilentWrapper:${name ?? "unknown"}]`, e);
    if (fallback) return <>{fallback}</>;
    return (
      <div className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-[10.5px] text-amber-700 dark:text-amber-300">
        ⚠ Bu bölmə müvəqqəti yüklənə bilmədi
        {name && <code className="ml-1 opacity-60">({name})</code>}
      </div>
    );
  }
}
