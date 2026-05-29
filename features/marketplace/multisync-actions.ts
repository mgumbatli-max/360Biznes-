"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";

type ActionResult<T = unknown> = { ok: true; data?: T } | { ok: false; error: string };

/**
 * Bütün aktiv marketplace hesablarına eyni anda stok sync.
 *
 * Real production-da hər platforma üçün spesifik API çağrısı olmalıdır
 * (Trendyol Stock Update API, Wildberries API, Wolt Items API, və s.).
 * Burada simulyator: hər hesab üçün marketplace_sync_log qeydiyyatı yaradır,
 * son_sync yenilənir.
 */
export async function syncAllMarketplaces(): Promise<ActionResult<{ synced: number; failed: number; logs: string[] }>> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const logs: string[] = [];
    let synced = 0;
    let failed = 0;

    try {
      const accounts = await prisma.marketplace_hesablari.findMany({
        where: { aktiv: true },
      });

      for (const acc of accounts) {
        try {
          // Mock sync — real production-da burada platforma API çağrısı olmalıdır
          await prisma.marketplace_hesablari.update({
            where: { id: acc.id },
            data: { son_sync: new Date(), son_xeta: null, status: "aktiv" },
          });
          // Sync log yaz
          await prisma.marketplace_sync_log
            .create({
              data: {
                sahibkar_id: sahibkarId,
                hesab_id: acc.id,
                emeliyyat: "stok_sync",
                istiqamet: "cixir",
                status: "ugurlu",
              },
            })
            .catch(() => null);
          logs.push(`✓ ${acc.platform} (${acc.ad})`);
          synced += 1;
        } catch (e) {
          const msg = e instanceof Error ? e.message : "naməlum xəta";
          await prisma.marketplace_hesablari
            .update({
              where: { id: acc.id },
              data: { son_xeta: msg, status: "xeta" },
            })
            .catch(() => null);
          logs.push(`✗ ${acc.platform} (${acc.ad}): ${msg}`);
          failed += 1;
        }
      }

      revalidatePath("/marketplace");
      revalidatePath("/marketplace/multi-sync");
      return {
        ok: true,
        data: {
          synced,
          failed,
          logs,
          is_mock: true,
          notice: "MOCK SYNC: Real platforma adapter-ləri (Wolt/Trendyol/Bolt) qoşulmayıb. Yalnız son_sync tarixi yenilənir, məhsul/stok göndərilmir.",
        },
      };
    } catch (e) {
      console.error("[syncAllMarketplaces]", e);
      return { ok: false, error: "Toplu sync alınmadı" };
    }
  });
}

/** Tək bir hesab üçün sync */
export async function syncOneMarketplace(id: string): Promise<ActionResult> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    try {
      await prisma.marketplace_hesablari.update({
        where: { id },
        data: { son_sync: new Date(), son_xeta: null, status: "aktiv" },
      });
      await prisma.marketplace_sync_log
        .create({
          data: {
            sahibkar_id: sahibkarId,
            hesab_id: id,
            emeliyyat: "stok_sync",
            istiqamet: "cixir",
            status: "ugurlu",
          },
        })
        .catch(() => null);
      revalidatePath("/marketplace/multi-sync");
      return { ok: true };
    } catch (e) {
      console.error("[syncOneMarketplace]", e);
      return { ok: false, error: "Sync alınmadı" };
    }
  });
}

/**
 * Marketplace sifarişini ERP-yə (ticarət satışı) çevirmək. Real-da bu məhsul yoxlama
 * + stok rezerv + satış sənədi yaratma logikası olur. Burada minimal status update.
 */
export async function convertOrderToErp(id: string): Promise<ActionResult> {
  return withTenant(async () => {
    try {
      const order = await prisma.marketplace_sifarisleri.findUnique({
        where: { id },
        select: { erp_satis_id: true },
      });
      if (!order) return { ok: false, error: "Sifariş tapılmadı" };
      if (order.erp_satis_id) return { ok: false, error: "Artıq çevrilib" };

      // Sadəcə status-u "qebul" et — real-da satış sənədi yaradılır
      await prisma.marketplace_sifarisleri.update({
        where: { id },
        data: { status: "qebul_edildi" },
      });
      revalidatePath("/marketplace/multi-sync");
      return { ok: true };
    } catch (e) {
      console.error("[convertOrderToErp]", e);
      return { ok: false, error: "Çevirmə alınmadı" };
    }
  });
}
