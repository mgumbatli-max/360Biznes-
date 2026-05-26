import "server-only";
import type { prisma } from "./prisma";

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

/**
 * Atomic, race-safe sənəd nömrəsi generatoru.
 *
 * Köhnə kod `findFirst(orderBy nomre desc)` + `+1` istifadə edirdi — eyni
 * saniyədə iki satış dublikat nömrə yaradırdı. Yeni model:
 *   `sened_nomre_counter (sahibkar_id, prefix, il, son_nomre)` cədvəli +
 *   `next_sened_nomre(sahibkar_id, prefix, il)` PG funksiyası — `INSERT ...
 *   ON CONFLICT DO UPDATE RETURNING` ilə atomic increment.
 *
 * Format: `${prefix.toUpperCase()}-${YYYY}-${pad6(num)}`
 *   məs: SATIS-2026-000123
 *
 * @param prefix - 'satis' | 'alis' | 'kredit' | 'market' | 'qaytarma'
 */
export async function nextDocNumber(
  tx: Tx,
  sahibkarId: string,
  prefix: "satis" | "alis" | "kredit" | "market" | "qaytarma",
  date?: Date,
): Promise<string> {
  const il = (date ?? new Date()).getFullYear();
  const rows = await tx.$queryRaw<{ next_sened_nomre: number }[]>`
    SELECT next_sened_nomre(${sahibkarId}::uuid, ${prefix}, ${il}) AS next_sened_nomre
  `;
  const num = rows[0]?.next_sened_nomre ?? 1;
  const padded = String(num).padStart(6, "0");
  return `${prefix.toUpperCase()}-${il}-${padded}`;
}
