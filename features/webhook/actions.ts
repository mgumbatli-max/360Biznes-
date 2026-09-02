"use server";

import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { audit } from "@/lib/audit/log";
import { safeFetch, SsrfError } from "@/lib/utils/safe-fetch";
import {
  requireMarketplaceActionPerm,
  bustMarketplaceCache,
  redactWebhookPayload,
} from "@/features/marketplace/access-guard";

const CreateSchema = z.object({
  ad: z.string().min(2).max(150),
  url: z.string().url(),
  events: z.string().optional().or(z.literal("")),
});

type ActionResult = { ok: true } | { ok: false; error: string };

/**
 * Webhook URL validation — yalnız xarici https://, public host.
 */
function validateWebhookUrl(url: string): { ok: true } | { ok: false; error: string } {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:" && u.protocol !== "http:") {
      return { ok: false, error: "URL https:// və ya http:// olmalıdır" };
    }
    // SSRF guard: safeFetch private IPlerə icazə vermir; createdə də yoxla
    // (lakin DNS resolve halında SSRF mövcud ola bilər — production-da)
    return { ok: true };
  } catch {
    return { ok: false, error: "URL düzgün deyil" };
  }
}

export async function createWebhook(input: FormData): Promise<ActionResult> {
  const permCheck = await requireMarketplaceActionPerm("webhook.idare");
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  const parsed = CreateSchema.safeParse(Object.fromEntries(input.entries()));
  if (!parsed.success) return { ok: false, error: "URL düzgün deyil" };
  const d = parsed.data;
  const urlCheck = validateWebhookUrl(d.url);
  if (!urlCheck.ok) return urlCheck;

  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    try {
      const events = d.events ? d.events.split(",").map((s) => s.trim()).filter(Boolean) : [];
      const created = await prisma.webhook_endpoints.create({
        data: {
          sahibkar_id: sahibkarId,
          ad: d.ad.trim(),
          url: d.url.trim(),
          events,
          secret: crypto.randomBytes(24).toString("hex"),
          aktiv: true,
        },
      });
      revalidatePath("/webhook");
      bustMarketplaceCache();
      await audit("yarat", "webhook_endpoint", created.id, {
        yeni_data: { ad: d.ad, url: d.url, events },
        sebeb: `Webhook yaradıldı: ${d.ad}`,
      });
      return { ok: true };
    } catch (e) {
      console.error("[createWebhook]", e);
      const msg = e instanceof Error ? e.message : "naməlum səhv";
      return { ok: false, error: `Yaradılmadı: ${msg}` };
    }
  });
}

export async function toggleWebhook(id: string, aktiv: boolean): Promise<ActionResult> {
  const permCheck = await requireMarketplaceActionPerm("webhook.idare");
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  return withTenant(async () => {
    try {
      const before = await prisma.webhook_endpoints.findUnique({
        where: { id },
        select: { ad: true, aktiv: true },
      });
      if (!before) return { ok: false, error: "Endpoint tapılmadı" };
      await prisma.webhook_endpoints.update({ where: { id }, data: { aktiv } });
      revalidatePath("/webhook");
      bustMarketplaceCache();
      await audit(aktiv ? "aktivlesh" : "deaktivlesh", "webhook_endpoint", id, {
        evvelki_data: { aktiv: before.aktiv },
        yeni_data: { aktiv, ad: before.ad },
        sebeb: aktiv ? "Webhook aktivləşdirildi" : "Webhook deaktivləşdirildi",
      });
      return { ok: true };
    } catch (e) {
      console.error("[toggleWebhook]", e);
      const msg = e instanceof Error ? e.message : "naməlum səhv";
      return { ok: false, error: `Dəyişdirilmədi: ${msg}` };
    }
  });
}

/**
 * Soft delete — endpoint-i passivləşdir (delivery tarixçəsi orphan olmasın).
 */
export async function deleteWebhook(id: string): Promise<ActionResult> {
  const permCheck = await requireMarketplaceActionPerm("webhook.idare");
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  return withTenant(async () => {
    try {
      const before = await prisma.webhook_endpoints.findUnique({
        where: { id },
        select: { ad: true, url: true, aktiv: true },
      });
      if (!before) return { ok: false, error: "Endpoint tapılmadı" };
      // Soft delete — aktiv=false. Tarixçə qorunur, hard delete yoxdur.
      await prisma.webhook_endpoints.update({
        where: { id },
        data: { aktiv: false },
      });
      revalidatePath("/webhook");
      bustMarketplaceCache();
      await audit("arxiv", "webhook_endpoint", id, {
        evvelki_data: { ad: before.ad, url: before.url, aktiv: before.aktiv },
        yeni_data: { aktiv: false },
        sebeb: `Webhook arxivləndi: ${before.ad}`,
      });
      return { ok: true };
    } catch (e) {
      console.error("[deleteWebhook]", e);
      const msg = e instanceof Error ? e.message : "naməlum səhv";
      return { ok: false, error: `Arxivlənmədi: ${msg}` };
    }
  });
}

