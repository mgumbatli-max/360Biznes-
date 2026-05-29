"use server";

import { createHmac } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { computeChannelPrice, type KanalQiymetFormula } from "./types";
import { getKanalExtraServer } from "./kanal-extra";
import { recordOutboundPush } from "./outbound-stats";
import {
  enqueueOutboundRetry,
  getRetryQueue,
  removeRetryEntry,
  bumpRetryEntry,
} from "./outbound-retry";

const KanalSchema = z.object({ kanal: z.string().min(2).max(40) });

type Result<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

/**
 * Outbound stok+qiymət push — sahibkar tərəfdə "indi sync et" düyməsi sıxılır,
 * biz kanal-ın `outbound_url`-inə HMAC-imzalı POST göndəririk.
 *
 * Body sxeması:
 *   {
 *     "event": "stock_sync",
 *     "at": "ISO timestamp",
 *     "items": [{ "sku", "stok", "qiymet", "gizli" }]
 *   }
 *
 * Platforma (Wolt/Birmarket/sayt) öz adapter-i ilə bu payload-u öz menü/kataloq-una
 * mapping edir. Format universal — hər platform üçün ayrı kod lazım deyil.
 */
export async function pushStockToChannel(input: z.input<typeof KanalSchema>): Promise<Result<{ sent: number; status: number; ms: number }>> {
  const parsed = KanalSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Yanlış" };
  const { kanal } = parsed.data;

  return withTenant(async () => {
    const { sahibkarId } = requireTenant();

    const extra = await getKanalExtraServer(sahibkarId, kanal);
    if (!extra.outbound_url) {
      return { ok: false, error: "Bu kanal üçün outbound URL qurulmayıb" };
    }

    const [kanalRow, products, overrides] = await Promise.all([
      prisma.qiymet_kanal_komissiya.findUnique({
        where: { sahibkar_id_kanal: { sahibkar_id: sahibkarId, kanal } },
      }),
      prisma.mehsullar.findMany({
        where: { sahibkar_id: sahibkarId, aktiv: true },
        select: { id: true, kod: true, barkod: true, ad: true, satis_qiymeti: true, min_satis_qiymeti: true, stok_cemi: true },
      }),
      prisma.qiymet_kanal.findMany({
        where: { sahibkar_id: sahibkarId, kanal },
        select: { mehsul_id: true, qiymet: true, formula_kod: true },
      }),
    ]);

    const ovMap = new Map(overrides.map((o) => [o.mehsul_id, o]));
    const items = products
      .filter((p) => {
        const ov = ovMap.get(p.id);
        return ov?.formula_kod !== "gizli"; // gizli məhsulları skip
      })
      .map((p) => {
        const baza = Number(p.satis_qiymeti ?? 0);
        const ov = ovMap.get(p.id);
        const formula: KanalQiymetFormula = (ov?.formula_kod as KanalQiymetFormula) ?? "baza";
        const manual = ov?.formula_kod === "manual" ? Number(ov.qiymet) : null;
        const effective = computeChannelPrice({
          baza,
          formula,
          manual,
          komissiya_faiz: Number(kanalRow?.komissiya_faiz ?? 0),
          sabit_komissiya: Number(kanalRow?.sabit_komissiya ?? 0),
          catdirilma: Number(kanalRow?.catdirilma ?? 0),
          bank_xerc: Number(kanalRow?.bank_xerc ?? 0),
          min_qiymet: Number(p.min_satis_qiymeti ?? 0),
        });
        return {
          sku: p.kod ?? p.id,
          barkod: p.barkod,
          ad: p.ad,
          stok: Math.max(0, Number(p.stok_cemi ?? 0) - (extra.stok_buffer ?? 0)),
          qiymet: effective,
          valyuta: "AZN" as const,
        };
      });

    const body = JSON.stringify({
      event: "stock_sync",
      kanal,
      at: new Date().toISOString(),
      items,
    });

    // HMAC imza (secret varsa)
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (extra.outbound_secret) {
      const sig = createHmac("sha256", extra.outbound_secret).update(body).digest("hex");
      headers["X-Signature"] = `sha256=${sig}`;
    }

    const t0 = Date.now();
    try {
      const res = await fetch(extra.outbound_url, {
        method: "POST",
        headers,
        body,
        signal: AbortSignal.timeout(30_000),
      });
      const ms = Date.now() - t0;
      const errBody = res.ok ? null : await res.text().catch(() => null);
      await recordOutboundPush({
        sahibkarId,
        kanal,
        status: res.status,
        sent: items.length,
        ms,
        error: res.ok ? null : (errBody?.slice(0, 200) ?? `HTTP ${res.status}`),
      });
      if (!res.ok) {
        // Uğursuz — retry queue-ya əlavə et (exponential backoff)
        await enqueueOutboundRetry({
          sahibkarId,
          kanal,
          url: extra.outbound_url,
          body,
          itemCount: items.length,
          error: `HTTP ${res.status}${errBody ? `: ${errBody.slice(0, 100)}` : ""}`,
        });
        return {
          ok: false,
          error: `Outbound HTTP ${res.status} (${ms}ms) — retry queue-da gözləyir`,
        };
      }
      return { ok: true, data: { sent: items.length, status: res.status, ms } };
    } catch (e) {
      const ms = Date.now() - t0;
      const msg = e instanceof Error ? e.message : String(e);
      await recordOutboundPush({
        sahibkarId,
        kanal,
        status: 0,
        sent: items.length,
        ms,
        error: msg.slice(0, 200),
      });
      // Şəbəkə xətası — retry queue
      await enqueueOutboundRetry({
        sahibkarId,
        kanal,
        url: extra.outbound_url,
        body,
        itemCount: items.length,
        error: msg.slice(0, 200),
      });
      return { ok: false, error: `Şəbəkə xətası: ${msg} — retry queue-da gözləyir` };
    }
  });
}

