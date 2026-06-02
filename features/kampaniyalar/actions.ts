"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { TEMPLATES } from "./templates";
import { calcTier, TIP_META, type KampaniyaTip } from "./types";
import { applyCoupon as _applyCoupon, type AppliedCampaign } from "./matcher";

/** Tək kuponu aktiv/deaktiv etmək. */
export async function toggleCouponActive(id: string, aktiv: boolean): Promise<Result> {
  return withTenant(async () => {
    try {
      await prisma.coupons.update({ where: { id }, data: { aktiv } });
      revalidatePath("/kampaniyalar/kuponlar");
      return { ok: true };
    } catch (e) {
      console.error("[toggleCouponActive]", e);
      return { ok: false, error: "Yenilənmədi" };
    }
  });
}

/** Server action wrapper — applyCoupon-u client komponentdən çağırmaq üçün. */
export async function applyCouponAction(
  kod: string,
  cemi: number,
  kontragentId: string | null,
): Promise<{ ok: true; applied: AppliedCampaign } | { ok: false; error: string }> {
  return _applyCoupon(kod, { lines: [], cemi, kontragent_id: kontragentId, kanal: "pos" });
}

type Result = { ok: true; id?: string } | { ok: false; error: string };

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
  const parsed = BulkCouponSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Forma yanlışdır" };
  const { campaign_id, prefix, count, max_uses_per_kod, bitme } = parsed.data;

  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    try {
      // Kampaniya yoxlaması
      const c = await prisma.campaigns.findFirst({ where: { id: campaign_id } });
      if (!c) return { ok: false, error: "Kampaniya tapılmadı" };

      const bitmeDate = bitme ? new Date(bitme) : null;
      const codes: string[] = [];
      const data: { sahibkar_id: string; campaign_id: string; kod: string; max_uses: number; bitme_tarixi: Date | null }[] = [];

      // 6-rəqəmli unikal hissə (alfa-num, 0/O/I/1 çıxarılır — anlam qarışıqlığını azaltmaq üçün)
      const charset = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
      const usedKeys = new Set<string>();
      for (let i = 0; i < count; i++) {
        let kod: string;
        let attempts = 0;
        do {
          let suffix = "";
          for (let k = 0; k < 6; k++) suffix += charset[Math.floor(Math.random() * charset.length)];
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

      await prisma.coupons.createMany({
        data,
        skipDuplicates: true,
      });
      revalidatePath(`/kampaniyalar/${campaign_id}`);
      return { ok: true, created: codes.length, sample: codes.slice(0, 5) };
    } catch (e) {
      console.error("[bulkGenerateCoupons]", e);
      return { ok: false, error: "Yaradılmadı" };
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
  const parsed = BroadcastSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Forma yanlışdır" };

  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    try {
      const c = await prisma.campaigns.findFirst({ where: { id: parsed.data.campaign_id } });
      if (!c) return { ok: false, error: "Kampaniya tapılmadı" };

      // Sahibkar Telegram chat_id konfiqurasiyasını yoxla
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

      return { ok: true, sent: 1 };
    } catch (e) {
      console.error("[broadcastCampaignToTelegram]", e);
      return { ok: false, error: "Göndərmə alınmadı" };
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
 */
export async function findLoyaltyCard(query: string): Promise<FoundLoyaltyCard | null> {
  const q = query.trim();
  if (q.length < 3) return null;
  return withTenant(async () => {
    // 1. Kart kodu
    if (/^LK\d{9}$/i.test(q)) {
      const c = await prisma.loyalty_cards.findFirst({
        where: { kart_kod: q.toUpperCase(), aktiv: true },
        include: { kontragentler: { select: { id: true, ad: true, telefon: true } } },
      });
      if (c) return mapLoyalty(c);
    }
    // 2. Telefon
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
    // 3. Ad axtarış
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
 * - Balansdan mebleg çıxılır
 * - loyalty_tx-də "serf" nov-i ilə yazılır
 */
export async function applyBonusToSale(
  kartId: string,
  satisId: string | null,
  mebleg: number,
): Promise<{ ok: true; yeniBalans: number } | { ok: false; error: string }> {
  if (!Number.isFinite(mebleg) || mebleg <= 0) return { ok: false, error: "Məbləğ düzgün deyil" };
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    try {
      const card = await prisma.loyalty_cards.findFirst({ where: { id: kartId } });
      if (!card) return { ok: false, error: "Kart tapılmadı" };
      const balans = Number(card.balans);
      if (mebleg > balans) return { ok: false, error: `Balans yalnız ${balans} ₼-dir` };

      const yeniBalans = balans - mebleg;
      await prisma.$transaction([
        prisma.loyalty_cards.update({
          where: { id: kartId },
          data: {
            balans: yeniBalans,
            total_serf: { increment: mebleg },
            son_alish_de: new Date(),
            yenilendi: new Date(),
          },
        }),
        prisma.loyalty_tx.create({
          data: {
            sahibkar_id: sahibkarId,
            kart_id: kartId,
            satis_id: satisId,
            nov: "serf",
            mebleg: -mebleg,
            qaliq: yeniBalans,
            qeyd: satisId ? `Satış #${satisId.slice(0, 8)}` : "Bonus istifadə",
          },
        }),
      ]);
      revalidatePath("/kampaniyalar/loyalty");
      return { ok: true, yeniBalans };
    } catch (e) {
      console.error("[applyBonusToSale]", e);
      return { ok: false, error: "Tətbiq alınmadı" };
    }
  });
}

// ============================================================
// LOYALTY AYARLARI — sahibkar konfiqurasiyası
// ============================================================

const LoyaltySettingsSchema = z.object({
  auto_create: z.union([z.literal("1"), z.literal("on"), z.literal("")]).optional(),
  max_serf_pct: z.coerce.number().int().min(0).max(100).default(30),
  min_serf_meblegh: z.coerce.number().min(0).max(10000).default(5),
  expire_ay: z.coerce.number().int().min(0).max(120).default(6),
});

export async function saveLoyaltySettings(input: FormData): Promise<Result> {
  const parsed = LoyaltySettingsSchema.safeParse(Object.fromEntries(input.entries()));
  if (!parsed.success) return { ok: false, error: "Forma yanlışdır" };
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
          where: {
            sahibkar_id_qrup_acar: { sahibkar_id: sahibkarId, qrup: "loyalty", acar: e.acar },
          },
          create: { sahibkar_id: sahibkarId, qrup: "loyalty", acar: e.acar, deyer: e.deyer, nov: "string" },
          update: { deyer: e.deyer, yenilendi: new Date() },
        });
      }
      revalidatePath("/kampaniyalar/ayarlar");
      revalidatePath("/kampaniyalar/loyalty");
      return { ok: true };
    } catch (e) {
      console.error("[saveLoyaltySettings]", e);
      return { ok: false, error: "Yadda saxlanmadı" };
    }
  });
}

