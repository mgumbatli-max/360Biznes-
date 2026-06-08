"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { chatCompletion } from "@/lib/ai/anthropic";
import { safeAuditLog } from "@/lib/audit/safe-log";

type ActionResult =
  | { ok: true; id?: number; count?: number; rule?: SegmentRule; messages?: DripMessage[] }
  | { ok: false; error: string };

export type SegmentRule = {
  borc?: "var" | "yox";
  qiymet_tipi?: ("adi" | "topdan" | "vip")[];
  son_alish_max_gun?: number; // hist: max gün since son_temas
  son_alish_min_gun?: number;
  min_satish_say?: number;
  ay?: number; // last N ay
  funnel?: string[];
  qara_siyahi?: boolean;
};

const RULE_FIELDS = `Cədvəl: kontragentler (nov='musteri').
Mövcud sahələr:
- borc: ədəd (>0 = borclu, =0 = borc yox)
- qiymet_tipi: 'adi' | 'topdan' | 'vip'
- son_temas: son əlaqə tarixi
- yaradildi: yaradılma tarixi
- funnel_status: 'yeni'|'aktiv'|'muntezem'|'passiv'
- qara_siyahi: bool

Qaydanı bu JSON formatına çevir:
{
  "borc": "var" | "yox",
  "qiymet_tipi": ["adi","topdan","vip"],
  "son_alish_max_gun": number, // son alıs son N gün ərzində
  "son_alish_min_gun": number, // son alıs N gündən köhnə
  "min_satish_say": number,
  "ay": number, // son N ay aktivlik
  "funnel": ["aktiv","muntezem"],
  "qara_siyahi": bool
}
Yalnız aid olan açarları daxil et. Yalnız JSON qaytar.`;

/** AI-dən təbii dil → seqment qaydası */
export async function aiBuildSegmentRule(input: FormData): Promise<ActionResult> {
  // Hər iki icazə (AI istifadəsi və seqment idarəsi)
  const { requireCrmActionPerm: rp } = await import("./access-guard");
  const permCheck = await rp(["ai.istifade", "segment.idare"]);
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  const tesvir = String(input.get("tesvir") ?? "").trim();
  if (tesvir.length < 4) return { ok: false, error: "Təsvir çox qısadır" };
  if (tesvir.length > 1000) return { ok: false, error: "Təsvir 1000 simvoldan uzun ola bilməz" };

  // AI quota
  const { checkAiCavabQuota } = await import("./quota");
  const quota = await checkAiCavabQuota(1);
  if (!quota.ok) return { ok: false, error: quota.error };

  return withTenant(async () => {
    try {
      const res = await chatCompletion([{ role: "user", content: tesvir }], {
        system: RULE_FIELDS,
        max_tokens: 400,
      });
      const txt = res.text.replace(/```json|```/g, "").trim();
      let rule: SegmentRule = {};
      let usedHeuristic = false;
      try {
        const json = JSON.parse(txt);
        rule = sanitizeRule(json);
      } catch {
        // Heuristic fallback — AI cavabı JSON deyil
        rule = heuristicParse(tesvir);
        usedHeuristic = true;
      }
      const count = await countByRule(rule);
      return { ok: true, rule, count, heuristic: usedHeuristic };
    } catch (e) {
      console.error("[aiBuildSegmentRule]", e);
      const msg = e instanceof Error ? e.message : "naməlum səhv";
      return { ok: false, error: `AI qaydanı çıxara bilmədi: ${msg}` };
    }
  });
}

function sanitizeRule(v: unknown): SegmentRule {
  const r: SegmentRule = {};
  if (!v || typeof v !== "object") return r;
  const o = v as Record<string, unknown>;
  if (o.borc === "var" || o.borc === "yox") r.borc = o.borc;
  if (Array.isArray(o.qiymet_tipi)) {
    const allowed = ["adi", "topdan", "vip"] as const;
    r.qiymet_tipi = (o.qiymet_tipi as string[]).filter((x) => allowed.includes(x as typeof allowed[number])) as SegmentRule["qiymet_tipi"];
  }
  if (typeof o.son_alish_max_gun === "number") r.son_alish_max_gun = o.son_alish_max_gun;
  if (typeof o.son_alish_min_gun === "number") r.son_alish_min_gun = o.son_alish_min_gun;
  if (typeof o.min_satish_say === "number") r.min_satish_say = o.min_satish_say;
  if (typeof o.ay === "number") r.ay = o.ay;
  if (Array.isArray(o.funnel)) r.funnel = (o.funnel as string[]).filter((x) => typeof x === "string");
  if (typeof o.qara_siyahi === "boolean") r.qara_siyahi = o.qara_siyahi;
  return r;
}

