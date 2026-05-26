import "server-only";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";

export type TaskScope = "menim" | "yaratdigim" | "hamisi";
export type TaskStatus = "yeni" | "icrada" | "gozlemede" | "tamamlandi" | "legv";
export type TaskPriority = "asagi" | "normal" | "yuksek" | "tecili";
export type TaskSort = "deadline" | "yaradildi" | "prioritet" | "xatirlatma";

export type TaskFilter = {
  scope: TaskScope;
  status?: TaskStatus[];
  prioritet?: TaskPriority[];
  tip?: string[];
  mesul_id?: string;
  search?: string;
  sort?: TaskSort;
  overdue?: boolean; // deadline < indi VƏ status != tamamlandi/legv
};

export type TaskListItem = {
  id: string;
  basliq: string;
  tesvir: string | null;
  status: string;
  prioritet: string;
  tip: string | null;
  deadline: Date | null;
  xatirlatma: Date | null;
  yaradan_id: string;
  yaradan_ad: string;
  mesul_id: string | null;
  mesul_ad: string | null;
  icracilar: Array<{ id: string; ad_soyad: string; rol: string }>;
  reng: string | null;
  viewers_gizlilik: string | null;
  checklist_total: number;
  checklist_done: number;
  comment_count: number;
  yaradildi: Date | null;
  tamamlandi_de: Date | null;
};

// `qeyd_daxili` daxilindəki struktur teqləri oxumaq üçün helperlər
function readTag(text: string | null | undefined, key: string): string | null {
  if (!text) return null;
  const rx = new RegExp(`\\[${key}:([^\\]]*)\\]`);
  const m = text.match(rx);
  return m ? m[1] : null;
}

function buildOrderBy(sort: TaskSort | undefined) {
  switch (sort) {
    case "yaradildi":
      return [{ yaradildi: { sort: "desc" as const, nulls: "last" as const } }];
    case "prioritet":
      return [
        { prioritet: "desc" as const },
        { deadline: { sort: "asc" as const, nulls: "last" as const } },
      ];
    case "xatirlatma":
      return [{ xatirlatma: { sort: "asc" as const, nulls: "last" as const } }];
    case "deadline":
    default:
      return [
        { status: "asc" as const },
        { prioritet: "desc" as const },
        { deadline: { sort: "asc" as const, nulls: "last" as const } },
      ];
  }
}

