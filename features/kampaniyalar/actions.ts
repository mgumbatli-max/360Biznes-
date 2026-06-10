"use server";

import { revalidatePath } from "next/cache";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { audit } from "@/lib/audit/log";
import { TEMPLATES } from "./templates";
import { calcTier, TIP_META, type KampaniyaTip } from "./types";
import { applyCoupon as _applyCoupon, type AppliedCampaign } from "./matcher";
import { requireKampaniyaActionPerm, bustKampaniyaCache } from "./access-guard";
import { checkBroadcastRateLimit } from "./broadcast-limit";

type Result = { ok: true; id?: string } | { ok: false; error: string };

/**
 * Kriptoloji random gift card kodu — collision-safe.
 * Format: "GC" + 12 simvol base32 (alfanumeric, O/0/I/1 yox).
 */
function generateGiftCode(): string {
  const charset = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(12);
  let out = "";
  for (let i = 0; i < 12; i++) {
    out += charset[bytes[i] % charset.length];
  }
  return `GC${out}`;
}

/** Tək kuponu aktiv/deaktiv etmək. */
export async function toggleCouponActive(id: string, aktiv: boolean): Promise<Result> {
  const permCheck = await requireKampaniyaActionPerm("kampaniya.kupon");
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  return withTenant(async () => {
    try {
      const before = await prisma.coupons.findUnique({ where: { id }, select: { kod: true, aktiv: true, campaign_id: true } });
      if (!before) return { ok: false, error: "Kupon tapılmadı" };
      await prisma.coupons.update({ where: { id }, data: { aktiv } });
      revalidatePath("/kampaniyalar/kuponlar");
      bustKampaniyaCache();
      await audit(aktiv ? "aktivlesh" : "deaktivlesh", "kupon", id, {
        evvelki_data: { aktiv: before.aktiv },
        yeni_data: { aktiv, kod: before.kod, campaign_id: before.campaign_id },
        sebeb: aktiv ? "Kupon aktivləşdirildi" : "Kupon deaktivləşdirildi",
      });
      return { ok: true };
    } catch (e) {
      console.error("[toggleCouponActive]", e);
      const msg = e instanceof Error ? e.message : "naməlum səhv";
      return { ok: false, error: `Yenilənmədi: ${msg}` };
    }
  });
}

/** Server action wrapper — applyCoupon-u client komponentdən çağırmaq üçün. */
export async function applyCouponAction(
  kod: string,
  cemi: number,
  kontragentId: string | null,
): Promise<{ ok: true; applied: AppliedCampaign } | { ok: false; error: string }> {
  // POS-da çağırılır — read-only matcher; oxu icazəsi kifayətdir
  const permCheck = await requireKampaniyaActionPerm("kampaniya.oxu");
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  return _applyCoupon(kod, { lines: [], cemi, kontragent_id: kontragentId, kanal: "pos" });
}

// ============================================================
// TOPLU KUPON GENERASIYA — N unikal kod birdən
// ============================================================

const BulkCouponSchema = z.object({
  campaign_id: z.string().uuid(),
  prefix: z.string().min(2).max(10).regex(/^[A-Z0-9]+$/, "Yalnız böyük hərf və rəqəm"),
  count: z.coerce.number().int().min(1).max(2000),
  max_uses_per_kod: z.coerce.number().int().min(1).max(1000).default(1),
  bitme: z.string().optional(),
});

export async function bulkGenerateCoupons(input: z.input<typeof BulkCouponSchema>): Promise<
  { ok: true; created: number; sample: string[] } | { ok: false; error: string }
> {
  const permCheck = await requireKampaniyaActionPerm("kampaniya.kupon");
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  const parsed = BulkCouponSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Forma yanlışdır" };
  const { campaign_id, prefix, count, max_uses_per_kod, bitme } = parsed.data;

  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    try {
      const c = await prisma.campaigns.findFirst({ where: { id: campaign_id } });
      if (!c) return { ok: false, error: "Kampaniya tapılmadı" };

      const bitmeDate = bitme ? new Date(bitme) : null;
      if (bitmeDate && Number.isNaN(bitmeDate.getTime())) {
        return { ok: false, error: "Bitmə tarixi səhvdir" };
      }

      const codes: string[] = [];
      const data: { sahibkar_id: string; campaign_id: string; kod: string; max_uses: number; bitme_tarixi: Date | null }[] = [];

      const charset = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
      const usedKeys = new Set<string>();
      for (let i = 0; i < count; i++) {
        let kod: string;
        let attempts = 0;
        do {
          // Kriptoloji random (riyazi Math.random əvəzinə)
          const bytes = randomBytes(6);
          let suffix = "";
          for (let k = 0; k < 6; k++) suffix += charset[bytes[k] % charset.length];
          kod = `${prefix}${suffix}`;
          attempts++;
          if (attempts > 50) return { ok: false, error: "Unikal kod yaradıla bilmədi" };
        } while (usedKeys.has(kod));
        usedKeys.add(kod);
        codes.push(kod);
        data.push({
          sahibkar_id: sahibkarId,
          campaign_id,
          kod,
          max_uses: max_uses_per_kod,
          bitme_tarixi: bitmeDate,
        });
      }

      await prisma.coupons.createMany({ data, skipDuplicates: true });
      revalidatePath(`/kampaniyalar/${campaign_id}`);
      bustKampaniyaCache();
      await audit("bulk_yarat", "kupon", campaign_id, {
        yeni_data: { prefix, count: codes.length, max_uses_per_kod, bitme: bitme || null, kampaniya: c.ad },
        sebeb: `${codes.length} ədəd kupon yaradıldı`,
      });
      return { ok: true, created: codes.length, sample: codes.slice(0, 5) };
    } catch (e) {
      console.error("[bulkGenerateCoupons]", e);
      const msg = e instanceof Error ? e.message : "naməlum səhv";
      return { ok: false, error: `Yaradılmadı: ${msg}` };
    }
  });
}

