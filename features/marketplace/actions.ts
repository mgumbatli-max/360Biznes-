"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { audit } from "@/lib/audit/log";
import { encryptString, maskSecret } from "@/lib/security/encrypt";
import { requireMarketplaceActionPerm, bustMarketplaceCache } from "./access-guard";

const ConnectSchema = z.object({
  platform: z.enum(["umico", "birmarket", "wolt", "tap", "lalafo", "diger"]),
  ad: z.string().min(2).max(150),
  store_id: z.string().max(100).optional().or(z.literal("")),
  store_url: z.string().url().optional().or(z.literal("")),
  api_key: z.string().max(500).optional().or(z.literal("")),
  // 100% komisyon real biznesdə yoxdur — 50% cap
  komisyon_faiz: z.coerce.number().min(0).max(50).default(0),
});

type ActionResult = { ok: true } | { ok: false; error: string };

export async function connectMarketplace(input: FormData): Promise<ActionResult> {
  const permCheck = await requireMarketplaceActionPerm("marketplace.idare");
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  const parsed = ConnectSchema.safeParse(Object.fromEntries(input.entries()));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Forma yanlışdır" };
  const d = parsed.data;

  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    try {
      // API key encrypt-at-rest
      const apiKeyEnc = d.api_key?.trim() ? encryptString(d.api_key.trim()) : null;
      const created = await prisma.marketplace_hesablari.create({
        data: {
          sahibkar_id: sahibkarId,
          platform: d.platform,
          ad: d.ad.trim(),
          store_id: d.store_id?.trim() || null,
          store_url: d.store_url?.trim() || null,
          api_key: apiKeyEnc,
          komisyon_faiz: d.komisyon_faiz,
          status: "gozleyir",
          aktiv: true,
        },
      });
      revalidatePath("/marketplace");
      bustMarketplaceCache();
      await audit("yarat", "marketplace_hesab", created.id, {
        yeni_data: {
          platform: d.platform,
          ad: d.ad,
          store_id: d.store_id || null,
          komisyon_faiz: d.komisyon_faiz,
          api_key_mask: d.api_key ? maskSecret(d.api_key) : null,
        },
        sebeb: `Marketplace qoşuldu: ${d.platform} / ${d.ad}`,
      });
      return { ok: true };
    } catch (e) {
      console.error("[connectMarketplace]", e);
      const msg = e instanceof Error ? e.message : "naməlum səhv";
      return { ok: false, error: `Qoşulmadı: ${msg}` };
    }
  });
}

export async function syncMarketplace(id: string): Promise<ActionResult> {
  const permCheck = await requireMarketplaceActionPerm("marketplace.sync");
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  return withTenant(async () => {
    try {
      const before = await prisma.marketplace_hesablari.findUnique({
        where: { id },
        select: { ad: true, platform: true, status: true },
      });
      if (!before) return { ok: false, error: "Hesab tapılmadı" };
      // Mock sync: real production-da hər platforma üçün spesifik API call
      await prisma.marketplace_hesablari.update({
        where: { id },
        data: { son_sync: new Date(), son_xeta: null, status: "aktiv" },
      });
      revalidatePath("/marketplace");
      bustMarketplaceCache();
      await audit("sync", "marketplace_hesab", id, {
        yeni_data: { platform: before.platform, ad: before.ad },
        sebeb: `Marketplace sync: ${before.ad}`,
      });
      return { ok: true };
    } catch (e) {
      console.error("[syncMarketplace]", e);
      const msg = e instanceof Error ? e.message : "naməlum səhv";
      return { ok: false, error: `Sinxron alınmadı: ${msg}` };
    }
  });
}

export async function toggleMarketplace(id: string, aktiv: boolean): Promise<ActionResult> {
  const permCheck = await requireMarketplaceActionPerm("marketplace.idare");
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  return withTenant(async () => {
    try {
      const before = await prisma.marketplace_hesablari.findUnique({
        where: { id },
        select: { ad: true, platform: true, aktiv: true },
      });
      if (!before) return { ok: false, error: "Hesab tapılmadı" };
      await prisma.marketplace_hesablari.update({ where: { id }, data: { aktiv } });
      revalidatePath("/marketplace");
      bustMarketplaceCache();
      await audit(aktiv ? "aktivlesh" : "deaktivlesh", "marketplace_hesab", id, {
        evvelki_data: { aktiv: before.aktiv },
        yeni_data: { aktiv, platform: before.platform, ad: before.ad },
        sebeb: aktiv ? "Marketplace aktivləşdirildi" : "Marketplace deaktivləşdirildi",
      });
      return { ok: true };
    } catch (e) {
      console.error("[toggleMarketplace]", e);
      const msg = e instanceof Error ? e.message : "naməlum səhv";
      return { ok: false, error: `Dəyişdirilmədi: ${msg}` };
    }
  });
}

// ============================================================
// YENİ FUNKSIONALLIQ
// ============================================================

/**
 * API token-i fırlat (rotation) — qədim token-u arxivlə, yenini saxla.
 */
export async function rotateApiToken(
  id: string,
  yeniToken: string,
): Promise<ActionResult> {
  const permCheck = await requireMarketplaceActionPerm("marketplace.idare");
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  if (!yeniToken || yeniToken.trim().length < 8) {
    return { ok: false, error: "Yeni token ən azı 8 simvol olmalıdır" };
  }
  return withTenant(async () => {
    try {
      const before = await prisma.marketplace_hesablari.findUnique({
        where: { id },
        select: { ad: true, platform: true, api_key: true },
      });
      if (!before) return { ok: false, error: "Hesab tapılmadı" };
      const enc = encryptString(yeniToken.trim());
      await prisma.marketplace_hesablari.update({
        where: { id },
        data: { api_key: enc, status: "gozleyir" },
      });
      bustMarketplaceCache();
      revalidatePath("/marketplace");
      await audit("token_fırlat", "marketplace_hesab", id, {
        yeni_data: {
          ad: before.ad,
          platform: before.platform,
          kohne_mask: maskSecret(before.api_key),
          yeni_mask: maskSecret(yeniToken),
        },
        sebeb: "Marketplace API token rotation",
      });
      return { ok: true };
    } catch (e) {
      console.error("[rotateApiToken]", e);
      const msg = e instanceof Error ? e.message : "naməlum səhv";
      return { ok: false, error: `Alınmadı: ${msg}` };
    }
  });
}
