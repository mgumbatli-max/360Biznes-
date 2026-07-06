"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { audit } from "@/lib/audit/log";
import {
  requireMarketplaceActionPerm,
  bustMarketplaceCache,
  checkSyncRateLimit,
} from "./access-guard";

type ActionResult<T = unknown> = { ok: true; data?: T } | { ok: false; error: string };

/**
 * Bütün aktiv marketplace hesablarına eyni anda stok sync.
 * Rate limit: saatlıq 1 toplu sync / tenant (yüksək yük olmasın).
 */
export async function syncAllMarketplaces(): Promise<ActionResult<{ synced: number; failed: number; logs: string[]; is_mock?: boolean; notice?: string }>> {
  const permCheck = await requireMarketplaceActionPerm("marketplace.sync");
  if (!permCheck.ok) return { ok: false, error: permCheck.error };

  return withTenant(async () => {
    const { sahibkarId } = requireTenant();

    // Rate limit yoxla
    const rate = await checkSyncRateLimit();
    if (!rate.ok) return { ok: false, error: rate.error };

    const logs: string[] = [];
    let synced = 0;
    let failed = 0;

    try {
      const accounts = await prisma.marketplace_hesablari.findMany({
        where: { aktiv: true },
      });

      for (const acc of accounts) {
        try {
          await prisma.marketplace_hesablari.update({
            where: { id: acc.id },
            data: { son_sync: new Date(), son_xeta: null, status: "aktiv" },
          });
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
      bustMarketplaceCache();
      // Audit qeydi rate-limit sayğacı üçün də vacibdir (resurs_nov="marketplace_bulk")
      await audit("sync", "marketplace_bulk", null, {
        yeni_data: { synced, failed, hesab_say: accounts.length },
        sebeb: `Toplu marketplace sync: ${synced}/${accounts.length}`,
      });
      return {
        ok: true,
        data: {
          synced,
          failed,
          logs,
          is_mock: true,
          notice: "MOCK SYNC: Real platforma adapter-ləri (Wolt/Trendyol/Bolt) qoşulmayıb.",
        },
      };
    } catch (e) {
      console.error("[syncAllMarketplaces]", e);
      const msg = e instanceof Error ? e.message : "naməlum səhv";
      return { ok: false, error: `Toplu sync alınmadı: ${msg}` };
    }
  });
}

/** Tək bir hesab üçün sync */
export async function syncOneMarketplace(id: string): Promise<ActionResult> {
  const permCheck = await requireMarketplaceActionPerm("marketplace.sync");
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    try {
      const before = await prisma.marketplace_hesablari.findUnique({
        where: { id },
        select: { ad: true, platform: true },
      });
      if (!before) return { ok: false, error: "Hesab tapılmadı" };
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
      bustMarketplaceCache();
      await audit("sync", "marketplace_hesab", id, {
        yeni_data: { platform: before.platform, ad: before.ad },
        sebeb: `Tək marketplace sync: ${before.ad}`,
      });
      return { ok: true };
    } catch (e) {
      console.error("[syncOneMarketplace]", e);
      const msg = e instanceof Error ? e.message : "naməlum səhv";
      return { ok: false, error: `Sync alınmadı: ${msg}` };
    }
  });
}

/**
 * Marketplace sifarişini ERP-yə (ticarət satışı) çevirmək.
 */
