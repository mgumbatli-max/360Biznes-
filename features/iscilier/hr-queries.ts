import "server-only";
import { unstable_cache } from "next/cache";
import { prisma, prismaUnscoped } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { parseQeydTags } from "./hr-tags";
import type { ProfileExtras, OrgNode, SkillsMatrixData, HeadcountStats } from "./hr-types";

const DEFAULT_SKILLS = [
  "Excel",
  "1C",
  "Word",
  "Satış",
  "Marketing",
  "Müştəri xidməti",
  "İngiliscə",
  "Rusca",
  "Türkcə",
  "SQL",
  "Logo Tiger",
  "Anbar",
  "Liderlik",
  "Komanda işi",
  "Texniki bilik",
];

/** Parse extras from istifadeciler.qeyd. */
export async function getEmployeeExtras(id: string): Promise<ProfileExtras> {
  return withTenant(async () => {
    const row = await prisma.istifadeciler.findUnique({
      where: { id },
      select: { qeyd: true },
    });
    return parseQeydTags(row?.qeyd ?? null);
  });
}

const fetchHeadcountStatsCached = (sahibkarId: string) =>
  unstable_cache(
    async (): Promise<HeadcountStats> => {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const dayStart = new Date(now);
      dayStart.setHours(0, 0, 0, 0);
      const days90 = new Date(dayStart);
      days90.setDate(days90.getDate() - 90);

      const [total, aktiv, onLeaveToday, leftLast90, newThisMonth] = await Promise.all([
        prismaUnscoped.istifadeciler.count({ where: { sahibkar_id: sahibkarId } }),
        prismaUnscoped.istifadeciler.count({ where: { sahibkar_id: sahibkarId, aktiv: true, isden_cixdi: null } }),
        prismaUnscoped.isci_mezuniyyet
          .count({
            where: {
              sahibkar_id: sahibkarId,
              baslama: { lte: dayStart },
              bitme: { gte: dayStart },
              status: "tesdiq",
            },
          })
          .catch(() => 0),
        prismaUnscoped.istifadeciler.count({ where: { sahibkar_id: sahibkarId, isden_cixdi: { gte: days90 } } }),
        prismaUnscoped.istifadeciler.count({ where: { sahibkar_id: sahibkarId, ise_baslama: { gte: monthStart } } }),
      ]);

      return {
        total,
        aktiv,
        mezuniyyetde: onLeaveToday,
        isden_cixmis_90: leftLast90,
        bu_ay_yeni: newThisMonth,
      };
    },
    ["headcount-stats", sahibkarId],
    { revalidate: 120, tags: [`hr:${sahibkarId}`] },
  );

/** Headcount strip stats. */
export async function getHeadcountStats(): Promise<HeadcountStats> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    return fetchHeadcountStatsCached(sahibkarId)();
  });
}

/** Org chart by vəzifə hierarchy (CEO/Direktor/Menecer/İşçi).
 *  We don't depend on a manager_id column — build groups by role/vezife.
 */
export async function getOrgChart(filterSobe?: string): Promise<{
  ceo: OrgNode | null;
  directors: OrgNode[];
  managers: OrgNode[];
  staff: OrgNode[];
  sobeler: Array<{ ad: string; count: number }>;
}> {
  return withTenant(async () => {
    const rows = await prisma.istifadeciler.findMany({
      where: { aktiv: true, isden_cixdi: null },
      include: {
        roles: { select: { ad: true } },
        filiallar_istifadeciler_default_filial_idTofiliallar: { select: { ad: true } },
      },
      orderBy: { ad_soyad: "asc" },
    });

    function toNode(r: (typeof rows)[number]): OrgNode {
      return {
        id: r.id,
        ad_soyad: r.ad_soyad,
        vezife: r.vezife,
        rol_ad: r.roles?.ad ?? null,
        sobe: r.filiallar_istifadeciler_default_filial_idTofiliallar?.ad ?? r.vezife ?? "Ümumi",
      };
    }

    const filtered = filterSobe
      ? rows.filter(
          (r) =>
            (r.filiallar_istifadeciler_default_filial_idTofiliallar?.ad ?? r.vezife ?? "")
              .toLowerCase() === filterSobe.toLowerCase(),
        )
      : rows;

    function classify(r: (typeof rows)[number]): "ceo" | "director" | "manager" | "staff" {
      const v = (r.vezife ?? "").toLowerCase();
      const role = (r.roles?.ad ?? "").toLowerCase();
      if (role.includes("admin") || v.includes("ceo") || v.includes("təsis") || v.includes("sahibkar"))
        return "ceo";
      if (v.includes("direktor") || role.includes("direktor")) return "director";
      if (v.includes("menecer") || v.includes("manager") || v.includes("rəhbər") || v.includes("baş"))
        return "manager";
      return "staff";
    }

    let ceo: OrgNode | null = null;
    const directors: OrgNode[] = [];
    const managers: OrgNode[] = [];
    const staff: OrgNode[] = [];

    for (const r of filtered) {
      const c = classify(r);
      const node = toNode(r);
      if (c === "ceo" && !ceo) ceo = node;
      else if (c === "ceo") directors.push(node);
      else if (c === "director") directors.push(node);
      else if (c === "manager") managers.push(node);
      else staff.push(node);
    }

    const sobeMap = new Map<string, number>();
    for (const r of rows) {
      const s =
        r.filiallar_istifadeciler_default_filial_idTofiliallar?.ad ?? r.vezife ?? "Ümumi";
      sobeMap.set(s, (sobeMap.get(s) ?? 0) + 1);
    }
    const sobeler = [...sobeMap.entries()]
      .map(([ad, count]) => ({ ad, count }))
      .sort((a, b) => b.count - a.count);

    return { ceo, directors, managers, staff, sobeler };
  });
}

