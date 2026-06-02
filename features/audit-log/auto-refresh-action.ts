"use server";

import { revalidateTag } from "next/cache";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";

/**
 * Auto-refresh komponenti üçün audit cache tag invalidation.
 * router.refresh() yalnız Server Component-i yenidən render edir; lakin
 * `unstable_cache` 10 saniyə revalidate-i öz daxili saatla işlədir. Bu action
 * cache tag-i şəxsən invalidate edib yeni audit qeydlərini dərhal göstərir.
 */
export async function refreshAuditCache(): Promise<void> {
  await withTenant(async () => {
    const { sahibkarId } = requireTenant();
    revalidateTag(`audit:${sahibkarId}`, "max");
  });
}
