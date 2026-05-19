import "server-only";
import { prisma } from "@/lib/db/prisma";
import { requireTenant } from "@/lib/db/tenant-context";

/**
 * Boşluqdan asılı olmayan məhsul axtarışı.
 *
 * Problem: əməkdaş "buds3" yazır, məhsul adı "Buds 3" — və ya əksinə.
 * Hər iki halda da tapılmalıdır.
 *
 * Həll: PostgreSQL `REPLACE(field, ' ', '')` ilə hər iki tərəfdən boşluq silinir,
 * sonra normal substring match. Eyni zamanda ASCII normalize (Azərbaycan hərfləri
 * də ekvivalent ASCII səslərə uyğun tapılsın istəyirsənsə — burada həmin daxili
 * `unaccent` extension yoxdursa standart LOWER istifadə olunur).
 *
 * Returns: uyğun məhsul ID-ləri. Sonra `prisma.mehsullar.findMany({ where: { id: { in: ids }}})`
 * istifadə edə bilərsən.
 */
export async function searchProductIdsSpaceInsensitive(
  query: string,
  opts: { limit?: number; activeOnly?: boolean } = {},
): Promise<string[]> {
  const q = query.trim();
  if (q.length < 1) return [];

  const { sahibkarId } = requireTenant();
  const limit = Math.min(200, Math.max(1, opts.limit ?? 50));
  const activeFilter = opts.activeOnly !== false; // default true

  // Search both spaced and unspaced (normalized) versions
  const rows = activeFilter
    ? await prisma.$queryRaw<{ id: string }[]>`
        SELECT id::text FROM mehsullar
        WHERE sahibkar_id = ${sahibkarId}::uuid AND aktiv = TRUE
          AND (
            LOWER(REPLACE(COALESCE(ad, ''),     ' ', '')) LIKE '%' || LOWER(REPLACE(${q}, ' ', '')) || '%'
            OR LOWER(REPLACE(COALESCE(kod, ''),    ' ', '')) LIKE '%' || LOWER(REPLACE(${q}, ' ', '')) || '%'
            OR LOWER(REPLACE(COALESCE(barkod, ''), ' ', '')) LIKE '%' || LOWER(REPLACE(${q}, ' ', '')) || '%'
            OR LOWER(REPLACE(COALESCE(model, ''),  ' ', '')) LIKE '%' || LOWER(REPLACE(${q}, ' ', '')) || '%'
          )
        ORDER BY ad ASC
        LIMIT ${limit}
      `
    : await prisma.$queryRaw<{ id: string }[]>`
        SELECT id::text FROM mehsullar
        WHERE sahibkar_id = ${sahibkarId}::uuid
          AND (
            LOWER(REPLACE(COALESCE(ad, ''),     ' ', '')) LIKE '%' || LOWER(REPLACE(${q}, ' ', '')) || '%'
            OR LOWER(REPLACE(COALESCE(kod, ''),    ' ', '')) LIKE '%' || LOWER(REPLACE(${q}, ' ', '')) || '%'
            OR LOWER(REPLACE(COALESCE(barkod, ''), ' ', '')) LIKE '%' || LOWER(REPLACE(${q}, ' ', '')) || '%'
            OR LOWER(REPLACE(COALESCE(model, ''),  ' ', '')) LIKE '%' || LOWER(REPLACE(${q}, ' ', '')) || '%'
          )
        ORDER BY ad ASC
        LIMIT ${limit}
      `;
  return rows.map((r) => r.id);
}

/**
 * "Buds 3" və "buds3" eyni nəticəni tapsın deyə Prisma `where` filtri üçün
 * uyğun OR şərtlərinin siyahısı. İki versiya yaradır:
 *   1) Orijinal query (Prisma `contains`)
 *   2) Query-dən boşluqlar silinmiş versiya (Prisma `contains`)
 *
 * Bu yüngül yanaşma — DB sütunundakı boşluqları silmir, yalnız query-də variantlar
 * yaradır. Tam həll üçün `searchProductIdsSpaceInsensitive` istifadə et.
 */
export function buildVariantSearch(query: string): string[] {
  const q = query.trim();
  if (!q) return [];
  const variants = new Set<string>([q]);
  const noSpace = q.replace(/\s+/g, "");
  if (noSpace !== q) variants.add(noSpace);
  return Array.from(variants);
}
