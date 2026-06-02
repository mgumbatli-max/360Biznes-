import { AsyncLocalStorage } from "node:async_hooks";

export type TenantContext = {
  sahibkarId: string;
  istifadeciId: string;
  rolId: number;
  /**
   * Rolun adı — multi-tenant migrasiyadan sonra rolId nömrəsi hər sahibkar üçün
   * fərqli olur (sahibkar_id+ad unikaldır). "sahibkar", "admin", "kassir" kimi
   * yoxlamalar üçün ad istifadə edilməlidir, rolId nömrəsi yox.
   * Sistem callback-lərində (cron, webhook) boş ola bilər.
   */
  rolAd?: string;
  icazeler: string[];
};

// Cache the AsyncLocalStorage instance on globalThis so HMR / multiple
// module instantiations all share the same storage. Without this, the
// storage in prisma.ts and with-tenant.ts can end up being different
// instances and the `run()` context becomes invisible to lookups.
const globalForStorage = globalThis as unknown as {
  __360biznes_tenantStorage?: AsyncLocalStorage<TenantContext>;
};
const storage: AsyncLocalStorage<TenantContext> =
  globalForStorage.__360biznes_tenantStorage ??
  (globalForStorage.__360biznes_tenantStorage = new AsyncLocalStorage<TenantContext>());

/**
 * Run a function with a tenant context bound for the duration of its async work.
 * All Prisma calls inside will automatically receive `sahibkar_id` filtering
 * (see lib/db/prisma.ts extension).
 */
export function runWithTenant<T>(ctx: TenantContext, fn: () => T): T {
  return storage.run(ctx, fn);
}

/** Returns the current tenant context or throws if none is active. */
export function requireTenant(): TenantContext {
  const ctx = storage.getStore();
  if (!ctx) {
    throw new Error(
      "Tenant context is missing. Wrap server-side code with `runWithTenant()` or call from an authenticated route."
    );
  }
  return ctx;
}

/** Returns the current tenant context, or undefined if not in a tenant scope. */
export function getTenant(): TenantContext | undefined {
  return storage.getStore();
}

/** Internal: only used by the Prisma extension to safely access tenant id. */
export function currentTenantId(): string | undefined {
  return storage.getStore()?.sahibkarId;
}
