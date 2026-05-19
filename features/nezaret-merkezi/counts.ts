import "server-only";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import type { TabBadge, NezaretTab } from "./components/tabs";

/**
 * Returns badge counts for the unified tab bar. Called once per layout/page load.
 */
export async function getNezaretBadges(): Promise<Partial<Record<NezaretTab, TabBadge>>> {
  return withTenant(async () => {
    try {
      const [alertOpen, alertKritik, tesdiqGozleyen, autoErrors24h] = await Promise.all([
        prisma.alerts.count({ where: { status: { in: ["yeni", "baxilir"] } } }),
        prisma.alerts.count({ where: { status: { in: ["yeni", "baxilir"] }, seviyye: "kritik" } }),
        prisma.tesdiq_telep.count({ where: { status: "gozleyir" } }),
        prisma.avto_log.count({
          where: {
            yaradildi: { gte: new Date(Date.now() - 24 * 3600 * 1000) },
            status: { not: "ok" },
          },
        }),
      ]);

      return {
        xeberdarliqlar: {
          count: alertKritik > 0 ? alertKritik : alertOpen,
          tone: alertKritik > 0 ? "rose" : "amber",
        },
        tesdiqler: {
          count: tesdiqGozleyen,
          tone: "emerald",
        },
        qaydalar: autoErrors24h > 0
          ? { count: autoErrors24h, tone: "rose" }
          : undefined,
      };
    } catch (e) {
      console.warn("[getNezaretBadges]", e);
      return {};
    }
  });
}

/** Single number for the sidebar badge — total things needing attention. */
export async function getNezaretSidebarTotal(): Promise<{ count: number; tone: "rose" | "amber" | "emerald" }> {
  return withTenant(async () => {
    try {
      const { istifadeciId } = requireTenant();
      const [alertOpen, alertKritik, tesdiqGozleyen] = await Promise.all([
        prisma.alerts.count({ where: { status: { in: ["yeni", "baxilir"] } } }),
        prisma.alerts.count({ where: { status: { in: ["yeni", "baxilir"] }, seviyye: "kritik" } }),
        // 4-eyes: yalnız başqalarının yaratdıqları — özümünkü mənim üçün təsdiqə dəymir
        prisma.tesdiq_telep.count({
          where: { status: "gozleyir", yaradan_id: { not: istifadeciId } },
        }),
      ]);
      const total = alertOpen + tesdiqGozleyen;
      const tone: "rose" | "amber" | "emerald" =
        alertKritik > 0 ? "rose" : alertOpen > 0 || tesdiqGozleyen > 0 ? "amber" : "emerald";
      return { count: total, tone };
    } catch {
      return { count: 0, tone: "emerald" };
    }
  });
}
