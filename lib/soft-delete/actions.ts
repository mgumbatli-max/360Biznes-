"use server";

import { Prisma, prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { auth } from "@/auth";
import { audit } from "@/lib/audit/log";
import { canRestoreRecords, canHardDelete } from "./record-filter";

type ActionResult = { ok: true } | { ok: false; error: string };

/**
 * SOFT DELETE — vahid helper.
 *
 * Bu funksiya generic-dir; modul-specific cancel action-ları
 * (məs. cancelSale, cancelPurchase) BU helperı çağıraraq başlamalıdır.
 *
 * Davranış:
 *   - `deleted_at = NOW()`, `deleted_by = istifadeci_id`, `delete_reason`
 *   - Audit log yaranır
 *   - Modul-spesifik yan effektlər (stok geri, balans recalc) ÇAĞIRAN tərəfindədir
 *
 * NƏ ETMƏZ: stoku geri qaytarmaz, balansı bərpa etməz. Bunu modul action edir.
 */
export async function softDeleteRecord({
  table,
  id,
  reason,
  sahibkarId,
  istifadeciId,
  tx,
}: {
  table:
    | "satis_sifarisleri"
    | "alis_sifarisleri"
    | "qaytarma_sifarisleri"
    | "teklifler"
    | "finance_operations";
  id: string;
  reason: string;
  sahibkarId: string;
  istifadeciId: string;
  tx?: Prisma.TransactionClient;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const client = tx ?? (prisma as unknown as Prisma.TransactionClient);
  try {
    // Raw — table name dynamic (Prisma generic update istifadə etmir).
    const sql = Prisma.sql`
      UPDATE ${Prisma.raw(table)}
      SET deleted_at = NOW(),
          deleted_by = ${istifadeciId}::uuid,
          delete_reason = ${reason}
      WHERE id = ${id}::uuid
        AND sahibkar_id = ${sahibkarId}::uuid
        AND deleted_at IS NULL
    `;
    const affected = await client.$executeRaw(sql);
    if (affected === 0) {
      return { ok: false, error: "Qeyd tapılmadı və ya artıq silinib" };
    }
    return { ok: true };
  } catch (e) {
    console.error("[softDeleteRecord]", e);
    return { ok: false, error: e instanceof Error ? e.message : "Silinmədi" };
  }
}

/**
 * RESTORE — silinmiş qeydi bərpa et.
 *
 * Çağıran modul-spesifik balans/stok yoxlaması ETMƏLİDİR:
 *   - Stok kifayət edirmi (satışı bərpa edirik amma stok 0 olarsa risk)
 *   - Müştəri balansı düzgün hesablanacaq
 *   - Əlaqəli sənədlər silinibsə xəbərdarlıq
 */
export async function restoreRecord({
  table,
  id,
  reason,
}: {
  table:
    | "satis_sifarisleri"
    | "alis_sifarisleri"
    | "qaytarma_sifarisleri"
    | "teklifler"
    | "finance_operations";
  id: string;
  reason?: string;
}): Promise<ActionResult> {
  const canRestore = await canRestoreRecords();
  if (!canRestore) return { ok: false, error: "Bərpa üçün icazə yoxdur" };

  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    try {
      // Mövcudluq + silinmiş olub-olmaması yoxla
      const existing = await prisma.$queryRaw<Array<{ deleted_at: Date | null }>>(Prisma.sql`
        SELECT deleted_at FROM ${Prisma.raw(table)}
         WHERE id = ${id}::uuid AND sahibkar_id = ${sahibkarId}::uuid
         LIMIT 1
      `);
      if (existing.length === 0) return { ok: false, error: "Qeyd tapılmadı" };
      if (!existing[0].deleted_at) return { ok: false, error: "Bu qeyd silinməyib" };

      // satis_sifarisleri üçün xüsusi: status hələ də 'legv' ola bilər
      // bərpa zamanı status="tamamlandi" (yaxud uyğun) müəyyən edilməlidir.
      // Hələlik yalnız deleted_at = NULL et — modul-spesifik restore status təyin edir.
      await prisma.$executeRaw(Prisma.sql`
        UPDATE ${Prisma.raw(table)}
        SET deleted_at = NULL,
            restored_at = NOW(),
            restored_by = ${istifadeciId}::uuid
        WHERE id = ${id}::uuid AND sahibkar_id = ${sahibkarId}::uuid
      `);

      try {
        await audit("yenile", table, id, {
          yeni_data: { restored_at: new Date().toISOString() },
          sebeb: reason ?? "Silinmiş qeyd bərpa olundu",
        });
      } catch { /* non-fatal */ }

      return { ok: true };
    } catch (e) {
      console.error("[restoreRecord]", e);
      return { ok: false, error: e instanceof Error ? e.message : "Bərpa alınmadı" };
    }
  });
}

/**
 * HARD DELETE — yalnız sahibkar/owner. Geri qaytarıla bilməz.
 */
export async function hardDeleteRecord({
  table,
  id,
}: {
  table: string;
  id: string;
}): Promise<ActionResult> {
  const canHard = await canHardDelete();
  if (!canHard) return { ok: false, error: "Fiziki silmə üçün icazə yoxdur" };

  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    try {
      const affected = await prisma.$executeRaw(Prisma.sql`
        DELETE FROM ${Prisma.raw(table)}
         WHERE id = ${id}::uuid
           AND sahibkar_id = ${sahibkarId}::uuid
           AND deleted_at IS NOT NULL
      `);
      if (affected === 0) {
        return {
          ok: false,
          error: "Yalnız əvvəlcədən silinmiş (soft-deleted) qeydlər fiziki silinə bilər",
        };
      }
      try {
        await audit("sil", table, id, {
          yeni_data: { hard_delete: true },
          sebeb: "FİZİKİ SİLMƏ — qeyd DB-dən tamamilə silindi",
        });
      } catch { /* non-fatal */ }
      return { ok: true };
    } catch (e) {
      console.error("[hardDeleteRecord]", e);
      return { ok: false, error: e instanceof Error ? e.message : "Silinmədi" };
    }
  });
}
