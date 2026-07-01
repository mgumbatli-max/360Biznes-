"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { audit } from "@/lib/audit/log";
import { requireAyarActionPerm, bustAyarCache } from "./access-guard";

type ActionResult<T = unknown> = { ok: true; data?: T } | { ok: false; error: string };

// ============================================================
// YENİ FUNKSIONALLIQ — Ayar timeline + export/import + diff
// ============================================================

/**
 * 1) Ayar dəyişikliyi timeline — son 30 gün sahibkar üçün ayar audit-i.
 */
export type SettingsTimelineEntry = {
  ts: Date;
  emeliyyat: string;
  resurs_nov: string;
  resurs_id: string | null;
  istifadeci_ad: string | null;
  sebeb: string | null;
};

export async function auditSettingsTimeline(
  days = 30,
): Promise<ActionResult<{ events: SettingsTimelineEntry[] }>> {
  const permCheck = await requireAyarActionPerm("ayar.idare");
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  return withTenant(async () => {
    try {
      const since = new Date(Date.now() - Math.min(365, Math.max(1, days)) * 86400_000);
      const rows = await prisma.audit_log.findMany({
        where: {
          yaradildi: { gte: since },
          OR: [
            { resurs_nov: { startsWith: "ayar" } },
            { resurs_nov: { contains: "_ayar" } },
            { resurs_nov: { in: [
              "api_key", "backup", "telegram_ayar", "email_ayar",
              "mp_komisyon", "qiymet_novu", "discount_threshold",
              "borc_avto_ayar", "xerc_kateqoriya", "risk_qayda",
              "rol_icaze", "rol",
            ] } },
          ],
        },
        include: { istifadeciler: { select: { ad_soyad: true } } },
        orderBy: { yaradildi: "desc" },
        take: 200,
      });
      return {
        ok: true,
        data: {
          events: rows.map((r) => ({
            ts: r.yaradildi ?? new Date(),
            emeliyyat: r.emeliyyat,
            resurs_nov: r.resurs_nov,
            resurs_id: r.resurs_id,
            istifadeci_ad: r.istifadeciler?.ad_soyad ?? null,
            sebeb: r.sebeb,
          })),
        },
      };
    } catch (e) {
      console.error("[auditSettingsTimeline]", e);
      const msg = e instanceof Error ? e.message : "naməlum səhv";
      return { ok: false, error: `Alınmadı: ${msg}` };
    }
  });
}

/**
 * 2) Bütün ayarları JSON export — backup məqsədli.
 * Sensitive (telegram/email config, api_key hash) maskalanır.
 */
export async function exportSettings(): Promise<ActionResult<{ json: string; count: number; timestamp: string }>> {
  const permCheck = await requireAyarActionPerm("ayar.idare");
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    try {
      const rows = await prisma.ayarlar.findMany({
        where: { sahibkar_id: sahibkarId },
        orderBy: [{ qrup: "asc" }, { acar: "asc" }],
      });
      // Sensitive ayarları mask et
      const SENSITIVE_QRUPS = new Set(["telegram", "email", "smtp", "bank", "marketplace"]);
      const data = rows.map((r) => {
        const isSensitive = SENSITIVE_QRUPS.has(r.qrup);
        return {
          qrup: r.qrup,
          acar: r.acar,
          deyer: isSensitive ? "***SENSITIVE***" : r.deyer,
          nov: r.nov,
          tesvir: r.tesvir,
        };
      });
      const timestamp = new Date().toISOString();
      const json = JSON.stringify({
        meta: { sahibkar_id: sahibkarId, exported_at: timestamp, count: data.length },
        ayarlar: data,
      }, null, 2);
      await audit("export", "ayar", null, {
        yeni_data: { count: data.length, sensitive_masked: true },
        sebeb: "Ayarlar JSON export",
      });
      return { ok: true, data: { json, count: data.length, timestamp } };
    } catch (e) {
      console.error("[exportSettings]", e);
      const msg = e instanceof Error ? e.message : "naməlum səhv";
      return { ok: false, error: `Export alınmadı: ${msg}` };
    }
  });
}

