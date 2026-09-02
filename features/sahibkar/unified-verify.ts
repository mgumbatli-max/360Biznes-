"use server";

import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { setPinSession } from "@/lib/sahibkar/session";
import { getAttemptStatus, recordFailure, resetAttempts } from "@/lib/sahibkar/rate-limit";
import { DEFAULT_SECRET_CODE } from "./constants";
import { safeAuditLog } from "@/lib/audit/safe-log";

type Result = { ok: true } | { ok: false; error: string };

/**
 * Single entry point that tries BOTH the PIN and the secret code in order.
 * The verify page uses this so the owner can use either method on the same field.
 */
export async function verifyPinOrCode(input: FormData): Promise<Result> {
  const value = String(input.get("kod") ?? "").trim();
  if (!/^\d{3,12}$/.test(value)) return { ok: false, error: "3-12 rəqəm daxil edin" };

  return withTenant(async () => {
    const { sahibkarId, istifadeciId, rolAd } = requireTenant();
    if (rolAd !== "sahibkar") return { ok: false, error: "İcazə yoxdur" };

    // QA-audit: rate-limit SERVER-avtoritativ (sahibkar_id ilə).
    const status = await getAttemptStatus(sahibkarId);
    if (status.locked) {
      const min = Math.floor((status.remainingSec ?? 0) / 60);
      const sec = (status.remainingSec ?? 0) % 60;
      return { ok: false, error: `Çox sayda yanlış cəhd. ${min}:${String(sec).padStart(2, "0")} sonra yenidən` };
    }

    const cfg = await prisma.sahibkar_ayar.findFirst({ omit: { sifre_hash: false } });
    if (!cfg) return { ok: false, error: "Sahibkar bölməsi qurulmayıb. /sahibkar/setup-a keçin." };

    // Try PIN first (4-8 digits expected for PIN)
    if (cfg.sifre_hash && /^\d{4,8}$/.test(value)) {
      const ok = await bcrypt.compare(value, cfg.sifre_hash);
      if (ok) {
        await setPinSession(sahibkarId, istifadeciId);
        await resetAttempts(sahibkarId);
        return { ok: true };
      }
    }

    // Then try secret code
    let codeMatch = false;
    if (cfg.gizli_kod_hash) {
      codeMatch = await bcrypt.compare(value, cfg.gizli_kod_hash);
    } else {
      codeMatch = value === DEFAULT_SECRET_CODE;
    }

    if (codeMatch) {
      await setPinSession(sahibkarId, istifadeciId);
      await resetAttempts(sahibkarId);
      // Audit successful secret-code entry — outbox fallback varsa itmir
      if (cfg.audit_log !== false) {
        await safeAuditLog({
          sahibkar_id: sahibkarId,
          istifadeci_id: istifadeciId,
          emeliyyat: "gizli_giris",
          resurs_nov: "sahibkar_ayar",
          resurs_id: String(cfg.id),
          status: "ugur",
          sebeb: "Vahid forma vasitəsilə gizli kodla giriş",
        });
      }
      return { ok: true };
    }

    // Neither — record failure
    const failed = await recordFailure(sahibkarId, cfg.yanlis_limit ?? 5);
    if (failed.locked) {
      const min = Math.floor((failed.remainingSec ?? 0) / 60);
      return { ok: false, error: `Çox sayda yanlış cəhd. ${min} dəqiqəlik lockout aktivləşdi.` };
    }
    const limit = cfg.yanlis_limit ?? 5;
    return { ok: false, error: `PIN və ya kod səhvdir (${failed.count}/${limit})` };
  });
}
