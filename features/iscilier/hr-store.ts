import "server-only";
import { prisma } from "@/lib/db/prisma";
import { requireTenant } from "@/lib/db/tenant-context";

/** Generic JSON storage for HR records (recruitment, training, budget) — uses `ayarlar`. */

export async function listEntries<T>(qrup: string): Promise<Array<{ acar: string; data: T }>> {
  const { sahibkarId } = requireTenant();
  const rows = await prisma.ayarlar.findMany({
    where: { sahibkar_id: sahibkarId, qrup },
    orderBy: { acar: "asc" },
  });
  return rows
    .map((r) => {
      try {
        return { acar: r.acar, data: JSON.parse(r.deyer ?? "null") as T };
      } catch {
        return null;
      }
    })
    .filter((x): x is { acar: string; data: T } => x !== null);
}

export async function getEntry<T>(qrup: string, acar: string): Promise<T | null> {
  const { sahibkarId } = requireTenant();
  const row = await prisma.ayarlar.findUnique({
    where: { sahibkar_id_qrup_acar: { sahibkar_id: sahibkarId, qrup, acar } },
  });
  if (!row?.deyer) return null;
  try {
    return JSON.parse(row.deyer) as T;
  } catch {
    return null;
  }
}

export async function setEntry<T>(qrup: string, acar: string, data: T, tesvir?: string): Promise<void> {
  const { sahibkarId } = requireTenant();
  const deyer = JSON.stringify(data);
  await prisma.ayarlar.upsert({
    where: { sahibkar_id_qrup_acar: { sahibkar_id: sahibkarId, qrup, acar } },
    update: { deyer, nov: "json", tesvir },
    create: { sahibkar_id: sahibkarId, qrup, acar, deyer, nov: "json", tesvir },
  });
}

export async function deleteEntry(qrup: string, acar: string): Promise<void> {
  const { sahibkarId } = requireTenant();
  await prisma.ayarlar.deleteMany({
    where: { sahibkar_id: sahibkarId, qrup, acar },
  });
}

export function nextId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}
