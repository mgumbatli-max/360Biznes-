import "server-only";
import { unstable_cache } from "next/cache";
import { prismaUnscoped } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";

/**
 * Returns whether the sahibkar section should appear in the sidebar.
 * Default: true. Owner can hide via /sahibkar/ayarlar — section then only
 * accessible via the secret search code (default "7733").
 *
 * Only relevant when current user has role 9 (owner) — others never see it anyway.
 */
export async function getSahibkarSidebarVisible(rolId: number): Promise<boolean> {
  if (rolId !== 9) return false;
  return withTenant(async () => {
    try {
      const { sahibkarId } = requireTenant();
      const cached = unstable_cache(
        async () => {
          const cfg = await prismaUnscoped.sahibkar_ayar.findFirst({
            where: { sahibkar_id: sahibkarId },
            select: { sidebar_gorunsun: true },
          });
          if (!cfg) return true;
          return cfg.sidebar_gorunsun !== false;
        },
        ["sahibkar-sidebar-visible", sahibkarId],
        { revalidate: 300, tags: [`sahibkar-ayar:${sahibkarId}`] },
      );
      return cached();
    } catch {
      return true;
    }
  }).catch(() => true);
}
