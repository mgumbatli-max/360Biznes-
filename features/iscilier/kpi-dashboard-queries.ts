import "server-only";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { getStealthState } from "@/lib/stealth/server";

export type KpiDashboardRow = {
  istifadeci_id: string;
  ad_soyad: string;
  vezife: string | null;
  rol_ad: string | null;
  profil_sekil: string | null;
  // Maaş və bonus
  aylik_maas: number;
  bonus_qazanilan: number;
  bonus_pool: number;
  cerime_toplam: number;
  net_maas: number; // maaş + bonus − cərimə
  // KPI faizləri
  davamiyyet_faiz: number;   // 0-100
  tapsiriq_faiz: number;     // 0-100 (vaxtında bitirilən)
  sehv_faiz: number;         // 0-100 (rədd edilmiş təsdiq %)
  satis_meblegh: number;
  satis_sayi: number;
  // Trendlər (keçən ay ilə müqayisə) — bp = basis points fərqi
  trend_satis: number | null;       // bu ay satış − keçən ay
  trend_davamiyyet: number | null;  // % nöqtələri
  trend_tapsiriq: number | null;
  // Ümumi performans skoru (0-100) — sıralanma üçün
  performans_skoru: number;
  // Hesablama tarixi
  il: number;
  ay: number;
};

export type SortKey =
  | "ad" | "vezife" | "maas" | "bonus" | "cerime" | "net"
  | "davamiyyet" | "tapsiriq" | "sehv" | "satis" | "performans";

export type SortDir = "asc" | "desc";

export type KpiDashboardSummary = {
  cemi_emekdas: number;
  cemi_maas: number;
  cemi_bonus: number;
  cemi_cerime: number;
  cemi_satis: number;
  ortalama_davamiyyet: number;
  ortalama_tapsiriq: number;
  ortalama_sehv: number;
};

/**
 * Bütün aktiv əməkdaşlar üçün KPI dashboard cədvəli.
 *
 * Hər sətrdə:
 *  - Maaş, bonus, cərimə (bordro_cedveli + bonus_calc-dən)
 *  - Davamiyyət %, tapşırıq %, səhv % (real göstəricilərdən)
 *  - Satış məbləği və sayı (cari ay)
 *
 * Performance qeydi: hər əməkdaş üçün ayrıca bonus hesablanır — N əməkdaşda
 * N DB sorğusu. 100+ əməkdaşı olan biznes üçün optimize lazımdır
 * (məs. aggregate queries). Hələlik kiçik tenant üçün uyğundur.
 */