// ============================================================
// MÜŞTƏRI TELEGRAM BROADCAST
// ============================================================

const BroadcastSchema = z.object({
  campaign_id: z.string().uuid(),
  mesaj: z.string().min(10).max(2000).optional(),
});

export async function broadcastCampaignToTelegram(
  input: z.input<typeof BroadcastSchema>,
): Promise<{ ok: true; sent: number } | { ok: false; error: string }> {
  const permCheck = await requireKampaniyaActionPerm("marketing.broadcast");
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  const parsed = BroadcastSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Forma yanlışdır" };

  return withTenant(async () => {
    const { sahibkarId } = requireTenant();

    // Rate limit yoxla
    const rate = await checkBroadcastRateLimit();
    if (!rate.ok) return { ok: false, error: rate.error };

    try {
      const c = await prisma.campaigns.findFirst({ where: { id: parsed.data.campaign_id } });
      if (!c) return { ok: false, error: "Kampaniya tapılmadı" };

      const cfg = await prisma.ayarlar.findFirst({
        where: { sahibkar_id: sahibkarId, qrup: "telegram", acar: "chat_id" },
        select: { deyer: true },
      });
      if (!cfg?.deyer) return { ok: false, error: "Telegram chat_id qurulmayıb (/ayarlar/inteqrasiya)" };

      const { sendTelegramMessage, escapeTelegramHtml, isTelegramConfigured } = await import("@/lib/telegram/notifier");
      if (!isTelegramConfigured()) return { ok: false, error: "TELEGRAM_BOT_TOKEN env yoxdur" };

      const tipMeta = TIP_META[c.tip as KampaniyaTip] ?? TIP_META.percent_endirim;
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3500";

      const action = (c.action_json ?? {}) as Record<string, unknown>;
      const rules = (c.rules_json ?? {}) as Record<string, unknown>;
      const value = Number(action.value ?? 0);
      const valueStr = action.discount_type === "percent" ? `${value}%` :
                       action.discount_type === "fixed" ? `${value} ₼` : "";

      const userMesaj = parsed.data.mesaj?.trim();
      const text = userMesaj
        ? userMesaj
        : [
            `${tipMeta.emoji} <b>${escapeTelegramHtml(c.ad)}</b>`,
            "",
            valueStr ? `🎯 <b>${valueStr}</b> endirim` : "",
            c.aciqlamaq ? `\n${escapeTelegramHtml(c.aciqlamaq)}` : "",
            rules.min_cart ? `\n🛒 Min səbət: <b>${rules.min_cart} ₼</b>` : "",
            c.bitme ? `\n🗓 Bitir: ${new Date(c.bitme).toLocaleDateString("az-AZ", { day: "2-digit", month: "long", year: "numeric" })}` : "",
            "\n#kampaniya #endirim",
          ].filter(Boolean).join("");

      const res = await sendTelegramMessage({
        chatId: cfg.deyer,
        text,
        parseMode: "HTML",
        inlineKeyboard: [[{ text: "Bizdən sifariş et", url: `${baseUrl}/` }]],
      });

      if (!res.ok) return { ok: false, error: `Telegram xətası: ${res.error}` };

      await audit("broadcast", "kampaniya", c.id, {
        yeni_data: { kanal: "telegram", kampaniya: c.ad, mesaj_uzunluq: text.length, custom: !!userMesaj },
        sebeb: `Telegram broadcast: ${c.ad}`,
      });

      return { ok: true, sent: 1 };
    } catch (e) {
      console.error("[broadcastCampaignToTelegram]", e);
      const msg = e instanceof Error ? e.message : "naməlum səhv";
      return { ok: false, error: `Göndərmə alınmadı: ${msg}` };
    }
  });
}

// ============================================================
// KART AXTARIŞ — POS / sahibkar üçün
// ============================================================

export type FoundLoyaltyCard = {
  id: string;
  kart_kod: string;
  tier: string;
  balans: number;
  total_qazanc: number;
  kontragent: { id: string; ad: string; telefon: string | null };
};

/**
 * Kartı 3 üsulla axtarır:
 *  1. Tam kart kodu (LKxxxxxxxxx)
 *  2. Telefon nömrəsi (sonu 7-9 rəqəm)
 *  3. Müştəri adı (qismən)
 *
 * PII guard: `kampaniya.oxu` ya da POS rolları lazımdır.
 */
export async function findLoyaltyCard(query: string): Promise<FoundLoyaltyCard | null> {
  // POS-da kassir də çağırır — geniş icaze yoxlamasını qonaq olmadıqdan sonra et
  const permCheck = await requireKampaniyaActionPerm("kampaniya.oxu");
  if (!permCheck.ok) return null;
  const q = query.trim();
  if (q.length < 3) return null;
  return withTenant(async () => {
    if (/^LK\d{9}$/i.test(q)) {
      const c = await prisma.loyalty_cards.findFirst({
        where: { kart_kod: q.toUpperCase(), aktiv: true },
        include: { kontragentler: { select: { id: true, ad: true, telefon: true } } },
      });
      if (c) return mapLoyalty(c);
    }
    const digits = q.replace(/\D/g, "");
    if (digits.length >= 7) {
      const tail = digits.slice(-9);
      const candidate = await prisma.kontragentler.findFirst({
        where: { telefon: { endsWith: tail }, aktiv: true },
        select: { id: true },
      });
      if (candidate) {
        const c = await prisma.loyalty_cards.findFirst({
          where: { kontragent_id: candidate.id, aktiv: true },
          include: { kontragentler: { select: { id: true, ad: true, telefon: true } } },
        });
        if (c) return mapLoyalty(c);
      }
    }
    if (q.length >= 3) {
      const byName = await prisma.kontragentler.findFirst({
        where: { ad: { contains: q, mode: "insensitive" }, aktiv: true },
        select: { id: true },
      });
      if (byName) {
        const c = await prisma.loyalty_cards.findFirst({
          where: { kontragent_id: byName.id, aktiv: true },
          include: { kontragentler: { select: { id: true, ad: true, telefon: true } } },
        });
        if (c) return mapLoyalty(c);
      }
    }
    return null;
  });
}