export async function getTasks(filter: TaskFilter, page = 1, pageSize = 50): Promise<{ items: TaskListItem[]; total: number }> {
  return withTenant(async () => {
    const { istifadeciId } = requireTenant();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};

    if (filter.scope === "menim") {
      where.OR = [
        { mesul_id: istifadeciId },
        { tapshiriq_iscilier: { some: { istifadeci_id: istifadeciId } } },
      ];
    } else if (filter.scope === "yaratdigim") {
      where.yaradan_id = istifadeciId;
    }

    if (filter.status?.length) where.status = { in: filter.status };
    if (filter.prioritet?.length) where.prioritet = { in: filter.prioritet };
    if (filter.tip?.length) where.tip = { in: filter.tip };
    if (filter.mesul_id) where.mesul_id = filter.mesul_id;
    // Overdue: server-side filter — pagination/total düzgün hesablansın
    if (filter.overdue) {
      where.deadline = { lt: new Date() };
      where.status = { notIn: ["tamamlandi", "legv"] };
    }
    if (filter.search) {
      const search = filter.search.trim();
      const orFilters = [
        { basliq: { contains: search, mode: "insensitive" as const } },
        { tesvir: { contains: search, mode: "insensitive" as const } },
      ];
      if (where.OR) {
        where.AND = [{ OR: where.OR }, { OR: orFilters }];
        delete where.OR;
      } else {
        where.OR = orFilters;
      }
    }

    const [items, total] = await Promise.all([
      prisma.tapshiriqlar.findMany({
        where,
        orderBy: buildOrderBy(filter.sort),
        take: pageSize,
        skip: (page - 1) * pageSize,
        include: {
          istifadeciler_tapshiriqlar_mesul_idToistifadeciler: { select: { id: true, ad_soyad: true } },
          istifadeciler_tapshiriqlar_yaradan_idToistifadeciler: { select: { id: true, ad_soyad: true } },
          tapshiriq_iscilier: {
            include: { istifadeciler: { select: { id: true, ad_soyad: true } } },
          },
          tapshiriq_checklist: { select: { tamamlandi: true } },
          _count: { select: { tapshiriq_kommentleri: true } },
        },
      }),
      prisma.tapshiriqlar.count({ where }),
    ]);

    return {
      items: items.map((t) => {
        const reng = readTag(t.qeyd_daxili, "COLOR");
        const viewersRaw = readTag(t.qeyd_daxili, "VIEWERS");
        const viewers_gizlilik = viewersRaw ? viewersRaw.split("|")[0] : null;
        return {
          id: t.id,
          basliq: t.basliq,
          tesvir: t.tesvir,
          status: t.status ?? "yeni",
          prioritet: t.prioritet ?? "normal",
          tip: t.tip,
          deadline: t.deadline,
          xatirlatma: t.xatirlatma,
          yaradan_id: t.yaradan_id,
          yaradan_ad: t.istifadeciler_tapshiriqlar_yaradan_idToistifadeciler?.ad_soyad ?? "—",
          mesul_id: t.mesul_id,
          mesul_ad: t.istifadeciler_tapshiriqlar_mesul_idToistifadeciler?.ad_soyad ?? null,
          icracilar: t.tapshiriq_iscilier.map((i) => ({
            id: i.istifadeci_id,
            ad_soyad: i.istifadeciler.ad_soyad,
            rol: i.rol ?? "icraci",
          })),
          reng,
          viewers_gizlilik,
          checklist_total: t.tapshiriq_checklist.length,
          checklist_done: t.tapshiriq_checklist.filter((c) => c.tamamlandi).length,
          comment_count: t._count.tapshiriq_kommentleri,
          yaradildi: t.yaradildi,
          tamamlandi_de: t.tamamlandi_de,
        };
      }),
      total,
    };
  });
}

export type TaskStats = {
  cemi: number;
  toplam: number;
  gozleyir: number;
  icrada: number;
  yoxlanilir: number;
  tamamlandi: number;
  gecikmis: number;
  yeni: number;
  bugun_son_tarix: number;
};

export async function getTaskStats(): Promise<TaskStats> {
  return withTenant(async () => {
    const { istifadeciId } = requireTenant();
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    const baseScope = {
      OR: [
        { mesul_id: istifadeciId },
        { tapshiriq_iscilier: { some: { istifadeci_id: istifadeciId } } },
      ],
    };

    const [cemi, aktiv, yeni, icrada, yoxlanilir, tamamlandi, gecikmis, bugun] = await Promise.all([
      prisma.tapshiriqlar.count({ where: baseScope }),
      prisma.tapshiriqlar.count({
        where: { ...baseScope, status: { notIn: ["tamamlandi", "legv"] } },
      }),
      prisma.tapshiriqlar.count({ where: { ...baseScope, status: "yeni" } }),
      prisma.tapshiriqlar.count({ where: { ...baseScope, status: "icrada" } }),
      prisma.tapshiriqlar.count({ where: { ...baseScope, status: "gozlemede" } }),
      prisma.tapshiriqlar.count({ where: { ...baseScope, status: "tamamlandi" } }),
      prisma.tapshiriqlar.count({
        where: {
          ...baseScope,
          deadline: { lt: now },
          status: { notIn: ["tamamlandi", "legv"] },
        },
      }),
      prisma.tapshiriqlar.count({
        where: {
          ...baseScope,
          deadline: { gte: now, lt: tomorrow },
          status: { notIn: ["tamamlandi", "legv"] },
        },
      }),
    ]);

    return {
      cemi,
      toplam: aktiv,
      gozleyir: yeni,
      icrada,
      yoxlanilir,
      tamamlandi,
      gecikmis,
      yeni,
      bugun_son_tarix: bugun,
    };
  });
}

