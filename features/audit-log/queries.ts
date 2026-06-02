import "server-only";
import { unstable_cache } from "next/cache";
import { prisma, prismaUnscoped } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";

export type AuditFilter = {
  q?: string;
  emeliyyat?: string;
  resurs_nov?: string;
  /** Bir neçə resurs növü ilə filter (modul dropdown-undan) */
  resurs_nov_in?: string[];
  status?: string;
  istifadeci_id?: string;
  from?: string;
  to?: string;
};

export type AuditStats = {
  total_24h: number;
  yarat_24h: number;
  silme_24h: number;
  xeta_24h: number;
  gece_24h: number;
};

export type AuditAnomaly = {
  kind: "gece" | "tezSilme" | "xeta_zincir" | "yeni_cihaz" | "uğursuz_giris";
  message: string;
  sayi: number;
  severity?: "info" | "warning" | "danger";
};

export async function getAuditLog(filter: AuditFilter, page = 1, pageSize = 50) {
  return withTenant(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};
    if (filter.emeliyyat) where.emeliyyat = filter.emeliyyat;
    if (filter.resurs_nov) where.resurs_nov = filter.resurs_nov;
    else if (filter.resurs_nov_in && filter.resurs_nov_in.length > 0) {
      where.resurs_nov = { in: filter.resurs_nov_in };
    }
    if (filter.status) where.status = filter.status;
    if (filter.istifadeci_id) where.istifadeci_id = filter.istifadeci_id;
    if (filter.from || filter.to) {
      where.yaradildi = {};
      if (filter.from) where.yaradildi.gte = new Date(filter.from);
      if (filter.to) where.yaradildi.lte = new Date(filter.to);
    }
    if (filter.q) {
      where.OR = [
        { istifadeci_ad: { contains: filter.q, mode: "insensitive" } },
        { resurs_nov: { contains: filter.q, mode: "insensitive" } },
        { url: { contains: filter.q } },
        { ip_adres: { contains: filter.q } },
        { resurs_id: { contains: filter.q } },
      ];
    }
    const [items, total] = await Promise.all([
      prisma.audit_log.findMany({
        where,
        orderBy: { yaradildi: "desc" },
        take: pageSize,
        skip: (page - 1) * pageSize,
      }),
      prisma.audit_log.count({ where }),
    ]);
    return { items, total };
  });
}

