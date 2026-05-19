"use server";

import { revalidatePath } from "next/cache";
import { setRoleAllowedTiers, type TierKey, ALL_TIERS } from "./qiymet-icaze";

export type SaveResult = { ok: true } | { ok: false; error: string };

export async function saveRoleAllowedTiers(rolId: number, tiers: string[]): Promise<SaveResult> {
  if (!Number.isInteger(rolId) || rolId <= 0) {
    return { ok: false, error: "rolId yanlışdır" };
  }
  const clean = tiers.filter((t): t is TierKey => ALL_TIERS.includes(t as TierKey));
  try {
    await setRoleAllowedTiers(rolId, clean);
    revalidatePath("/ayarlar/qiymet-icaze");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Xəta" };
  }
}