/**
 * 3) JSON ayarları idxal — dry_run mode-da yalnız diff göstərir.
 */
const ImportSchema = z.object({
  json: z.string().min(2),
  dry_run: z.boolean().default(true),
});

export type ImportResult = {
  toplam: number;
  yeniler: { qrup: string; acar: string }[];
  deyisenler: { qrup: string; acar: string; from: string | null; to: string }[];
  atilanlar: { qrup: string; acar: string; reason: string }[];
  applied: boolean;
};

export async function importSettings(
  input: z.input<typeof ImportSchema>,
): Promise<ActionResult<ImportResult>> {
  const permCheck = await requireAyarActionPerm("ayar.idare");
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  const parsed = ImportSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Yanlış format" };
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    try {
      const data = JSON.parse(parsed.data.json);
      if (!data || !Array.isArray(data.ayarlar)) {
        return { ok: false, error: "JSON formatı yanlışdır (ayarlar array gözlənilir)" };
      }
      const incoming = data.ayarlar as Array<{ qrup: string; acar: string; deyer: string | null; nov?: string | null }>;
      // Sensitive group-ları atla (encrypted token-lar yenidən idxal olunmamalıdır)
      const SENSITIVE_QRUPS = new Set(["telegram", "email", "smtp", "bank", "marketplace"]);

      const existing = await prisma.ayarlar.findMany({
        where: { sahibkar_id: sahibkarId },
        select: { qrup: true, acar: true, deyer: true },
      });
      const exMap = new Map<string, string | null>();
      for (const r of existing) exMap.set(`${r.qrup}:${r.acar}`, r.deyer);

      const yeniler: { qrup: string; acar: string }[] = [];
      const deyisenler: { qrup: string; acar: string; from: string | null; to: string }[] = [];
      const atilanlar: { qrup: string; acar: string; reason: string }[] = [];

      for (const r of incoming) {
        if (!r.qrup || !r.acar) {
          atilanlar.push({ qrup: r.qrup ?? "?", acar: r.acar ?? "?", reason: "qrup/acar boşdur" });
          continue;
        }
        if (SENSITIVE_QRUPS.has(r.qrup)) {
          atilanlar.push({ qrup: r.qrup, acar: r.acar, reason: "sensitive — atlandı" });
          continue;
        }
        if (r.deyer === "***SENSITIVE***") {
          atilanlar.push({ qrup: r.qrup, acar: r.acar, reason: "mask göstərici" });
          continue;
        }
        const key = `${r.qrup}:${r.acar}`;
        const oldVal = exMap.get(key);
        if (oldVal == null) {
          yeniler.push({ qrup: r.qrup, acar: r.acar });
        } else if (oldVal !== r.deyer) {
          deyisenler.push({ qrup: r.qrup, acar: r.acar, from: oldVal, to: r.deyer ?? "" });
        }
      }

      // Dry-run isə tətbiq etmə
      if (parsed.data.dry_run) {
        return {
          ok: true,
          data: {
            toplam: incoming.length,
            yeniler,
            deyisenler,
            atilanlar,
            applied: false,
          },
        };
      }

      // Real tətbiq
      for (const r of incoming) {
        if (!r.qrup || !r.acar || r.deyer === "***SENSITIVE***" || SENSITIVE_QRUPS.has(r.qrup)) continue;
        await prisma.ayarlar.upsert({
          where: { sahibkar_id_qrup_acar: { sahibkar_id: sahibkarId, qrup: r.qrup, acar: r.acar } },
          create: { sahibkar_id: sahibkarId, qrup: r.qrup, acar: r.acar, deyer: r.deyer, nov: r.nov ?? "string" },
          update: { deyer: r.deyer, yenilendi: new Date() },
        });
      }
      revalidatePath("/ayarlar");
      bustAyarCache();
      await audit("idxal", "ayar", null, {
        yeni_data: { toplam: incoming.length, yeni: yeniler.length, deyisen: deyisenler.length, atilan: atilanlar.length },
        sebeb: "Ayarlar JSON idxal",
      });
      return {
        ok: true,
        data: {
          toplam: incoming.length,
          yeniler,
          deyisenler,
          atilanlar,
          applied: true,
        },
      };
    } catch (e) {
      console.error("[importSettings]", e);
      const msg = e instanceof Error ? e.message : "naməlum səhv";
      return { ok: false, error: `İdxal alınmadı: ${msg}` };
    }
  });
}

