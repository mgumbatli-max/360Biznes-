"use server";

import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { setPinSession } from "@/lib/sahibkar/session";
import { DEFAULT_SECRET_CODE } from "./constants";
import { safeAuditLog } from "@/lib/audit/safe-log";

export type SearchCodeResult =
  | { ok: true; redirect: "/sahibkar" | "/sahibkar/setup" }
  | { ok: false; reason: "mismatch" | "not-owner" };

/**
 * Verify the secret search-bar code and, on success, immediately establish
 * a sahibkar PIN session so the owner does not need to re-enter PIN.
 *
 * This implements the "PIN OR search code" requirement — either grants access.
 * Returns a structured result the client can act on.
 */
export async function verifySearchCode(code: string): Promise<SearchCodeResult> {
  if (!code || code.length < 3) return { ok: false, reason: "mismatch" };

  return withTenant(async () => {
    const { sahibkarId, istifadeciId, rolId } = requireTenant();
    if (rolId !== 9) return { ok: false, reason: "not-owner" } as const;

    const cfg = await prisma.sahibkar_ayar.findFirst();

    // No config row at all — default code unlocks setup flow
    if (!cfg) {
      if (code !== DEFAULT_SECRET_CODE) return { ok: false, reason: "mismatch" } as const;
      // Don't set session — they need to setup PIN first
      return { ok: true, redirect: "/sahibkar/setup" } as const;
    }

    // Owner has a custom hidden code — verify against hash
    let matches = false;
    if (cfg.gizli_kod_hash) {
      matches = await bcrypt.compare(code, cfg.gizli_kod_hash);
    } else {
      // No custom code set — fall back to default
      matches = code === DEFAULT_SECRET_CODE;
    }
    if (!matches) return { ok: false, reason: "mismatch" } as const;

    // If they have no PIN yet, send to setup
    if (!cfg.sifre_hash) {
      return { ok: true, redirect: "/sahibkar/setup" } as const;
    }

    // Code is correct and PIN exists — grant access by establishing PIN session.
    await setPinSession(sahibkarId, istifadeciId);

    // Audit log: secret-code access leaves a trail (security important)
    // safeAuditLog fail-də outbox-a düşür, console.warn-də itmir.
    if (cfg.audit_log !== false) {
      await safeAuditLog({
        sahibkar_id: sahibkarId,
        istifadeci_id: istifadeciId,
        emeliyyat: "gizli_giris",
        resurs_nov: "sahibkar_ayar",
        resurs_id: String(cfg.id),
        status: "ugur",
        sebeb: "Axtarış vasitəsilə gizli kodla giriş",
      });
    }

    return { ok: true, redirect: "/sahibkar" } as const;
  });
}
