"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";

type ActionResult = { ok: true } | { ok: false; error: string };

const ToggleSchema = z.object({
  sidebar_gorunsun: z.coerce.boolean().optional(),
  audit_log: z.coerce.boolean().optional(),
  qoruma_aktiv: z.coerce.boolean().optional(),
});

export async function toggleSahibkarSetting(input: FormData): Promise<ActionResult> {
  const sidebar = input.get("sidebar_gorunsun");
  const audit = input.get("audit_log");
  const qoruma = input.get("qoruma_aktiv");

  const parsed = ToggleSchema.safeParse({
    sidebar_gorunsun: sidebar == null ? undefined : sidebar === "1" || sidebar === "true",
    audit_log: audit == null ? undefined : audit === "1" || audit === "true",
    qoruma_aktiv: qoruma == null ? undefined : qoruma === "1" || qoruma === "true",
  });
  if (!parsed.success) return { ok: false, error: "Yanlış parametr" };

  return withTenant(async () => {
    const { sahibkarId, rolAd } = requireTenant();
    if (rolAd !== "sahibkar") return { ok: false, error: "Yalnız sahibkar dəyişə bilər" };

    const existing = await prisma.sahibkar_ayar.findFirst();
    const data = parsed.data;
    if (existing) {
      await prisma.sahibkar_ayar.update({ where: { id: existing.id }, data });
    } else {
      await prisma.sahibkar_ayar.create({
        data: { sahibkar_id: sahibkarId, ...data },
      });
    }
    revalidatePath("/sahibkar/ayarlar");
    revalidatePath("/sahibkar");
    return { ok: true };
  });
}

const SessionSchema = z.object({
  sessiya_muddet: z.coerce.number().int().min(1, "Min 1 dəqiqə").max(120, "Max 120 dəqiqə"),
});

export async function updateSessionTimeout(input: FormData): Promise<ActionResult> {
  const parsed = SessionSchema.safeParse({ sessiya_muddet: input.get("sessiya_muddet") });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Yanlış dəyər" };
  }
  return withTenant(async () => {
    const { sahibkarId, rolAd } = requireTenant();
    if (rolAd !== "sahibkar") return { ok: false, error: "Yalnız sahibkar dəyişə bilər" };

    const existing = await prisma.sahibkar_ayar.findFirst();
    if (existing) {
      await prisma.sahibkar_ayar.update({
        where: { id: existing.id },
        data: { sessiya_muddet: parsed.data.sessiya_muddet },
      });
    } else {
      await prisma.sahibkar_ayar.create({
        data: { sahibkar_id: sahibkarId, sessiya_muddet: parsed.data.sessiya_muddet },
      });
    }
    revalidatePath("/sahibkar/ayarlar");
    return { ok: true };
  });
}

const SecretSchema = z
  .object({
    yeni_kod: z.string().regex(/^\d{3,12}$/, "3-12 rəqəm olmalıdır"),
    yeni_kod_tekrar: z.string(),
  })
  .refine((d) => d.yeni_kod === d.yeni_kod_tekrar, {
    message: "Kodlar uyğun gəlmir",
    path: ["yeni_kod_tekrar"],
  });

export async function updateSecretCode(input: FormData): Promise<ActionResult> {
  const parsed = SecretSchema.safeParse(Object.fromEntries(input.entries()));
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Yanlış kod" };
  }
  return withTenant(async () => {
    const { sahibkarId, rolAd } = requireTenant();
    if (rolAd !== "sahibkar") return { ok: false, error: "Yalnız sahibkar dəyişə bilər" };

    const hash = await bcrypt.hash(parsed.data.yeni_kod, 10);
    const existing = await prisma.sahibkar_ayar.findFirst();
    if (existing) {
      await prisma.sahibkar_ayar.update({
        where: { id: existing.id },
        data: { gizli_kod_hash: hash },
      });
    } else {
      await prisma.sahibkar_ayar.create({
        data: { sahibkar_id: sahibkarId, gizli_kod_hash: hash },
      });
    }
    revalidatePath("/sahibkar/ayarlar");
    return { ok: true };
  });
}

const EmailSchema = z.object({
  berpa_email: z.string().email("Düzgün email daxil edin").max(255).or(z.literal("")),
});

export async function updateRecoveryEmail(input: FormData): Promise<ActionResult> {
  const parsed = EmailSchema.safeParse({ berpa_email: input.get("berpa_email") });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Yanlış email" };
  }
  return withTenant(async () => {
    const { sahibkarId, rolAd } = requireTenant();
    if (rolAd !== "sahibkar") return { ok: false, error: "Yalnız sahibkar dəyişə bilər" };

    const email = parsed.data.berpa_email || null;
    const existing = await prisma.sahibkar_ayar.findFirst();
    if (existing) {
      await prisma.sahibkar_ayar.update({
        where: { id: existing.id },
        data: { berpa_email: email, berpa_email_tesdiq: false },
      });
    } else {
      await prisma.sahibkar_ayar.create({
        data: { sahibkar_id: sahibkarId, berpa_email: email },
      });
    }
    revalidatePath("/sahibkar/ayarlar");
    return { ok: true };
  });
}

const PinChangeSchema = z
  .object({
    kohne_pin: z.string().regex(/^\d{4,8}$/),
    yeni_pin: z.string().regex(/^\d{4,8}$/, "PIN 4-8 rəqəm olmalıdır"),
    yeni_pin_tekrar: z.string(),
  })
  .refine((d) => d.yeni_pin === d.yeni_pin_tekrar, {
    message: "Yeni PIN-lər uyğun gəlmir",
    path: ["yeni_pin_tekrar"],
  });

export async function changePin(input: FormData): Promise<ActionResult> {
  const parsed = PinChangeSchema.safeParse(Object.fromEntries(input.entries()));
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Yanlış məlumat" };
  }
  return withTenant(async () => {
    const { rolAd } = requireTenant();
    if (rolAd !== "sahibkar") return { ok: false, error: "Yalnız sahibkar dəyişə bilər" };

    const cfg = await prisma.sahibkar_ayar.findFirst({ omit: { sifre_hash: false } });
    if (!cfg?.sifre_hash) return { ok: false, error: "PIN qurulmayıb" };
    const ok = await bcrypt.compare(parsed.data.kohne_pin, cfg.sifre_hash);
    if (!ok) return { ok: false, error: "Köhnə PIN səhvdir" };

    const newHash = await bcrypt.hash(parsed.data.yeni_pin, 12);
    await prisma.sahibkar_ayar.update({
      where: { id: cfg.id },
      data: { sifre_hash: newHash, yenilendi: new Date() },
    });
    revalidatePath("/sahibkar/ayarlar");
    return { ok: true };
  });
}
