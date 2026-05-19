import "server-only";
import { cookies } from "next/headers";

const COOKIE = "sahibkar_pin_attempts";

type AttemptState = {
  count: number;
  lockedUntil: number | null; // unix ms
};

const DEFAULT_LIMIT = 5;
const LOCKOUT_MIN = 5; // 5 minutes after threshold

async function read(): Promise<AttemptState> {
  const jar = await cookies();
  const raw = jar.get(COOKIE)?.value;
  if (!raw) return { count: 0, lockedUntil: null };
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed.count === "number") return { count: parsed.count, lockedUntil: parsed.lockedUntil ?? null };
  } catch {
    /* ignore */
  }
  return { count: 0, lockedUntil: null };
}

async function write(s: AttemptState): Promise<void> {
  const jar = await cookies();
  jar.set(COOKIE, JSON.stringify(s), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60, // 1 hour — long enough for lockout window
  });
}

/** Read current state and whether we're locked out right now. */
export async function getAttemptStatus(): Promise<{ count: number; locked: boolean; remainingSec: number | null }> {
  const s = await read();
  const now = Date.now();
  if (s.lockedUntil && s.lockedUntil > now) {
    return { count: s.count, locked: true, remainingSec: Math.ceil((s.lockedUntil - now) / 1000) };
  }
  // Lockout expired → reset count (server component-dən çağırılarsa cookie set
  // edilməsi xəta verə bilər — səssizcə tut)
  if (s.lockedUntil && s.lockedUntil <= now) {
    try {
      await write({ count: 0, lockedUntil: null });
    } catch {
      /* server component context */
    }
    return { count: 0, locked: false, remainingSec: null };
  }
  return { count: s.count, locked: false, remainingSec: null };
}

/** Record a failed attempt. Returns the new state including whether we just locked. */
export async function recordFailure(limit = DEFAULT_LIMIT): Promise<{ count: number; locked: boolean; remainingSec: number | null }> {
  const s = await read();
  const newCount = s.count + 1;
  if (newCount >= limit) {
    const lockedUntil = Date.now() + LOCKOUT_MIN * 60 * 1000;
    await write({ count: newCount, lockedUntil });
    return { count: newCount, locked: true, remainingSec: LOCKOUT_MIN * 60 };
  }
  await write({ count: newCount, lockedUntil: null });
  return { count: newCount, locked: false, remainingSec: null };
}

/** Reset on successful login. */
export async function resetAttempts(): Promise<void> {
  await write({ count: 0, lockedUntil: null });
}
