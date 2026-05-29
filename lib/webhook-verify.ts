import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Webhook HMAC verification utility (provider-agnostik).
 *
 * Platform raw body-ni öz secret-i ilə HMAC-SHA256 ilə imzalayır və `X-Signature`
 * header-ində göndərir. Biz eyni secret-lə yenidən hesablayırıq və constant-time
 * müqayisə edirik.
 *
 * Header formatı dəstəklənir:
 *  - "sha256=<hex>" (GitHub, Stripe pattern)
 *  - "<hex>" (sadə)
 *  - "t=<ts>,v1=<hex>" (Stripe v1 — yalnız v1 hissəsi yoxlanılır)
 */

export function computeWebhookSignature(rawBody: string, secret: string): string {
  return createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
}

export function verifyWebhookSignature(
  rawBody: string,
  receivedHeader: string | null,
  secret: string,
): boolean {
  if (!receivedHeader || !secret) return false;
  const expected = computeWebhookSignature(rawBody, secret);

  // Header-dən hex çıxar
  let received = receivedHeader.trim();
  if (received.startsWith("sha256=")) received = received.slice(7);
  if (received.includes(",")) {
    const v1 = received.split(",").find((p) => p.startsWith("v1="));
    if (v1) received = v1.slice(3);
  }

  if (received.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(received, "hex"));
  } catch {
    return false;
  }
}

/** Yeni secret yarat — base64url 32 bayt (256 bit entropy). */
export function generateWebhookSecret(): string {
  return Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64url");
}
