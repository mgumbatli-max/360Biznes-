"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { ensurePermission } from "@/lib/auth/role-check";
import { generateApiKey } from "@/lib/api-key";

const AYARLAR_QRUP = "kanal_api_key";

type Result<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

const KanalSchema = z.object({
  kanal: z.string().min(2).max(40),
});

/**
 * Kanal üçün yeni API key yaradır (köhnəni əvəz edir — rotate edilmiş sayılır).
 * Plaintext yalnız BIR DƏFƏ qaytarılır, sonra göstərilmir.
 */
export async function generateKanalApiKey(input: z.input<typeof KanalSchema>): Promise<Result<{ key: string }>> {
  const parsed = KanalSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Yanlış" };
  const { kanal } = parsed.data;
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    ensurePermission("ayar.api_key","ayar.kanal");
    try {
      // Bu kanal həqiqətən mövcuddurmu?
      const exists = await prisma.qiymet_kanal_komissiya.findUnique({
        where: { sahibkar_id_kanal: { sahibkar_id: sahibkarId, kanal } },
        select: { id: true },
      });
      if (!exists) return { ok: false, error: "Kanal mövcud deyil. Əvvəl yaradın." };

      const { plaintext, hash } = generateApiKey(sahibkarId);
      const payload = JSON.stringify({
        hash,
        created: new Date().toISOString(),
        version: 1,
      });

      await prisma.ayarlar.upsert({
        where: {
          sahibkar_id_qrup_acar: {
            sahibkar_id: sahibkarId,
            qrup: AYARLAR_QRUP,
            acar: kanal,
          },
        },
        create: {
          sahibkar_id: sahibkarId,
          qrup: AYARLAR_QRUP,
          acar: kanal,
          deyer: payload,
          nov: "string",
        },
        update: {
          deyer: payload,
          yenilendi: new Date(),
        },
      });

      revalidatePath("/ayarlar/kanallar");
      return { ok: true, data: { key: plaintext } };
    } catch (e) {
      console.error("[generateKanalApiKey]", e);
      return { ok: false, error: "Key yaradıla bilmədi" };
    }
  });
}

export async function revokeKanalApiKey(input: z.input<typeof KanalSchema>): Promise<Result> {
  const parsed = KanalSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Yanlış" };
  const { kanal } = parsed.data;
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    ensurePermission("ayar.api_key","ayar.kanal");
    try {
      await prisma.ayarlar.deleteMany({
        where: { sahibkar_id: sahibkarId, qrup: AYARLAR_QRUP, acar: kanal },
      });
      revalidatePath("/ayarlar/kanallar");
      return { ok: true };
    } catch (e) {
      console.error("[revokeKanalApiKey]", e);
      return { ok: false, error: "Silinmədi" };
    }
  });
}

/**
 * Hansı kanalların API key-i mövcud olduğunu qaytarır (key özünü yox, sadəcə
 * mövcudluq + yaradılma tarixini).
 */
export async function listKanalApiKeyStatus(): Promise<Record<string, { created: string }>> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const rows = await prisma.ayarlar.findMany({
      where: { sahibkar_id: sahibkarId, qrup: AYARLAR_QRUP },
      select: { acar: true, deyer: true },
    });
    const out: Record<string, { created: string }> = {};
    for (const r of rows) {
      try {
        const p = JSON.parse(r.deyer ?? "{}") as { created?: string };
        out[r.acar] = { created: p.created ?? "" };
      } catch {
        /* */
      }
    }
    return out;
  });
}

// QA-audit KRİTİK: verifyApiKey buradan (bir "use server" faylı) SİLİNDİ — export olunduğu
// üçün açıq server-action kimi expose olunurdu (cross-tenant açar-probe). İndi
// lib/qiymet-kanal/webhook-secrets.ts ("server-only") daxilindədir; route handler oradan import edir.