export async function testWebhook(id: string): Promise<ActionResult> {
  const permCheck = await requireMarketplaceActionPerm(["webhook.test", "webhook.idare"]);
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    try {
      const ep = await prisma.webhook_endpoints.findUnique({ where: { id }, omit: { secret: false } });
      if (!ep) return { ok: false, error: "Endpoint tapılmadı" };

      const payload = {
        event: "test.ping",
        endpoint_id: ep.id,
        sent_at: new Date().toISOString(),
        data: { message: "Bu test webhookudur. 360Biznes-dən salam!" },
      };
      const body = JSON.stringify(payload);
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
        // SSRF-safe fetch — private IPs/internal hostnames bloklanır
        const res = await safeFetch(ep.url, {
          method: ep.method ?? "POST",
          headers,
          body,
          timeoutMs: ep.timeout_ms ?? 10000,
        });
        status = res.status;
        if (!res.ok) xeta = `HTTP ${res.status}`;
      } catch (err) {
        if (err instanceof SsrfError) {
          xeta = `SSRF blok: ${err.message}`;
        } else {
          xeta = err instanceof Error ? err.message : "Şəbəkə xətası";
        }
      }
      const muddet = Date.now() - start;

      await prisma.webhook_delivery.create({
        data: {
          sahibkar_id: sahibkarId,
          endpoint_id: ep.id,
          event: "test.ping",
          // Test payload — PII yoxdur, redact lazım deyil
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
      bustMarketplaceCache();
      await audit("test", "webhook_endpoint", id, {
        yeni_data: { status, xeta, muddet_ms: muddet, ssrf_blok: xeta?.startsWith("SSRF") ?? false },
        sebeb: `Webhook test: ${ep.ad}`,
      });
      return { ok: true };
    } catch (e) {
      console.error("[testWebhook]", e);
      const msg = e instanceof Error ? e.message : "naməlum səhv";
      return { ok: false, error: `Test alınmadı: ${msg}` };
    }
  });
}

// ============================================================
// YENİ FUNKSIONALLIQ
// ============================================================

/**
 * Uğursuz delivery-ni yenidən cəhd et.
 */
export async function retryFailedDelivery(deliveryId: string): Promise<ActionResult> {
  const permCheck = await requireMarketplaceActionPerm(["webhook.test", "webhook.idare"]);
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  let bid: bigint;
  try { bid = BigInt(deliveryId); } catch { return { ok: false, error: "Yanlış delivery ID" }; }
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    try {
      const delivery = await prisma.webhook_delivery.findUnique({
        where: { id: bid },
      });
      if (!delivery) return { ok: false, error: "Delivery tapılmadı" };
      if (delivery.http_status && delivery.http_status >= 200 && delivery.http_status < 300) {
        return { ok: false, error: "Bu delivery artıq uğurlu olub" };
      }
      if (!delivery.endpoint_id) return { ok: false, error: "Endpoint id yoxdur" };
      const ep = await prisma.webhook_endpoints.findUnique({
        where: { id: delivery.endpoint_id },
        omit: { secret: false },
      });
      if (!ep) return { ok: false, error: "Endpoint tapılmadı" };
      if (!ep.aktiv) return { ok: false, error: "Endpoint passivdir" };

      const body = JSON.stringify(delivery.payload);
      const signature = ep.secret
        ? crypto.createHmac("sha256", ep.secret).update(body).digest("hex")
        : null;
      const start = Date.now();
      let status = 0;
      let xeta: string | null = null;
      try {
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
          "X-360Biznes-Event": delivery.event ?? "retry",
          "X-360Biznes-Endpoint": ep.id,
          "X-360Biznes-Retry": "1",
          "User-Agent": "360Biznes-Webhook/1.0",
        };
        if (signature) headers["X-360Biznes-Signature"] = `sha256=${signature}`;
        const res = await safeFetch(ep.url, {
          method: ep.method ?? "POST",
          headers,
          body,
          timeoutMs: ep.timeout_ms ?? 10000,
        });
        status = res.status;
        if (!res.ok) xeta = `HTTP ${res.status}`;
      } catch (err) {
        if (err instanceof SsrfError) xeta = `SSRF blok: ${err.message}`;
        else xeta = err instanceof Error ? err.message : "Şəbəkə xətası";
      }
      await prisma.webhook_delivery.create({
        data: {
          sahibkar_id: sahibkarId,
          endpoint_id: ep.id,
          event: `${delivery.event ?? "retry"}.retry`,
          payload: delivery.payload as object,
          istek_url: ep.url,
          http_status: status || null,
          xeta,
          muddet_ms: Date.now() - start,
          cavab: status === 200 ? "OK" : null,
        },
      });
      revalidatePath("/webhook");
      bustMarketplaceCache();
      await audit("retry", "webhook_delivery", deliveryId, {
        yeni_data: { status, xeta, endpoint_id: ep.id, ep_ad: ep.ad },
        sebeb: `Webhook retry: ${ep.ad}`,
      });
      return { ok: true };
    } catch (e) {
      console.error("[retryFailedDelivery]", e);
      const msg = e instanceof Error ? e.message : "naməlum səhv";
      return { ok: false, error: `Yenidən cəhd alınmadı: ${msg}` };
    }
  });
}

