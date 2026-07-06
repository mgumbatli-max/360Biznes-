import "server-only";
import { prismaUnscoped } from "@/lib/db/prisma";
import { hashApiKey } from "@/lib/api-key";

// QA-audit KRİTİK: bu iki funksiya CROSS-TENANT (prismaUnscoped) sorğu edir və plaintext
// webhook secret / api-key hash oxuyur. Əvvəl "use server" fayllarından (webhook-actions.ts,
// api-key-actions.ts) export olunurdu → Next.js onları AÇIQ, çağırıla bilən Server Action
// endpoint kimi qeydiyyata alırdı: guard-sız + tenant-siz → istənilən şəxs bütün tenant-ların
// secret-lərini oxuya bilirdi. İndi "server-only" lib faylındadır → YALNIZ server kodundan
// (route handler-lərdən) import oluna bilir, RPC endpoint kimi expose OLUNMUR.

const WEBHOOK_QRUP = "kanal_webhook_secret";
const APIKEY_QRUP = "kanal_api_key";

/**
 * SERVER-ONLY: webhook endpoint girişində (tenant təyin OLUNMAMIŞDAN əvvəl) çağırılır —
 * hansı sahibkarın secret-i uyğun gəlir tapmaq üçün cross-tenant axtarış.
 */
export async function findWebhookSecretsForKanal(
  kanal: string,
): Promise<Array<{ sahibkar_id: string; secret: string }>> {
  const rows = await prismaUnscoped.ayarlar.findMany({
    where: { qrup: WEBHOOK_QRUP, acar: kanal },
    select: { sahibkar_id: true, deyer: true },
  });
  const out: Array<{ sahibkar_id: string; secret: string }> = [];
  for (const r of rows) {
    try {
      const p = JSON.parse(r.deyer ?? "{}") as { secret?: string };
      if (p.secret) out.push({ sahibkar_id: r.sahibkar_id, secret: p.secret });
    } catch {
      /* pozuq JSON — atla */
    }
  }
  return out;
}

/**
 * SERVER-ONLY: public marketplace API endpoint-də verilmiş plaintext key-i kanal üçün yoxlayır.
 * Match olarsa sahibkar_id qaytarır (tenant təyini). Tenant kontekst yoxdur → unscoped + hash.
 */
export async function verifyApiKey(plaintext: string, kanal: string): Promise<string | null> {
  if (!plaintext || !kanal) return null;
  const hash = hashApiKey(plaintext);
  const rows = await prismaUnscoped.ayarlar.findMany({
    where: { qrup: APIKEY_QRUP, acar: kanal },
    select: { sahibkar_id: true, deyer: true },
  });
  for (const r of rows) {
    try {
      const p = JSON.parse(r.deyer ?? "{}") as { hash?: string };
      if (p.hash === hash) return r.sahibkar_id;
    } catch {
      /* pozuq JSON — atla */
    }
  }
  return null;
}