/** Skills matrix: rows=employees, cols=skills. */
export async function getSkillsMatrix(filterSobe?: string): Promise<SkillsMatrixData> {
  return withTenant(async () => {
    const rows = await prisma.istifadeciler.findMany({
      where: { aktiv: true, isden_cixdi: null },
      select: {
        id: true,
        ad_soyad: true,
        vezife: true,
        qeyd: true,
        filiallar_istifadeciler_default_filial_idTofiliallar: { select: { ad: true } },
      },
      orderBy: { ad_soyad: "asc" },
    });

    // Compute per-employee skill map
    const empSkills = new Map<string, Map<string, number>>();
    const skillFreq = new Map<string, number>();

    for (const r of rows) {
      const extras = parseQeydTags(r.qeyd ?? null);
      const map = new Map<string, number>();
      for (const s of extras.skills) {
        if (!s.name) continue;
        map.set(s.name, Math.max(map.get(s.name) ?? 0, s.level));
        skillFreq.set(s.name, (skillFreq.get(s.name) ?? 0) + 1);
      }
      empSkills.set(r.id, map);
    }

    // Use top-15 skills (combo of seed + most frequent)
    const seedSet = new Set(DEFAULT_SKILLS);
    const freqList = [...skillFreq.entries()].sort((a, b) => b[1] - a[1]).map(([n]) => n);
    const skills: string[] = [];
    for (const s of DEFAULT_SKILLS) {
      if (!skills.includes(s)) skills.push(s);
    }
    for (const s of freqList) {
      if (!seedSet.has(s) && skills.length < 15) skills.push(s);
    }
    const topSkills = skills.slice(0, 15);

    const employees = rows
      .filter((r) =>
        filterSobe
          ? (r.filiallar_istifadeciler_default_filial_idTofiliallar?.ad ?? r.vezife ?? "")
              .toLowerCase() === filterSobe.toLowerCase()
          : true,
      )
      .map((r) => {
        const map = empSkills.get(r.id) ?? new Map();
        return {
          id: r.id,
          ad_soyad: r.ad_soyad,
          vezife: r.vezife,
          sobe: r.filiallar_istifadeciler_default_filial_idTofiliallar?.ad ?? null,
          levels: topSkills.map((s) => map.get(s) ?? 0),
        };
      });

    // Gap report — skills where most employees rate <=2
    const gaps = topSkills
      .map((skill, idx) => {
        const avg =
          employees.length > 0
            ? employees.reduce((s, e) => s + e.levels[idx], 0) / employees.length
            : 0;
        return { skill, avg, low: employees.filter((e) => e.levels[idx] <= 1).length };
      })
      .sort((a, b) => a.avg - b.avg)
      .slice(0, 5);

    return { skills: topSkills, employees, gaps };
  });
}

/** Self-service: get the current user's full profile. */
export async function getMyProfile() {
  return withTenant(async () => {
    const { istifadeciId } = requireTenant();
    return prisma.istifadeciler.findUnique({
      where: { id: istifadeciId },
      include: {
        roles: { select: { ad: true } },
        filiallar_istifadeciler_default_filial_idTofiliallar: { select: { ad: true } },
      },
    });
  });
}

export async function getMyId(): Promise<string> {
  return withTenant(async () => requireTenant().istifadeciId);
}
