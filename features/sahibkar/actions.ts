"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { setPinSession, clearPinSession, touchPinSession } from "@/lib/sahibkar/session";
import { getAttemptStatus, recordFailure, resetAttempts } from "@/lib/sahibkar/rate-limit";

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
    const { sahibkarId, istifadeciId, rolId } = requireTenant();
    if (rolId !== 9) return { ok: false, error: "Yalnız sahibkar PIN qoya bilər" };

    const hash = await bcrypt.hash(parsed.data.pin, 12);

    // Upsert sahibkar_ayar row
    const existing = await prisma.sahibkar_ayar.findFirst();
    if (existing) {
      await prisma.sahibkar_ayar.update({
        where: { id: existing.id },
        data: { sifre_hash: hash, sifre_nov: "pin", aktiv: true, qoruma_aktiv: true },
      });
    } else {
      await prisma.sahibkar_ayar.create({
        data: { sahibkar_id: sahibkarId, sifre_hash: hash, sifre_nov: "pin", aktiv: true, qoruma_aktiv: true },
      });
    }
    // Yeni qurulan PIN üçün də user-ın konfiqurasiya etdiyi sessiya müddətini tətbiq et
    const cfgTtl = (existing?.sessiya_muddet ?? 15) || 15;
    await setPinSession(sahibkarId, istifadeciId, cfgTtl);
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
    const { sahibkarId, istifadeciId, rolId } = requireTenant();
    if (rolId !== 9) return { ok: false, error: "Yalnız sahibkar girə bilər" };

    const cfg = await prisma.sahibkar_ayar.findFirst();
    if (!cfg?.sifre_hash) return { ok: false, error: "PIN qurulmayıb" };

    const ok = await bcrypt.compare(pin, cfg.sifre_hash);
    if (!ok) {
      const failed = await recordFailure(cfg.yanlis_limit ?? 5);
      // Audit failed attempts (limited — only when locking out)
      if (failed.locked && cfg.audit_log !== false) {
        try {
          await prisma.audit_log.create({
            data: {
              sahibkar_id: sahibkarId,
              istifadeci_id: istifadeciId,
              emeliyyat: "pin_lockout",
              resurs_nov: "sahibkar_ayar",
              resurs_id: String(cfg.id),
              status: "xeberdarliq",
              sebeb: `${failed.count} yanlış PIN cəhdi — 5 dəq lockout`,
            },
          });
        } catch { /* silent */ }
      }
      if (failed.locked) {
        const min = Math.floor((failed.remainingSec ?? 0) / 60);
        return { ok: false, error: `Çox sayda yanlış cəhd. ${min} dəqiqəlik lockout aktivləşdi.` };
      }
      const limit = cfg.yanlis_limit ?? 5;
      return { ok: false, error: `PIN səhvdir (${failed.count}/${limit} cəhd).` };
    }

    const ttl = (cfg.sessiya_muddet ?? 15) || 15;
    await setPinSession(sahibkarId, istifadeciId, ttl);
    await resetAttempts();
    return { ok: true };
  });
}

export async function lockSahibkar() {
  await clearPinSession();
  redirect("/dashboard");
}

/**
 * Client-tərəfli aktivlik sliding-TTL üçün cookie refresh-i.
 * Sahibkar/layout-da SessionCountdown bunu throttled (~30s) çağırır.
 * Cavabda yeni absolute expiresAt (unix saniyə) qaytarır ki, sayğac sinxronlaşsın.
 */
export async function refreshSahibkarSession(): Promise<{ expiresAt: number; ttlSec: number } | null> {
  const cfg = await withTenant(async () => prisma.sahibkar_ayar.findFirst({ select: { sessiya_muddet: true } })).catch(() => null);
  const ttl = (cfg?.sessiya_muddet ?? 15) || 15;
  const sess = await touchPinSession(ttl);
  if (!sess) return null;
  return { expiresAt: sess.exp, ttlSec: ttl * 60 };
}
