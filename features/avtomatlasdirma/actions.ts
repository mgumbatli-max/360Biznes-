"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { permGate } from "@/lib/auth/role-check";
const ShertItemSchema = z.object({
  field: z.string().min(1),
  operator: z.enum(["=", ">", ">=", "<", "<=", "!="]),
  value: z.coerce.number(),
});

const ShertGroupSchema = z.object({
  logic: z.enum(["and", "or"]),
  conditions: z.array(ShertItemSchema).max(20),
});

const ScopeSchema = z.object({
  type: z.string().min(1),
  ids: z.array(z.union([z.string(), z.number()])).optional(),
});

const ActionSchema = z.object({
  kod: z.string().min(1),
  param: z.record(z.string(), z.unknown()).optional(),
});

const NotificationSchema = z.object({
  recipients: z.array(z.string()).default([]),
  selected_ids: z.array(z.string()).optional(),
  channels: z.array(z.string()).default([]),
  template: z.string().max(2000).optional(),
});

const CreateRuleSchema = z.object({
  ad: z.string().min(2).max(200),
  tesvir: z.string().max(2000).optional(),
  trigger_kod: z.string().min(2).max(50),
  modul: z.string().max(40).optional(),
  prioritet: z.enum(["asagi", "orta", "yuxsek", "kritik"]).default("orta"),
  aktiv: z.boolean().default(true),
  shert: ShertGroupSchema,
  scope: z.array(ScopeSchema).default([]),
  actions: z.array(ActionSchema).min(1, "Ən azı 1 əməliyyat seçin"),
  notification: NotificationSchema.optional(),
  schedule: z.string().default("realtime"),
});

type ActionResult = { ok: true; id?: number } | { ok: false; error: string };

export async function createRule(definition: z.input<typeof CreateRuleSchema>): Promise<ActionResult> {
  const parsed = CreateRuleSchema.safeParse(definition);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Forma yanlışdır" };
  }
  const d = parsed.data;

  return withTenant(async () => {
    { const _pg = permGate("ayar.idare", "ayarlar.idare"); if (!_pg.ok) return _pg; }
    const { sahibkarId, istifadeciId } = requireTenant();
    try {
      const r = await prisma.avto_qayda.create({
        data: {
          sahibkar_id: sahibkarId,
          ad: d.ad.trim(),
          tesvir: d.tesvir || null,
          trigger_kod: d.trigger_kod,
          modul: d.modul || null,
          prioritet: d.prioritet,
          shert_json: { logic: d.shert.logic, conditions: d.shert.conditions, scope: d.scope } as object,
          action_json: { actions: d.actions, notification: d.notification ?? null } as object,
          bildiris_kanal: d.notification?.channels?.[0] ?? "in_app",
          tekrarlanma: d.schedule,
          aktiv: d.aktiv,
          yaradan_id: istifadeciId,
        },
      });
      revalidatePath("/avtomatlasdirma");
      return { ok: true, id: r.id };
    } catch (e) {
      console.error("[createRule]", e);
      return { ok: false, error: "Qayda yaradılmadı" };
    }
  });
}

export async function updateRule(id: number, definition: z.input<typeof CreateRuleSchema>): Promise<ActionResult> {
  const parsed = CreateRuleSchema.safeParse(definition);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Forma yanlışdır" };
  }
  const d = parsed.data;

  return withTenant(async () => {
    { const _pg = permGate("ayar.idare", "ayarlar.idare"); if (!_pg.ok) return _pg; }
    try {
      // Sistem qaydaları redaktə oluna bilməz — klonla
      const existing = await prisma.avto_qayda.findFirst({ where: { id } });
      if (!existing) return { ok: false, error: "Qayda tapılmadı" };
      if (existing.sistem_qayda) return { ok: false, error: "Sistem qaydası redaktə oluna bilməz — Klonla düyməsi ilə kopya yarat" };
      await prisma.avto_qayda.update({
        where: { id },
        data: {
          ad: d.ad.trim(),
          tesvir: d.tesvir || null,
          trigger_kod: d.trigger_kod,
          modul: d.modul || null,
          prioritet: d.prioritet,
          shert_json: { logic: d.shert.logic, conditions: d.shert.conditions, scope: d.scope } as object,
          action_json: { actions: d.actions, notification: d.notification ?? null } as object,
          bildiris_kanal: d.notification?.channels?.[0] ?? "in_app",
          tekrarlanma: d.schedule,
          aktiv: d.aktiv,
          yenilendi: new Date(),
        },
      });
      revalidatePath("/avtomatlasdirma");
      revalidatePath(`/avtomatlasdirma/${id}`);
      return { ok: true, id };
    } catch (e) {
      console.error("[updateRule]", e);
      return { ok: false, error: "Qayda yenilənmədi" };
    }
  });
}

