import "server-only";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import type { DateRange } from "./shared";

export type StaffPerf = {
  id: string;
  ad: string;
  vezife: string | null;
  aylik_maas: number | null;
  sifaris_say: number;
  cemi: number;
  ort_cek: number;
  endirim: number;
  endirim_pct: number;
  roi: number;
};

export async function getStaffPerformance(range: DateRange, limit = 50): Promise<StaffPerf[]> {
  return withTenant(async () => {
    const { sahibkarId, rolAd, icazeler } = requireTenant();
    // 🔒 (audit #6) aylik_maas + maaşdan törəyən ROI yalnız maas.view/maas.idare
    // (və ya imtiyazlı) olana açıq — isci.view tək kifayət deyil.
    const priv = /(sahibkar|admin|owner|direktor)/.test((rolAd ?? "").toLowerCase());
    const canViewSalary = priv || (icazeler ?? []).includes("maas.view") || (icazeler ?? []).includes("maas.idare");
    const rows = await prisma.$queryRaw<{
      id: string;
      ad: string;
      vezife: string | null;
      aylik_maas: number | null;
      sifaris_say: number;
      cemi: number;
      umumi: number;
      ort_cek: number;
      endirim: number;
    }[]>`
      SELECT u.id::text, u.ad_soyad AS ad, u.vezife, u.aylik_maas::float AS aylik_maas,
             COUNT(ss.id)::int AS sifaris_say,
             COALESCE(SUM(ss.son_mebleg), 0)::float AS cemi,
             COALESCE(SUM(ss.umumi_mebleg), 0)::float AS umumi,
             COALESCE(AVG(ss.son_mebleg), 0)::float AS ort_cek,
             COALESCE(SUM(ss.endirim_mebleg), 0)::float AS endirim
        FROM istifadeciler u
        LEFT JOIN satis_sifarisleri ss
               ON ss.satis_meneceri_id = u.id
              AND ss.tarix BETWEEN ${range.from} AND ${range.to}
              AND ss.status != 'legv'
              AND ss.qaralama IS NOT TRUE
       WHERE u.sahibkar_id = ${sahibkarId}::uuid AND u.aktiv = TRUE
       GROUP BY u.id, u.ad_soyad, u.vezife, u.aylik_maas
       ORDER BY cemi DESC
       LIMIT ${limit}
    `;
    return rows.map((r) => {
      const cemi = Number(r.cemi);
      const umumi = Number(r.umumi);
      const endirim = Number(r.endirim);
      const maas = Number(r.aylik_maas ?? 0);
      return {
        id: r.id,
        ad: r.ad,
        vezife: r.vezife,
        // Maaş yoxsa null (redaksiya); ROI da maaşdan törədiyi üçün gizlənir.
        aylik_maas: canViewSalary ? (r.aylik_maas != null ? Number(r.aylik_maas) : null) : null,
        sifaris_say: Number(r.sifaris_say),
        cemi,
        ort_cek: Number(r.ort_cek),
        endirim,
        // (audit #15) endirim faizi BRUT məbləğə (umumi_mebleg) nisbətdə hesablanır —
        // əvvəl son_mebleg (endirimdən sonrakı) məxrəc idi, faizi şişirdirdi.
        endirim_pct: umumi > 0 ? (endirim / umumi) * 100 : 0,
        roi: canViewSalary && maas > 0 ? cemi / maas : 0,
      };
    });
  });
}

export type AttendanceStat = {
  id: string;
  ad: string;
  is_gun: number;
  qayib_gun: number;
  davamiyyet_pct: number;
};

export async function getAttendanceStats(range: DateRange): Promise<AttendanceStat[]> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const rows = await prisma.$queryRaw<AttendanceStat[]>`
      SELECT u.id::text, u.ad_soyad AS ad,
             COUNT(d.id) FILTER (WHERE d.status IN ('isde','gəldi','i_de','geldi'))::int AS is_gun,
             COUNT(d.id) FILTER (WHERE d.status IN ('qayib','yox','ezrli','ezrsiz'))::int AS qayib_gun,
             0.0::float AS davamiyyet_pct
        FROM istifadeciler u
        LEFT JOIN davamiyyet d ON d.istifadeci_id = u.id
             AND d.tarix BETWEEN ${range.from} AND ${range.to}
       WHERE u.sahibkar_id = ${sahibkarId}::uuid AND u.aktiv = TRUE
       GROUP BY u.id, u.ad_soyad
       ORDER BY is_gun DESC
       LIMIT 50
    `.catch(() => [] as AttendanceStat[]);
    return rows.map((r) => {
      const is_gun = Number(r.is_gun ?? 0);
      const qayib_gun = Number(r.qayib_gun ?? 0);
      const total = is_gun + qayib_gun;
      return {
        ...r,
        is_gun,
        qayib_gun,
        davamiyyet_pct: total > 0 ? (is_gun / total) * 100 : 0,
      };
    });
  });
}
