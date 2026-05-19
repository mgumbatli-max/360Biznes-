import "server-only";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";

export type DavamFilter = {
  istifadeci_id?: string;
  month?: string;
  status?: string;
};

export type ShiftKey = "seher" | "axsam" | "gece";

export const SHIFTS: Record<ShiftKey, { label: string; start: string; end: string }> = {
  seher: { label: "Səhər (08–16)", start: "08:00", end: "16:00" },
  axsam: { label: "Axşam (16–24)", start: "16:00", end: "00:00" },
  gece: { label: "Gecə (00–08)", start: "00:00", end: "08:00" },
};

/** Reads structured shift/break/overtime info from row.qeyd if encoded as JSON-with-prefix. */
function parseMeta(qeyd: string | null): {
  text: string | null;
  shift: ShiftKey | null;
  fasile_dq: number;
  overtime_dq: number;
} {
  if (!qeyd) return { text: null, shift: null, fasile_dq: 0, overtime_dq: 0 };
  const marker = "##META:";
  const idx = qeyd.indexOf(marker);
  if (idx < 0) return { text: qeyd, shift: null, fasile_dq: 0, overtime_dq: 0 };
  const text = qeyd.slice(0, idx).trim() || null;
  try {
    const raw = qeyd.slice(idx + marker.length);
    const json = JSON.parse(raw);
    return {
      text,
      shift: (json.shift ?? null) as ShiftKey | null,
      fasile_dq: Number(json.fasile_dq ?? 0),
      overtime_dq: Number(json.overtime_dq ?? 0),
    };
  } catch {
    return { text, shift: null, fasile_dq: 0, overtime_dq: 0 };
  }
}

export function encodeMeta(args: {
  qeyd?: string | null;
  shift?: ShiftKey | null;
  fasile_dq?: number;
  overtime_dq?: number;
}): string {
  const text = (args.qeyd ?? "").trim();
  const meta = {
    shift: args.shift ?? null,
    fasile_dq: Number(args.fasile_dq ?? 0),
    overtime_dq: Number(args.overtime_dq ?? 0),
  };
  if (!meta.shift && !meta.fasile_dq && !meta.overtime_dq) return text;
  return (text ? text + " " : "") + "##META:" + JSON.stringify(meta);
}

function parseMonthRange(monthStr?: string): { start: Date; end: Date; il: number; ay: number } {
  let il: number;
  let ay: number;
  if (monthStr) {
    const [y, m] = monthStr.split("-").map(Number);
    il = y;
    ay = m;
  } else {
    const d = new Date();
    il = d.getFullYear();
    ay = d.getMonth() + 1;
  }
  return {
    il,
    ay,
    start: new Date(il, ay - 1, 1),
    end: new Date(il, ay, 1),
  };
}