export async function toggleRule(id: number, aktiv: boolean): Promise<ActionResult> {
  return withTenant(async () => {
    { const _pg = permGate("ayar.idare", "ayarlar.idare"); if (!_pg.ok) return _pg; }
    try {
      await prisma.avto_qayda.update({ where: { id }, data: { aktiv, yenilendi: new Date() } });
      revalidatePath("/avtomatlasdirma");
      revalidatePath(`/avtomatlasdirma/${id}`);
      return { ok: true };
    } catch (e) {
      console.error("[toggleRule]", e);
      return { ok: false, error: "Dəyişdirilmədi" };
    }
  });
}

export async function deleteRule(id: number): Promise<ActionResult> {
  return withTenant(async () => {
    { const _pg = permGate("ayar.idare", "ayarlar.idare"); if (!_pg.ok) return _pg; }
    try {
      // Sistem qaydaları silinə bilməz
      const existing = await prisma.avto_qayda.findFirst({ where: { id } });
      if (!existing) return { ok: false, error: "Qayda tapılmadı" };
      if (existing.sistem_qayda) return { ok: false, error: "Sistem qaydası silinə bilməz" };
      await prisma.avto_qayda.delete({ where: { id } });
      revalidatePath("/avtomatlasdirma");
      return { ok: true };
    } catch (e) {
      console.error("[deleteRule]", e);
      return { ok: false, error: "Silinmədi" };
    }
  });
}

/**
 * Mövcud qaydanı klonlayır — eyni şərt, scope, action, bildiriş, lakin yeni ad.
 * Yeni qayda PASSİV olaraq yaradılır ki, sahibkar redaktə etdikdən sonra
 * aktivləşdirsin (təsadüfən eyni hadisəyə cüt qayda yayılmasın deyə).
 */
export async function cloneRule(id: number): Promise<ActionResult> {
  return withTenant(async () => {
    { const _pg = permGate("ayar.idare", "ayarlar.idare"); if (!_pg.ok) return _pg; }
    try {
      const { sahibkarId, istifadeciId } = requireTenant();
      const src = await prisma.avto_qayda.findFirst({ where: { id, sahibkar_id: sahibkarId } });
      if (!src) return { ok: false, error: "Qayda tapılmadı" };

      const created = await prisma.avto_qayda.create({
        data: {
          sahibkar_id: sahibkarId,
          ad: `${src.ad} (kopya)`.slice(0, 200),
          tesvir: src.tesvir,
          modul: src.modul,
          trigger_kod: src.trigger_kod,
          shert_json: src.shert_json ?? undefined,
          action_json: src.action_json ?? undefined,
          hedef_filial_id: src.hedef_filial_id,
          hedef_ist_id: src.hedef_ist_id,
          prioritet: src.prioritet,
          bildiris_kanal: src.bildiris_kanal,
          tekrarlanma: src.tekrarlanma,
          aktiv: false, // klon passiv başlayır
          sistem_qayda: false,
          ai_teklifi: false,
          yaradan_id: istifadeciId,
          qeyd: src.qeyd,
        },
        select: { id: true },
      });

      revalidatePath("/avtomatlasdirma");
      return { ok: true, id: created.id };
    } catch (e) {
      console.error("[cloneRule]", e);
      return { ok: false, error: "Klonlanmadı" };
    }
  });
}

/**
 * Çoxlu qaydanı eyni anda aktiv/passiv et. Filtrli siyahıdan və ya seçilmiş
 * qaydalardan istifadə olunur. Sistem qaydaları (sistem_qayda=true) toxunulmur.
 */