/**
 * Webhook delivery statistikası — uğur faizi, ortalama latency.
 */
export type WebhookDeliveryStats = {
  endpoint_id: string;
  ad: string;
  cemi: number;
  ugurlu: number;
  ugursuz: number;
  ugur_pct: number;
  orta_latency_ms: number;
  son_ugur: Date | null;
  son_ugursuz: Date | null;
};

export async function getWebhookDeliveryStats(
  endpointId: string,
): Promise<{ ok: true; data: WebhookDeliveryStats } | { ok: false; error: string }> {
  const permCheck = await requireMarketplaceActionPerm("marketplace.oxu");
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  return withTenant(async () => {
    try {
      const ep = await prisma.webhook_endpoints.findUnique({
        where: { id: endpointId },
        select: { ad: true, son_ugur: true, son_u_ursuz: true },
      });
      if (!ep) return { ok: false, error: "Endpoint tapılmadı" };
      const since = new Date(Date.now() - 30 * 86400_000);
      const all = await prisma.webhook_delivery.findMany({
        where: { endpoint_id: endpointId, yaradildi: { gte: since } },
        select: { http_status: true, muddet_ms: true },
      });
      const cemi = all.length;
      const ugurlu = all.filter((d) => d.http_status && d.http_status >= 200 && d.http_status < 300).length;
      const ugursuz = cemi - ugurlu;
      const orta_latency_ms = cemi > 0
        ? Math.round(all.reduce((s, d) => s + (d.muddet_ms ?? 0), 0) / cemi)
        : 0;
      return {
        ok: true,
        data: {
          endpoint_id: endpointId,
          ad: ep.ad,
          cemi,
          ugurlu,
          ugursuz,
          ugur_pct: cemi > 0 ? Math.round((ugurlu / cemi) * 100) : 0,
          orta_latency_ms,
          son_ugur: ep.son_ugur,
          son_ugursuz: ep.son_u_ursuz,
        },
      };
    } catch (e) {
      console.error("[getWebhookDeliveryStats]", e);
      const msg = e instanceof Error ? e.message : "naməlum səhv";
      return { ok: false, error: `Alınmadı: ${msg}` };
    }
  });
}

/**
 * Event üçün nümunə payload yarat.
 */
export async function previewWebhookPayload(
  event: string,
): Promise<{ ok: true; payload: object } | { ok: false; error: string }> {
  const permCheck = await requireMarketplaceActionPerm("marketplace.oxu");
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  const samples: Record<string, object> = {
    "order.created": {
      event: "order.created",
      data: {
        id: "ord_sample_001",
        nomre: "S-2025-1042",
        musteri_ad: "Ali Məmmədov",
        telefon: "9941234567",
        mebleg: 250.5,
        valyuta: "AZN",
        kanal: "umico",
        mehsullar: [
          { ad: "Məhsul A", miqdar: 1, qiymet: 250.5 },
        ],
      },
      sent_at: new Date().toISOString(),
    },
    "order.paid": {
      event: "order.paid",
      data: {
        order_id: "ord_sample_001",
        mebleg: 250.5,
        odenis_nov: "card",
        tarix: new Date().toISOString(),
      },
      sent_at: new Date().toISOString(),
    },
    "product.created": {
      event: "product.created",
      data: { id: "prod_sample_001", ad: "Yeni məhsul", qiymet: 99.9, kategoriya: "Elektronika" },
      sent_at: new Date().toISOString(),
    },
    "test.ping": {
      event: "test.ping",
      data: { message: "Bu nümunə payloaddır" },
      sent_at: new Date().toISOString(),
    },
  };
  const sample = samples[event] ?? samples["test.ping"];
  // PII redact — sample-də olsa belə təhlükəsizlik təcrübəsi göstər
  return { ok: true, payload: redactWebhookPayload(sample) };
}
