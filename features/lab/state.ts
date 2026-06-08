import "server-only";
import { cookies } from "next/headers";
import { LAB_FEATURES } from "./catalog";

const COOKIE_NAME = "lab_active";
const MAX_AGE = 60 * 60 * 24 * 365; // 1 year
const MAX_FEATURES = 100; // cap əgər kimsə cookie-ni manipulyasiya etsə

const VALID_IDS = new Set(LAB_FEATURES.map((f) => f.id));

/**
 * Cookie-dən gələn ID-ləri sanitize et:
 *   - Catalog-da olub-olmadığını yoxla (qondarma ID-ləri sil)
 *   - Max 100 ID-yə cap
 *   - Unikallaşdır
 */
function sanitizeIds(ids: unknown): string[] {
  if (!Array.isArray(ids)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of ids) {
    if (typeof v !== "string") continue;
    if (!VALID_IDS.has(v)) continue;
    if (seen.has(v)) continue;
    seen.add(v);
    out.push(v);
    if (out.length >= MAX_FEATURES) break;
  }
  return out;
}

/** Server-only — get the list of activated lab feature IDs for this user. */
export async function getActiveFeatures(): Promise<string[]> {
  const c = await cookies();
  const raw = c.get(COOKIE_NAME)?.value;
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return sanitizeIds(parsed);
  } catch {
    return [];
  }
}

export async function isFeatureActive(id: string): Promise<boolean> {
  if (!VALID_IDS.has(id)) return false;
  const list = await getActiveFeatures();
  return list.includes(id);
}

export async function setActiveFeatures(ids: string[]): Promise<void> {
  const sanitized = sanitizeIds(ids);
  const c = await cookies();
  c.set(COOKIE_NAME, JSON.stringify(sanitized), {
    maxAge: MAX_AGE,
    path: "/",
    sameSite: "lax",
    httpOnly: true, // KRİTİK: XSS sızması halında lab feature-larına çatmaq olmasın
    secure: process.env.NODE_ENV === "production",
  });
}