const fetchAuditStatsCached = (sahibkarId: string) =>
  unstable_cache(
    async (): Promise<AuditStats> => {
      const since = new Date(Date.now() - 24 * 3600 * 1000);
      // emeliyyat tarixən UPPERCASE-də yazılırdı ("YARAT", "SIL"). Yeni audit()
      // helper kiçik hərflərlə yazır ("yarat", "yarad", "sil"). KPI həm köhnə
      // həm yeni qeydləri saymalıdır.
      const YARAT_VARIANTS = ["yarat", "yarad", "YARAT"];
      const SIL_VARIANTS = ["sil", "SIL"];
      const [total, yarat, silme, xeta] = await Promise.all([
        prismaUnscoped.audit_log.count({ where: { sahibkar_id: sahibkarId, yaradildi: { gte: since } } }),
        prismaUnscoped.audit_log.count({ where: { sahibkar_id: sahibkarId, yaradildi: { gte: since }, emeliyyat: { in: YARAT_VARIANTS } } }),
        prismaUnscoped.audit_log.count({ where: { sahibkar_id: sahibkarId, yaradildi: { gte: since }, emeliyyat: { in: SIL_VARIANTS } } }),
        prismaUnscoped.audit_log.count({ where: { sahibkar_id: sahibkarId, yaradildi: { gte: since }, status: { not: "ugur" } } }),
      ]);
      const nightRows = await prismaUnscoped.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*)::bigint AS count
        FROM audit_log
        WHERE sahibkar_id = ${sahibkarId}::uuid
          AND yaradildi >= ${since}
          AND EXTRACT(HOUR FROM yaradildi) >= 0
          AND EXTRACT(HOUR FROM yaradildi) < 6
      `.catch(() => []);
      const gece = nightRows[0] ? Number(nightRows[0].count) : 0;
      return { total_24h: total, yarat_24h: yarat, silme_24h: silme, xeta_24h: xeta, gece_24h: gece };
    },
    ["audit-stats", sahibkarId],
    // Audit log live-feed kimi göstərilir — 60s cache auto-refresh-ə əngəl olur.
    // 10s cache yeni qeydlərin dərhal görünməsini təmin edir, lakin hər API-yə
    // 10 dəfə hit etmir.
    { revalidate: 10, tags: [`audit:${sahibkarId}`] },
  );

export async function getAuditStats(): Promise<AuditStats> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    return fetchAuditStatsCached(sahibkarId)();
  });
}

export async function getTopUsers(limit = 5) {
  return withTenant(async () => {
    const since = new Date(Date.now() - 7 * 24 * 3600 * 1000);
    const rows = await prisma.audit_log.groupBy({
      by: ["istifadeci_id", "istifadeci_ad"],
      where: { yaradildi: { gte: since }, istifadeci_id: { not: null } },
      _count: { _all: true },
      orderBy: { _count: { id: "desc" } },
      take: limit,
    });
    return rows.map((r) => ({
      istifadeci_id: r.istifadeci_id,
      istifadeci_ad: r.istifadeci_ad ?? "—",
      sayi: r._count._all,
    }));
  });
}

export async function getTopEntities(limit = 5) {
  return withTenant(async () => {
    const since = new Date(Date.now() - 7 * 24 * 3600 * 1000);
    const rows = await prisma.audit_log.groupBy({
      by: ["resurs_nov"],
      where: { yaradildi: { gte: since } },
      _count: { _all: true },
      orderBy: { _count: { id: "desc" } },
      take: limit,
    });
    return rows.map((r) => ({ resurs_nov: r.resurs_nov, sayi: r._count._all }));
  });
}

export async function getAnomalies(): Promise<AuditAnomaly[]> {
  return withTenant(async () => {
    const since = new Date(Date.now() - 24 * 3600 * 1000);
    const out: AuditAnomaly[] = [];

    const nightOps = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint AS count
      FROM audit_log
      WHERE yaradildi >= ${since}
        AND emeliyyat IN ('SIL','YENILE','YARAT')
        AND EXTRACT(HOUR FROM yaradildi) < 6
    `.catch(() => []);
    if (nightOps[0] && Number(nightOps[0].count) > 0) {
      out.push({
        kind: "gece",
        message: "Gecə saatlarında (00-06) əməliyyatlar müşahidə olunur",
        sayi: Number(nightOps[0].count),
      });
    }

    const rapidDelete = await prisma.audit_log.count({
      where: {
        yaradildi: { gte: new Date(Date.now() - 60 * 60 * 1000) },
        emeliyyat: "SIL",
      },
    });
    if (rapidDelete >= 10) {
      out.push({
        kind: "tezSilme",
        message: "Son bir saatda 10+ silmə əməliyyatı",
        sayi: rapidDelete,
      });
    }

    const errChain = await prisma.audit_log.count({
      where: { yaradildi: { gte: since }, status: { not: "ugur" } },
    });
    if (errChain >= 5) {
      out.push({
        kind: "xeta_zincir",
        message: "Son 24 saatda 5+ uğursuz əməliyyat",
        sayi: errChain,
      });
    }

    // KRİTİK: yeni cihazdan giriş — son 24 saat
    const newDeviceLogins = await prisma.audit_log.count({
      where: {
        yaradildi: { gte: since },
        emeliyyat: "yeni_cihaz_giris",
        status: "ugur",
      },
    });
    if (newDeviceLogins > 0) {
      out.push({
        kind: "yeni_cihaz",
        message: newDeviceLogins === 1
          ? "Son 24 saatda yeni cihazdan 1 giriş — siz idinizmi?"
          : `Son 24 saatda yeni cihazlardan ${newDeviceLogins} giriş — yoxlayın`,
        sayi: newDeviceLogins,
        severity: "danger",
      });
    }

    // Uğursuz giriş zənciri (son 24s)
    const failedLogins = await prisma.audit_log.count({
      where: {
        yaradildi: { gte: since },
        emeliyyat: "uğursuz_giris",
      },
    });
    if (failedLogins >= 3) {
      out.push({
        kind: "uğursuz_giris",
        message: `Son 24 saatda ${failedLogins} uğursuz giriş cəhdi`,
        sayi: failedLogins,
        severity: failedLogins >= 10 ? "danger" : "warning",
      });
    }
    return out;
  });
}
