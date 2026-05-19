import "server-only";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";

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
    const cfg = await prisma.sahibkar_ayar.findFirst({ select: { sidebar_gorunsun: true } });
    if (!cfg) return true; // default visible until owner sets a preference
    return cfg.sidebar_gorunsun !== false;
  }).catch(() => true);
}