function heuristicParse(t: string): SegmentRule {
  const r: SegmentRule = {};
  const low = t.toLowerCase();
  if (/vip/.test(low)) r.qiymet_tipi = ["vip"];
  if (/topdan|toptan/.test(low)) r.qiymet_tipi = [...(r.qiymet_tipi ?? []), "topdan"] as SegmentRule["qiymet_tipi"];
  if (/borclu|borc var/.test(low)) r.borc = "var";
  if (/borcsuz|borc yox/.test(low)) r.borc = "yox";
  const m1 = low.match(/(\d+)\s*ay/);
  if (m1) r.ay = parseInt(m1[1], 10);
  const m2 = low.match(/(\d+)\s*g[uü]n/);
  if (m2) r.son_alish_max_gun = parseInt(m2[1], 10);
  const m3 = low.match(/(\d+)\s*\+\s*sat[ıi]ş/);
  if (m3) r.min_satish_say = parseInt(m3[1], 10);
  if (/passiv|aktiv olmayan|çıxmış|cixmis/.test(low)) r.son_alish_min_gun = 90;
  return r;
}

/** Qaydaya görə kontragentlər WHERE şərti */
function whereFromRule(rule: SegmentRule): Record<string, unknown> {
  const where: Record<string, unknown> = { nov: "musteri" };
  // Müştəri seqmentində "borc" = müştərinin bizə borcu (alacaq sütunu).
  if (rule.borc === "var") where.alacaq = { gt: 0 };
  if (rule.borc === "yox") where.alacaq = { lte: 0 };
  if (rule.qiymet_tipi?.length) where.qiymet_tipi = { in: rule.qiymet_tipi };
  if (rule.funnel?.length) where.funnel_status = { in: rule.funnel };
  if (typeof rule.qara_siyahi === "boolean") where.qara_siyahi = rule.qara_siyahi;

  const now = Date.now();
  if (typeof rule.son_alish_max_gun === "number") {
    where.son_temas = { gte: new Date(now - rule.son_alish_max_gun * 86400000) };
  } else if (typeof rule.son_alish_min_gun === "number") {
    where.son_temas = { lt: new Date(now - rule.son_alish_min_gun * 86400000) };
  } else if (typeof rule.ay === "number") {
    where.son_temas = { gte: new Date(now - rule.ay * 30 * 86400000) };
  }
  return where;
}

export async function countByRule(rule: SegmentRule): Promise<number> {
  return withTenant(async () => {
    const where = whereFromRule(rule);
    // min_satish_say — ayrıca query; əgər varsa, çoxsaylı müştəriləri kontragent_id ilə filter et
    if (typeof rule.min_satish_say === "number" && rule.min_satish_say > 0) {
      const { sahibkarId } = requireTenant();
      const rows = await prisma.$queryRaw<{ musteri_id: string }[]>`
        SELECT musteri_id FROM satis_sifarisleri
         WHERE sahibkar_id = ${sahibkarId}::uuid AND musteri_id IS NOT NULL
         GROUP BY musteri_id
        HAVING COUNT(*) >= ${rule.min_satish_say}
      `.catch(() => [] as { musteri_id: string }[]);
      const ids = rows.map((r) => r.musteri_id);
      if (ids.length === 0) return 0;
      (where as Record<string, unknown>).id = { in: ids };
    }
    return prisma.kontragentler.count({ where });
  });
}

/** Custom seqmenti yarat (AI qaydası ilə) */
const SaveSegmentSchema = z.object({
  ad: z.string().min(2).max(150),
  tesvir: z.string().max(400).optional().or(z.literal("")),
  reng: z.string().max(20).optional().or(z.literal("")),
  qayda_json: z.string().min(2),
});

export async function saveAiSegment(input: FormData): Promise<ActionResult> {
  const { requireCrmActionPerm: rp, bustCrmCache: bc } = await import("./access-guard");
  const permCheck = await rp("segment.idare");
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  const parsed = SaveSegmentSchema.safeParse(Object.fromEntries(input.entries()));
  if (!parsed.success) return { ok: false, error: "Forma yanlışdır" };
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    try {
      let rule: SegmentRule = {};
      try {
        rule = sanitizeRule(JSON.parse(parsed.data.qayda_json));
      } catch {
        return { ok: false, error: "Qayda JSON yanlışdır" };
      }
      const kod = `ai_${Date.now().toString(36)}`;
      const created = await prisma.musteri_seqment.create({
        data: {
          sahibkar_id: sahibkarId,
          kod,
          ad: parsed.data.ad.trim(),
          tesvir: parsed.data.tesvir?.trim() || null,
          reng: parsed.data.reng?.trim() || "#a78bfa",
          qayda_json: rule as unknown as object,
          sistem: false,
          aktiv: true,
        },
      });
      revalidatePath("/crm/segment");
      bc();
      const { audit } = await import("@/lib/audit/log");
      await audit("yarat", "musteri_seqment", created.id, {
        yeni_data: { kod, ad: parsed.data.ad, rule_keys: Object.keys(rule) },
        sebeb: `Yeni AI seqment: ${parsed.data.ad}`,
      });
      return { ok: true, id: created.id };
    } catch (e) {
      console.error("[saveAiSegment]", e);
      const msg = e instanceof Error ? e.message : "naməlum səhv";
      return { ok: false, error: `Saxlanmadı: ${msg}` };
    }
  });
}