export async function getUsersForAssignment(): Promise<Array<{ id: string; ad_soyad: string; vezife: string | null }>> {
  return withTenant(async () => {
    const rows = await prisma.istifadeciler.findMany({
      where: { aktiv: true },
      orderBy: { ad_soyad: "asc" },
      select: { id: true, ad_soyad: true, vezife: true },
    });
    return rows;
  });
}

/**
 * Aktiv (vaxtı keçmiş və ya yaxınlaşan) xatırlatmaların sayı — cari istifadəçi üçün.
 */
export async function getMyActiveReminders(): Promise<number> {
  return withTenant(async () => {
    const { istifadeciId } = requireTenant();
    const now = new Date();

    const count = await prisma.tapshiriqlar.count({
      where: {
        OR: [
          { mesul_id: istifadeciId },
          { tapshiriq_iscilier: { some: { istifadeci_id: istifadeciId } } },
        ],
        status: { notIn: ["tamamlandi", "legv"] },
        xatirlatma: { lte: now, not: null },
      },
    });

    return count;
  });
}

/**
 * Cari istifadəçinin ID-si (server component-lərdə default mesul üçün)
 */
export async function getMyUserId(): Promise<string> {
  return withTenant(async () => {
    const { istifadeciId } = requireTenant();
    return istifadeciId;
  });
}

/**
 * "Mənim işim" topbar widget üçün xülasə.
 *
 * - Mənə təyin olunmuş açıq tapşırıqlar (top 5)
 * - Bu gün xatırlatma vaxtı çatmış (top 5)
 * - Mənim baxışımı gözləyən təsdiq sorğuları (top 5 — yalnız audit.view və ya istifadeci.idare olanlar)
 */
export type MyWorkItem = {
  id: string;
  basliq: string;
  meta: string | null;
  href: string;
};

export type MyWorkSummary = {
  myTasks: MyWorkItem[];
  todayReminders: MyWorkItem[];
  pendingApprovals: MyWorkItem[];
  canSeeApprovals: boolean;
  totals: { tasks: number; reminders: number; approvals: number };
};

