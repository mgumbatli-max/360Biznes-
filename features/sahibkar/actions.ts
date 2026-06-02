"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { setPinSession, clearPinSession } from "@/lib/sahibkar/session";
import { getAttemptStatus, recordFailure, resetAttempts } from "@/lib/sahibkar/rate-limit";
import { safeAuditLog } from "@/lib/audit/safe-log";

const PIN_RULE = z.string().regex(/^\d{4,8}$/, "PIN 4-8 rəqəm olmalıdır");

const SetupSchema = z
  .object({
    pin: PIN_RULE,
    pin_tekrar: z.string(),
  })
  .refine((d) => d.pin === d.pin_tekrar, { message: "PIN-lər uyğun gəlmir", path: ["pin_tekrar"] });

type ActionResult = { ok: true } | { ok: false; error: string };

export async function setupPin(input: FormData): Promise<ActionResult> {
  const parsed = SetupSchema.safeParse(Object.fromEntries(input.entries()));
  if (!parsed.success) {
    const first = parsed.error.issues[0]?.message;
    return { ok: false, error: first ?? "Forma yanlışdır" };
  }
  return withTenant(async () => {
    const { sahibkarId, istifadeciId, rolAd } = requireTenant();
    if (rolAd !== "sahibkar") return { ok: false, error: "Yalnız sahibkar PIN qoya bilər" };

    const hash = await bcrypt.hash(parsed.data.pin, 12);

    // Upsert sahibkar_ayar row. Setup zamanı sessiya_muddet boşdursa standart 15
    // dəqiqə yazılır — sonra sahibkar/ayarlar bölməsindən dəyişdirilə bilər.
    const existing = await prisma.sahibkar_ayar.findFirst();
    if (existing) {
      await prisma.sahibkar_ayar.update({
        where: { id: existing.id },
        data: {
          sifre_hash: hash,
          sifre_nov: "pin",
          aktiv: true,
          qoruma_aktiv: true,
          // Əgər əvvəlcədən boş idisə, 15-i yaz; varsa, dəyişmə
          ...(existing.sessiya_muddet == null ? { sessiya_muddet: 15 } : {}),
        },
      });
    } else {
      await prisma.sahibkar_ayar.create({
        data: {
          sahibkar_id: sahibkarId,
          sifre_hash: hash,
          sifre_nov: "pin",
          aktiv: true,
          qoruma_aktiv: true,
          sessiya_muddet: 15, // standart, sonra dəyişdirilə bilər
        },
      });
    }
    const cfgTtl = existing?.sessiya_muddet && existing.sessiya_muddet >= 1 ? existing.sessiya_muddet : 15;
    await setPinSession(sahibkarId, istifadeciId, cfgTtl);
    // Audit: PIN qurulması / yenilənməsi — kritik təhlükəsizlik hadisəsi
    await safeAuditLog({
      sahibkar_id: sahibkarId,
      istifadeci_id: istifadeciId,
      emeliyyat: existing ? "pin_yenile" : "pin_qur",
      resurs_nov: "sahibkar_ayar",
      resurs_id: existing ? String(existing.id) : null,
      status: "ugur",
      sebeb: existing ? "Sahibkar PIN yeniləndi" : "Sahibkar PIN ilk dəfə quruldu",
    });
    return { ok: true };
  });
}

export async function verifyPin(input: FormData): Promise<ActionResult> {
  const pin = String(input.get("pin") ?? "");
  if (!PIN_RULE.safeParse(pin).success) return { ok: false, error: "PIN düzgün deyil" };

  // Rate limit check BEFORE bcrypt — cheap shield
  const status = await getAttemptStatus();
  if (status.locked) {
    const min = Math.floor((status.remainingSec ?? 0) / 60);
    const sec = (status.remainingSec ?? 0) % 60;
    return { ok: false, error: `Çox sayda yanlış cəhd. ${min}:${String(sec).padStart(2, "0")} sonra yenidən cəhd edin.` };
  }

  return withTenant(async () => {
    const { sahibkarId, istifadeciId, rolAd } = requireTenant();
    if (rolAd !== "sahibkar") return { ok: false, error: "Yalnız sahibkar girə bilər" };

    const cfg = await prisma.sahibkar_ayar.findFirst();
    if (!cfg?.sifre_hash) return { ok: false, error: "PIN qurulmayıb" };

    const ok = await bcrypt.compare(pin, cfg.sifre_hash);
    if (!ok) {
      const failed = await recordFailure(cfg.yanlis_limit ?? 5);
      // Audit failed attempts (limited — only when locking out).
      // safeAuditLog → outbox fallback, console.warn-də itmir.
      if (failed.locked && cfg.audit_log !== false) {
        await safeAuditLog({
          sahibkar_id: sahibkarId,
          istifadeci_id: istifadeciId,
          emeliyyat: "pin_lockout",
          resurs_nov: "sahibkar_ayar",
          resurs_id: String(cfg.id),
          status: "xeberdarliq",
          sebeb: `${failed.count} yanlış PIN cəhdi — 5 dəq lockout`,
        });
      }
      if (failed.locked) {
        const min = Math.floor((failed.remainingSec ?? 0) / 60);
        return { ok: false, error: `Çox sayda yanlış cəhd. ${min} dəqiqəlik lockout aktivləşdi.` };
      }
      const limit = cfg.yanlis_limit ?? 5;
      return { ok: false, error: `PIN səhvdir (${failed.count}/${limit} cəhd).` };
    }

    const ttl = cfg.sessiya_muddet && cfg.sessiya_muddet >= 1 ? cfg.sessiya_muddet : 15;
    await setPinSession(sahibkarId, istifadeciId, ttl);
    await resetAttempts();
    // Audit: uğurlu sahibkar PIN girişi
    if (cfg.audit_log !== false) {
      await safeAuditLog({
        sahibkar_id: sahibkarId,
        istifadeci_id: istifadeciId,
        emeliyyat: "pin_giris",
        resurs_nov: "sahibkar_ayar",
        resurs_id: String(cfg.id),
        status: "ugur",
        sebeb: "Sahibkar PIN ilə girdi",
      });
    }
    return { ok: true };
  });
}

export async function lockSahibkar() {
  // Audit: sahibkar bölməsindən çıxış
  try {
    await withTenant(async () => {
      const { sahibkarId, istifadeciId } = requireTenant();
      const cfg = await prisma.sahibkar_ayar.findFirst();
      if (cfg?.audit_log !== false) {
        await safeAuditLog({
          sahibkar_id: sahibkarId,
          istifadeci_id: istifadeciId,
          emeliyyat: "pin_cixis",
          resurs_nov: "sahibkar_ayar",
          resurs_id: cfg ? String(cfg.id) : null,
          status: "ugur",
          sebeb: "Sahibkar bölməsindən çıxış (lock)",
        });
      }
    });
  } catch {
    // Audit səhvi çıxış axınını dayandırmasın
  }
  await clearPinSession();
  redirect("/dashboard");
}
