import "server-only";
import { unstable_cache } from "next/cache";
import { prismaUnscoped } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";

export type HeatmapCell = { dow: number; hour: number; say: number; meb: number };

/**
 * Build a 7x24 sales heatmap covering the last `days` days. dow 0=Sunday.
 */
export async function getSalesHeatmap(days = 90): Promise<HeatmapCell[]> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    // QA-perf: 90 günlük satış DOW/saat aqreqatı (7×24 grid) ağırdır, dəqiqədə dəyişmir → cache 10dəq.
    const rows = await unstable_cache(
      () => prismaUnscoped.$queryRaw<
        { dow: number; hour: number; say: number; meb: number }[]
      >`
        SELECT
          EXTRACT(DOW  FROM COALESCE(yaradildi, tarix))::int AS dow,
          EXTRACT(HOUR FROM COALESCE(yaradildi, tarix))::int AS hour,
          COUNT(*)::int                                       AS say,
          COALESCE(SUM(son_mebleg), 0)::float                 AS meb
        FROM satis_sifarisleri
        WHERE sahibkar_id = ${sahibkarId}::uuid
          AND tarix >= CURRENT_DATE - (${days}::int - 1)
          AND COALESCE(status, '') <> 'legv'
          AND COALESCE(qaralama, false) = false
        GROUP BY 1, 2
        ORDER BY 1, 2
      `,
      ["sales-heatmap", sahibkarId, String(days)],
      { revalidate: 600, tags: [`sales:${sahibkarId}`] },
    )();
    return rows.map((r) => ({
      dow: Number(r.dow),
      hour: Number(r.hour),
      say: Number(r.say),
      meb: Number(r.meb),
    }));
  });
}