export async function getKpiDashboard(opts: {
  monthStr?: string;
  search?: string;
  vezifeFilter?: string;
  sortBy?: SortKey;
  sortDir?: SortDir;
  /** true olarsa, gizli mod scale-i tətbiq olunmur. Excel eksport, vergi hesabatı üçün. */
  rawData?: boolean;
} = {}): Promise<{
  month: { il: number; ay: number };
  rows: KpiDashboardRow[];
  summary: KpiDashboardSummary;
  vezifeOptions: string[];
}> {
  const monthStr = opts.monthStr;
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const d = new Date();
    let il = d.getFullYear();
    let ay = d.getMonth() + 1;
    if (monthStr) {
      const [y, m] = monthStr.split("-").map(Number);
      if (y && m) {
        il = y;
        ay = m;
      }
    }
    const start = new Date(il, ay - 1, 1);
    const end = new Date(il, ay, 0, 23, 59, 59);
    const expectedWorkDays = countWeekdays(start, end);

    // 1. Aktiv əməkdaşlar
    const employees = await prisma.istifadeciler.findMany({
      where: { sahibkar_id: sahibkarId, aktiv: true },
      select: {
        id: true,
        ad_soyad: true,
        vezife: true,
        profil_sekil: true,
        aylik_maas: true,
        roles: { select: { ad: true } },
      },
      orderBy: { ad_soyad: "asc" },
      take: 500,
    });

    if (employees.length === 0) {
      return {
        month: { il, ay },
        rows: [],
        summary: {
          cemi_emekdas: 0,
          cemi_maas: 0,
          cemi_bonus: 0,
          cemi_cerime: 0,
          cemi_satis: 0,
          ortalama_davamiyyet: 0,
          ortalama_tapsiriq: 0,
          ortalama_sehv: 0,
        },
        vezifeOptions: [],
      };
    }

    const empIds = employees.map((e) => e.id);

    // 2. Toplu sorğular — paralel
    const [davamiyyet, tasks, tasksOnTime, approvals, approvalsRejected, sales, bordro] = await Promise.all([
      // Davamiyyət — hər əməkdaş üçün qaydasında günlər
      prisma.davamiyyet.groupBy({
        by: ["istifadeci_id"],
        where: {
          sahibkar_id: sahibkarId,
          istifadeci_id: { in: empIds },
          tarix: { gte: start, lte: end },
          status: "qaydasinda",
        },
        _count: { _all: true },
      }),
      // Tapşırıqlar — hər əməkdaş üçün ümumi
      // QA-orta: icraçı (tapshiriq_iscilier) tapşırıqları da sayılsın — əvvəl yalnız
      // mesul_id sayılırdı, tapshiriqlar modulunun analitikası ilə ziddiyyət yaranırdı
      prisma.$queryRaw<{ mesul_id: string; count: bigint }[]>`
        WITH user_task AS (
          SELECT t.id, t.mesul_id AS istifadeci_id
            FROM tapshiriqlar t
           WHERE t.sahibkar_id = ${sahibkarId}::uuid AND t.mesul_id IS NOT NULL
             AND t.deadline BETWEEN ${start} AND ${end}
          UNION
          SELECT t.id, ti.istifadeci_id
            FROM tapshiriqlar t
            JOIN tapshiriq_iscilier ti ON ti.tapshiriq_id = t.id
           WHERE t.sahibkar_id = ${sahibkarId}::uuid
             AND t.deadline BETWEEN ${start} AND ${end}
        )
        SELECT istifadeci_id::text AS mesul_id, COUNT(*)::bigint AS count
          FROM user_task
         WHERE istifadeci_id = ANY(${empIds}::uuid[])
         GROUP BY istifadeci_id
      `,
      // Vaxtında bitirilmiş tapşırıqlar
      // QA-orta: icraçı tapşırıqları da daxil (mesul_id UNION tapshiriq_iscilier)
      prisma.$queryRaw<{ mesul_id: string; count: bigint }[]>`
        WITH user_task AS (
          SELECT t.id, t.deadline, t.tamamlandi_de, t.mesul_id AS istifadeci_id
            FROM tapshiriqlar t
           WHERE t.sahibkar_id = ${sahibkarId}::uuid AND t.mesul_id IS NOT NULL
          UNION
          SELECT t.id, t.deadline, t.tamamlandi_de, ti.istifadeci_id
            FROM tapshiriqlar t
            JOIN tapshiriq_iscilier ti ON ti.tapshiriq_id = t.id
           WHERE t.sahibkar_id = ${sahibkarId}::uuid
        )
        SELECT istifadeci_id::text AS mesul_id, COUNT(*)::bigint AS count
          FROM user_task
         WHERE istifadeci_id = ANY(${empIds}::uuid[])
           AND deadline BETWEEN ${start} AND ${end}
           AND tamamlandi_de IS NOT NULL
           AND tamamlandi_de <= deadline
         GROUP BY istifadeci_id
      `,
      // Təsdiq sorğuları — yaradılmış
      prisma.tesdiq_telep.groupBy({
        by: ["yaradan_id"],
        where: {
          sahibkar_id: sahibkarId,
          yaradan_id: { in: empIds },
          yaradildi: { gte: start, lte: end },
        },
        _count: { _all: true },
      }),
      // Təsdiq sorğuları — rədd edilmiş
      prisma.tesdiq_telep.groupBy({
        by: ["yaradan_id"],
        where: {
          sahibkar_id: sahibkarId,
          yaradan_id: { in: empIds },
          yaradildi: { gte: start, lte: end },
          status: "red",
        },
        _count: { _all: true },
      }),
      // Satış — yaradan üzrə
      prisma.satis_sifarisleri.groupBy({
        by: ["yaradan_id"],
        where: {
          sahibkar_id: sahibkarId,
          yaradan_id: { in: empIds },
          tarix: { gte: start, lte: end },
          status: { notIn: ["legv", "qaralama", "tesdiq_gozleyir"] },
        },
        _sum: { son_mebleg: true },
        _count: { _all: true },
      }),
      // Bordro — bonus və cərimə cəmləri (maas_hesablamalar cədvəlindən)
      prisma.maas_hesablamalar.findMany({
        where: {
          sahibkar_id: sahibkarId,
          istifadeci_id: { in: empIds },
          il,
          ay,
        },
        select: {
          istifadeci_id: true,
          kpi_bonus: true,
          manual_bonus: true,
          cerime: true,
          // QA-orta: bordro faktiki NET — dashboard "Net" sütunu bununla uyğunlaşdırılır
          son_meblegh: true,
        },
      }),
    ]);

    // 3. Helper maps — strict tipləmə tsc üçün
    const davMap = new Map<string, number>(davamiyyet.map((d: { istifadeci_id: string; _count: { _all: number } }) => [d.istifadeci_id, d._count._all]));
    // QA-orta: raw UNION nəticəsi {mesul_id, count} formasındadır
    const taskMap = new Map<string, number>(tasks.map((t) => [t.mesul_id, Number(t.count)]));
    const onTimeMap = new Map<string, number>(tasksOnTime.map((t: { mesul_id: string; count: bigint }) => [t.mesul_id, Number(t.count)]));
    const apprMap = new Map<string, number>(approvals.map((a: { yaradan_id: string | null; _count: { _all: number } }) => [a.yaradan_id ?? "", a._count._all]));
    const rejectMap = new Map<string, number>(approvalsRejected.map((a: { yaradan_id: string | null; _count: { _all: number } }) => [a.yaradan_id ?? "", a._count._all]));
    const salesMap = new Map<string, { mebleg: number; sayi: number }>(
      sales.map((s: { yaradan_id: string | null; _sum: { son_mebleg: unknown }; _count: { _all: number } }) =>
        [s.yaradan_id ?? "", { mebleg: Number(s._sum.son_mebleg ?? 0), sayi: s._count._all }],
      ),
    );
    const bordroMap = new Map<string, { bonus: number; cerime: number; net: number | null }>(
      bordro.map((b: { istifadeci_id: string; kpi_bonus: unknown; manual_bonus: unknown; cerime: unknown; son_meblegh: unknown }) =>
        [b.istifadeci_id, {
          bonus: Number(b.kpi_bonus ?? 0) + Number(b.manual_bonus ?? 0),
          cerime: Number(b.cerime ?? 0),
          // QA-orta: bordro faktiki NET (prorata/vergi/sosial/avans daxil) — bordro yoxdursa null
          net: b.son_meblegh == null ? null : Number(b.son_meblegh),
        }],
      ),
    );

    // 4. Bonus — Perf (#11): əvvəl hər əməkdaş üçün ayrıca calculateMonthlyBonus
    // çağırılırdı (N+1 DB sorğusu). Bonus rəqəmi bordro sorğusunda artıq mövcuddur
    // (kpi_bonus + manual_bonus → bordroMap.bonus), ona görə birbaşa ondan istifadə edilir.

    // 5. Keçən ay üçün eyni metrikləri çək — trend hesablamaq üçün
    const prevDate = new Date(il, ay - 2, 1);
    const prevIl = prevDate.getFullYear();
    const prevAy = prevDate.getMonth() + 1;
    const prevStart = new Date(prevIl, prevAy - 1, 1);
    const prevEnd = new Date(prevIl, prevAy, 0, 23, 59, 59);
    const prevExpectedDays = countWeekdays(prevStart, prevEnd);

    const [prevDav, prevTasks, prevOnTime, prevSales] = await Promise.all([
      prisma.davamiyyet.groupBy({
        by: ["istifadeci_id"],
        where: {
          sahibkar_id: sahibkarId,
          istifadeci_id: { in: empIds },
          tarix: { gte: prevStart, lte: prevEnd },
          status: "qaydasinda",
        },
        _count: { _all: true },
      }),
      // QA-orta: icraçı tapşırıqları da daxil (mesul_id UNION tapshiriq_iscilier)
      prisma.$queryRaw<{ mesul_id: string; count: bigint }[]>`
        WITH user_task AS (
          SELECT t.id, t.mesul_id AS istifadeci_id
            FROM tapshiriqlar t
           WHERE t.sahibkar_id = ${sahibkarId}::uuid AND t.mesul_id IS NOT NULL
             AND t.deadline BETWEEN ${prevStart} AND ${prevEnd}
          UNION
          SELECT t.id, ti.istifadeci_id
            FROM tapshiriqlar t
            JOIN tapshiriq_iscilier ti ON ti.tapshiriq_id = t.id
           WHERE t.sahibkar_id = ${sahibkarId}::uuid
             AND t.deadline BETWEEN ${prevStart} AND ${prevEnd}
        )
        SELECT istifadeci_id::text AS mesul_id, COUNT(*)::bigint AS count
          FROM user_task
         WHERE istifadeci_id = ANY(${empIds}::uuid[])
         GROUP BY istifadeci_id
      `,
      // QA-orta: icraçı tapşırıqları da daxil (mesul_id UNION tapshiriq_iscilier)
      prisma.$queryRaw<{ mesul_id: string; count: bigint }[]>`
        WITH user_task AS (
          SELECT t.id, t.deadline, t.tamamlandi_de, t.mesul_id AS istifadeci_id
            FROM tapshiriqlar t
           WHERE t.sahibkar_id = ${sahibkarId}::uuid AND t.mesul_id IS NOT NULL
          UNION
          SELECT t.id, t.deadline, t.tamamlandi_de, ti.istifadeci_id
            FROM tapshiriqlar t
            JOIN tapshiriq_iscilier ti ON ti.tapshiriq_id = t.id
           WHERE t.sahibkar_id = ${sahibkarId}::uuid
        )
        SELECT istifadeci_id::text AS mesul_id, COUNT(*)::bigint AS count
          FROM user_task
         WHERE istifadeci_id = ANY(${empIds}::uuid[])
           AND deadline BETWEEN ${prevStart} AND ${prevEnd}
           AND tamamlandi_de IS NOT NULL
           AND tamamlandi_de <= deadline
         GROUP BY istifadeci_id
      `,
      prisma.satis_sifarisleri.groupBy({
        by: ["yaradan_id"],
        where: {
          sahibkar_id: sahibkarId,
          yaradan_id: { in: empIds },
          tarix: { gte: prevStart, lte: prevEnd },
          status: { notIn: ["legv", "qaralama", "tesdiq_gozleyir"] },
        },
        _sum: { son_mebleg: true },
      }),
    ]);
    const prevDavMap = new Map<string, number>(prevDav.map((d) => [d.istifadeci_id, d._count._all]));
    const prevTaskMap = new Map<string, number>(prevTasks.map((t) => [t.mesul_id, Number(t.count)])); // QA-orta: raw UNION forması
    const prevOnTimeMap = new Map<string, number>(prevOnTime.map((t) => [t.mesul_id, Number(t.count)]));
    const prevSalesMap = new Map<string, number>(
      prevSales.map((s) => [s.yaradan_id ?? "", Number(s._sum.son_mebleg ?? 0)]),
    );

    // 6. Hər əməkdaş üçün sətr formalaşdır
    const rows: KpiDashboardRow[] = employees.map((e) => {
      const dav = davMap.get(e.id) ?? 0;
      const davFaiz = expectedWorkDays > 0 ? Math.min(100, (dav / expectedWorkDays) * 100) : 0;
      const totalTasks = taskMap.get(e.id) ?? 0;
      const onTime = onTimeMap.get(e.id) ?? 0;
      const tapsFaiz = totalTasks > 0 ? (onTime / totalTasks) * 100 : 0;
      const totalAppr = apprMap.get(e.id) ?? 0;
      const rejAppr = rejectMap.get(e.id) ?? 0;
      const sehvFaiz = totalAppr > 0 ? (rejAppr / totalAppr) * 100 : 0;
      const satis = salesMap.get(e.id) ?? { mebleg: 0, sayi: 0 };
      const b = bordroMap.get(e.id) ?? { bonus: 0, cerime: 0, net: null }; // QA-orta: net sahəsi əlavə olundu
      const maas = Number(e.aylik_maas ?? 0);
      const bonusQaz = b.bonus; // Perf (#11): bordrodan birbaşa (kpi+manual)
      const cerime = b.cerime;

      // Trend hesablamaları — keçən ayla müqayisə
      const prevDavCount = prevDavMap.get(e.id) ?? 0;
      const prevDavFaiz = prevExpectedDays > 0 ? (prevDavCount / prevExpectedDays) * 100 : 0;
      const prevTasksTotal = prevTaskMap.get(e.id) ?? 0;
      const prevOnTimeTotal = prevOnTimeMap.get(e.id) ?? 0;
      const prevTapsFaiz = prevTasksTotal > 0 ? (prevOnTimeTotal / prevTasksTotal) * 100 : 0;
      const prevSatisMebleg = prevSalesMap.get(e.id) ?? 0;

      // Ümumi performans skoru (0-100) — sıralama üçün
      // Bonus 30% + Davamiyyət 25% + Tapşırıq 25% + (100 − Səhv) 20%
      // Perf (#11): pool artıq hesablanmır — bonus komponenti üçün neytral 50 baza.
      const bonusScore = 50;
      const performansSkoru =
        bonusScore * 0.3 +
        davFaiz * 0.25 +
        tapsFaiz * 0.25 +
        (100 - sehvFaiz) * 0.2;

      return {
        istifadeci_id: e.id,
        ad_soyad: e.ad_soyad,
        vezife: e.vezife,
        rol_ad: e.roles?.ad ?? null,
        profil_sekil: e.profil_sekil,
        aylik_maas: maas,
        bonus_qazanilan: bonusQaz,
        bonus_pool: 0, // Perf (#11): pool artıq per-işçi hesablanmır
        cerime_toplam: cerime,
        // QA-orta: bordro hesablanıbsa faktiki NET (son_meblegh) — bordro səhifəsi ilə eyni
        // rəqəm görünsün; bordro yoxdursa köhnə təxmini düstur (brüt) fallback.
        net_maas: b.net ?? (maas + bonusQaz - cerime),
        davamiyyet_faiz: davFaiz,
        tapsiriq_faiz: tapsFaiz,
        sehv_faiz: sehvFaiz,
        satis_meblegh: satis.mebleg,
        satis_sayi: satis.sayi,
        trend_satis: satis.mebleg - prevSatisMebleg,
        trend_davamiyyet: davFaiz - prevDavFaiz,
        trend_tapsiriq: tapsFaiz - prevTapsFaiz,
        performans_skoru: Math.round(performansSkoru),
        il,
        ay,
      };
    });

    // 6. Xülasə
    const summary: KpiDashboardSummary = {
      cemi_emekdas: rows.length,
      cemi_maas: rows.reduce((s, r) => s + r.aylik_maas, 0),
      cemi_bonus: rows.reduce((s, r) => s + r.bonus_qazanilan, 0),
      cemi_cerime: rows.reduce((s, r) => s + r.cerime_toplam, 0),
      cemi_satis: rows.reduce((s, r) => s + r.satis_meblegh, 0),
      ortalama_davamiyyet: rows.length > 0 ? rows.reduce((s, r) => s + r.davamiyyet_faiz, 0) / rows.length : 0,
      ortalama_tapsiriq: rows.length > 0 ? rows.reduce((s, r) => s + r.tapsiriq_faiz, 0) / rows.length : 0,
      ortalama_sehv: rows.length > 0 ? rows.reduce((s, r) => s + r.sehv_faiz, 0) / rows.length : 0,
    };

    // 7. Vəzifə seçimləri (filter dropdown üçün)
    const vezifeSet = new Set<string>();
    for (const r of rows) if (r.vezife) vezifeSet.add(r.vezife);
    const vezifeOptions = Array.from(vezifeSet).sort();

    // 8. Axtarış + filter tətbiq et
    let filtered = rows;
    if (opts.search?.trim()) {
      const q = opts.search.trim().toLowerCase();
      filtered = filtered.filter(
        (r) =>
          r.ad_soyad.toLowerCase().includes(q) ||
          (r.vezife ?? "").toLowerCase().includes(q) ||
          (r.rol_ad ?? "").toLowerCase().includes(q),
      );
    }
    if (opts.vezifeFilter) {
      filtered = filtered.filter((r) => r.vezife === opts.vezifeFilter);
    }

    // 9. Sıralama
    const sortBy: SortKey = opts.sortBy ?? "performans";
    const sortDir: SortDir = opts.sortDir ?? "desc";
    const dirMul = sortDir === "asc" ? 1 : -1;
    filtered.sort((a, b) => {
      let av: number | string = 0;
      let bv: number | string = 0;
      switch (sortBy) {
        case "ad": av = a.ad_soyad; bv = b.ad_soyad; break;
        case "vezife": av = a.vezife ?? ""; bv = b.vezife ?? ""; break;
        case "maas": av = a.aylik_maas; bv = b.aylik_maas; break;
        case "bonus": av = a.bonus_qazanilan; bv = b.bonus_qazanilan; break;
        case "cerime": av = a.cerime_toplam; bv = b.cerime_toplam; break;
        case "net": av = a.net_maas; bv = b.net_maas; break;
        case "davamiyyet": av = a.davamiyyet_faiz; bv = b.davamiyyet_faiz; break;
        case "tapsiriq": av = a.tapsiriq_faiz; bv = b.tapsiriq_faiz; break;
        case "sehv": av = a.sehv_faiz; bv = b.sehv_faiz; break;
        case "satis": av = a.satis_meblegh; bv = b.satis_meblegh; break;
        case "performans": av = a.performans_skoru; bv = b.performans_skoru; break;
      }
      if (typeof av === "string" && typeof bv === "string") {
        return av.localeCompare(bv, "az") * dirMul;
      }
      return ((av as number) - (bv as number)) * dirMul;
    });

    // 10. Gizli mod scale tətbiqi — yalnız display rəqəmlərinə
    // rawData=true (Excel eksport) → tətbiq edilməz; real data verilir
    const stealth = opts.rawData ? { aktiv: false, scale: 1 } : await getStealthState();
    if (stealth.aktiv && stealth.scale !== 1) {
      const s = stealth.scale;
      filtered = filtered.map((r) => ({
        ...r,
        aylik_maas: r.aylik_maas * s,
        bonus_qazanilan: r.bonus_qazanilan * s,
        bonus_pool: r.bonus_pool * s,
        cerime_toplam: r.cerime_toplam * s,
        net_maas: r.net_maas * s,
        satis_meblegh: r.satis_meblegh * s,
        trend_satis: r.trend_satis != null ? r.trend_satis * s : null,
      }));
      summary.cemi_maas *= s;
      summary.cemi_bonus *= s;
      summary.cemi_cerime *= s;
      summary.cemi_satis *= s;
    }

    return { month: { il, ay }, rows: filtered, summary, vezifeOptions };
  });
}

function countWeekdays(start: Date, end: Date): number {
  let count = 0;
  const d = new Date(start);
  while (d <= end) {
    const dow = d.getDay();
    if (dow !== 0) count++; // Bazar (sunday) hesabdan çıxır
    d.setDate(d.getDate() + 1);
  }
  return count;
}