export async function getDavamiyyetData(filter: DavamFilter = {}) {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const { start, end, il, ay } = parseMonthRange(filter.month);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = { sahibkar_id: sahibkarId, tarix: { gte: start, lt: end } };
    if (filter.istifadeci_id) where.istifadeci_id = filter.istifadeci_id;
    if (filter.status && filter.status !== "all") where.status = filter.status;

    const [rows, employees, leaveRows] = await Promise.all([
      prisma.davamiyyet.findMany({
        where,
        orderBy: [{ tarix: "desc" }, { istifadeci_id: "asc" }],
        include: {
          istifadeciler_davamiyyet_istifadeci_idToistifadeciler: {
            select: { id: true, ad_soyad: true, vezife: true },
          },
        },
      }),
      prisma.istifadeciler.findMany({
        where: { aktiv: true, isden_cixdi: null, sahibkar_id: sahibkarId },
        select: { id: true, ad_soyad: true, vezife: true },
        orderBy: { ad_soyad: "asc" },
      }),
      prisma.isci_mezuniyyet
        .findMany({
          where: {
            sahibkar_id: sahibkarId,
            status: "tesdiq",
            OR: [
              { baslama: { gte: start, lt: end } },
              { bitme: { gte: start, lt: end } },
              { AND: [{ baslama: { lt: start } }, { bitme: { gte: end } }] },
            ],
          },
          select: { istifadeci_id: true, baslama: true, bitme: true },
        })
        .catch(() => []),
    ]);

    // Build leave overlay
    const leaveByUser = new Map<string, Set<number>>();
    for (const lv of leaveRows) {
      const set = leaveByUser.get(lv.istifadeci_id) ?? new Set<number>();
      const lvStart = new Date(Math.max(lv.baslama.getTime(), start.getTime()));
      const lvEnd = new Date(Math.min(lv.bitme.getTime(), end.getTime() - 1));
      for (let d = new Date(lvStart); d <= lvEnd; d.setDate(d.getDate() + 1)) {
        if (d.getMonth() === ay - 1) set.add(d.getDate());
      }
      leaveByUser.set(lv.istifadeci_id, set);
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // KPI calcs
    const total_qeyd = rows.length;
    const gec = rows.filter((r) => (r.gec_dq ?? 0) > 0).length;
    const qaib = rows.filter((r) => r.status === "qaib" || !r.giris_saat).length;
    const vaxtinda = rows.filter((r) => r.giris_saat && (r.gec_dq ?? 0) === 0).length;

    const rowList = rows.map((r) => {
      const meta = parseMeta(r.qeyd);
      return {
        id: r.id.toString(),
        tarix: r.tarix,
        istifadeci_id: r.istifadeci_id,
        istifadeci_ad: r.istifadeciler_davamiyyet_istifadeci_idToistifadeciler?.ad_soyad ?? "—",
        vezife: r.istifadeciler_davamiyyet_istifadeci_idToistifadeciler?.vezife ?? null,
        giris: r.giris_saat,
        cixis: r.cixis_saat,
        gozlenen_giris: r.gozlenen_giris,
        gozlenen_cixis: r.gozlenen_cixis,
        gec_dq: r.gec_dq ?? 0,
        ish_saatlari: r.ish_saatlari ? Number(r.ish_saatlari) : null,
        status: (r.status ?? "qaydasinda") as string,
        qeyd: meta.text,
        shift: meta.shift,
        fasile_dq: meta.fasile_dq,
        overtime_dq: meta.overtime_dq,
      };
    });

    // ==================== Aylıq report (per istifadeci) ====================
    const employeeReportMap = new Map<
      string,
      {
        istifadeci_id: string;
        ad_soyad: string;
        vezife: string | null;
        ish_gun: number;
        qaib_gun: number;
        gec_dq: number;
        overtime_dq: number;
        fasile_dq: number;
        ish_saat: number;
      }
    >();
    for (const e of employees) {
      employeeReportMap.set(e.id, {
        istifadeci_id: e.id,
        ad_soyad: e.ad_soyad,
        vezife: e.vezife,
        ish_gun: 0,
        qaib_gun: 0,
        gec_dq: 0,
        overtime_dq: 0,
        fasile_dq: 0,
        ish_saat: 0,
      });
    }
    for (const r of rowList) {
      const rep = employeeReportMap.get(r.istifadeci_id);
      if (!rep) continue;
      if (r.status === "qaib") rep.qaib_gun++;
      else if (r.status !== "istirahet" && r.status !== "mezuniyyet") rep.ish_gun++;
      rep.gec_dq += r.gec_dq;
      rep.overtime_dq += r.overtime_dq;
      rep.fasile_dq += r.fasile_dq;
      if (r.ish_saatlari) rep.ish_saat += r.ish_saatlari;
    }
    const reportRows = Array.from(employeeReportMap.values()).sort((a, b) =>
      a.ad_soyad.localeCompare(b.ad_soyad),
    );

    // Day grid
    const daysInMonth = new Date(il, ay, 0).getDate();
    const grid: Array<{
      istifadeci_id: string;
      ad_soyad: string;
      vezife: string | null;
      days: Array<{ d: number; status: "present" | "late" | "absent" | "off" | "future" | "leave" }>;
    }> = employees.map((e) => {
      const days: { d: number; status: "present" | "late" | "absent" | "off" | "future" | "leave" }[] = [];
      const leaveDays = leaveByUser.get(e.id) ?? new Set<number>();
      for (let d = 1; d <= daysInMonth; d++) {
        const dt = new Date(il, ay - 1, d);
        const dow = dt.getDay();
        const isWeekend = dow === 0 || dow === 6;
        if (dt > today) {
          days.push({ d, status: leaveDays.has(d) ? "leave" : "future" });
          continue;
        }
        if (leaveDays.has(d)) {
          days.push({ d, status: "leave" });
          continue;
        }
        const row = rows.find(
          (r) => r.istifadeci_id === e.id && new Date(r.tarix).getDate() === d,
        );
        if (row) {
          if (row.status === "qaib") days.push({ d, status: "absent" });
          else if (row.status === "mezuniyyet") days.push({ d, status: "leave" });
          else if ((row.gec_dq ?? 0) > 0) days.push({ d, status: "late" });
          else days.push({ d, status: "present" });
        } else if (isWeekend) {
          days.push({ d, status: "off" });
        } else {
          days.push({ d, status: "absent" });
        }
      }
      return { istifadeci_id: e.id, ad_soyad: e.ad_soyad, vezife: e.vezife, days };
    });

    return {
      month: { il, ay, daysInMonth },
      rows: rowList,
      employees,
      grid,
      kpi: { total_qeyd, gec, qaib, vaxtinda },
      report: reportRows,
    };
  });
}