// ============================================================
// AVTO-BITMƏ — vaxtı keçən kampaniyaları expired et
// ============================================================

export async function expireOldCampaigns(): Promise<{ ok: true; expired: number } | { ok: false; error: string }> {
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
      return { ok: true, expired: r.count };
    } catch (e) {
      console.error("[expireOldCampaigns]", e);
      return { ok: false, error: "Yenilənmədi" };
    }
  });
}

// Optional number sahəsi — boş string olduqda `undefined`-a çevir,
// əks halda `z.coerce.number()` boş stringi 0-a çevirib `positive()`-i pozur.
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
  rules_json: z.string().optional(),    // JSON string
  action_json: z.string().optional(),   // JSON string
});

export async function createCampaign(input: FormData | z.input<typeof CreateSchema>): Promise<Result> {
  const raw = input instanceof FormData ? Object.fromEntries(input.entries()) : input;
  const parsed = CreateSchema.safeParse(raw);
  if (!parsed.success) {
    const i = parsed.error.issues[0];
    const field = i?.path.join(".") || "?";
    const msg = i?.message || "naməlum";
    return { ok: false, error: `Forma yanlışdır — ${field}: ${msg}` };
  }
  const d = parsed.data;
  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    try {
      const rules = d.rules_json ? safeJson(d.rules_json) : {};
      const action = d.action_json ? safeJson(d.action_json) : {};

      // Kupon / endirim tipləri üçün endirim konfiqurasiyası məcburidir
      const needsDiscount = ["percent_endirim", "sabit_endirim", "sebet_endirim", "flash_sale", "doğum_gunu", "welcome", "reaktivlesdir", "coupon"];
      if (needsDiscount.includes(d.tip)) {
        const a = action as Record<string, unknown>;
        if (!a.discount_type || !Number.isFinite(Number(a.value)) || Number(a.value) <= 0) {
          return { ok: false, error: "Endirim faizi / məbləği təyin edilməyib" };
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
      return { ok: true, id: c.id };
    } catch (e) {
      console.error("[createCampaign]", e);
      return { ok: false, error: "Kampaniya yaradılmadı" };
    }
  });
}

