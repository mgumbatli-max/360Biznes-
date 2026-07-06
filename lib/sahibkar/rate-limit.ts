import "server-only";
import { prismaUnscoped } from "@/lib/db/prisma";

// QA-audit KRİTİK: PIN brute-force qorunması ƏVVƏL client-idarəli cookie-də idi — istifadəçi cookie-ni
// silərək lockout-u tamamilə keçirdi. İndi SERVER-avtoritativ: cəhd sayı/lockout ayarlar cədvəlində
// (tenant başına, qrup="sahibkar_pin"). prismaUnscoped + açıq sahibkar_id.
const QRUP = "sahibkar_pin";
const ACAR = "attempts";
const LOCKOUT_MIN = 5; // threshold aşıldıqdan sonra 5 dəqiqə

type AttemptState = { count: number; lockedUntil: number | null };

async function read(sahibkarId: string): Promise<AttemptState> {
  const row = await prismaUnscoped.ayarlar.findFirst({
    where: { sahibkar_id: sahibkarId, qrup: QRUP, acar: ACAR },
    select: { deyer: true },
  });
  if (!row?.deyer) return { count: 0, lockedUntil: null };
  try {
    const p = JSON.parse(row.deyer);
    if (typeof p.count === "number") return { count: p.count, lockedUntil: p.lockedUntil ?? null };
  } catch { /* pozuq */ }
  return { count: 0, lockedUntil: null };
}

async function write(sahibkarId: string, s: AttemptState): Promise<void> {
  await prismaUnscoped.ayarlar.upsert({
    where: { sahibkar_id_qrup_acar: { sahibkar_id: sahibkarId, qrup: QRUP, acar: ACAR } },
    update: { deyer: JSON.stringify(s), yenilendi: new Date() },
    create: { sahibkar_id: sahibkarId, qrup: QRUP, acar: ACAR, deyer: JSON.stringify(s), nov: "json", tesvir: "Sahibkar PIN cəhd sayğacı" },
  });
}

/** Cari vəziyyət + hazırda lockout aktivdirmi. */
export async function getAttemptStatus(sahibkarId: string): Promise<{ count: number; locked: boolean; remainingSec: number | null }> {
  const s = await read(sahibkarId);
  const now = Date.now();
  if (s.lockedUntil && s.lockedUntil > now) {
    return { count: s.count, locked: true, remainingSec: Math.ceil((s.lockedUntil - now) / 1000) };
  }
  if (s.lockedUntil && s.lockedUntil <= now) {
    try { await write(sahibkarId, { count: 0, lockedUntil: null }); } catch { /* */ }
    return { count: 0, locked: false, remainingSec: null };
  }
  return { count: s.count, locked: false, remainingSec: null };
}

/** Uğursuz cəhdi qeyd et. */
export async function recordFailure(sahibkarId: string, limit = 5): Promise<{ count: number; locked: boolean; remainingSec: number | null }> {
  const s = await read(sahibkarId);
  const newCount = s.count + 1;
  if (newCount >= limit) {
    const lockedUntil = Date.now() + LOCKOUT_MIN * 60 * 1000;
    await write(sahibkarId, { count: newCount, lockedUntil });
    return { count: newCount, locked: true, remainingSec: LOCKOUT_MIN * 60 };
  }
  await write(sahibkarId, { count: newCount, lockedUntil: null });
  return { count: newCount, locked: false, remainingSec: null };
}

/** Uğurlu girişdə sıfırla. */
export async function resetAttempts(sahibkarId: string): Promise<void> {
  await write(sahibkarId, { count: 0, lockedUntil: null });
}
