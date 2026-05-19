import "server-only";
import crypto from "node:crypto";
import { cookies } from "next/headers";

const COOKIE = "sahibkar_pin_session";
const DEFAULT_TTL_MIN = 15;

type PinPayload = {
  sahibkar_id: string;
  istifadeci_id: string;
  exp: number; // unix seconds
};

function secret(): string {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET is required for sahibkar PIN sessions");
  return s;
}

function sign(payload: PinPayload): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const hmac = crypto.createHmac("sha256", secret()).update(body).digest("base64url");
  return `${body}.${hmac}`;
}

function verify(token: string): PinPayload | null {
  const [body, hmac] = token.split(".");
  if (!body || !hmac) return null;
  const expected = crypto.createHmac("sha256", secret()).update(body).digest("base64url");
  if (!crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(expected))) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString()) as PinPayload;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function setPinSession(
  sahibkar_id: string,
  istifadeci_id: string,
  ttlMin: number = DEFAULT_TTL_MIN
): Promise<PinPayload> {
  const safeTtl = ttlMin >= 1 ? ttlMin : DEFAULT_TTL_MIN;
  const exp = Math.floor(Date.now() / 1000) + safeTtl * 60;
  const payload: PinPayload = { sahibkar_id, istifadeci_id, exp };
  const token = sign(payload);
  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: safeTtl * 60,
    path: "/",
  });
  return payload;
}

export async function clearPinSession() {
  const jar = await cookies();
  jar.delete(COOKIE);
}

export async function getPinSession(): Promise<PinPayload | null> {
  const jar = await cookies();
  const t = jar.get(COOKIE)?.value;
  if (!t) return null;
  return verify(t);
}

/**
 * Refresh sliding TTL on access. Returns the (renewed) payload or null.
 *
 * Next.js 16-da cookies yalnız Server Action və ya Route Handler-də dəyişdirilə bilir.
 * Server component-dən çağırılanda set() xəta atır — onu səssizcə tutub mövcud
 * payload-u qaytarırıq (TTL refresh ilk action çağırışında baş verir).
 *
 * @param ttlMin — yeni TTL (dəqiqə). Verilməsə cookie öz mövcud exp-i ilə qalır.
 */
export async function touchPinSession(ttlMin?: number): Promise<PinPayload | null> {
  const current = await getPinSession();
  if (!current) return null;
  try {
    return await setPinSession(current.sahibkar_id, current.istifadeci_id, ttlMin ?? DEFAULT_TTL_MIN);
  } catch {
    // Server component context — cookie dəyişdirilə bilmir, mövcud exp qaytar
    return current;
  }
}