type LoyaltyRow = {
  id: string; kart_kod: string; tier: string;
  balans: { toString(): string };
  total_qazanc: { toString(): string };
  kontragentler: { id: string; ad: string; telefon: string | null };
};

function mapLoyalty(c: LoyaltyRow): FoundLoyaltyCard {
  return {
    id: c.id,
    kart_kod: c.kart_kod,
    tier: c.tier,
    balans: Number(c.balans),
    total_qazanc: Number(c.total_qazanc),
    kontragent: c.kontragentler,
  };
}

/**
 * POS-da müştəri seçildikdə çağırılır — birbaşa kontragent_id ilə kart tap.
 */
export async function getLoyaltyCardByKontragent(kontragentId: string): Promise<FoundLoyaltyCard | null> {
  const permCheck = await requireKampaniyaActionPerm("kampaniya.oxu");
  if (!permCheck.ok) return null;
  if (!kontragentId) return null;
  return withTenant(async () => {
    const c = await prisma.loyalty_cards.findFirst({
      where: { kontragent_id: kontragentId, aktiv: true },
      include: { kontragentler: { select: { id: true, ad: true, telefon: true } } },
    });
    return c ? mapLoyalty(c) : null;
  });
}

/**
 * Satış zamanı bonusu kartdan çıxar (POS-da "Bonus ilə öde" basıldıqda).
 * Atomic decrement — race condition həll olunub.
 */
export async function applyBonusToSale(
  kartId: string,
  satisId: string | null,
  mebleg: number,
): Promise<{ ok: true; yeniBalans: number } | { ok: false; error: string }> {
  const permCheck = await requireKampaniyaActionPerm("kampaniya.oxu");
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  if (!Number.isFinite(mebleg) || mebleg <= 0) return { ok: false, error: "Məbləğ düzgün deyil" };
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    try {
      // Atomic update — yalnız balans ≥ mebleg olduqda decrement
      const result = await prisma.$transaction(async (tx) => {
        // QA-K7: idempotentlik — eyni satış üçün bonus artıq SƏRF olunubsa
        // (offline retry / double-submit) kartdan təkrar çıxma.
        if (satisId) {
          const already = await tx.loyalty_tx.findFirst({
            where: { kart_id: kartId, satis_id: satisId, nov: "serf" },
            select: { qaliq: true },
          });
          if (already) return Number(already.qaliq);
        }
        const updated = await tx.loyalty_cards.updateMany({
          where: { id: kartId, balans: { gte: mebleg } },
          data: {
            balans: { decrement: mebleg },
            total_serf: { increment: mebleg },
            son_alish_de: new Date(),
            yenilendi: new Date(),
          },
        });
        if (updated.count === 0) {
          return null; // Balans çatmır ya da kart yoxdur
        }
        // Yenilənmiş balansı oxu
        const card = await tx.loyalty_cards.findUnique({ where: { id: kartId } });
        if (!card) return null;
        await tx.loyalty_tx.create({
          data: {
            sahibkar_id: sahibkarId,
            kart_id: kartId,
            satis_id: satisId,
            nov: "serf",
            mebleg: -mebleg,
            qaliq: Number(card.balans),
            qeyd: satisId ? `Satış #${satisId.slice(0, 8)}` : "Bonus istifadə",
          },
        });
        return Number(card.balans);
      });
      if (result === null) return { ok: false, error: "Kart tapılmadı ya da balans kifayət deyil" };
      revalidatePath("/kampaniyalar/loyalty");
      bustKampaniyaCache();
      await audit("serf", "loyalty_kart", kartId, {
        yeni_data: { mebleg, satis_id: satisId, yeni_balans: result },
        sebeb: satisId ? `Satışda bonus istifadə: ${mebleg} ₼` : `Bonus istifadə: ${mebleg} ₼`,
      });
      return { ok: true, yeniBalans: result };
    } catch (e) {
      console.error("[applyBonusToSale]", e);
      const msg = e instanceof Error ? e.message : "naməlum səhv";
      return { ok: false, error: `Tətbiq alınmadı: ${msg}` };
    }
  });
}

// ============================================================
// LOYALTY AYARLARI — sahibkar konfiqurasiyası
// ============================================================

const LoyaltySettingsSchema = z.object({
  auto_create: z.union([z.literal("1"), z.literal("on"), z.literal("")]).optional(),
  max_serf_pct: z.coerce.number().int().min(0).max(50, "Maksimum 50% icazə verilir").default(30),
  min_serf_meblegh: z.coerce.number().min(0).max(10000).default(5),
  expire_ay: z.coerce.number().int().min(0).max(120).default(6),
});