export async function bulkToggleRules(ids: number[], aktiv: boolean): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  if (!Array.isArray(ids) || ids.length === 0) return { ok: false, error: "Qayda seçilməyib" };
  return withTenant(async () => {
    { const _pg = permGate("ayar.idare", "ayarlar.idare"); if (!_pg.ok) return _pg; }
    try {
      const { sahibkarId } = requireTenant();
      const result = await prisma.avto_qayda.updateMany({
        where: { id: { in: ids }, sahibkar_id: sahibkarId, sistem_qayda: false },
        data: { aktiv, yenilendi: new Date() },
      });
      revalidatePath("/avtomatlasdirma");
      return { ok: true, count: result.count };
    } catch (e) {
      console.error("[bulkToggleRules]", e);
      return { ok: false, error: "Toplu əməliyyat alınmadı" };
    }
  });
}

/**
 * Çoxlu qaydanı eyni anda sil. Sistem qaydaları silinmir.
 */
export async function bulkDeleteRules(ids: number[]): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  if (!Array.isArray(ids) || ids.length === 0) return { ok: false, error: "Qayda seçilməyib" };
  return withTenant(async () => {
    { const _pg = permGate("ayar.idare", "ayarlar.idare"); if (!_pg.ok) return _pg; }
    try {
      const { sahibkarId } = requireTenant();
      const result = await prisma.avto_qayda.deleteMany({
        where: { id: { in: ids }, sahibkar_id: sahibkarId, sistem_qayda: false },
      });
      revalidatePath("/avtomatlasdirma");
      return { ok: true, count: result.count };
    } catch (e) {
      console.error("[bulkDeleteRules]", e);
      return { ok: false, error: "Toplu silinmə alınmadı" };
    }
  });
}

/**
 * Verilmiş qaydanın trigger_kod-una görə uyğun gələn obyektləri tapır.
 * `testRule` (dry-run) və `runRuleNow` (real icra) bu helper-i çağırır.
 * Heç bir log / mutasiya etmir — sadəcə match nəticəsi.
 */