/**
 * SERVER-ONLY: yalnız verilmiş məhsul ID-lərini bir kanala push edir.
 * POS satış sonrası `after()` daxilində çağırılır — bütün kataloq əvəzinə
 * yalnız stoku dəyişən məhsullar göndərilir (kiçik payload, sürətli).
 *
 * Tenant context aktiv olmalıdır.
 */
export async function pushSpecificProductsToChannel(
  kanal: string,
  productIds: string[],
): Promise<{ ok: true; sent: number } | { ok: false; error: string }> {
  if (productIds.length === 0) return { ok: true, sent: 0 };
  const { sahibkarId } = requireTenant();
  const extra = await getKanalExtraServer(sahibkarId, kanal);
  if (!extra.outbound_url) return { ok: false, error: "outbound_url yoxdur" };

  const [kanalRow, products, overrides] = await Promise.all([
    prisma.qiymet_kanal_komissiya.findUnique({
      where: { sahibkar_id_kanal: { sahibkar_id: sahibkarId, kanal } },
    }),
    prisma.mehsullar.findMany({
      where: { sahibkar_id: sahibkarId, id: { in: productIds } },
      select: {
        id: true, kod: true, barkod: true, ad: true,
        satis_qiymeti: true, min_satis_qiymeti: true, stok_cemi: true,
      },
    }),
    prisma.qiymet_kanal.findMany({
      where: { sahibkar_id: sahibkarId, kanal, mehsul_id: { in: productIds } },
      select: { mehsul_id: true, qiymet: true, formula_kod: true },
    }),
  ]);

  const ovMap = new Map(overrides.map((o) => [o.mehsul_id, o]));
  const items = products
    .filter((p) => ovMap.get(p.id)?.formula_kod !== "gizli")
    .map((p) => {
      const baza = Number(p.satis_qiymeti ?? 0);
      const ov = ovMap.get(p.id);
      const formula: KanalQiymetFormula = (ov?.formula_kod as KanalQiymetFormula) ?? "baza";
      const manual = ov?.formula_kod === "manual" ? Number(ov.qiymet) : null;
      return {
        sku: p.kod ?? p.id,
        barkod: p.barkod,
        ad: p.ad,
        stok: Math.max(0, Number(p.stok_cemi ?? 0) - (extra.stok_buffer ?? 0)),
        qiymet: computeChannelPrice({
          baza, formula, manual,
          komissiya_faiz: Number(kanalRow?.komissiya_faiz ?? 0),
          sabit_komissiya: Number(kanalRow?.sabit_komissiya ?? 0),
          catdirilma: Number(kanalRow?.catdirilma ?? 0),
          bank_xerc: Number(kanalRow?.bank_xerc ?? 0),
          min_qiymet: Number(p.min_satis_qiymeti ?? 0),
        }),
        valyuta: "AZN" as const,
      };
    });

  if (items.length === 0) return { ok: true, sent: 0 };

  const body = JSON.stringify({
    event: "stock_delta",
    kanal,
    at: new Date().toISOString(),
    items,
  });
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (extra.outbound_secret) {
    const sig = createHmac("sha256", extra.outbound_secret).update(body).digest("hex");
    headers["X-Signature"] = `sha256=${sig}`;
  }

  const t0 = Date.now();
  try {
    const res = await fetch(extra.outbound_url, {
      method: "POST",
      headers,
      body,
      signal: AbortSignal.timeout(15_000),
    });
    const ms = Date.now() - t0;
    const errBody = res.ok ? null : await res.text().catch(() => null);
    await recordOutboundPush({
      sahibkarId, kanal, status: res.status, sent: items.length, ms,
      error: res.ok ? null : (errBody?.slice(0, 200) ?? `HTTP ${res.status}`),
    });
    if (!res.ok) {
      await enqueueOutboundRetry({
        sahibkarId, kanal, url: extra.outbound_url, body, itemCount: items.length,
        error: `HTTP ${res.status}${errBody ? `: ${errBody.slice(0, 100)}` : ""}`,
      });
      return { ok: false, error: `HTTP ${res.status}` };
    }
    return { ok: true, sent: items.length };
  } catch (e) {
    const ms = Date.now() - t0;
    const msg = e instanceof Error ? e.message : String(e);
    await recordOutboundPush({
      sahibkarId, kanal, status: 0, sent: items.length, ms, error: msg.slice(0, 200),
    });
    await enqueueOutboundRetry({
      sahibkarId, kanal, url: extra.outbound_url, body, itemCount: items.length, error: msg.slice(0, 200),
    });
    return { ok: false, error: msg };
  }
}

