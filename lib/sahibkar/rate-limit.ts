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

/** Uğursuz cəhdi qeyd et. QA-fix: read-modify-write ATOMİK deyildi (paralel cəhd lockout-u itirirdi) →
 *  advisory xact-lock (sahibkar açarı) ilə serializasiya. */
export async function recordFailure(sahibkarId: string, limit = 5): Promise<{ count: number; locked: boolean; remainingSec: number | null }> {
  return prismaUnscoped.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${sahibkarId + ":pinlock"}))`;
    const row = await tx.ayarlar.findFirst({ where: { sahibkar_id: sahibkarId, qrup: QRUP, acar: ACAR }, select: { deyer: true } });
    let cur = { count: 0, lockedUntil: null as number | null };
    if (row?.deyer) { try { const p = JSON.parse(row.deyer); if (typeof p.count === "number") cur = { count: p.count, lockedUntil: p.lockedUntil ?? null }; } catch { /* */ } }
    const newCount = cur.count + 1;
    const lockedUntil = newCount >= limit ? Date.now() + LOCKOUT_MIN * 60 * 1000 : null;
    const state = { count: newCount, lockedUntil };
    await tx.ayarlar.upsert({
      where: { sahibkar_id_qrup_acar: { sahibkar_id: sahibkarId, qrup: QRUP, acar: ACAR } },
      update: { deyer: JSON.stringify(state), yenilendi: new Date() },
      create: { sahibkar_id: sahibkarId, qrup: QRUP, acar: ACAR, deyer: JSON.stringify(state), nov: "json", tesvir: "Sahibkar PIN cəhd sayğacı" },
    });
    return { count: newCount, locked: lockedUntil !== null, remainingSec: lockedUntil !== null ? LOCKOUT_MIN * 60 : null };
  });
}

/** Uğurlu girişdə sıfırla. */
export async function resetAttempts(sahibkarId: string): Promise<void> {
  await write(sahibkarId, { count: 0, lockedUntil: null });
}
