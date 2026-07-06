"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { ensurePermission } from "@/lib/auth/role-check";
import { generateWebhookSecret } from "@/lib/webhook-verify";

const QRUP = "kanal_webhook_secret";
const KanalSchema = z.object({ kanal: z.string().min(2).max(40) });

type Result<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

/** Yeni webhook secret yaradır (köhnəni əvəz edir — rotation). Plaintext bir dəfə qaytarılır. */
export async function generateWebhookSecretForKanal(
  input: z.input<typeof KanalSchema>,
): Promise<Result<{ secret: string }>> {
  const parsed = KanalSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Yanlış" };
  const { kanal } = parsed.data;
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    ensurePermission("ayar.api_key","ayar.kanal");
    const exists = await prisma.qiymet_kanal_komissiya.findUnique({
      where: { sahibkar_id_kanal: { sahibkar_id: sahibkarId, kanal } },
      select: { id: true },
    });
    if (!exists) return { ok: false, error: "Kanal mövcud deyil" };

    const secret = generateWebhookSecret();
    // Webhook secret üçün plaintext lazımdır — HMAC verifikasiyası body-ni
    // eyni secret-lə yenidən imzalayır. Bu Stripe/GitHub patternidir.
    // API key-dən fərqli olaraq, hash müqayisə işləmir.
    const payload = JSON.stringify({ secret, created: new Date().toISOString() });

    await prisma.ayarlar.upsert({
      where: {
        sahibkar_id_qrup_acar: { sahibkar_id: sahibkarId, qrup: QRUP, acar: kanal },
      },
      create: { sahibkar_id: sahibkarId, qrup: QRUP, acar: kanal, deyer: payload, nov: "string" },
      update: { deyer: payload, yenilendi: new Date() },
    });
    revalidatePath("/ayarlar/kanallar");
    return { ok: true, data: { secret } };
  });
}

export async function revokeWebhookSecret(input: z.input<typeof KanalSchema>): Promise<Result> {
  const parsed = KanalSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Yanlış" };
  const { kanal } = parsed.data;
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    ensurePermission("ayar.api_key","ayar.kanal");
    await prisma.ayarlar.deleteMany({
      where: { sahibkar_id: sahibkarId, qrup: QRUP, acar: kanal },
    });
    revalidatePath("/ayarlar/kanallar");
    return { ok: true };
  });
}

export async function listWebhookSecretStatus(): Promise<Record<string, { created: string }>> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const rows = await prisma.ayarlar.findMany({
      where: { sahibkar_id: sahibkarId, qrup: QRUP },
      select: { acar: true, deyer: true },
    });
    const out: Record<string, { created: string }> = {};
    for (const r of rows) {
      try {
        const p = JSON.parse(r.deyer ?? "{}") as { created?: string };
        out[r.acar] = { created: p.created ?? "" };
      } catch {}
    }
    return out;
  });
}

/** SERVER-ONLY (webhook endpoint daxili) — bütün sahibkarlar üzrə bu kanal üçün
 * plaintext secret-ləri qaytarır. Verifikasiya zamanı body-ni hər secret ilə
 * imzalayıb signature ilə müqayisə edirik. Match olan secret-in sahibkar-ı qaytarılır. */
// QA-audit KRİTİK: findWebhookSecretsForKanal buradan (bir "use server" faylı) SİLİNDİ —
// export olunduğu üçün açıq server-action kimi expose olunurdu (cross-tenant secret sızması).
// İndi lib/qiymet-kanal/webhook-secrets.ts ("server-only") daxilindədir; route handler oradan import edir.