/**
 * Mövcud kampaniyanın action_json-unu yeniləmək — köhnə boş kupon kampaniyalarını fix etmək üçün.
 * Sahibkar/admin role tələb olunur.
 */
export async function updateCampaignDiscount(
  id: string,
  discountType: "percent" | "fixed",
  value: number,
): Promise<Result> {
  if (!Number.isFinite(value) || value <= 0) {
    return { ok: false, error: "Endirim dəyəri düzgün deyil" };
  }
  return withTenant(async () => {
    const { rolAd } = requireTenant();
    if (rolAd !== "sahibkar" && rolAd !== "admin") {
      return { ok: false, error: "İcazə yoxdur" };
    }
    try {
      const c = await prisma.campaigns.findFirst({ where: { id }, select: { id: true, action_json: true } });
      if (!c) return { ok: false, error: "Kampaniya tapılmadı" };
      const current = (c.action_json ?? {}) as Record<string, unknown>;
      await prisma.campaigns.update({
        where: { id },
        data: { action_json: { ...current, discount_type: discountType, value } },
      });
      revalidatePath("/kampaniyalar");
      revalidatePath(`/kampaniyalar/${id}`);
      return { ok: true, id };
    } catch (e) {
      console.error("[updateCampaignDiscount]", e);
      return { ok: false, error: "Yenilənmədi" };
    }
  });
}

/** Hazır şablondan kampaniya yaratmaq — bir kliklə. */
export async function createFromTemplate(kod: string): Promise<Result> {
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
      return { ok: true, id: c.id };
    } catch (e) {
      console.error("[createFromTemplate]", e);
      return { ok: false, error: "Yaradılmadı" };
    }
  });
}

export async function toggleCampaignStatus(id: string, status: "active" | "paused" | "archived"): Promise<Result> {
  return withTenant(async () => {
    try {
      await prisma.campaigns.update({ where: { id }, data: { status, yenilendi: new Date() } });
      revalidatePath("/kampaniyalar");
      revalidatePath(`/kampaniyalar/${id}`);
      return { ok: true };
    } catch (e) {
      console.error("[toggleCampaignStatus]", e);
      return { ok: false, error: "Dəyişdirilmədi" };
    }
  });
}

export async function deleteCampaign(id: string): Promise<Result> {
  return withTenant(async () => {
    try {
      await prisma.campaigns.delete({ where: { id } });
      revalidatePath("/kampaniyalar");
      return { ok: true };
    } catch (e) {
      console.error("[deleteCampaign]", e);
      return { ok: false, error: "Silinmədi" };
    }
  });
}

// ============================================================
// LOYALTY KART
// ============================================================