export async function saveLoyaltySettings(input: FormData): Promise<Result> {
  const permCheck = await requireKampaniyaActionPerm("loyalty.idare");
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  const parsed = LoyaltySettingsSchema.safeParse(Object.fromEntries(input.entries()));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Forma yanlışdır" };
  const { auto_create, max_serf_pct, min_serf_meblegh, expire_ay } = parsed.data;
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    try {
      const entries: { acar: string; deyer: string }[] = [
        { acar: "auto_create", deyer: auto_create === "1" || auto_create === "on" ? "true" : "false" },
        { acar: "max_serf_pct", deyer: String(max_serf_pct) },
        { acar: "min_serf_meblegh", deyer: String(min_serf_meblegh) },
        { acar: "expire_ay", deyer: String(expire_ay) },
      ];
      for (const e of entries) {
        await prisma.ayarlar.upsert({
          where: { sahibkar_id_qrup_acar: { sahibkar_id: sahibkarId, qrup: "loyalty", acar: e.acar } },
          create: { sahibkar_id: sahibkarId, qrup: "loyalty", acar: e.acar, deyer: e.deyer, nov: "string" },
          update: { deyer: e.deyer, yenilendi: new Date() },
        });
      }
      revalidatePath("/kampaniyalar/ayarlar");
      revalidatePath("/kampaniyalar/loyalty");
      bustKampaniyaCache();
      await audit("yenile", "loyalty_ayarlar", null, {
        yeni_data: { max_serf_pct, min_serf_meblegh, expire_ay, auto_create: auto_create === "1" || auto_create === "on" },
        sebeb: "Loyalty proqramı ayarları yeniləndi",
      });
      return { ok: true };
    } catch (e) {
      console.error("[saveLoyaltySettings]", e);
      const msg = e instanceof Error ? e.message : "naməlum səhv";
      return { ok: false, error: `Yadda saxlanmadı: ${msg}` };
    }
  });
}

// ============================================================
// AVTO-BITMƏ — vaxtı keçən kampaniyaları expired et
// ============================================================

export async function expireOldCampaigns(): Promise<{ ok: true; expired: number } | { ok: false; error: string }> {
  const permCheck = await requireKampaniyaActionPerm("kampaniya.idare");
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  return withTenant(async () => {
    try {
      const now = new Date();
      const r = await prisma.campaigns.updateMany({
        where: {
          status: { in: ["active", "paused"] },
          bitme: { lt: now, not: null },
        },
        data: { status: "expired", yenilendi: new Date() },
      });
      revalidatePath("/kampaniyalar");
      bustKampaniyaCache();
      if (r.count > 0) {
        await audit("expire", "kampaniya", null, {
          yeni_data: { sayi: r.count },
          sebeb: "Vaxtı keçən kampaniyalar arxivləndi (manual)",
        });
      }
      return { ok: true, expired: r.count };
    } catch (e) {
      console.error("[expireOldCampaigns]", e);
      const msg = e instanceof Error ? e.message : "naməlum səhv";
      return { ok: false, error: `Yenilənmədi: ${msg}` };
    }
  });
}

const optionalPositiveInt = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? undefined : v),
  z.coerce.number().int().positive().optional(),
);

const CreateSchema = z.object({
  ad: z.string().trim().min(2).max(200),
  aciqlamaq: z.string().max(2000).optional().or(z.literal("")),
  tip: z.string().min(2),
  status: z.enum(["draft", "active", "paused"]).default("draft"),
  baslama: z.string().optional().or(z.literal("")),
  bitme: z.string().optional().or(z.literal("")),
  prioritet: z.coerce.number().int().min(0).max(100).default(50),
  max_uses: optionalPositiveInt,
  max_per_user: optionalPositiveInt,
  stackable: z.union([z.literal("1"), z.literal("on"), z.literal("")]).optional(),
  rules_json: z.string().optional(),
  action_json: z.string().optional(),
});

export async function createCampaign(input: FormData | z.input<typeof CreateSchema>): Promise<Result> {
  const permCheck = await requireKampaniyaActionPerm("kampaniya.idare");
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  const raw = input instanceof FormData ? Object.fromEntries(input.entries()) : input;
  const parsed = CreateSchema.safeParse(raw);
  if (!parsed.success) {
    const i = parsed.error.issues[0];
    const field = i?.path.join(".") || "?";
    const msg = i?.message || "naməlum";
    return { ok: false, error: `Forma yanlışdır — ${field}: ${msg}` };
  }
  const d = parsed.data;

  // Tarix məntiqi: bitme >= baslama
  if (d.baslama && d.bitme) {
    const bsl = new Date(d.baslama);
    const btm = new Date(d.bitme);
    if (!Number.isNaN(bsl.getTime()) && !Number.isNaN(btm.getTime()) && btm < bsl) {
      return { ok: false, error: "Bitmə tarixi başlama tarixindən kiçik ola bilməz" };
    }
  }

  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    try {
      const rules = d.rules_json ? safeJson(d.rules_json) : {};
      const action = d.action_json ? safeJson(d.action_json) : {};

      const needsDiscount = ["percent_endirim", "sabit_endirim", "sebet_endirim", "flash_sale", "doğum_gunu", "welcome", "reaktivlesdir", "coupon"];
      if (needsDiscount.includes(d.tip)) {
        const a = action as Record<string, unknown>;
        if (!a.discount_type || !Number.isFinite(Number(a.value)) || Number(a.value) <= 0) {
          return { ok: false, error: "Endirim faizi / məbləği təyin edilməyib" };
        }
        // 100%-dən böyük endirim qəbul edilməz
        if (a.discount_type === "percent" && Number(a.value) > 100) {
          return { ok: false, error: "Faiz endirimi 100%-dən böyük ola bilməz" };
        }
      }

      const c = await prisma.campaigns.create({
        data: {
          sahibkar_id: sahibkarId,
          ad: d.ad,
          aciqlamaq: d.aciqlamaq || null,
          tip: d.tip,
          status: d.status,
          baslama: d.baslama ? new Date(d.baslama) : new Date(),
          bitme: d.bitme ? new Date(d.bitme) : null,
          prioritet: d.prioritet,
          max_uses: d.max_uses ?? null,
          max_per_user: d.max_per_user ?? null,
          stackable: d.stackable === "1" || d.stackable === "on",
          rules_json: rules,
          action_json: action,
          yaradan_id: istifadeciId,
        },
        select: { id: true },
      });
      revalidatePath("/kampaniyalar");
      bustKampaniyaCache();
      await audit("yarat", "kampaniya", c.id, {
        yeni_data: { ad: d.ad, tip: d.tip, status: d.status, prioritet: d.prioritet },
        sebeb: `Yeni kampaniya: ${d.ad}`,
      });
      return { ok: true, id: c.id };
    } catch (e) {
      console.error("[createCampaign]", e);
      const msg = e instanceof Error ? e.message : "naməlum səhv";
      return { ok: false, error: `Kampaniya yaradılmadı: ${msg}` };
    }
  });
}

