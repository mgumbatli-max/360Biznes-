import "server-only";
import { prisma } from "@/lib/db/prisma";
import { requireTenant } from "@/lib/db/tenant-context";

/**
 * Cross-module helper — keep stock alerts in sync after any stok decrement
 * (satış, mexaric, qaytarma-out, transfer-out).
 *
 * Behaviour:
 *  - reads current stok across all anbar for `mehsul_id`
 *  - compares against `mehsullar.min_stok` (>= 0)
 *  - if current < min_stok → inserts alerts row (idempotent: skip if an
 *    open `stok_kritik` alert already exists for the same obyekt_id within
 *    the last 24h)
 *  - if current >= min_stok → marks any open `stok_kritik` alert for that
 *    product as `hell` (resolved) — auto-clear behaviour
 *
 * Designed to be called from inside `withTenant(...)` so we can re-use
 * `requireTenant()`. Always uses the default `prisma` client (called
 * post-commit) — keeps the implementation simple and avoids carrying
 * a `TransactionClient` type through public helpers.
 *
 * Errors are swallowed and logged — alert insertion must never break a sale.
 */
export async function checkAndCreateStockAlert(mehsulId: string): Promise<void> {
  if (!mehsulId) return;
  const db = prisma;
  try {
    const { sahibkarId } = requireTenant();
    const mehsul = await db.mehsullar.findFirst({
      where: { id: mehsulId, sahibkar_id: sahibkarId },
      select: { id: true, ad: true, min_stok: true },
    });
    if (!mehsul) return;
    const minStok = Number(mehsul.min_stok ?? 0);
    if (!(minStok > 0)) return; // No threshold configured -> nothing to do

    const stokAgg = await db.stok.aggregate({
      where: { sahibkar_id: sahibkarId, mehsul_id: mehsulId },
      _sum: { miqdar: true },
    });
    const cari = Number(stokAgg._sum.miqdar ?? 0);

    if (cari >= minStok) {
      // Auto-clear: stock recovered → close any open stok_kritik for this product
      await db.alerts.updateMany({
        where: {
          sahibkar_id: sahibkarId,
          kateqoriya_kod: "stok_kritik",
          obyekt_nov: "mehsul",
          obyekt_id: mehsulId,
          status: { in: ["yeni", "baxilir"] },
        },
        data: { status: "hell", resolved_at: new Date(), resolution_note: "Stok bərpa olundu" },
      });
      return;
    }

    // Idempotency: don't double-create within 24h
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const existing = await db.alerts.findFirst({
      where: {
        sahibkar_id: sahibkarId,
        kateqoriya_kod: "stok_kritik",
        obyekt_nov: "mehsul",
        obyekt_id: mehsulId,
        status: { in: ["yeni", "baxilir"] },
        last_seen_at: { gte: dayAgo },
      },
      select: { id: true },
    });
    if (existing) {
      // Refresh last_seen_at so the alert stays "fresh" instead of being duplicated
      await db.alerts.update({
        where: { id: existing.id },
        data: { last_seen_at: new Date() },
      });
      return;
    }

    // Resolve or create the alert category "stok_kritik"
    let cat = await db.alert_categories.findUnique({
      where: { kod: "stok_kritik" },
      select: { id: true, kod: true },
    });
    if (!cat) {
      cat = await db.alert_categories.create({
        data: {
          kod: "stok_kritik",
          ad: "Kritik stok",
          emoji: "📦",
          qrup: "anbar",
        },
        select: { id: true, kod: true },
      });
    }

    const seviyye = cari <= 0 ? "kritik" : "risk";
    await db.alerts.create({
      data: {
        sahibkar_id: sahibkarId,
        kateqoriya_id: cat.id,
        kateqoriya_kod: cat.kod,
        seviyye,
        status: "yeni",
        basliq: `Stok aşağı: ${mehsul.ad}`,
        tesvir: `${mehsul.ad} üçün cari stok ${cari.toFixed(2)} (minimum: ${minStok.toFixed(2)})`,
        obyekt_nov: "mehsul",
        obyekt_id: mehsulId,
        obyekt_basliq: mehsul.ad,
      },
    });
  } catch (e) {
    console.warn("[checkAndCreateStockAlert] skipped:", e);
  }
}

/**
 * Batched variant — call once with a list of `mehsul_id` after a multi-line
 * sale/transfer/qaytarma. Deduplicates the list internally.
 */
export async function checkAndCreateStockAlertBatch(
  mehsulIds: string[],
): Promise<void> {
  const unique = Array.from(new Set(mehsulIds.filter(Boolean)));
  for (const id of unique) {
    await checkAndCreateStockAlert(id);
  }
}
