import "server-only";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";

export type MaasBand = {
  vezife: string;
  min: number;
  ortalama: number;
  max: number;
  current_avg?: number;
  count?: number;
};

export async function getMaasBands(): Promise<MaasBand[]> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const [rows, employees] = await Promise.all([
      prisma.ayarlar.findMany({
        where: { sahibkar_id: sahibkarId, qrup: "maas_band" },
      }),
      prisma.istifadeciler.findMany({
        where: { sahibkar_id: sahibkarId, aktiv: true, isden_cixdi: null, vezife: { not: null } },
        select: { vezife: true, aylik_maas: true },
      }),
    ]);

    // Current averages per vezife
    const stats = new Map<string, { sum: number; count: number }>();
    for (const e of employees) {
      if (!e.vezife) continue;
      const cur = stats.get(e.vezife) ?? { sum: 0, count: 0 };
      cur.sum += Number(e.aylik_maas ?? 0);
      cur.count++;
      stats.set(e.vezife, cur);
    }

    const bands: MaasBand[] = rows.map((r) => {
      const parsed = safeParse(r.deyer);
      const s = stats.get(r.acar);
      return {
        vezife: r.acar,
        min: parsed.min,
        ortalama: parsed.ortalama,
        max: parsed.max,
        current_avg: s && s.count ? s.sum / s.count : undefined,
        count: s?.count ?? 0,
      };
    });

    // Add any vezifeler not yet in bands
    for (const [vez, s] of stats.entries()) {
      if (!bands.some((b) => b.vezife === vez)) {
        bands.push({ vezife: vez, min: 0, ortalama: 0, max: 0, current_avg: s.sum / s.count, count: s.count });
      }
    }

    return bands.sort((a, b) => a.vezife.localeCompare(b.vezife));
  });
}

function safeParse(s: string | null): { min: number; ortalama: number; max: number } {
  if (!s) return { min: 0, ortalama: 0, max: 0 };
  try {
    const v = JSON.parse(s);
    return {
      min: Number(v.min ?? 0),
      ortalama: Number(v.ortalama ?? 0),
      max: Number(v.max ?? 0),
    };
  } catch {
    return { min: 0, ortalama: 0, max: 0 };
  }
}