/**
 * Mövcud kampaniyanın action_json-unu yeniləmək.
 */
export async function updateCampaignDiscount(
  id: string,
  discountType: "percent" | "fixed",
  value: number,
): Promise<Result> {
  const permCheck = await requireKampaniyaActionPerm("kampaniya.idare");
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  if (!Number.isFinite(value) || value <= 0) {
    return { ok: false, error: "Endirim dəyəri düzgün deyil" };
  }
  if (discountType === "percent" && value > 100) {
    return { ok: false, error: "Faiz endirimi 100%-dən böyük ola bilməz" };
  }
  return withTenant(async () => {
    try {
      const c = await prisma.campaigns.findFirst({ where: { id }, select: { id: true, ad: true, action_json: true } });
      if (!c) return { ok: false, error: "Kampaniya tapılmadı" };
      const current = (c.action_json ?? {}) as Record<string, unknown>;
      await prisma.campaigns.update({
        where: { id },
        data: { action_json: { ...current, discount_type: discountType, value } },
      });
      revalidatePath("/kampaniyalar");
      revalidatePath(`/kampaniyalar/${id}`);
      bustKampaniyaCache();
      await audit("yenile", "kampaniya", id, {
        evvelki_data: { discount_type: current.discount_type, value: current.value },
        yeni_data: { discount_type: discountType, value },
        sebeb: `Endirim dəyişdi: ${c.ad}`,
      });
      return { ok: true, id };
    } catch (e) {
      console.error("[updateCampaignDiscount]", e);
      const msg = e instanceof Error ? e.message : "naməlum səhv";
      return { ok: false, error: `Yenilənmədi: ${msg}` };
    }
  });
}

/** Hazır şablondan kampaniya yaratmaq — bir kliklə. */
export async function createFromTemplate(kod: string): Promise<Result> {
  const permCheck = await requireKampaniyaActionPerm("kampaniya.idare");
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  const tpl = TEMPLATES.find((t) => t.kod === kod);
  if (!tpl) return { ok: false, error: "Şablon tapılmadı" };
  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    try {
      const c = await prisma.campaigns.create({
        data: {
          sahibkar_id: sahibkarId,
          ad: tpl.ad,
          aciqlamaq: tpl.qisa,
          tip: tpl.tip,
          status: "draft",
          baslama: new Date(),
          bitme: null,
          rules_json: tpl.rules,
          action_json: tpl.action,
          ikon: tpl.emoji,
          yaradan_id: istifadeciId,
        },
        select: { id: true },
      });
      revalidatePath("/kampaniyalar");
      bustKampaniyaCache();
      await audit("yarat", "kampaniya", c.id, {
        yeni_data: { sablon_kod: kod, ad: tpl.ad, tip: tpl.tip },
        sebeb: `Şablondan kampaniya: ${tpl.ad}`,
      });
      return { ok: true, id: c.id };
    } catch (e) {
      console.error("[createFromTemplate]", e);
      const msg = e instanceof Error ? e.message : "naməlum səhv";
      return { ok: false, error: `Yaradılmadı: ${msg}` };
    }
  });
}

// Status keçidləri — finite state machine
const VALID_TRANSITIONS: Record<string, string[]> = {
  draft: ["active", "paused", "archived"],
  active: ["paused", "archived"],
  paused: ["active", "archived"],
  expired: ["archived"],
  archived: [], // arxivlənmiş kampaniya artıq açıla bilməz
};

export async function toggleCampaignStatus(id: string, status: "active" | "paused" | "archived"): Promise<Result> {
  const permCheck = await requireKampaniyaActionPerm("kampaniya.idare");
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  return withTenant(async () => {
    try {
      const before = await prisma.campaigns.findFirst({ where: { id }, select: { ad: true, status: true } });
      if (!before) return { ok: false, error: "Kampaniya tapılmadı" };
      const valid = VALID_TRANSITIONS[before.status] ?? [];
      if (!valid.includes(status)) {
        return { ok: false, error: `«${before.status}» → «${status}» keçidi icazə verilmir` };
      }
      await prisma.campaigns.update({ where: { id }, data: { status, yenilendi: new Date() } });
      revalidatePath("/kampaniyalar");
      revalidatePath(`/kampaniyalar/${id}`);
      bustKampaniyaCache();
      await audit("status", "kampaniya", id, {
        evvelki_data: { status: before.status },
        yeni_data: { status, ad: before.ad },
        sebeb: `Kampaniya statusu: ${before.status} → ${status}`,
      });
      return { ok: true };
    } catch (e) {
      console.error("[toggleCampaignStatus]", e);
      const msg = e instanceof Error ? e.message : "naməlum səhv";
      return { ok: false, error: `Dəyişdirilmədi: ${msg}` };
    }
  });
}

/**
 * Soft delete — kampaniyanı arxivlə (hard delete əvəzinə).
 */