async function findMatchedEntities(
  sahibkarId: string,
  rule: { trigger_kod: string; shert_json: unknown },
): Promise<{ matched: number; examples: { id: string; label: string }[]; meta: { label: string } }> {
  const shertJson = (rule.shert_json ?? {}) as { conditions?: { field: string; operator: string; value: number }[] };
  const conditions = shertJson.conditions ?? [];
  const meta = TRIGGER_TO_QUERY[rule.trigger_kod] ?? { label: "obyekt" };
  let matched = 0;
  const examples: { id: string; label: string }[] = [];

  try {
    switch (rule.trigger_kod) {
      case "stok_az": {
        const limit = conditions.find((c) => c.field === "stok_miqdar")?.value ?? 5;
        const rows = await prisma.$queryRaw<{ mehsul_id: string; ad: string; q: number }[]>`
          SELECT m.id::text AS mehsul_id, m.ad,
                 COALESCE((SELECT SUM(s.miqdar) FROM stok s WHERE s.mehsul_id = m.id), 0) AS q
            FROM mehsullar m
           WHERE m.sahibkar_id = ${sahibkarId}::uuid AND m.aktiv = TRUE
             AND COALESCE((SELECT SUM(s.miqdar) FROM stok s WHERE s.mehsul_id = m.id), 0) < ${limit}
             AND COALESCE((SELECT SUM(s.miqdar) FROM stok s WHERE s.mehsul_id = m.id), 0) > 0
           LIMIT 100`;
        matched = rows.length;
        for (const row of rows.slice(0, 5)) examples.push({ id: row.mehsul_id, label: `${row.ad} (qalıq: ${row.q})` });
        break;
      }
      case "stok_bit": {
        const rows = await prisma.$queryRaw<{ id: string; ad: string }[]>`
          SELECT m.id::text, m.ad
            FROM mehsullar m
           WHERE m.sahibkar_id = ${sahibkarId}::uuid AND m.aktiv = TRUE
             AND COALESCE((SELECT SUM(s.miqdar) FROM stok s WHERE s.mehsul_id = m.id), 0) = 0
           LIMIT 100`;
        matched = rows.length;
        for (const row of rows.slice(0, 5)) examples.push({ id: row.id, label: row.ad });
        break;
      }
      case "borc_gecikdi": {
        const gun = conditions.find((c) => c.field === "borc_gun")?.value ?? 7;
        const since = new Date();
        since.setDate(since.getDate() - gun);
        const rows = await prisma.kontragentler.findMany({
          where: { aktiv: true, alacaq: { gt: 0 }, yenilendi: { lt: since } },
          select: { id: true, ad: true, alacaq: true },
          take: 100,
        });
        matched = rows.length;
        for (const row of rows.slice(0, 5)) examples.push({ id: row.id, label: `${row.ad} (${Number(row.alacaq).toFixed(0)} ₼)` });
        break;
      }
      case "tap_gecikdi": {
        const rows = await prisma.tapshiriqlar.findMany({
          where: { deadline: { lt: new Date() }, status: { notIn: ["tamamlandi", "legv"] } },
          select: { id: true, basliq: true },
          take: 100,
        });
        matched = rows.length;
        for (const row of rows.slice(0, 5)) examples.push({ id: row.id, label: row.basliq });
        break;
      }
      case "mehsul_uzun_satilmadi": {
        const gun = conditions.find((c) => c.field === "son_satish_gun")?.value ?? 60;
        const rows = await prisma.$queryRaw<{ id: string; ad: string }[]>`
          SELECT m.id::text, m.ad
            FROM mehsullar m
           WHERE m.sahibkar_id = ${sahibkarId}::uuid AND m.aktiv = TRUE
             AND NOT EXISTS (
               SELECT 1 FROM satis_sifaris_satirlari sls
               JOIN satis_sifarisleri ss ON ss.id = sls.sifaris_id
               WHERE sls.mehsul_id = m.id
                 AND ss.tarix >= CURRENT_DATE - (${gun} || ' days')::interval
                 AND ss.status != 'legv'
             )
             AND COALESCE((SELECT SUM(s.miqdar) FROM stok s WHERE s.mehsul_id = m.id), 0) > 0
           LIMIT 100`;
        matched = rows.length;
        for (const row of rows.slice(0, 5)) examples.push({ id: row.id, label: row.ad });
        break;
      }
      default:
        matched = 0;
    }
  } catch (qe) {
    console.warn("[findMatchedEntities failed]", qe);
  }

  return { matched, examples, meta };
}

/**
 * Manual icra — qaydanı right-now işlət (cron gözləməklə deyil).
 * test mode-undan fərqli: tapılmış hər obyektə görə HƏQİQİ alert yaradır.
 * Bu, "tapdı amma heç bir şey etmədi" problemi həll edir.
 */