export async function convertOrderToErp(id: string): Promise<ActionResult> {
  const permCheck = await requireMarketplaceActionPerm(["marketplace.idare", "marketplace.sync"]);
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    try {
      const order = await prisma.marketplace_sifarisleri.findFirst({
        where: { id, sahibkar_id: sahibkarId },
        select: {
          erp_satis_id: true, status: true, xarici_nomre: true, meblegh: true,
          erp_mehsul_id: true, mehsul_kod: true, mehsul_ad: true, sayi: true,
          marketplace_magaza_hesablari: { select: { platform: true, anbar_id: true } },
        },
      });
      if (!order) return { ok: false, error: "Sifariş tapılmadı" };
      if (order.erp_satis_id) return { ok: false, error: "Artıq çevrilib" };

      // QA-audit: əvvəl YALNIZ status yazılırdı — erp_satis_id/stok/finance yaranmırdı (dead
      // idempotency). İndi real ERP marketplace satışı yaradılır (stok mexaric + komissiya + finance).

      // 1) Məhsulu resolve et: erp_mehsul_id → yoxsa mehsul_kod (SKU/barkod).
      let mehsulId = order.erp_mehsul_id ?? null;
      if (!mehsulId && order.mehsul_kod) {
        const prod = await prisma.mehsullar.findFirst({
          where: {
            sahibkar_id: sahibkarId,
            OR: [{ kod: order.mehsul_kod }, { barkod: order.mehsul_kod }],
          },
          select: { id: true },
        });
        mehsulId = prod?.id ?? null;
      }
      if (!mehsulId) {
        return { ok: false, error: `Məhsul ERP-də tapılmadı (kod: ${order.mehsul_kod ?? order.mehsul_ad ?? "—"}). Əvvəl məhsulu bağlayın.` };
      }

      // 2) Anbar: magaza anbarı → yoxsa ilk aktiv anbar.
      let anbarId = order.marketplace_magaza_hesablari?.anbar_id ?? null;
      if (!anbarId) {
        const anbar = await prisma.anbarlar.findFirst({
          where: { sahibkar_id: sahibkarId, aktiv: true },
          orderBy: { id: "asc" },
          select: { id: true },
        });
        anbarId = anbar?.id ?? null;
      }
      if (!anbarId) return { ok: false, error: "Aktiv anbar tapılmadı" };

      // 3) Platform map — magaza.platform PLATFORM_VALUES-a uyğun deyilsə "diger".
      const PLATFORM_VALUES = ["bolt_food", "wolt", "yango_deli", "tap_az", "progo", "diger"] as const;
      const rawPlat = (order.marketplace_magaza_hesablari?.platform ?? "").toLowerCase();
      const platform = (PLATFORM_VALUES as readonly string[]).includes(rawPlat)
        ? (rawPlat as (typeof PLATFORM_VALUES)[number])
        : "diger";

      const sayi = Math.max(1, Number(order.sayi ?? 1));
      const umumi = Number(order.meblegh ?? 0);
      const vahidQiymet = sayi > 0 ? Math.round((umumi / sayi) * 100) / 100 : umumi;

      // 4) Real marketplace satışı yarat (stok/komissiya/finance createMarketSatis daxilində).
      const { createMarketSatis } = await import("@/features/ticaret/market-satis-action");
      const res = await createMarketSatis({
        platform,
        sifaris_nomresi: order.xarici_nomre,
        anbar_id: anbarId,
        lines: [{ mehsul_id: mehsulId, miqdar: sayi, qiymet: vahidQiymet, endirim_faiz: 0 }],
        qeyd: `Marketplace sifariş çevrildi: ${order.xarici_nomre}`,
      });
      if (!res.ok) return { ok: false, error: res.error };

      // 5) erp_satis_id + erp_mehsul_id + status yaz (idempotency artıq işlək).
      await prisma.marketplace_sifarisleri.update({
        where: { id },
        data: { status: "qebul_edildi", erp_satis_id: res.satis_id, erp_mehsul_id: mehsulId },
      });
      revalidatePath("/marketplace/multi-sync");
      bustMarketplaceCache();
      await audit("konvert", "marketplace_sifaris", id, {
        evvelki_data: { status: order.status },
        yeni_data: { status: "qebul_edildi", nomre: order.xarici_nomre, mebleg: umumi, erp_satis_id: res.satis_id },
        sebeb: `Marketplace sifariş ERP satışına çevrildi: ${order.xarici_nomre ?? id}`,
      });
      return { ok: true };
    } catch (e) {
      console.error("[convertOrderToErp]", e);
      const msg = e instanceof Error ? e.message : "naməlum səhv";
      return { ok: false, error: `Çevirmə alınmadı: ${msg}` };
    }
  });
}

// ============================================================
// YENİ FUNKSIONALLIQ
// ============================================================

/**
 * Seçilmiş marketplace-lər üçün toplu sync.
 */
