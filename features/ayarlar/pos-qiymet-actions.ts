"use server";

import { revalidatePath } from "next/cache";
import {
  setPosPriceSettings,
  type PosPriceSettings,
} from "./pos-qiymet";

export type SaveResult = { ok: true } | { ok: false; error: string };

export async function savePosPriceSettings(
  input: Partial<PosPriceSettings>,
): Promise<SaveResult> {
  try {
    await setPosPriceSettings(input);
    revalidatePath("/ayarlar/pos-qiymet");
    revalidatePath("/pos");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Xəta" };
  }
}