export async function deleteCampaign(id: string): Promise<Result> {
  const permCheck = await requireKampaniyaActionPerm("kampaniya.sil");
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  return withTenant(async () => {
    try {
      const before = await prisma.campaigns.findFirst({
        where: { id },
        select: { ad: true, status: true, tip: true, current_uses: true },
      });
      if (!before) return { ok: false, error: "Kampaniya tapılmadı" };
      // Soft delete: status="archived"
      await prisma.campaigns.update({
        where: { id },
        data: { status: "archived", yenilendi: new Date() },
      });
      revalidatePath("/kampaniyalar");
      bustKampaniyaCache();
      await audit("arxiv", "kampaniya", id, {
        evvelki_data: { status: before.status, ad: before.ad, current_uses: before.current_uses },
        yeni_data: { status: "archived" },
        sebeb: `Kampaniya arxivləndi: ${before.ad}`,
      });
      return { ok: true };
    } catch (e) {
      console.error("[deleteCampaign]", e);
      const msg = e instanceof Error ? e.message : "naməlum səhv";
      return { ok: false, error: `Arxivlənmədi: ${msg}` };
    }
  });
}

// ============================================================
// LOYALTY KART
// ============================================================

export async function createLoyaltyCard(kontragentId: string): Promise<Result & { kart_kod?: string }> {
  const permCheck = await requireKampaniyaActionPerm("loyalty.idare");
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    try {
      const existing = await prisma.loyalty_cards.findFirst({
        where: { kontragent_id: kontragentId },
      });
      if (existing) return { ok: true, id: existing.id, kart_kod: existing.kart_kod };

      // 9-rəqəmli kriptoloji random kod
      const bytes = randomBytes(9);
      let suffix = "";
      const charset = "0123456789";
      for (let i = 0; i < 9; i++) suffix += charset[bytes[i] % 10];
      const kod = `LK${suffix}`;
      const card = await prisma.loyalty_cards.create({
        data: {
          sahibkar_id: sahibkarId,
          kontragent_id: kontragentId,
          kart_kod: kod,
          tier: "bronze",
        },
        select: { id: true, kart_kod: true },
      });
      revalidatePath("/kampaniyalar/loyalty");
      bustKampaniyaCache();
      await audit("yarat", "loyalty_kart", card.id, {
        yeni_data: { kontragent_id: kontragentId, kart_kod: card.kart_kod, tier: "bronze" },
        sebeb: "Yeni loyalty kart yaradıldı",
      });
      return { ok: true, id: card.id, kart_kod: card.kart_kod };
    } catch (e) {
      console.error("[createLoyaltyCard]", e);
      const msg = e instanceof Error ? e.message : "naməlum səhv";
      return { ok: false, error: `Kart yaradılmadı: ${msg}` };
    }
  });
}

/**
 * Bonus balansını manual artır/azalt.
 * KRİTİK MALİYYƏ ƏMƏLİYYATI — `loyalty.balans` icazəsi tələb olunur.
 */
export async function adjustLoyaltyBalans(
  kartId: string,
  mebleg: number,
  qeyd: string,
): Promise<Result> {
  const permCheck = await requireKampaniyaActionPerm("loyalty.balans");
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  if (!Number.isFinite(mebleg) || mebleg === 0) return { ok: false, error: "Məbləğ düzgün deyil" };
  if (Math.abs(mebleg) > 100000) return { ok: false, error: "Bir əməliyyatda 100,000 ₼-dan çox dəyişdirilə bilməz" };
  if (!qeyd || qeyd.trim().length < 2) return { ok: false, error: "Səbəb tələb olunur (audit üçün)" };
  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    try {
      const card = await prisma.loyalty_cards.findFirst({ where: { id: kartId }, include: { kontragentler: { select: { ad: true } } } });
      if (!card) return { ok: false, error: "Kart tapılmadı" };
      const evvelkiBalans = Number(card.balans);
      const yeniBalans = evvelkiBalans + mebleg;
      if (yeniBalans < 0) return { ok: false, error: "Kartda kifayət qədər balans yoxdur" };
      const nov = mebleg > 0 ? "manual_artir" : "manual_azalt";
      await prisma.$transaction([
        prisma.loyalty_cards.update({
          where: { id: kartId },
          data: {
            balans: yeniBalans,
            total_qazanc: mebleg > 0 ? { increment: mebleg } : undefined,
            total_serf: mebleg < 0 ? { increment: Math.abs(mebleg) } : undefined,
            yenilendi: new Date(),
          },
        }),
        prisma.loyalty_tx.create({
          data: {
            sahibkar_id: sahibkarId,
            kart_id: kartId,
            nov,
            mebleg,
            qaliq: yeniBalans,
            qeyd: qeyd.trim(),
            yaradan_id: istifadeciId,
          },
        }),
      ]);
      revalidatePath("/kampaniyalar/loyalty");
      bustKampaniyaCache();
      // 💰 KRİTİK audit qeydi — pul ekvivalenti dəyişdirilir
      await audit("balans_deyis", "loyalty_kart", kartId, {
        evvelki_data: { balans: evvelkiBalans },
        yeni_data: { balans: yeniBalans, deyisme: mebleg, kontragent: card.kontragentler?.ad ?? null, kart_kod: card.kart_kod },
        sebeb: `Manual balans dəyişməsi: ${qeyd.trim()}`,
      });
      return { ok: true };
    } catch (e) {
      console.error("[adjustLoyaltyBalans]", e);
      const msg = e instanceof Error ? e.message : "naməlum səhv";
      return { ok: false, error: `Dəyişdirilmədi: ${msg}` };
    }
  });
}