export async function runRuleNow(id: number): Promise<{ ok: true; matched: number; alertsCreated: number; logId?: string } | { ok: false; error: string }> {
  return withTenant(async () => {
    { const _pg = permGate("ayar.idare", "ayarlar.idare"); if (!_pg.ok) return _pg; }
    try {
      const { sahibkarId, istifadeciId } = requireTenant();
      const rule = await prisma.avto_qayda.findFirst({ where: { id } });
      if (!rule) return { ok: false, error: "Qayda tapılmadı" };
      if (!rule.aktiv) return { ok: false, error: "Qayda passivdir — əvvəlcə aktivləşdirin" };

      // 1. Uyğun obyektləri tap (heç bir log artırmadan)
      const matchResult = await findMatchedEntities(sahibkarId, rule);

      // 2. Hər match üçün xəbərdarlıq yarat (yalnız "xeberdarliq" action varsa)
      const actionJson = (rule.action_json ?? {}) as { actions?: { kod: string }[] };
      const actionList = actionJson.actions ?? [];
      const wantsAlert = actionList.some((a) => a.kod === "xeberdarliq" || a.kod === "bildiris");
      let alertsCreated = 0;
      if (wantsAlert && matchResult.matched > 0) {
        const seviyye = rule.prioritet === "kritik" ? "kritik" : rule.prioritet === "yuxsek" ? "yuxsek" : "orta";
        // Trigger_kod-dan alert kateqoriyasına map
        const TRIGGER_TO_CAT: Record<string, string> = {
          stok_az: "stok", stok_bit: "stok",
          mehsul_uzun_satilmadi: "mehsul_perf",
          satish_mayadan_ashagi: "satis", satish_yarandi: "satis", boyuk_endirim: "satis", qiymet_deyisdi: "satis",
          alish_yarandi: "alish", odenis_gecikdi: "alish",
          borc_gecikdi: "borc",
          bank_uygunsuz: "bank",
          tap_gecikdi: "tapshiriq",
          isci_gec_geldi: "isci", isci_gelmedi: "isci",
          servis_status_deyismedi: "servis",
          qaytarma_yarandi: "qaytarma",
          mp_sifaris_gecikdi: "marketplace",
          kassa_baglanmadi: "sistem",
        };
        const catKod = TRIGGER_TO_CAT[rule.trigger_kod] ?? "sistem";
        const cat = await prisma.alert_categories.findFirst({ where: { kod: catKod }, select: { id: true, kod: true } });
        if (cat) {
          for (const ex of matchResult.examples) {
            try {
              await prisma.alerts.create({
                data: {
                  sahibkar_id: sahibkarId,
                  kateqoriya_id: cat.id,
                  kateqoriya_kod: cat.kod,
                  rule_id: rule.id,
                  rule_kod: rule.trigger_kod,
                  basliq: `${rule.ad}: ${ex.label}`.slice(0, 255),
                  tesvir: rule.tesvir ?? "Manual icra nəticəsində yaradıldı",
                  seviyye,
                  status: "yeni",
                  obyekt_nov: matchResult.meta.label.slice(0, 40),
                  obyekt_id: ex.id.slice(0, 60),
                  obyekt_basliq: ex.label.slice(0, 255),
                },
              });
              alertsCreated++;
            } catch (alertErr) {
              console.warn("[runRuleNow alert create]", alertErr);
            }
          }
        } else {
          console.warn(`[runRuleNow] alert_categories kod="${catKod}" tapılmadı`);
        }
      }

      // 3. Real icra log (status=ok, manual flaq)
      const log = await prisma.avto_log.create({
        data: {
          sahibkar_id: sahibkarId,
          qayda_id: id,
          trigger_kod: rule.trigger_kod,
          status: "ok",
          xeta_metn: null,
          shert_match: { matched: matchResult.matched, target: matchResult.meta.label },
          action_netice: { manual: true, by: istifadeciId, alertsCreated },
        },
        select: { id: true },
      });

      // 4. İcra sayğacını TƏK dəfə artır (testRule artırmır)
      await prisma.avto_qayda.update({
        where: { id },
        data: { son_islem: new Date(), islem_say: { increment: 1 } },
      });

      revalidatePath("/avtomatlasdirma");
      revalidatePath(`/avtomatlasdirma/${id}`);
      revalidatePath("/xeberdarliqlar");
      return { ok: true, matched: matchResult.matched, alertsCreated, logId: log.id.toString() };
    } catch (e) {
      console.error("[runRuleNow]", e);
      return { ok: false, error: "Manual icra alınmadı" };
    }
  });
}

/* ──────────────────────────────────────────────────────────────────────────
 * TEST MODE — simulates what the rule would do without firing actions
 * ────────────────────────────────────────────────────────────────────────── */

export type TestRunResult = {
  ok: true;
  matched: number;
  target_label: string;
  examples: { id: string; label: string }[];
  actions_simulated: { kod: string; ad: string }[];
  risk_note?: string;
} | { ok: false; error: string };

const TRIGGER_TO_QUERY: Record<string, { label: string }> = {
  stok_az: { label: "məhsul (az stok)" },
  stok_bit: { label: "məhsul (stok bitib)" },
  mehsul_uzun_satilmadi: { label: "məhsul (uzun satılmır)" },
  satish_mayadan_ashagi: { label: "satış (maya altı)" },
  borc_gecikdi: { label: "müştəri (borc gecikib)" },
  odenis_gecikdi: { label: "tədarükçü (ödəniş gecikib)" },
  tap_gecikdi: { label: "tapşırıq (gecikmiş)" },
  isci_gec_geldi: { label: "işçi (gec gəlib)" },
  isci_gelmedi: { label: "işçi (gəlməyib)" },
  servis_status_deyismedi: { label: "servis (status dəyişməyib)" },
  qiymet_deyisdi: { label: "məhsul" },
  boyuk_endirim: { label: "satış (böyük endirim)" },
  bank_uygunsuz: { label: "bank əməliyyatı" },
  mp_sifaris_gecikdi: { label: "marketplace sifarişi" },
  kassa_baglanmadi: { label: "kassa" },
  satish_yarandi: { label: "satış" },
  alish_yarandi: { label: "alış" },
  qaytarma_yarandi: { label: "qaytarma" },
};