/* ------------------------------------------------------------------ */
/*   DRIP CAMPAIGN                                                    */
/* ------------------------------------------------------------------ */

export type DripMessage = { gun: number; ad: string; matn: string };

const DRIP_DEFAULTS: DripMessage[] = [
  { gun: 0, ad: "Salam", matn: "Salam {{ad}}, sizinlə əlaqə saxlamaq xoş oldu! Hər hansı sualınız olarsa bizə yazın." },
  { gun: 3, ad: "Endirim təklifi", matn: "Salam {{ad}}, sizin üçün xüsusi endirim hazırlamışıq. Növbəti alışınızda 10% endirim əldə edə bilərsiniz." },
  { gun: 7, ad: "Xatırlatma", matn: "Salam {{ad}}, sizi unutmamışıq! Yeni məhsullarımıza baxa bilərsiniz." },
];

const DripSchema = z.object({
  seqment_kod: z.string().min(1),
  kampaniya_ad: z.string().min(2).max(150),
  mesajlar_json: z.string().optional().or(z.literal("")),
  kanal: z.string().default("whatsapp"),
});

export async function startDripCampaign(input: FormData): Promise<ActionResult> {
  const { requireCrmActionPerm: rp, bustCrmCache: bc } = await import("./access-guard");
  const permCheck = await rp(["broadcast.idare", "segment.idare"]);
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  const parsed = DripSchema.safeParse(Object.fromEntries(input.entries()));
  if (!parsed.success) return { ok: false, error: "Forma yanlışdır" };
  const d = parsed.data;

  let messages: DripMessage[] = DRIP_DEFAULTS;
  if (d.mesajlar_json) {
    try {
      const v = JSON.parse(d.mesajlar_json);
      if (Array.isArray(v)) {
        messages = v
          .filter((m) => m && typeof m.matn === "string" && typeof m.gun === "number")
          .map((m) => ({ gun: m.gun, ad: String(m.ad ?? `Mesaj ${m.gun}g`), matn: String(m.matn) }));
      }
    } catch {
      // ignore, use defaults
    }
  }
  if (messages.length === 0) messages = DRIP_DEFAULTS;

  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    try {
      const now = new Date();
      const createdIds: string[] = [];
      for (const m of messages) {
        const sched = new Date(now.getTime() + m.gun * 86400000);
        const camp = await prisma.broadcast_kampaniyalari.create({
          data: {
            sahibkar_id: sahibkarId,
            yaradan_id: istifadeciId,
            ad: `${d.kampaniya_ad} · +${m.gun}g · ${m.ad}`,
            matn: m.matn,
            kanallar: [d.kanal],
            hedef: "all_musteri",
            hedef_meta: { drip: true, seqment_kod: d.seqment_kod, sira: m.gun } as unknown as object,
            zamanlama: sched,
            status: "gozlemede",
            gonderilen_say: 0,
            ugurlu_say: 0,
            xeta_say: 0,
          },
        });
        createdIds.push(camp.id);
      }

      // Audit — outbox-safe
      await safeAuditLog({
        sahibkar_id: sahibkarId,
        istifadeci_id: istifadeciId,
        emeliyyat: "yarat",
        resurs_nov: "drip_campaign",
        resurs_id: createdIds[0] ?? null,
        yeni_data: { seqment_kod: d.seqment_kod, count: createdIds.length, kanal: d.kanal } as unknown as object,
        status: "ugur",
      });

      revalidatePath("/crm/segment");
      revalidatePath("/crm/broadcast");
      bc();
      return { ok: true, count: createdIds.length, messages };
    } catch (e) {
      console.error("[startDripCampaign]", e);
      const msg = e instanceof Error ? e.message : "naməlum səhv";
      return { ok: false, error: `Drip başladıla bilmədi: ${msg}` };
    }
  });
}