export async function createLoyaltyCard(kontragentId: string): Promise<Result & { kart_kod?: string }> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    try {
      // Artıq var?
      const existing = await prisma.loyalty_cards.findFirst({
        where: { kontragent_id: kontragentId },
      });
      if (existing) return { ok: true, id: existing.id, kart_kod: existing.kart_kod };

      // 9-rəqəmli unikal kod
      const kod = `LK${Date.now().toString().slice(-9)}`;
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
      return { ok: true, id: card.id, kart_kod: card.kart_kod };
    } catch (e) {
      console.error("[createLoyaltyCard]", e);
      return { ok: false, error: "Kart yaradılmadı" };
    }
  });
}

export async function adjustLoyaltyBalans(
  kartId: string,
  mebleg: number,
  qeyd: string,
): Promise<Result> {
  if (!Number.isFinite(mebleg) || mebleg === 0) return { ok: false, error: "Məbləğ düzgün deyil" };
  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    try {
      const card = await prisma.loyalty_cards.findFirst({ where: { id: kartId } });
      if (!card) return { ok: false, error: "Kart tapılmadı" };
      const yeniBalans = Number(card.balans) + mebleg;
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
            qeyd,
            yaradan_id: istifadeciId,
          },
        }),
      ]);
      revalidatePath("/kampaniyalar/loyalty");
      return { ok: true };
    } catch (e) {
      console.error("[adjustLoyaltyBalans]", e);
      return { ok: false, error: "Dəyişdirilmədi" };
    }
  });
}

/** Loyalty kartın tier-ini total_qazanc-a görə yenilə. */
export async function recalcTier(kartId: string): Promise<Result> {
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
      return { ok: true };
    } catch (e) {
      console.error("[recalcTier]", e);
      return { ok: false, error: "Yenilənmədi" };
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
  return withTenant(async () => {
    try {
      await prisma.gift_cards.update({
        where: { id: kartId },
        data: { alici_kontragent_id: kontragentId, yenilendi: new Date() },
      });
      revalidatePath("/kampaniyalar/giftcards");
      return { ok: true };
    } catch (e) {
      console.error("[assignGiftCardToCustomer]", e);
      return { ok: false, error: "Təyin edilmədi" };
    }
  });
}

/** Hədiyyə kartını söndür (lost/stolen/refund). */
export async function deactivateGiftCard(kartId: string): Promise<Result> {
  return withTenant(async () => {
    try {
      await prisma.gift_cards.update({
        where: { id: kartId },
        data: { aktiv: false, yenilendi: new Date() },
      });
      revalidatePath("/kampaniyalar/giftcards");
      return { ok: true };
    } catch (e) {
      console.error("[deactivateGiftCard]", e);
      return { ok: false, error: "Söndürülmədi" };
    }
  });
}

export async function createGiftCard(input: FormData | z.input<typeof GiftSchema>): Promise<Result & { kod?: string }> {
  const raw = input instanceof FormData ? Object.fromEntries(input.entries()) : input;
  const parsed = GiftSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Forma yanlışdır" };
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    try {
      const kod = `GC${Date.now().toString().slice(-10).toUpperCase()}`;
      const card = await prisma.gift_cards.create({
        data: {
          sahibkar_id: sahibkarId,
          kart_kod: kod,
          nominal: parsed.data.nominal,
          qaliq: parsed.data.nominal,
          alici_kontragent_id: parsed.data.kontragent_id || null,
          bitme_tarixi: parsed.data.bitme ? new Date(parsed.data.bitme) : null,
        },
        select: { kart_kod: true },
      });
      revalidatePath("/kampaniyalar/giftcards");
      return { ok: true, kod: card.kart_kod };
    } catch (e) {
      console.error("[createGiftCard]", e);
      return { ok: false, error: "Yaradılmadı" };
    }
  });
}

// ============================================================
// HELPERS
// ============================================================

function safeJson(s: string): Record<string, unknown> {
  try { return JSON.parse(s); } catch { return {}; }
}