/**
 * 4) Verilmiş tarixdən sonra dəyişən ayarlar siyahısı.
 */
export async function getSettingsDiff(
  since: string,
): Promise<ActionResult<{ count: number; changes: { qrup: string; acar: string; yenilendi: Date | null }[] }>> {
  const permCheck = await requireAyarActionPerm("ayar.idare");
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  const sinceDate = new Date(since);
  if (Number.isNaN(sinceDate.getTime())) return { ok: false, error: "Tarix yanlışdır" };
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    try {
      const rows = await prisma.ayarlar.findMany({
        where: { sahibkar_id: sahibkarId, yenilendi: { gte: sinceDate } },
        select: { qrup: true, acar: true, yenilendi: true },
        orderBy: { yenilendi: "desc" },
      });
      return {
        ok: true,
        data: {
          count: rows.length,
          changes: rows.map((r) => ({ qrup: r.qrup, acar: r.acar, yenilendi: r.yenilendi })),
        },
      };
    } catch (e) {
      console.error("[getSettingsDiff]", e);
      const msg = e instanceof Error ? e.message : "naməlum səhv";
      return { ok: false, error: `Alınmadı: ${msg}` };
    }
  });
}

/**
 * 5) API key istifadə statistikası — son 30 gün.
 */
export async function getApiKeyUsage(
  keyId: string,
): Promise<ActionResult<{ id: string; ad: string; istifade_sayi: number; son_istifade: Date | null }>> {
  const permCheck = await requireAyarActionPerm("ayar.api_key");
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  return withTenant(async () => {
    try {
      const k = await prisma.api_keys.findFirst({
        where: { id: keyId },
        select: { id: true, ad: true, istifade_sayi: true, son_istifade: true },
      });
      if (!k) return { ok: false, error: "API açar tapılmadı" };
      return {
        ok: true,
        data: {
          id: k.id,
          ad: k.ad,
          istifade_sayi: k.istifade_sayi ?? 0,
          son_istifade: k.son_istifade,
        },
      };
    } catch (e) {
      console.error("[getApiKeyUsage]", e);
      const msg = e instanceof Error ? e.message : "naməlum səhv";
      return { ok: false, error: `Alınmadı: ${msg}` };
    }
  });
}

/**
 * 6) Bütün API açarlarını revoke et (təcili əməliyyat).
 */
export async function rotateAllApiKeys(): Promise<ActionResult<{ revoked: number }>> {
  const permCheck = await requireAyarActionPerm("ayar.api_key");
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    try {
      const r = await prisma.api_keys.updateMany({
        where: { sahibkar_id: sahibkarId, aktiv: true },
        data: { aktiv: false },
      });
      revalidatePath("/ayarlar/webhook-api");
      bustAyarCache();
      // 🔥 Bu kritik təcili əməliyyatdır — audit məcburi
      await audit("toplu_revoke", "api_key", null, {
        yeni_data: { revoked: r.count },
        sebeb: "Bütün API açarları təcili revoke edildi",
      });
      return { ok: true, data: { revoked: r.count } };
    } catch (e) {
      console.error("[rotateAllApiKeys]", e);
      const msg = e instanceof Error ? e.message : "naməlum səhv";
      return { ok: false, error: `Alınmadı: ${msg}` };
    }
  });
}

/**
 * 7) Subscription downgrade impact preview — neçə user/məhsul limiti aşır.
 */
