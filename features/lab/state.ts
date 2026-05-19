import "server-only";
import { cookies } from "next/headers";

const COOKIE_NAME = "lab_active";
const MAX_AGE = 60 * 60 * 24 * 365; // 1 year

/** Server-only — get the list of activated lab feature IDs for this user. */
export async function getActiveFeatures(): Promise<string[]> {
  const c = await cookies();
  const raw = c.get(COOKIE_NAME)?.value;
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.filter((v) => typeof v === "string");
  } catch {
    /* ignore */
  }
  return [];
}

export async function isFeatureActive(id: string): Promise<boolean> {
  const list = await getActiveFeatures();
  return list.includes(id);
}

export async function setActiveFeatures(ids: string[]): Promise<void> {
  const c = await cookies();
  c.set(COOKIE_NAME, JSON.stringify(ids), {
    maxAge: MAX_AGE,
    path: "/",
    sameSite: "lax",
    httpOnly: false, // allow client read for optimistic UI
  });
}
