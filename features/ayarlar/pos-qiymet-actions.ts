"use server";

import { revalidatePath } from "next/cache";
import {
  setPosPriceSettings,
  type PosPriceSettings,
} from "./pos-qiymet";
import { requireAyarActionPerm } from "./access-guard";

export type SaveResult = { ok: true } | { ok: false; error: string };

export async function savePosPriceSettings(
  input: Partial<PosPriceSettings>,
): Promise<SaveResult> {
  // QA-K5: backend icazə guard-ı (əvvəl yalnız frontend gizlədirdi)
  const __g = await requireAyarActionPerm(["ayar.qiymet", "ayar.idare"]);
  if (!__g.ok) return { ok: false, error: __g.error };
  try {
    await setPosPriceSettings(input);
    revalidatePath("/ayarlar/pos-qiymet");
    revalidatePath("/pos");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Xəta" };
  }
}