export async function bulkSyncMarketplaces(
  ids: string[],
): Promise<ActionResult<{ synced: number; failed: number; details: { id: string; ok: boolean; error?: string }[] }>> {
  const permCheck = await requireMarketplaceActionPerm("marketplace.sync");
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  if (!ids.length) return { ok: false, error: "Seçim yoxdur" };
  if (ids.length > 50) return { ok: false, error: "Bir dəfəyə 50-dən çox sync mümkün deyil" };

  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    let synced = 0;
    let failed = 0;
    const details: { id: string; ok: boolean; error?: string }[] = [];
    try {
      const accounts = await prisma.marketplace_hesablari.findMany({
        where: { id: { in: ids }, aktiv: true },
      });
      for (const acc of accounts) {
        try {
          await prisma.marketplace_hesablari.update({
            where: { id: acc.id },
            data: { son_sync: new Date(), son_xeta: null, status: "aktiv" },
          });
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
          details.push({ id: acc.id, ok: true });
          synced++;
        } catch (e) {
          const msg = e instanceof Error ? e.message : "naməlum xəta";
          details.push({ id: acc.id, ok: false, error: msg });
          failed++;
        }
      }
      revalidatePath("/marketplace");
      bustMarketplaceCache();
      await audit("bulk_sync", "marketplace_hesab", null, {
        yeni_data: { synced, failed, isteklen: ids.length },
        sebeb: `Bulk marketplace sync: ${synced}/${ids.length}`,
      });
      return { ok: true, data: { synced, failed, details } };
    } catch (e) {
      console.error("[bulkSyncMarketplaces]", e);
      const msg = e instanceof Error ? e.message : "naməlum səhv";
      return { ok: false, error: `Alınmadı: ${msg}` };
    }
  });
}

/**
 * Marketplace sağlamlıq xülasəsi — bütün hesabların sync vəziyyəti.
 */
export type MarketplaceHealth = {
  total: number;
  aktiv: number;
  xeta: number;
  son_24_saat_sync: number;
  hesablar: {
    id: string;
    platform: string;
    ad: string;
    status: string | null;
    son_sync: Date | null;
    son_xeta: string | null;
  }[];
};

export async function getMarketplaceHealthSummary(): Promise<{ ok: true; data: MarketplaceHealth } | { ok: false; error: string }> {
  const permCheck = await requireMarketplaceActionPerm("marketplace.oxu");
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  return withTenant(async () => {
    try {
      const dayAgo = new Date(Date.now() - 86400_000);
      const accounts = await prisma.marketplace_hesablari.findMany({
        select: {
          id: true, platform: true, ad: true, status: true, aktiv: true,
          son_sync: true, son_xeta: true,
        },
      });
      return {
        ok: true,
        data: {
          total: accounts.length,
          aktiv: accounts.filter((a) => a.aktiv).length,
          xeta: accounts.filter((a) => a.status === "xeta").length,
          son_24_saat_sync: accounts.filter((a) => a.son_sync && a.son_sync > dayAgo).length,
          hesablar: accounts.map((a) => ({
            id: a.id,
            platform: a.platform,
            ad: a.ad,
            status: a.status,
            son_sync: a.son_sync,
            son_xeta: a.son_xeta,
          })),
        },
      };
    } catch (e) {
      console.error("[getMarketplaceHealthSummary]", e);
      const msg = e instanceof Error ? e.message : "naməlum səhv";
      return { ok: false, error: `Alınmadı: ${msg}` };
    }
  });
}

/**
 * Marketplace sifariş axtarış.
 */
export async function searchOrders(
  query: string,
  marketplaceId?: string,
): Promise<{ ok: true; orders: { id: string; nomre: string | null; mebleg: number; status: string | null; tarix: Date | null }[] } | { ok: false; error: string }> {
  const permCheck = await requireMarketplaceActionPerm("marketplace.oxu");
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  const q = query.trim();
  if (q.length < 2) return { ok: false, error: "Axtarış mətni 2 simvoldan qısa ola bilməz" };
  return withTenant(async () => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const where: any = {
        OR: [
          { xarici_nomre: { contains: q, mode: "insensitive" } },
          { musteri_ad: { contains: q, mode: "insensitive" } },
          { musteri_telefon: { contains: q } },
        ],
      };
      if (marketplaceId) where.magaza_id = marketplaceId;
      const rows = await prisma.marketplace_sifarisleri.findMany({
        where,
        select: { id: true, xarici_nomre: true, meblegh: true, status: true, yaradildi: true },
        orderBy: { yaradildi: "desc" },
        take: 100,
      });
      return {
        ok: true,
        orders: rows.map((r) => ({
          id: r.id,
          nomre: r.xarici_nomre,
          mebleg: Number(r.meblegh ?? 0),
          status: r.status,
          tarix: r.yaradildi,
        })),
      };
    } catch (e) {
      console.error("[searchOrders]", e);
      const msg = e instanceof Error ? e.message : "naməlum səhv";
      return { ok: false, error: `Axtarış alınmadı: ${msg}` };
    }
  });
}
