"use server";

import { revalidatePath } from "next/cache";
import { getActiveFeatures, setActiveFeatures } from "./state";
import { getFeatureById } from "./catalog";

/** Toggle a lab feature on/off for the current user. */
export async function toggleLabFeature(id: string): Promise<{ ok: boolean; active: boolean; error?: string }> {
  const feature = getFeatureById(id);
  if (!feature) return { ok: false, active: false, error: "Funksiya tapılmadı" };

  const current = await getActiveFeatures();
  const isActive = current.includes(id);
  const next = isActive ? current.filter((x) => x !== id) : [...current, id];
  await setActiveFeatures(next);

  revalidatePath("/360-lab");
  revalidatePath(`/360-lab/${id}`);
  return { ok: true, active: !isActive };
}

/** Disable all activated lab features at once. */
export async function deactivateAllLabFeatures(): Promise<{ ok: boolean }> {
  await setActiveFeatures([]);
  revalidatePath("/360-lab");
  return { ok: true };
}
