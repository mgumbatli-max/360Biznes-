import "server-only";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";

export type AlertSeverity = "info" | "xeber" | "risk" | "kritik";
export type AlertStatus = "yeni" | "baxilir" | "snoozed" | "hell_olundu" | "legv";

export type AlertFilter = {
  search?: string;
  seviyye?: AlertSeverity[];
  status?: AlertStatus[];
  kateqoriya_kod?: string[];
  assigned_to_me?: boolean;
  current_user_id?: string;
};

export type AlertListItem = {
  id: string;
  basliq: string;
  tesvir: string | null;
  seviyye: string;
  status: string;
  kateqoriya_kod: string;
  kateqoriya_ad: string;
  kateqoriya_emoji: string | null;
  kateqoriya_reng: string | null;
  risk_bali: number | null;
  obyekt_nov: string | null;
  obyekt_basliq: string | null;
  assigned_to_ad: string | null;
  first_seen_at: Date | null;
  due_at: Date | null;
  snoozed_until: Date | null;
};

export type AlertStats = {
  open_count: number;
  kritik_count: number;
  snoozed_count: number;
  today_count: number;
  resolved_today_count: number;
};

const OPEN_STATUSES = ["yeni", "baxilir"];

export async function getAlertStats(): Promise<AlertStats> {
  return withTenant(async () => {
    const now = new Date();
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);

    const [open, kritik, snoozed, todayNew, resolvedToday] = await Promise.all([
      prisma.alerts.count({ where: { status: { in: OPEN_STATUSES } } }),
      prisma.alerts.count({
        where: { status: { in: OPEN_STATUSES }, seviyye: "kritik" },
      }),
      prisma.alerts.count({
        where: { status: "snoozed", snoozed_until: { gt: now } },
      }),
      prisma.alerts.count({ where: { first_seen_at: { gte: today } } }),
      prisma.alerts.count({
        where: { status: "hell_olundu", resolved_at: { gte: today } },
      }),
    ]);

    return {
      open_count: open,
      kritik_count: kritik,
      snoozed_count: snoozed,
      today_count: todayNew,
      resolved_today_count: resolvedToday,
    };
  });
}

export async function getAlertCategories() {
  // Global table, not tenant-scoped — use a separate unscoped read.
  const rows = await prisma.alert_categories.findMany({
    where: { aktiv: true },
    orderBy: [{ siralama: "asc" }, { ad: "asc" }],
  });
  return rows;
}

/** Severity priority for sorting — kritik (highest) → info (lowest). */
const SEVERITY_RANK: Record<string, number> = {
  kritik: 4,
  yuksek: 3,
  risk: 2,
  xeber: 2,
  info: 1,
};

export async function getAlerts(
  filter: AlertFilter,
  page = 1,
  pageSize = 25
): Promise<{ items: AlertListItem[]; total: number }> {
  return withTenant(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};
    if (filter.seviyye?.length) where.seviyye = { in: filter.seviyye };
    if (filter.status?.length) where.status = { in: filter.status };
    if (filter.kateqoriya_kod?.length) where.kateqoriya_kod = { in: filter.kateqoriya_kod };
    if (filter.assigned_to_me && filter.current_user_id) where.assigned_to = filter.current_user_id;
    if (filter.search) {
      const q = filter.search.trim();
      where.OR = [
        { basliq: { contains: q, mode: "insensitive" } },
        { tesvir: { contains: q, mode: "insensitive" } },
        { obyekt_basliq: { contains: q, mode: "insensitive" } },
      ];
    }

    // Fetch a larger window so we can re-sort by severity rank manually,
    // since lexicographic sort on "seviyye" doesn't reflect priority.
    const fetchSize = Math.max(pageSize * 3, 75);
    const [rawItems, total] = await Promise.all([
      prisma.alerts.findMany({
        where,
        orderBy: [{ status: "asc" }, { first_seen_at: "desc" }],
        take: fetchSize,
        include: {
          alert_categories: { select: { ad: true, emoji: true, reng: true } },
          istifadeciler_alerts_assigned_toToistifadeciler: { select: { ad_soyad: true } },
        },
      }),
      prisma.alerts.count({ where }),
    ]);

    // Sort: open status first, then critical → info, then newest first
    const STATUS_RANK: Record<string, number> = { yeni: 0, baxilir: 1, snoozed: 2, hell_olundu: 3, legv: 4 };
    rawItems.sort((a, b) => {
      const sa = STATUS_RANK[a.status] ?? 99;
      const sb = STATUS_RANK[b.status] ?? 99;
      if (sa !== sb) return sa - sb;
      const ra = SEVERITY_RANK[a.seviyye] ?? 0;
      const rb = SEVERITY_RANK[b.seviyye] ?? 0;
      if (ra !== rb) return rb - ra;
      const ta = a.first_seen_at?.getTime() ?? 0;
      const tb = b.first_seen_at?.getTime() ?? 0;
      return tb - ta;
    });

    const items = rawItems.slice((page - 1) * pageSize, page * pageSize);

    return {
      items: items.map((a) => ({
        id: a.id,
        basliq: a.basliq,
        tesvir: a.tesvir,
        seviyye: a.seviyye,
        status: a.status,
        kateqoriya_kod: a.kateqoriya_kod,
        kateqoriya_ad: a.alert_categories.ad,
        kateqoriya_emoji: a.alert_categories.emoji,
        kateqoriya_reng: a.alert_categories.reng,
        risk_bali: a.risk_bali,
        obyekt_nov: a.obyekt_nov,
        obyekt_basliq: a.obyekt_basliq,
        assigned_to_ad: a.istifadeciler_alerts_assigned_toToistifadeciler?.ad_soyad ?? null,
        first_seen_at: a.first_seen_at,
        due_at: a.due_at,
        snoozed_until: a.snoozed_until,
      })),
      total,
    };
  });
}