/**
 * SERVER-ONLY: stok dəyişən məhsulları auto-push olunmuş bütün kanallara çatdırır.
 * POS satış sonrası `after()` daxilində çağırılır.
 * Tenant context aktiv olmalıdır.
 */
export async function autoPushAfterSale(productIds: string[]): Promise<void> {
  if (productIds.length === 0) return;
  try {
    const { sahibkarId } = requireTenant();
    const rows = await prisma.ayarlar.findMany({
      where: { sahibkar_id: sahibkarId, qrup: "kanal_extra" },
      select: { acar: true, deyer: true },
    });
    const autoChannels: string[] = [];
    for (const r of rows) {
      try {
        const p = JSON.parse(r.deyer ?? "{}") as { auto_push_on_sale?: boolean; outbound_url?: string };
        if (p.auto_push_on_sale && p.outbound_url) autoChannels.push(r.acar);
      } catch {}
    }
    await Promise.allSettled(
      autoChannels.map((kanal) => pushSpecificProductsToChannel(kanal, productIds)),
    );
  } catch (e) {
    console.error("[autoPushAfterSale]", e);
  }
}

/**
 * Pending retry-ləri sıra ilə işlət. Bir entry uğurlu olarsa queue-dan silinir.
 * Uğursuzdursa attempts++ və exponential backoff next_retry_at güncəllənir.
 * 3 cəhddən sonra entry tamamilə silinir (audit log-da qalır).
 */
export async function processRetryQueue(input: z.input<typeof KanalSchema>): Promise<Result<{ processed: number; ok_count: number; fail_count: number; skipped: number }>> {
  const parsed = KanalSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Yanlış" };
  const { kanal } = parsed.data;

  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const extra = await getKanalExtraServer(sahibkarId, kanal);

    const queue = await getRetryQueue(sahibkarId, kanal);
    if (queue.entries.length === 0) {
      return { ok: true, data: { processed: 0, ok_count: 0, fail_count: 0, skipped: 0 } };
    }

    const now = Date.now();
    let okCount = 0;
    let failCount = 0;
    let skipped = 0;

    // Snapshot — işlədiyimiz əsnada queue dəyişməsin
    const snapshot = [...queue.entries];
    for (const entry of snapshot) {
      // backoff yetişməyibsə skip et
      if (new Date(entry.next_retry_at).getTime() > now) {
        skipped++;
        continue;
      }
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (extra.outbound_secret) {
        const sig = createHmac("sha256", extra.outbound_secret).update(entry.body).digest("hex");
        headers["X-Signature"] = `sha256=${sig}`;
      }
      const t0 = Date.now();
      try {
        const res = await fetch(entry.url, {
          method: "POST",
          headers,
          body: entry.body,
          signal: AbortSignal.timeout(30_000),
        });
        const ms = Date.now() - t0;
        const errBody = res.ok ? null : await res.text().catch(() => null);
        await recordOutboundPush({
          sahibkarId,
          kanal,
          status: res.status,
          sent: entry.item_count,
          ms,
          error: res.ok ? null : (errBody?.slice(0, 200) ?? `HTTP ${res.status}`),
        });
        if (res.ok) {
          await removeRetryEntry(sahibkarId, kanal, entry.id);
          okCount++;
        } else {
          await bumpRetryEntry(sahibkarId, kanal, entry.id, `HTTP ${res.status}`);
          failCount++;
        }
      } catch (e) {
        const ms = Date.now() - t0;
        const msg = e instanceof Error ? e.message : String(e);
        await recordOutboundPush({
          sahibkarId,
          kanal,
          status: 0,
          sent: entry.item_count,
          ms,
          error: msg.slice(0, 200),
        });
        await bumpRetryEntry(sahibkarId, kanal, entry.id, msg.slice(0, 200));
        failCount++;
      }
    }
    return {
      ok: true,
      data: { processed: snapshot.length, ok_count: okCount, fail_count: failCount, skipped },
    };
  });
}
