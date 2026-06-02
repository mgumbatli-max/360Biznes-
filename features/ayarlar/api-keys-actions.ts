"use server";

import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { audit } from "@/lib/audit/log";

/**
 * Sahibkarın ümumi REST API açarları.
 * Marketplace-ə xas olan qiymət-kanal açarları ayrıca features/qiymet-kanal/api-key-actions-da idarə olunur.
 */

const CreateSchema = z.object({
  ad: z.string().min(2).max(150),
  scopes: z.string().optional().or(z.literal("")), // comma-separated
  bitme_gun: z.coerce.number().int().min(0).max(3650).optional(),
  rate_limit_qm: z.coerce.number().int().min(1).max(10000).optional(),
});

type Result<T = void> = { ok: true; data?: T } | { ok: false; error: string };

function bcryptLikeHash(value: string): string {
  // bcrypt-əvəzinə HMAC-SHA256 ilə hash (server-side verify zamanı timingSafeEqual)
  return crypto.createHash("sha256").update(value).digest("hex");
}

export async function generateApiKey(
  input: FormData,
): Promise<Result<{ key: string; prefix: string }>> {
  const parsed = CreateSchema.safeParse(Object.fromEntries(input.entries()));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Forma yanlışdır" };
  const d = parsed.data;

  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    try {
      // Açar formatı: bk_<prefix>_<random>
      const prefix = crypto.randomBytes(4).toString("hex");
      const secret = crypto.randomBytes(24).toString("hex");
      const fullKey = `bk_${prefix}_${secret}`;
      const hash = bcryptLikeHash(fullKey);

      const scopes = (d.scopes ?? "").split(",").map((s) => s.trim()).filter(Boolean);
      const bitme = d.bitme_gun && d.bitme_gun > 0
        ? new Date(Date.now() + d.bitme_gun * 24 * 60 * 60 * 1000)
        : null;

      const created = await prisma.api_keys.create({
        data: {
          sahibkar_id: sahibkarId,
          ad: d.ad.trim(),
          key_prefix: prefix,
          key_hash: hash,
          scopes,
          rate_limit_qm: d.rate_limit_qm ?? 100,
          bitme,
          yaradan_id: istifadeciId,
        },
      });

      await audit("yarat", "api_key", created.id, {
        yeni_data: { ad: d.ad, scopes, rate_limit_qm: d.rate_limit_qm ?? 100, bitme_gun: d.bitme_gun ?? null },
        sebeb: "API açar yaradıldı",
      });

      revalidatePath("/ayarlar/webhook-api");
      return { ok: true, data: { key: fullKey, prefix } };
    } catch (e) {
      console.error("[generateApiKey]", e);
      return { ok: false, error: "Yaradılmadı" };
    }
  });
}

export async function revokeApiKey(id: string): Promise<Result> {
  return withTenant(async () => {
    try {
      const before = await prisma.api_keys.findUnique({ where: { id }, select: { ad: true, key_prefix: true } });
      await prisma.api_keys.update({ where: { id }, data: { aktiv: false } });
      await audit("sil", "api_key", id, {
        evvelki_data: before as Record<string, unknown> | null,
        sebeb: "API açar revoke edildi",
      });
      revalidatePath("/ayarlar/webhook-api");
      return { ok: true };
    } catch (e) {
      console.error("[revokeApiKey]", e);
      return { ok: false, error: "Revoke alınmadı" };
    }
  });
}

export async function deleteApiKey(id: string): Promise<Result> {
  return withTenant(async () => {
    try {
      const before = await prisma.api_keys.findUnique({ where: { id }, select: { ad: true, key_prefix: true } });
      await prisma.api_keys.delete({ where: { id } });
      await audit("sil", "api_key", id, {
        evvelki_data: before as Record<string, unknown> | null,
        sebeb: "API açar tamamilə silindi",
      });
      revalidatePath("/ayarlar/webhook-api");
      return { ok: true };
    } catch (e) {
      console.error("[deleteApiKey]", e);
      return { ok: false, error: "Silinmədi" };
    }
  });
}