/** Loyalty kartın tier-ini total_qazanc-a görə yenilə. */
export async function recalcTier(kartId: string): Promise<Result> {
  const permCheck = await requireKampaniyaActionPerm("loyalty.idare");
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  return withTenant(async () => {
    try {
      const card = await prisma.loyalty_cards.findFirst({ where: { id: kartId } });
      if (!card) return { ok: false, error: "Kart tapılmadı" };
      const newTier = calcTier(Number(card.total_qazanc));
      if (newTier === card.tier) return { ok: true };
      await prisma.loyalty_cards.update({
        where: { id: kartId },
        data: { tier: newTier, yenilendi: new Date() },
      });
      revalidatePath("/kampaniyalar/loyalty");
      bustKampaniyaCache();
      await audit("tier_yenile", "loyalty_kart", kartId, {
        evvelki_data: { tier: card.tier },
        yeni_data: { tier: newTier, total_qazanc: Number(card.total_qazanc) },
        sebeb: `Tier yeniləndi: ${card.tier} → ${newTier}`,
      });
      return { ok: true };
    } catch (e) {
      console.error("[recalcTier]", e);
      const msg = e instanceof Error ? e.message : "naməlum səhv";
      return { ok: false, error: `Yenilənmədi: ${msg}` };
    }
  });
}

// ============================================================
// HƏDIYYƏ KARTI
// ============================================================

const GiftSchema = z.object({
  nominal: z.coerce.number().positive().max(100000),
  kontragent_id: z.string().uuid().optional().or(z.literal("")),
  bitme: z.string().optional().or(z.literal("")),
});

/** Mövcud hədiyyə kartını müştəriyə təyin et. */
export async function assignGiftCardToCustomer(kartId: string, kontragentId: string): Promise<Result> {
  const permCheck = await requireKampaniyaActionPerm("gift.idare");
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  return withTenant(async () => {
    try {
      const before = await prisma.gift_cards.findUnique({ where: { id: kartId }, select: { kart_kod: true, nominal: true } });
      if (!before) return { ok: false, error: "Hədiyyə kartı tapılmadı" };
      await prisma.gift_cards.update({
        where: { id: kartId },
        data: { alici_kontragent_id: kontragentId, yenilendi: new Date() },
      });
      revalidatePath("/kampaniyalar/giftcards");
      bustKampaniyaCache();
      await audit("teyin", "gift_kart", kartId, {
        yeni_data: { kart_kod: before.kart_kod, kontragent_id: kontragentId, nominal: Number(before.nominal) },
        sebeb: `Hədiyyə kartı müştəriyə təyin edildi`,
      });
      return { ok: true };
    } catch (e) {
      console.error("[assignGiftCardToCustomer]", e);
      const msg = e instanceof Error ? e.message : "naməlum səhv";
      return { ok: false, error: `Təyin edilmədi: ${msg}` };
    }
  });
}

/** Hədiyyə kartını söndür (lost/stolen/refund). */
export async function deactivateGiftCard(kartId: string): Promise<Result> {
  const permCheck = await requireKampaniyaActionPerm("gift.idare");
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  return withTenant(async () => {
    try {
      const before = await prisma.gift_cards.findUnique({ where: { id: kartId }, select: { kart_kod: true, nominal: true, qaliq: true } });
      if (!before) return { ok: false, error: "Hədiyyə kartı tapılmadı" };
      await prisma.gift_cards.update({
        where: { id: kartId },
        data: { aktiv: false, yenilendi: new Date() },
      });
      revalidatePath("/kampaniyalar/giftcards");
      bustKampaniyaCache();
      await audit("deaktiv", "gift_kart", kartId, {
        yeni_data: { kart_kod: before.kart_kod, nominal: Number(before.nominal), qaliq: Number(before.qaliq) },
        sebeb: "Hədiyyə kartı söndürüldü",
      });
      return { ok: true };
    } catch (e) {
      console.error("[deactivateGiftCard]", e);
      const msg = e instanceof Error ? e.message : "naməlum səhv";
      return { ok: false, error: `Söndürülmədi: ${msg}` };
    }
  });
}

export async function createGiftCard(input: FormData | z.input<typeof GiftSchema>): Promise<Result & { kod?: string }> {
  const permCheck = await requireKampaniyaActionPerm("gift.yarat");
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  const raw = input instanceof FormData ? Object.fromEntries(input.entries()) : input;
  const parsed = GiftSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Forma yanlışdır" };
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    try {
      // 3 cəhd, kod kolliziyası halında yeni kod try et
      let lastErr: unknown = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        const kod = generateGiftCode();
        try {
          const card = await prisma.gift_cards.create({
            data: {
              sahibkar_id: sahibkarId,
              kart_kod: kod,
              nominal: parsed.data.nominal,
              qaliq: parsed.data.nominal,
              alici_kontragent_id: parsed.data.kontragent_id || null,
              bitme_tarixi: parsed.data.bitme ? new Date(parsed.data.bitme) : null,
            },
            select: { id: true, kart_kod: true },
          });
          revalidatePath("/kampaniyalar/giftcards");
          bustKampaniyaCache();
          // 💰 KRİTİK audit — pul ekvivalenti yaradılır
          await audit("yarat", "gift_kart", card.id, {
            yeni_data: {
              kart_kod: card.kart_kod,
              nominal: parsed.data.nominal,
              kontragent_id: parsed.data.kontragent_id || null,
              bitme: parsed.data.bitme || null,
            },
            sebeb: `Hədiyyə kartı yaradıldı (${parsed.data.nominal} ₼)`,
          });
          return { ok: true, kod: card.kart_kod };
        } catch (e) {
          lastErr = e;
          if (e instanceof Error && e.message.includes("Unique")) continue;
          throw e;
        }
      }
      const msg = lastErr instanceof Error ? lastErr.message : "kod kolliziyası";
      return { ok: false, error: `Yaradılmadı: ${msg}` };
    } catch (e) {
      console.error("[createGiftCard]", e);
      const msg = e instanceof Error ? e.message : "naməlum səhv";
      return { ok: false, error: `Yaradılmadı: ${msg}` };
    }
  });
}