/** Grouped by category. Used for the "Qruplaşdırılmış" view. */
export type AlertGroup = {
  kateqoriya_kod: string;
  kateqoriya_ad: string;
  kateqoriya_emoji: string | null;
  kateqoriya_reng: string | null;
  qrup: string | null;
  count: number;
  kritik_count: number;
  items: AlertListItem[];
};

export async function getAlertsGrouped(filter: AlertFilter): Promise<AlertGroup[]> {
  const { items } = await getAlerts(filter, 1, 500);
  const cats = await getAlertCategories();
  const catMeta = new Map(cats.map((c) => [c.kod, { qrup: c.qrup, siralama: c.siralama ?? 0 }]));

  const groups = new Map<string, AlertGroup>();
  for (const a of items) {
    let g = groups.get(a.kateqoriya_kod);
    if (!g) {
      g = {
        kateqoriya_kod: a.kateqoriya_kod,
        kateqoriya_ad: a.kateqoriya_ad,
        kateqoriya_emoji: a.kateqoriya_emoji,
        kateqoriya_reng: a.kateqoriya_reng,
        qrup: catMeta.get(a.kateqoriya_kod)?.qrup ?? null,
        count: 0,
        kritik_count: 0,
        items: [],
      };
      groups.set(a.kateqoriya_kod, g);
    }
    g.count++;
    if (a.seviyye === "kritik" || a.seviyye === "yuksek") g.kritik_count++;
    g.items.push(a);
  }

  return Array.from(groups.values()).sort((a, b) => {
    if (a.kritik_count !== b.kritik_count) return b.kritik_count - a.kritik_count;
    return b.count - a.count;
  });
}

/** Single alert with full detail for the detail page. */
export async function getAlertDetail(id: string) {
  return withTenant(async () => {
    const alert = await prisma.alerts.findUnique({
      where: { id },
      include: {
        alert_categories: { select: { ad: true, emoji: true, reng: true, qrup: true } },
        istifadeciler_alerts_assigned_toToistifadeciler: { select: { id: true, ad_soyad: true, email: true } },
        istifadeciler_alerts_resolved_byToistifadeciler: { select: { id: true, ad_soyad: true } },
        alert_comments: {
          orderBy: { yaradildi: "desc" },
          include: { istifadeciler: { select: { ad_soyad: true } } },
        },
        alert_escalations: {
          orderBy: { yaradildi: "desc" },
          include: {
            istifadeciler_alert_escalations_escalated_byToistifadeciler: { select: { ad_soyad: true } },
            istifadeciler_alert_escalations_escalated_toToistifadeciler: { select: { ad_soyad: true } },
          },
        },
      },
    });
    return alert;
  });
}
