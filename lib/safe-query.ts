/**
 * Silent fallback helper — DB/RPC failure-ları "boş data" ilə əvəz edir,
 * AMMA console.error ilə logsuz qalmır.
 *
 * Audit zamanı tapıldı ki, çoxlu yerdə `.catch(() => [])` istifadə olunur
 * və production-da DB səhvi olarsa istifadəçi boş səhifə görür, log yoxdur.
 * Bu helper ilə eyni davranış, amma server log-larında stack görünür.
 *
 * İstifadə:
 *   await prisma.something.findMany(...)
 *     .catch(silentFallback("getHesablar", [] as never[]))
 */
export function silentFallback<T>(label: string, fallback: T): (e: unknown) => T {
  return (e: unknown) => {
    const err = e as { message?: string; code?: string };
    console.error(
      `[silent-fallback:${label}]`,
      err?.code ? `[${err.code}]` : "",
      err?.message ?? String(e),
    );
    return fallback;
  };
}
