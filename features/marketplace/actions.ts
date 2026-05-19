"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";

const ConnectSchema = z.object({
  platform: z.enum(["umico", "birmarket", "wolt", "tap", "lalafo", "diger"]),
  ad: z.string().min(2).max(150),
  store_id: z.string().max(100).optional().or(z.literal("")),
  store_url: z.string().url().optional().or(z.literal("")),
  api_key: z.string().max(500).optional().or(z.literal("")),
  komisyon_faiz: z.coerce.number().min(0).max(100).default(0),
});

type ActionResult = { ok: true } | { ok: false; error: string };

export async function connectMarketplace(input: FormData): Promise<ActionResult> {
  const parsed = ConnectSchema.safeParse(Object.fromEntries(input.entries()));
  if (!parsed.success) return { ok: false, error: "Forma yanlışdır" };
  const d = parsed.data;

  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    try {
      await prisma.marketplace_hesablari.create({
        data: {
          sahibkar_id: sahibkarId,
          platform: d.platform,
          ad: d.ad.trim(),
          store_id: d.store_id?.trim() || null,
          store_url: d.store_url?.trim() || null,
          api_key: d.api_key?.trim() || null,
          komisyon_faiz: d.komisyon_faiz,
          status: "gozleyir",
          aktiv: true,
        },
      });
      revalidatePath("/marketplace");
      return { ok: true };
    } catch (e) {
      console.error("[connectMarketplace]", e);
      return { ok: false, error: "Qoşulmadı" };
    }
  });
}

export async function syncMarketplace(id: string): Promise<ActionResult> {
  return withTenant(async () => {
    try {
      // Mock sync: simulate API call by updating son_sync and clearing son_xeta.
      await prisma.marketplace_hesablari.update({
        where: { id },
        data: { son_sync: new Date(), son_xeta: null, status: "aktiv" },
      });
      revalidatePath("/marketplace");
      return { ok: true };
    } catch (e) {
      console.error("[syncMarketplace]", e);
      return { ok: false, error: "Sinxron alınmadı" };
    }
  });
}

export async function toggleMarketplace(id: string, aktiv: boolean): Promise<ActionResult> {
  return withTenant(async () => {
    try {
      await prisma.marketplace_hesablari.update({ where: { id }, data: { aktiv } });
      revalidatePath("/marketplace");
      return { ok: true };
    } catch (e) {
      console.error("[toggleMarketplace]", e);
      return { ok: false, error: "Dəyişdirilmədi" };
    }
  });
}
