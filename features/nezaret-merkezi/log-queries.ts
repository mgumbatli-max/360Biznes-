import "server-only";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";

export type UnifiedLogEntry = {
  id: string;
  source: "automation" | "approval" | "alert";
  timestamp: Date | null;
  title: string;
  detail: string | null;
  user: string | null;
  status: "ok" | "xeta" | "info";
  link: string;
  badges: { label: string; tone: "primary" | "amber" | "emerald" | "rose" | "neutral" }[];
};

type LogFilter = {
  source?: "automation" | "approval" | "alert" | "all";
  status?: "ok" | "xeta" | "all";
  q?: string;
  limit?: number;
};

const STATUS_TONE: Record<string, "emerald" | "rose" | "amber" | "primary"> = {
  ok: "emerald",
  ugur: "emerald",
  ugurlu: "emerald",
  tesdiq: "emerald",
  yarat: "primary",
  yaradildi: "primary",
  auto_tesdiq: "emerald",
  xeta: "rose",
  ugursuz: "rose",
  red: "rose",
  redd_edildi: "rose",
  legv: "rose",
  legv_edildi: "rose",
  xeberdarliq: "amber",
};

export async function getUnifiedLog(f: LogFilter = {}): Promise<UnifiedLogEntry[]> {
  const limit = f.limit ?? 80;
  const includeAuto = !f.source || f.source === "all" || f.source === "automation";
  const includeApproval = !f.source || f.source === "all" || f.source === "approval";
  const includeAlert = !f.source || f.source === "all" || f.source === "alert";

  return withTenant(async () => {
    const out: UnifiedLogEntry[] = [];

    if (includeAuto) {
      const autoLogs = await prisma.avto_log.findMany({
        orderBy: { yaradildi: "desc" },
        take: limit,
        include: { avto_qayda: { select: { ad: true, modul: true, id: true } } },
      });
      for (const l of autoLogs) {
        const sm = l.shert_match as { matched?: number; target?: string; dry_run?: boolean } | null;
        const status = (l.status === "ok" ? "ok" : "xeta") as "ok" | "xeta";
        out.push({
          id: `auto-${l.id}`,
          source: "automation",
          timestamp: l.yaradildi,
          title: l.avto_qayda?.ad ?? "—",
          detail: l.xeta_metn ?? (sm?.matched != null ? `${sm.matched} ${sm.target ?? "obyekt"} uyğun gəldi` : null),
          user: null,
          status,
          link: l.qayda_id ? `/avtomatlasdirma/${l.qayda_id}` : "/avtomatlasdirma",
          badges: [
            { label: "Avtomatlaşdırma", tone: "primary" },
            ...(l.trigger_kod ? [{ label: l.trigger_kod, tone: "neutral" as const }] : []),
            ...(sm?.dry_run ? [{ label: "TEST", tone: "amber" as const }] : []),
          ],
        });
      }
    }

    if (includeApproval) {
      const approvalLogs = await prisma.tesdiq_log.findMany({
        orderBy: { yaradildi: "desc" },
        take: limit,
        include: {
          istifadeciler: { select: { ad_soyad: true } },
          tesdiq_telep: { select: { id: true, basliq: true, emeliyyat_nov: true } },
        },
      });
      for (const l of approvalLogs) {
        const op = l.emeliyyat ?? "yaradildi";
        const isError = op.includes("red") || op.includes("legv");
        const status = isError ? "xeta" : "ok";
        const STATUS_LABEL: Record<string, string> = {
          yaradildi: "Yaradıldı",
          auto_tesdiq: "Auto-təsdiq",
          tesdiqlendi: "Təsdiqləndi",
          redd_edildi: "Rədd edildi",
          legv_edildi: "Ləğv edildi",
          bulk_tesdiq: "Bulk təsdiq",
          bulk_red: "Bulk rədd",
          qeyd: "Qeyd",
        };
        out.push({
          id: `tesdiq-${l.id}`,
          source: "approval",
          timestamp: l.yaradildi,
          title: l.tesdiq_telep?.basliq ?? l.tesdiq_telep?.emeliyyat_nov ?? "Təsdiq sorğusu",
          detail: l.qeyd ?? null,
          user: l.istifadeciler?.ad_soyad ?? null,
          status,
          link: l.tesdiq_telep ? `/tesdiq/${l.tesdiq_telep.id}` : "/tesdiq",
          badges: [
            { label: "Təsdiq", tone: "emerald" },
            { label: STATUS_LABEL[op] ?? op, tone: STATUS_TONE[op] ?? "neutral" },
          ],
        });
      }
    }

    if (includeAlert) {
      // Treat alert resolutions and escalations as log entries
      const [resolved, escalated, comments] = await Promise.all([
        prisma.alerts.findMany({
          where: { status: "hell_olundu", resolved_at: { not: null } },
          orderBy: { resolved_at: "desc" },
          take: Math.floor(limit / 3),
          include: {
            istifadeciler_alerts_resolved_byToistifadeciler: { select: { ad_soyad: true } },
            alert_categories: { select: { ad: true, emoji: true } },
          },
        }),
        prisma.alert_escalations.findMany({
          orderBy: { yaradildi: "desc" },
          take: Math.floor(limit / 3),
          include: {
            istifadeciler_alert_escalations_escalated_byToistifadeciler: { select: { ad_soyad: true } },
            alerts: { select: { id: true, basliq: true } },
          },
        }),
        prisma.alert_comments.findMany({
          orderBy: { yaradildi: "desc" },
          take: Math.floor(limit / 3),
          include: {
            istifadeciler: { select: { ad_soyad: true } },
            alerts: { select: { id: true, basliq: true } },
          },
        }),
      ]);

      for (const r of resolved) {
        out.push({
          id: `alert-resolved-${r.id}`,
          source: "alert",
          timestamp: r.resolved_at,
          title: r.basliq,
          detail: r.resolution_note ?? null,
          user: r.istifadeciler_alerts_resolved_byToistifadeciler?.ad_soyad ?? null,
          status: "ok",
          link: `/xeberdarliqlar/${r.id}`,
          badges: [
            { label: "Xəbərdarlıq", tone: "amber" },
            { label: "Həll olundu", tone: "emerald" },
          ],
        });
      }
      for (const e of escalated) {
        out.push({
          id: `alert-esc-${e.id}`,
          source: "alert",
          timestamp: e.yaradildi,
          title: e.alerts?.basliq ?? "Xəbərdarlıq",
          detail: e.sebeb ?? null,
          user: e.istifadeciler_alert_escalations_escalated_byToistifadeciler?.ad_soyad ?? null,
          status: "ok",
          link: e.alert_id ? `/xeberdarliqlar/${e.alert_id}` : "/xeberdarliqlar",
          badges: [
            { label: "Xəbərdarlıq", tone: "amber" },
            { label: "Eskalasiya", tone: "rose" },
          ],
        });
      }
      for (const c of comments) {
        out.push({
          id: `alert-cmt-${c.id}`,
          source: "alert",
          timestamp: c.yaradildi,
          title: c.alerts?.basliq ?? "Xəbərdarlıq",
          detail: c.metn.length > 100 ? c.metn.slice(0, 100) + "…" : c.metn,
          user: c.istifadeciler?.ad_soyad ?? null,
          status: "ok",
          link: c.alert_id ? `/xeberdarliqlar/${c.alert_id}` : "/xeberdarliqlar",
          badges: [
            { label: "Xəbərdarlıq", tone: "amber" },
            { label: "Qeyd", tone: "primary" },
          ],
        });
      }
    }

    // Sort all by timestamp DESC
    out.sort((a, b) => (b.timestamp?.getTime() ?? 0) - (a.timestamp?.getTime() ?? 0));

    // Apply text filter + status filter + slice
    let filtered = out;
    if (f.status && f.status !== "all") {
      filtered = filtered.filter((e) => e.status === f.status);
    }
    if (f.q) {
      const q = f.q.toLowerCase();
      filtered = filtered.filter((e) =>
        e.title.toLowerCase().includes(q) ||
        (e.detail ?? "").toLowerCase().includes(q) ||
        (e.user ?? "").toLowerCase().includes(q)
      );
    }
    return filtered.slice(0, limit);
  });
}