export async function previewSubscriptionDowngrade(
  newPlanId: number,
): Promise<ActionResult<{
  current_users: number;
  current_products: number;
  current_warehouses: number;
  yeni_plan_ad: string | null;
  asib_olan: { resurs: string; mövcud: number; limit: number; asma: number }[];
}>> {
  const permCheck = await requireAyarActionPerm("ayar.abune");
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  return withTenant(async () => {
    try {
      const [plan, users, products, warehouses] = await Promise.all([
        prisma.abune_planlari.findUnique({ where: { id: newPlanId } }).catch(() => null),
        prisma.istifadeciler.count({ where: { aktiv: true } }),
        prisma.mehsullar.count({ where: { aktiv: true } }),
        prisma.anbarlar.count({ where: { aktiv: true } }),
      ]);
      const asib: { resurs: string; mövcud: number; limit: number; asma: number }[] = [];
      if (plan) {
        // Schema-uyğun sahə adları (audit #15) — əvvəl max_isci/max_anbar
        // yazılmışdı (schema-da yoxdur), `as unknown` cast səhvi gizlədib limit
        // yoxlamasını dead-code etmişdi. Anbar limiti schema-da mövcud deyil.
        const isciLimit = Number(plan.max_istifadeci ?? 0);
        const mehsulLimit = Number(plan.max_mehsul ?? 0);
        if (isciLimit > 0 && users > isciLimit) {
          asib.push({ resurs: "İstifadəçi", mövcud: users, limit: isciLimit, asma: users - isciLimit });
        }
        if (mehsulLimit > 0 && products > mehsulLimit) {
          asib.push({ resurs: "Məhsul", mövcud: products, limit: mehsulLimit, asma: products - mehsulLimit });
        }
      }
      return {
        ok: true,
        data: {
          current_users: users,
          current_products: products,
          current_warehouses: warehouses,
          yeni_plan_ad: plan?.ad ?? null,
          asib_olan: asib,
        },
      };
    } catch (e) {
      console.error("[previewSubscriptionDowngrade]", e);
      const msg = e instanceof Error ? e.message : "naməlum səhv";
      return { ok: false, error: `Alınmadı: ${msg}` };
    }
  });
}

/**
 * 8) Settings dashboard — sahibkar üçün ümumi statistika.
 */
export type SettingsDashboard = {
  api_keys_active: number;
  webhook_endpoints_active: number;
  last_backup: Date | null;
  son_ayar_dəyişikliyi: Date | null;
  inteqrasiya_say: number;
};

export async function getSettingsDashboard(): Promise<ActionResult<SettingsDashboard>> {
  const permCheck = await requireAyarActionPerm("ayar.idare");
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    try {
      const [apiKeys, webhooks, lastBackup, lastAyar, inteqrasiya] = await Promise.all([
        prisma.api_keys.count({ where: { sahibkar_id: sahibkarId, aktiv: true } }),
        prisma.webhook_endpoints.count({ where: { aktiv: true } }),
        prisma.backups.findFirst({
          where: { sahibkar_id: sahibkarId, status: "tamamlandi" },
          orderBy: { yaradildi: "desc" },
          select: { yaradildi: true },
        }),
        prisma.ayarlar.findFirst({
          where: { sahibkar_id: sahibkarId },
          orderBy: { yenilendi: "desc" },
          select: { yenilendi: true },
        }),
        prisma.ayarlar.count({
          where: { sahibkar_id: sahibkarId, qrup: { in: ["telegram", "email", "smtp", "mp_komisyon", "marketplace"] } },
        }),
      ]);
      return {
        ok: true,
        data: {
          api_keys_active: apiKeys,
          webhook_endpoints_active: webhooks,
          last_backup: lastBackup?.yaradildi ?? null,
          son_ayar_dəyişikliyi: lastAyar?.yenilendi ?? null,
          inteqrasiya_say: inteqrasiya,
        },
      };
    } catch (e) {
      console.error("[getSettingsDashboard]", e);
      const msg = e instanceof Error ? e.message : "naməlum səhv";
      return { ok: false, error: `Alınmadı: ${msg}` };
    }
  });
}
