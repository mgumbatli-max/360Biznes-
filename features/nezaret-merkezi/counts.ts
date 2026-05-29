import "server-only";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { prisma, prismaUnscoped } from "@/lib/db/prisma";
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

async function fetchNezaretTotal(sahibkarId: string, istifadeciId: string) {
  const [alertOpen, alertKritik, tesdiqGozleyen] = await Promise.all([
    prismaUnscoped.alerts.count({
      where: { sahibkar_id: sahibkarId, status: { in: ["yeni", "baxilir"] } },
    }),
    prismaUnscoped.alerts.count({
      where: { sahibkar_id: sahibkarId, status: { in: ["yeni", "baxilir"] }, seviyye: "kritik" },
    }),
    prismaUnscoped.tesdiq_telep.count({
      where: { sahibkar_id: sahibkarId, status: "gozleyir", yaradan_id: { not: istifadeciId } },
    }),
  ]);
  const total = alertOpen + tesdiqGozleyen;
  const tone: "rose" | "amber" | "emerald" =
    alertKritik > 0 ? "rose" : alertOpen > 0 || tesdiqGozleyen > 0 ? "amber" : "emerald";
  return { count: total, tone };
}

/** Single number for the sidebar badge — total things needing attention. */
export const getNezaretSidebarTotal = cache(async (): Promise<{ count: number; tone: "rose" | "amber" | "emerald" }> => {
  return withTenant(async () => {
    try {
      const { sahibkarId, istifadeciId } = requireTenant();
      const cached = unstable_cache(
        () => fetchNezaretTotal(sahibkarId, istifadeciId),
        ["nezaret-sidebar-total", sahibkarId, istifadeciId],
        {
          revalidate: 30,
          tags: [`nezaret:${sahibkarId}`, `alerts:${sahibkarId}`],
        },
      );
      return cached();
    } catch {
      return { count: 0, tone: "emerald" };
    }
  });
});
