"use server";

import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";

const CreateSchema = z.object({
  ad: z.string().min(2).max(150),
  url: z.string().url(),
  events: z.string().optional().or(z.literal("")), // comma-separated
});

type ActionResult = { ok: true } | { ok: false; error: string };

export async function createWebhook(input: FormData): Promise<ActionResult> {
  const parsed = CreateSchema.safeParse(Object.fromEntries(input.entries()));
  if (!parsed.success) return { ok: false, error: "URL düzgün deyil" };
  const d = parsed.data;

  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    try {
      await prisma.webhook_endpoints.create({
        data: {
          sahibkar_id: sahibkarId,
          ad: d.ad.trim(),
          url: d.url.trim(),
          events: d.events ? d.events.split(",").map((s) => s.trim()).filter(Boolean) : [],
          secret: crypto.randomBytes(24).toString("hex"),
          aktiv: true,
        },
      });
      revalidatePath("/webhook");
      return { ok: true };
    } catch (e) {
      console.error("[createWebhook]", e);
      return { ok: false, error: "Yaradılmadı" };
    }
  });
}

export async function toggleWebhook(id: string, aktiv: boolean): Promise<ActionResult> {
  return withTenant(async () => {
    try {
      await prisma.webhook_endpoints.update({ where: { id }, data: { aktiv } });
      revalidatePath("/webhook");
      return { ok: true };
    } catch (e) {
      console.error("[toggleWebhook]", e);
      return { ok: false, error: "Dəyişdirilmədi" };
    }
  });
}

export async function deleteWebhook(id: string): Promise<ActionResult> {
  return withTenant(async () => {
    try {
      await prisma.webhook_endpoints.delete({ where: { id } });
      revalidatePath("/webhook");
      return { ok: true };
    } catch (e) {
      console.error("[deleteWebhook]", e);
      return { ok: false, error: "Silinmədi" };
    }
  });
}

export async function testWebhook(id: string): Promise<ActionResult> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    try {
      const ep = await prisma.webhook_endpoints.findUnique({ where: { id } });
      if (!ep) return { ok: false, error: "Endpoint tapılmadı" };

      const payload = {
        event: "test.ping",
        endpoint_id: ep.id,
        sent_at: new Date().toISOString(),
        data: { message: "Bu test webhookudur. 360Biznes-dən salam!" },
      };
      const body = JSON.stringify(payload);
      // HMAC-SHA256 imza — alıcı tərəf bunu yoxlaya bilər
      const signature = ep.secret
        ? crypto.createHmac("sha256", ep.secret).update(body).digest("hex")
        : null;
      const start = Date.now();
      let status = 0;
      let xeta: string | null = null;
      try {
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
          "X-360Biznes-Event": "test.ping",
          "X-360Biznes-Endpoint": ep.id,
          "User-Agent": "360Biznes-Webhook/1.0",
        };
        if (signature) headers["X-360Biznes-Signature"] = `sha256=${signature}`;
        const res = await fetch(ep.url, {
          method: ep.method ?? "POST",
          headers,
          body,
          signal: AbortSignal.timeout(ep.timeout_ms ?? 10000),
        });
        status = res.status;
        if (!res.ok) xeta = `HTTP ${res.status}`;
      } catch (err) {
        xeta = err instanceof Error ? err.message : "Şəbəkə xətası";
      }
      const muddet = Date.now() - start;

      await prisma.webhook_delivery.create({
        data: {
          sahibkar_id: sahibkarId,
          endpoint_id: ep.id,
          event: "test.ping",
          payload,
          istek_url: ep.url,
          http_status: status || null,
          xeta,
          muddet_ms: muddet,
          cavab: status === 200 ? "OK" : null,
        },
      });
      await prisma.webhook_endpoints.update({
        where: { id },
        data: {
          cagiris_sayi: { increment: 1 },
          ugurlu_sayi: status >= 200 && status < 300 ? { increment: 1 } : undefined,
          son_ugur: status >= 200 && status < 300 ? new Date() : undefined,
          son_u_ursuz: status >= 200 && status < 300 ? undefined : new Date(),
          son_xeta: xeta,
        },
      });
      revalidatePath("/webhook");
      return { ok: true };
    } catch (e) {
      console.error("[testWebhook]", e);
      return { ok: false, error: "Test alınmadı" };
    }
  });
}
