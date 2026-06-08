import "server-only";
import { Prisma, prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";

/**
 * Xərc unifikasiyası — sistem üzərində 2 fərqli yerdə xərc qeydi var:
 *   1. `xercl_r` — köhnə model, "Xərclər" UI-də göstərilir
 *   2. `finance_operations` (`type_kod="xercler"`) — yeni model, əməliyyat
 *      jurnalında göstərilir
 *
 * Bu helper hər iki mənbəni birləşdirib UNION ALL ilə qaytarır. Hesabat
 * və mənfəət hesablamaları üçün istifadə olunur. Dashboard və P&L
 * burada vahid mənbəyə güvənə bilər.
 */

export type UnifiedExpenseRow = {
  source: "xercl_r" | "finance_op";
  id: string;
  tarix: Date;
  tesvir: string;
  mebleg: number;
  kateqoriya_id: number | null;
  hesab_id: string | null;
  istifadeci_id: string | null;
  yaradildi: Date | null;
};

export async function getUnifiedExpenses(opts: {
  from?: Date;
  to?: Date;
  kateqoriya_id?: number | null;
  limit?: number;
}): Promise<UnifiedExpenseRow[]> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const from = opts.from ?? new Date(2000, 0, 1);
    const to = opts.to ?? new Date(2100, 11, 31);
    const limit = opts.limit ?? 1000;
    const kateqClause = opts.kateqoriya_id != null
      ? Prisma.sql`AND kateqoriya_id = ${opts.kateqoriya_id}`
      : Prisma.empty;

    const rows = await prisma.$queryRaw<{
      source: "xercl_r" | "finance_op";
      id: string;
      tarix: Date;
      tesvir: string;
      mebleg: number;
      kateqoriya_id: number | null;
      hesab_id: string | null;
      istifadeci_id: string | null;
      yaradildi: Date | null;
    }[]>(Prisma.sql`
      SELECT 'xercl_r'::text AS source,
             id::text AS id,
             tarix,
             tesvir,
             mebleg::float AS mebleg,
             kateqoriya_id,
             NULL::uuid AS hesab_id,
             istifadeci_id,
             yaradildi
        FROM xercl_r
       WHERE sahibkar_id = ${sahibkarId}::uuid
         AND legv_de IS NULL
         AND tarix >= ${from}::date
         AND tarix <= ${to}::date
         ${kateqClause}
      UNION ALL
      SELECT 'finance_op'::text AS source,
             id::text AS id,
             tarix,
             COALESCE(qeyd, type_kod, 'Xərc') AS tesvir,
             meblegh::float AS mebleg,
             expense_kateq_id AS kateqoriya_id,
             hesab_id,
             yaradan_id AS istifadeci_id,
             yaradildi
        FROM finance_operations
       WHERE sahibkar_id = ${sahibkarId}::uuid
         AND status = 'aktiv'
         AND type_kod = 'xercler'
         AND tarix >= ${from}::date
         AND tarix <= ${to}::date
         ${opts.kateqoriya_id != null ? Prisma.sql`AND expense_kateq_id = ${opts.kateqoriya_id}` : Prisma.empty}
       ORDER BY tarix DESC, yaradildi DESC
       LIMIT ${limit}
    `);

    return rows.map((r) => ({
      source: r.source,
      id: r.id,
      tarix: r.tarix,
      tesvir: r.tesvir,
      mebleg: Number(r.mebleg),
      kateqoriya_id: r.kateqoriya_id ?? null,
      hesab_id: r.hesab_id ?? null,
      istifadeci_id: r.istifadeci_id ?? null,
      yaradildi: r.yaradildi ?? null,
    }));
  });
}

/** Aggregate cəmi xərc — periode + kateqoriya filter ilə. */
export async function getUnifiedExpenseTotal(opts: {
  from?: Date;
  to?: Date;
  kateqoriya_id?: number | null;
}): Promise<number> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const from = opts.from ?? new Date(2000, 0, 1);
    const to = opts.to ?? new Date(2100, 11, 31);

    const rows = await prisma.$queryRaw<{ cem: number | string | null }[]>(Prisma.sql`
      SELECT COALESCE(SUM(mebleg), 0)::float AS cem FROM (
        SELECT mebleg FROM xercl_r
         WHERE sahibkar_id = ${sahibkarId}::uuid
           AND legv_de IS NULL
           AND tarix >= ${from}::date
           AND tarix <= ${to}::date
           ${opts.kateqoriya_id != null ? Prisma.sql`AND kateqoriya_id = ${opts.kateqoriya_id}` : Prisma.empty}
        UNION ALL
        SELECT meblegh AS mebleg FROM finance_operations
         WHERE sahibkar_id = ${sahibkarId}::uuid
           AND status = 'aktiv'
           AND type_kod = 'xercler'
           AND tarix >= ${from}::date
           AND tarix <= ${to}::date
           ${opts.kateqoriya_id != null ? Prisma.sql`AND expense_kateq_id = ${opts.kateqoriya_id}` : Prisma.empty}
      ) u
    `);
    return Number(rows[0]?.cem ?? 0);
  });
}