export async function getMyWorkSummary(): Promise<MyWorkSummary> {
  return withTenant(async () => {
    const { istifadeciId, icazeler } = requireTenant();
    const now = new Date();
    const startOfTomorrow = new Date(now);
    startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);
    startOfTomorrow.setHours(0, 0, 0, 0);

    // Top 5 açıq tapşırıqlar (məsul və ya icraçı olduğum)
    const taskScope = {
      OR: [
        { mesul_id: istifadeciId },
        { tapshiriq_iscilier: { some: { istifadeci_id: istifadeciId } } },
      ],
      status: { notIn: ["tamamlandi", "legv"] },
    };

    const [tasks, reminders, tasksTotal, remindersTotal] = await Promise.all([
      prisma.tapshiriqlar.findMany({
        where: taskScope,
        orderBy: [
          { prioritet: "desc" as const },
          { deadline: { sort: "asc" as const, nulls: "last" as const } },
        ],
        take: 5,
        select: {
          id: true,
          basliq: true,
          deadline: true,
          prioritet: true,
        },
      }),
      prisma.tapshiriqlar.findMany({
        where: {
          ...taskScope,
          xatirlatma: { lte: startOfTomorrow, not: null },
        },
        orderBy: [{ xatirlatma: { sort: "asc" as const, nulls: "last" as const } }],
        take: 5,
        select: {
          id: true,
          basliq: true,
          xatirlatma: true,
        },
      }),
      prisma.tapshiriqlar.count({ where: taskScope }),
      prisma.tapshiriqlar.count({
        where: { ...taskScope, xatirlatma: { lte: startOfTomorrow, not: null } },
      }),
    ]);

    const canSeeApprovals =
      icazeler?.some?.(
        (c) =>
          c === "audit.view" ||
          c === "istifadeci.idare" ||
          c === "rol.idare" ||
          c === "sahibkar.access",
      ) ?? false;

    let approvals: Array<{ id: number; basliq: string | null; mebleg: unknown; emeliyyat_nov: string; yaradildi: Date | null }> = [];
    let approvalsTotal = 0;
    if (canSeeApprovals) {
      // 4-eyes: öz yaratdığın sorğunu özün təsdiqləyə bilməzsən,
      // ona görə öz sorğularını "Mənim işim" panelində göstərməyə dəyməz.
      const approvalWhere = {
        status: "gozleyir",
        yaradan_id: { not: istifadeciId },
      };
      [approvals, approvalsTotal] = await Promise.all([
        prisma.tesdiq_telep.findMany({
          where: approvalWhere,
          orderBy: { yaradildi: "desc" },
          take: 5,
          select: {
            id: true,
            basliq: true,
            mebleg: true,
            emeliyyat_nov: true,
            yaradildi: true,
          },
        }),
        prisma.tesdiq_telep.count({ where: approvalWhere }),
      ]);
    }

    return {
      myTasks: tasks.map((t) => ({
        id: t.id,
        basliq: t.basliq,
        meta: t.deadline
          ? `Son tarix: ${t.deadline.toLocaleDateString("az-AZ")}`
          : t.prioritet
            ? `Prioritet: ${t.prioritet}`
            : null,
        href: `/tapshiriqlar/${t.id}`,
      })),
      todayReminders: reminders.map((t) => ({
        id: t.id,
        basliq: t.basliq,
        meta: t.xatirlatma
          ? t.xatirlatma.toLocaleString("az-AZ", { dateStyle: "short", timeStyle: "short" })
          : null,
        href: `/tapshiriqlar/${t.id}`,
      })),
      pendingApprovals: approvals.map((a) => ({
        id: String(a.id),
        basliq: a.basliq ?? a.emeliyyat_nov,
        meta: a.mebleg != null ? String(a.mebleg) + " ₼" : null,
        href: `/tesdiq`,
      })),
      canSeeApprovals,
      totals: {
        tasks: tasksTotal,
        reminders: remindersTotal,
        approvals: approvalsTotal,
      },
    };
  });
}

// ============================================================
// AI analiz — işçi performansı
// ============================================================

export type UserTaskPerformance = {
  istifadeci_id: string;
  ad_soyad: string;
  vezife: string | null;
  cemi: number;
  tamamlandi: number;
  icrada: number;
  gecikmis: number;
  tamamlanma_faiz: number;
  orta_bitme_gun: number;
  son_30_gun: number;
};

export async function getTaskPerformanceAnalytics(): Promise<UserTaskPerformance[]> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const users = await prisma.istifadeciler.findMany({
      where: { sahibkar_id: sahibkarId, aktiv: true },
      select: { id: true, ad_soyad: true, vezife: true },
      orderBy: { ad_soyad: "asc" },
    });

    const result: UserTaskPerformance[] = [];

    for (const u of users) {
      const baseWhere = {
        sahibkar_id: sahibkarId,
        OR: [
          { mesul_id: u.id },
          { tapshiriq_iscilier: { some: { istifadeci_id: u.id } } },
        ],
      };

      const [cemi, tamamlandi, icrada, gecikmis, son30, completedTasks] = await Promise.all([
        prisma.tapshiriqlar.count({ where: baseWhere }),
        prisma.tapshiriqlar.count({ where: { ...baseWhere, status: "tamamlandi" } }),
        prisma.tapshiriqlar.count({ where: { ...baseWhere, status: "icrada" } }),
        prisma.tapshiriqlar.count({
          where: { ...baseWhere, deadline: { lt: now }, status: { notIn: ["tamamlandi", "legv"] } },
        }),
        prisma.tapshiriqlar.count({
          where: {
            ...baseWhere,
            status: "tamamlandi",
            tamamlandi_de: { gte: thirtyDaysAgo },
          },
        }),
        prisma.tapshiriqlar.findMany({
          where: {
            ...baseWhere,
            status: "tamamlandi",
            tamamlandi_de: { not: null },
            yaradildi: { not: null },
          },
          select: { yaradildi: true, tamamlandi_de: true },
          take: 100,
        }),
      ]);

      const durations = completedTasks
        .map((t) => {
          if (!t.yaradildi || !t.tamamlandi_de) return null;
          return (t.tamamlandi_de.getTime() - t.yaradildi.getTime()) / (1000 * 60 * 60 * 24);
        })
        .filter((d): d is number => d !== null && d >= 0);
      const ortBitmeGun = durations.length
        ? Math.round((durations.reduce((s, x) => s + x, 0) / durations.length) * 10) / 10
        : 0;
      const faiz = cemi > 0 ? Math.round((tamamlandi / cemi) * 1000) / 10 : 0;

      if (cemi > 0) {
        result.push({
          istifadeci_id: u.id,
          ad_soyad: u.ad_soyad,
          vezife: u.vezife,
          cemi,
          tamamlandi,
          icrada,
          gecikmis,
          tamamlanma_faiz: faiz,
          orta_bitme_gun: ortBitmeGun,
          son_30_gun: son30,
        });
      }
    }

    return result.sort((a, b) => b.tamamlanma_faiz - a.tamamlanma_faiz);
  });
}