const ACTION_LABELS: Record<string, string> = {
  xeberdarliq: "Xəbərdarlıq yarat",
  tapshiriq: "Tapşırıq yarat",
  bildiris: "ERP bildirişi",
  whatsapp: "WhatsApp göndər",
  telegram: "Telegram göndər",
  email: "Email göndər",
  sms: "SMS göndər",
  tesdiq: "Təsdiq Mərkəzinə göndər",
  block: "Əməliyyatı blokla",
  kpi_artir: "KPI artır",
  kpi_azalt: "KPI azalt",
  cerime: "Cərimə",
  bonus: "Bonus",
  qeyd: "Qeyd əlavə et",
  yonlendir: "Yönləndir",
};

export async function testRule(id: number): Promise<TestRunResult> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    try {
      const r = await prisma.avto_qayda.findFirst({ where: { id } });
      if (!r) return { ok: false, error: "Qayda tapılmadı" };

      // Dry-run match
      const matchResult = await findMatchedEntities(sahibkarId, r);

      // Decode actions
      const actionJson = (r.action_json ?? {}) as { actions?: { kod: string }[] };
      const actionsList = actionJson.actions ?? [];
      const actions_simulated = actionsList.map((a) => ({
        kod: a.kod,
        ad: ACTION_LABELS[a.kod] ?? a.kod,
      }));

      const hasBlock = actionsList.some((a) => a.kod === "block");
      const risk_note = hasBlock && matchResult.matched > 10
        ? `⚠ Bu qayda ${matchResult.matched} əməliyyatı blok edəcək. Diqqətlə test edin.`
        : undefined;

      // Dry-run log — `shert_match.dry_run=true` flag-i ilə real icradan ayrılır.
      // islem_say İŞARƏ olunmur (real icra deyil, statistikanı çirkləndirmir).
      await prisma.avto_log.create({
        data: {
          sahibkar_id: sahibkarId,
          qayda_id: id,
          trigger_kod: r.trigger_kod,
          shert_match: { dry_run: true, matched: matchResult.matched, target: matchResult.meta.label } as object,
          action_netice: { dry_run: true, actions: actions_simulated.map((a) => a.kod) } as object,
          status: "ok",
        },
      });

      revalidatePath("/avtomatlasdirma");
      revalidatePath(`/avtomatlasdirma/${id}`);

      return {
        ok: true,
        matched: matchResult.matched,
        target_label: matchResult.meta.label,
        examples: matchResult.examples,
        actions_simulated,
        risk_note,
      };
    } catch (e) {
      console.error("[testRule]", e);
      return { ok: false, error: "Test alınmadı" };
    }
  });
}

export async function getRuleDefinition(id: number) {
  return withTenant(async () => {
    const r = await prisma.avto_qayda.findUnique({
      where: { id },
      include: {
        istifadeciler_avto_qayda_yaradan_idToistifadeciler: { select: { ad_soyad: true } },
        avto_log: {
          orderBy: { yaradildi: "desc" },
          take: 50,
        },
      },
    });
    return r;
  });
}

export async function getRuleStatsById(id: number) {
  return withTenant(async () => {
    const since = new Date(Date.now() - 24 * 3600 * 1000);
    const since7 = new Date(Date.now() - 7 * 24 * 3600 * 1000);
    const [day, week, total, errors7] = await Promise.all([
      prisma.avto_log.count({ where: { qayda_id: id, yaradildi: { gte: since } } }),
      prisma.avto_log.count({ where: { qayda_id: id, yaradildi: { gte: since7 } } }),
      prisma.avto_log.count({ where: { qayda_id: id } }),
      prisma.avto_log.count({ where: { qayda_id: id, yaradildi: { gte: since7 }, status: { not: "ok" } } }),
    ]);
    return { day, week, total, errors7 };
  });
}
