import "server-only";
import type { prisma } from "./prisma";

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

/**
 * Atomic, race-safe sənəd nömrəsi generatoru.
 *
 * Birinci seçim: `next_sened_nomre(uuid, varchar, int)` PG funksiyası
 *   (`sened_nomre_counter` cədvəli + UPSERT ON CONFLICT DO UPDATE RETURNING).
 *
 * Fallback: PG funksiyası yoxdursa (migration tətbiq olunmayıb), eyni
 * cədvəli inline raw SQL ilə UPSERT et. Cədvəl də yoxdursa, son resort
 * kimi `findFirst(orderBy nomre desc) + 1` istifadə olunur — bu race-safe
 * deyil, amma sistemin tamamilə dayanmasının qarşısını alır.
 *
 * Format: `${prefix.toUpperCase()}-${YYYY}-${pad6(num)}`
 *   məs: SATIS-2026-000123
 *
 * @param prefix - 'satis' | 'alis' | 'kredit' | 'market' | 'qaytarma' | 'teklif' | 'transfer'
 */
export type DocPrefix =
  | "satis"
  | "alis"
  | "kredit"
  | "market"
  | "qaytarma"
  | "teklif"
  | "transfer"
  | "mexaric"
  | "sayim";

const TABLE_MAP: Partial<Record<DocPrefix, { table: string; field: string }>> = {
  satis: { table: "satis_sifarisleri", field: "nomre" },
  alis: { table: "alis_sifarisleri", field: "nomre" },
  market: { table: "satis_sifarisleri", field: "nomre" },
  qaytarma: { table: "qaytarma_sifarisleri", field: "nomre" },
  teklif: { table: "teklifler", field: "nomre" },
};

export async function nextDocNumber(
  tx: Tx,
  sahibkarId: string,
  prefix: DocPrefix,
  date?: Date,
): Promise<string> {
  const il = (date ?? new Date()).getFullYear();

  // 1) Birinci cəhd — PG funksiyası.
  //
  // ⚠️ Explicit cast-lar VACİBDİR. Prisma JS template-də:
  //   - JS string → `text` (varchar deyil)
  //   - JS number → `bigint` (integer deyil)
  // PG funksiya overload resolution-u strict-dir və `(uuid, text, bigint)`
  // imzasını `(uuid, varchar, integer)` ilə uyğunlaşdırmır → `42883`.
  try {
    const rows = await tx.$queryRaw<{ next_sened_nomre: number }[]>`
      SELECT next_sened_nomre(
        ${sahibkarId}::uuid,
        ${prefix}::varchar,
        ${il}::integer
      ) AS next_sened_nomre
    `;
    const num = rows[0]?.next_sened_nomre ?? 1;
    return formatDocNumber(prefix, il, num);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // Yalnız "function does not exist" / "undefined function" üçün fallback-a düş.
    // Digər DB səhvlərini olduğu kimi qaytarırıq.
    const isMissingFn = /does not exist|undefined function|cannot find function/i.test(msg);
    if (!isMissingFn) throw err;
    console.warn(
      "[nextDocNumber] PG function next_sened_nomre tapılmadı — counter table fallback istifadə olunur. " +
        "Migration `2026-05-26-critical-fixes.sql` tətbiq edilməlidir.",
    );
  }

  // 2) İkinci cəhd — counter cədvəlinə inline UPSERT
  try {
    const rows = await tx.$queryRaw<{ son_nomre: number }[]>`
      INSERT INTO sened_nomre_counter (sahibkar_id, prefix, il, son_nomre, yenilendi)
      VALUES (${sahibkarId}::uuid, ${prefix}::varchar, ${il}::integer, 1, NOW())
      ON CONFLICT (sahibkar_id, prefix, il) DO UPDATE
        SET son_nomre = sened_nomre_counter.son_nomre + 1,
            yenilendi = NOW()
      RETURNING son_nomre
    `;
    const num = rows[0]?.son_nomre ?? 1;
    return formatDocNumber(prefix, il, num);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const isMissingTable = /does not exist|undefined table/i.test(msg);
    if (!isMissingTable) throw err;
    console.warn(
      "[nextDocNumber] sened_nomre_counter cədvəli də yoxdur — son resort: max+1 fallback. " +
        "Bu race-safe deyil; migration TƏCİLI tətbiq edilməlidir.",
    );
  }

  // 3) Son resort — orijinal cədvəldən max+1 (race-unsafe, amma sistemi dayanan)
  const mapping = TABLE_MAP[prefix];
  if (!mapping) {
    throw new Error(
      `[nextDocNumber] Sənəd nömrəsi yaradılmadı: 'sened_nomre_counter' cədvəli yoxdur və '${prefix}' üçün fallback cədvəli müəyyən edilməyib. Migration tətbiq edin.`,
    );
  }
  return await fallbackMaxPlusOne(tx, sahibkarId, prefix, il, mapping);
}

function formatDocNumber(prefix: DocPrefix, il: number, num: number): string {
  return `${prefix.toUpperCase()}-${il}-${String(num).padStart(6, "0")}`;
}

async function fallbackMaxPlusOne(
  tx: Tx,
  sahibkarId: string,
  prefix: DocPrefix,
  il: number,
  mapping: { table: string; field: string },
): Promise<string> {
  // Yalnız whitelist-dən gələn cədvəl/sahə adı istifadə olunur — SQL injection riski yoxdur.
  const pattern = `${prefix.toUpperCase()}-${il}-%`;
  const rows = await tx.$queryRawUnsafe<{ max_nomre: string | null }[]>(
    `SELECT MAX("${mapping.field}") AS max_nomre
       FROM "${mapping.table}"
      WHERE sahibkar_id = $1::uuid
        AND "${mapping.field}" LIKE $2`,
    sahibkarId,
    pattern,
  );
  const maxStr = rows[0]?.max_nomre ?? null;
  const lastNum = maxStr ? Number(maxStr.split("-").pop()) || 0 : 0;
  return formatDocNumber(prefix, il, lastNum + 1);
}