// ============================================================
// "Bağlı tapşırıqlar" — obyekt detail tabları üçün
// ============================================================

export async function getTasksForObject(obyektNov: string, obyektId: string): Promise<TaskListItem[]> {
  return withTenant(async () => {
    const links = await prisma.tapshiriq_obyektleri.findMany({
      where: { obyekt_nov: obyektNov, obyekt_id: obyektId },
      select: { tapshiriq_id: true },
      take: 100,
    });
    if (!links.length) return [];
    const ids = links.map((l) => l.tapshiriq_id);
    const rows = await prisma.tapshiriqlar.findMany({
      where: { id: { in: ids } },
      orderBy: { yaradildi: "desc" },
      include: {
        istifadeciler_tapshiriqlar_mesul_idToistifadeciler: { select: { id: true, ad_soyad: true } },
        istifadeciler_tapshiriqlar_yaradan_idToistifadeciler: { select: { id: true, ad_soyad: true } },
        tapshiriq_iscilier: {
          include: { istifadeciler: { select: { id: true, ad_soyad: true } } },
        },
        tapshiriq_checklist: { select: { tamamlandi: true } },
        _count: { select: { tapshiriq_kommentleri: true } },
      },
    });
    return rows.map((t) => {
      const reng = readTag(t.qeyd_daxili, "COLOR");
      const viewersRaw = readTag(t.qeyd_daxili, "VIEWERS");
      const viewers_gizlilik = viewersRaw ? viewersRaw.split("|")[0] : null;
      return {
        id: t.id,
        basliq: t.basliq,
        tesvir: t.tesvir,
        status: t.status ?? "yeni",
        prioritet: t.prioritet ?? "normal",
        tip: t.tip,
        deadline: t.deadline,
        xatirlatma: t.xatirlatma,
        yaradan_id: t.yaradan_id,
        yaradan_ad: t.istifadeciler_tapshiriqlar_yaradan_idToistifadeciler?.ad_soyad ?? "—",
        mesul_id: t.mesul_id,
        mesul_ad: t.istifadeciler_tapshiriqlar_mesul_idToistifadeciler?.ad_soyad ?? null,
        icracilar: t.tapshiriq_iscilier.map((i) => ({
          id: i.istifadeci_id,
          ad_soyad: i.istifadeciler.ad_soyad,
          rol: i.rol ?? "icraci",
        })),
        reng,
        viewers_gizlilik,
        checklist_total: t.tapshiriq_checklist.length,
        checklist_done: t.tapshiriq_checklist.filter((c) => c.tamamlandi).length,
        comment_count: t._count.tapshiriq_kommentleri,
        yaradildi: t.yaradildi,
        tamamlandi_de: t.tamamlandi_de,
      };
    });
  });
}