// ============================================================
// YENİ FUNKSIONALLIQ — Gift card balance check (public-safe)
// ============================================================

export type GiftBalanceCheck =
  | { ok: true; kart_kod: string; qaliq: number; nominal: number; bitme: Date | null; aktiv: boolean }
  | { ok: false; error: string };

/**
 * Hədiyyə kartının qalıq balansını yoxla — POS-da və müştəri panelində istifadə üçün.
 */
export async function checkGiftCardBalance(kartKod: string): Promise<GiftBalanceCheck> {
  const permCheck = await requireKampaniyaActionPerm("kampaniya.oxu");
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  const kod = kartKod.trim().toUpperCase();
  if (!/^GC[A-Z0-9]{10,14}$/.test(kod)) return { ok: false, error: "Kart kodu səhv formatdadır" };
  return withTenant(async () => {
    const card = await prisma.gift_cards.findFirst({
      where: { kart_kod: kod },
      select: { kart_kod: true, qaliq: true, nominal: true, bitme_tarixi: true, aktiv: true },
    });
    if (!card) return { ok: false, error: "Hədiyyə kartı tapılmadı" };
    return {
      ok: true,
      kart_kod: card.kart_kod,
      qaliq: Number(card.qaliq),
      nominal: Number(card.nominal),
      bitme: card.bitme_tarixi,
      aktiv: card.aktiv,
    };
  });
}

// ============================================================
// YENİ FUNKSIONALLIQ — Bulk loyalty tier recalc
// ============================================================

export async function bulkRecalcTiers(): Promise<{ ok: true; yenilenen: number; total: number } | { ok: false; error: string }> {
  const permCheck = await requireKampaniyaActionPerm("loyalty.idare");
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  return withTenant(async () => {
    try {
      const cards = await prisma.loyalty_cards.findMany({
        where: { aktiv: true },
        select: { id: true, tier: true, total_qazanc: true },
      });
      let yenilenen = 0;
      for (const card of cards) {
        const newTier = calcTier(Number(card.total_qazanc));
        if (newTier !== card.tier) {
          await prisma.loyalty_cards.update({
            where: { id: card.id },
            data: { tier: newTier, yenilendi: new Date() },
          });
          yenilenen++;
        }
      }
      revalidatePath("/kampaniyalar/loyalty");
      bustKampaniyaCache();
      await audit("bulk_tier_yenile", "loyalty_kart", null, {
        yeni_data: { yenilenen, total: cards.length },
        sebeb: `Bulk tier yenilənmə: ${yenilenen}/${cards.length}`,
      });
      return { ok: true, yenilenen, total: cards.length };
    } catch (e) {
      console.error("[bulkRecalcTiers]", e);
      const msg = e instanceof Error ? e.message : "naməlum səhv";
      return { ok: false, error: `Yenilənmədi: ${msg}` };
    }
  });
}

// ============================================================
// YENİ FUNKSIONALLIQ — Kampaniya ROI hesabatı
// ============================================================

export type CampaignRoi = {
  campaign_id: string;
  ad: string;
  istifade_sayi: number;
  endirim_cemi: number;
  satis_cemi: number;
  cixar_xerc: number;
  roi_pct: number;
};

/**
 * Kampaniya üçün ROI hesabla — endirim verildi vs gəlir əldə edildi.
 */
export async function getCampaignRoi(campaignId: string): Promise<{ ok: true; data: CampaignRoi } | { ok: false; error: string }> {
  const permCheck = await requireKampaniyaActionPerm("kampaniya.oxu");
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  return withTenant(async () => {
    try {
      const c = await prisma.campaigns.findFirst({
        where: { id: campaignId },
        select: { id: true, ad: true },
      });
      if (!c) return { ok: false, error: "Kampaniya tapılmadı" };

      const usage = await prisma.campaign_usage.aggregate({
        where: { campaign_id: campaignId },
        _count: { _all: true },
        _sum: { endirim_mebleg: true, bonus_qazanildi: true, bonus_serf: true },
      });

      // Bu kampaniya istifadə olunan satışların cəmi
      const sales = await prisma.satis_sifarisleri.aggregate({
        where: {
          campaign_usage: { some: { campaign_id: campaignId } },
          status: { not: "legv" },
        },
        _sum: { son_mebleg: true },
      }).catch(() => ({ _sum: { son_mebleg: 0 } }));

      const istifade_sayi = usage._count._all;
      const endirim_cemi = Number(usage._sum.endirim_mebleg ?? 0);
      const bonus_xerci = Number(usage._sum.bonus_qazanildi ?? 0); // gələcəkdə xərcə çevrilən
      const satis_cemi = Number(sales._sum.son_mebleg ?? 0);
      const cixar_xerc = endirim_cemi + bonus_xerci;
      const roi_pct = cixar_xerc > 0 ? Math.round(((satis_cemi - cixar_xerc) / cixar_xerc) * 100) : 0;

      return {
        ok: true,
        data: {
          campaign_id: c.id,
          ad: c.ad,
          istifade_sayi,
          endirim_cemi,
          satis_cemi,
          cixar_xerc,
          roi_pct,
        },
      };
    } catch (e) {
      console.error("[getCampaignRoi]", e);
      const msg = e instanceof Error ? e.message : "naməlum səhv";
      return { ok: false, error: `ROI hesablanmadı: ${msg}` };
    }
  });
}

// ============================================================
// HELPERS
// ============================================================

function safeJson(s: string): Record<string, unknown> {
  try { return JSON.parse(s); } catch { return {}; }
}
