import "server-only";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";

export type EmployeeDocument = {
  id: number;
  ad: string;
  kateqoriya: string;
  fayl_url: string;
  fayl_nov: string | null;
  fayl_olcu: number | null;
  qeyd: string | null;
  bitme_tarixi: Date | null;
  yaradildi: Date | null;
};

export async function getEmployeeDocuments(istifadeciId: string): Promise<EmployeeDocument[]> {
  return withTenant(async () => {
    const rows = await prisma.isci_senedleri.findMany({
      where: { istifadeci_id: istifadeciId },
      orderBy: { yaradildi: "desc" },
    });
    return rows.map((r) => ({
      id: r.id,
      ad: r.ad,
      kateqoriya: r.kateqoriya,
      fayl_url: r.fayl_url,
      fayl_nov: r.fayl_nov,
      fayl_olcu: r.fayl_olcu,
      qeyd: r.qeyd,
      bitme_tarixi: r.bitme_tarixi,
      yaradildi: r.yaradildi,
    }));
  });
}

export type WorkScheduleRow = {
  id: number | null;
  hefte_gunu: number; // 1..7 (Bazar ertəsi..Bazar)
  baslama: string | null; // "HH:MM"
  bitme: string | null;
  istirahet: boolean;
};

const DEFAULT_SCHEDULE: WorkScheduleRow[] = [
  { id: null, hefte_gunu: 1, baslama: "09:00", bitme: "18:00", istirahet: false },
  { id: null, hefte_gunu: 2, baslama: "09:00", bitme: "18:00", istirahet: false },
  { id: null, hefte_gunu: 3, baslama: "09:00", bitme: "18:00", istirahet: false },
  { id: null, hefte_gunu: 4, baslama: "09:00", bitme: "18:00", istirahet: false },
  { id: null, hefte_gunu: 5, baslama: "09:00", bitme: "18:00", istirahet: false },
  { id: null, hefte_gunu: 6, baslama: "10:00", bitme: "16:00", istirahet: false },
  { id: null, hefte_gunu: 7, baslama: null, bitme: null, istirahet: true },
];

function timeFromDb(t: Date | null): string | null {
  if (!t) return null;
  const iso = new Date(t).toISOString();
  return iso.slice(11, 16);
}

export async function getEmployeeSchedule(istifadeciId: string): Promise<WorkScheduleRow[]> {
  return withTenant(async () => {
    const rows = await prisma.isci_grafik.findMany({
      where: { istifadeci_id: istifadeciId },
      orderBy: { hefte_gunu: "asc" },
    });
    if (rows.length === 0) return DEFAULT_SCHEDULE;
    const map = new Map<number, WorkScheduleRow>();
    for (const r of rows) {
      map.set(r.hefte_gunu, {
        id: r.id,
        hefte_gunu: r.hefte_gunu,
        baslama: timeFromDb(r.baslama),
        bitme: timeFromDb(r.bitme),
        istirahet: !!r.istirahet,
      });
    }
    return [1, 2, 3, 4, 5, 6, 7].map((g) => map.get(g) ?? { id: null, hefte_gunu: g, baslama: null, bitme: null, istirahet: true });
  });
}
