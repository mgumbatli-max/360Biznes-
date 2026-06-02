import "server-only";
import { auth } from "@/auth";
import { runWithTenant, getTenant } from "./tenant-context";
import { loadPermissionsForRole } from "@/lib/auth/permissions";
import { cache } from "react";

const loadPermissionsCached = cache(loadPermissionsForRole);

/**
 * Server-side: runs the given function with the current session's tenant
 * context bound, so every Prisma call inside transparently filters by
 * `sahibkar_id` (see lib/db/prisma.ts extension).
 *
 * Throws if there is no authenticated session — call from authenticated
 * route handlers / server actions / server components only.
 */
export async function withTenant<T>(fn: () => Promise<T>): Promise<T> {
  // Reuse an already-active tenant context (e.g. nested withTenant call).
  // Avoids re-hitting auth() + permissions on each helper.
  const existing = getTenant();
  if (existing) {
    return runWithTenant(existing, async () => await fn());
  }

  const session = await auth();
  if (!session?.user) {
    throw new Error("withTenant: no authenticated session");
  }

  const icazeler = session.user.rol_id
    ? await loadPermissionsCached(session.user.rol_id)
    : [];

  // IMPORTANT: we await fn() INSIDE runWithTenant so that any PrismaPromise
  // returned by fn() has its `.then` callback fire while the AsyncLocalStorage
  // scope is still active. Returning fn() directly (without await) means the
  // PrismaPromise resolves AFTER storage.run() has exited, which makes the
  // Prisma extension see an empty tenant context and throw "tenant-guard".
  return runWithTenant(
    {
      sahibkarId: session.user.sahibkar_id,
      istifadeciId: session.user.id,
      rolId: session.user.rol_id,
      rolAd: session.user.rol_ad,
      icazeler,
    },
    async () => await fn()
  );
}
