import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { runWithTenant } from "@/lib/db/tenant-context";
import { findWebhookSecretsForKanal } from "@/features/qiymet-kanal/webhook-actions";
import { verifyWebhookSignature } from "@/lib/webhook-verify";
import { safeStockDecrement } from "@/lib/db/stock-guards";
import { rateAllow, rateRetryAfterSec } from "@/lib/rate-limiter";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Marketplace webhook receiver — platforma sifariş göndərdikdə qəbul edir,
 * `marketplace_sifarisleri`-yə yazır və stok-u azaldır.
 *
 * POST /api/v1/marketplace/orders/<kanal>
 *   Headers:
 *     X-Signature: sha256=<hex>     (HMAC body imzası — kanal secret ilə)
 *     Content-Type: application/json
 *   Body (universal JSON sxema):
 *     {
 *       "external_id": "WOLT-12345",       // platformanın sifariş ID-si
 *       "musteri": { "ad": "...", "telefon": "..." },
 *       "items": [
 *         { "sku": "ABC", "miqdar": 2, "qiymet": 25.50 }
 *       ],
 *       "umumi_mebleg": 51.00,
 *       "valyuta": "AZN",
 *       "status": "yeni"                    // "yeni" | "tesdiqlendi" | "legv"
 *     }
 *
 * Davranış:
 *  - HMAC verify (signature düz olmazsa 401)
 *  - Duplicate yoxlanışı (external_id + kanal unikaldır)
 *  - SKU → mehsul.id resolve, stok azaldılır
 *  - Stok yetərli deyilsə item-də "stok_catismir": true qaytarır, amma sifarişi qəbul edir
 *  - Audit log yazılır
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ kanal: string }> }) {
  const { kanal } = await ctx.params;
  if (!kanal) return NextResponse.json({ error: "kanal boşdur" }, { status: 400 });

  // 🔒 IP+kanal rate-limit (audit #6) — hər sorğu hər tenant secret-i üçün HMAC +
  // ayarlar tam skanı edir; boğulmasa CPU/DB amplifikasiya DoS.
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const hookRateKey = `mp-hook-ip:${ip}:${kanal}`;
  if (!rateAllow(hookRateKey, 120)) {
    return NextResponse.json(
      { error: "Rate limit aşıldı", retry_after_sec: rateRetryAfterSec(hookRateKey) },
      { status: 429, headers: { "Retry-After": String(rateRetryAfterSec(hookRateKey)) } },
    );
  }
  // 🔒 Body ölçü limiti (audit #6) — nəhəng gövdə ilə parse/HMAC amplifikasiyası.
  if (Number(req.headers.get("content-length") ?? 0) > 1_000_000) {
    return NextResponse.json({ error: "Body çox böyükdür" }, { status: 413 });
  }

  const rawBody = await req.text();
  if (rawBody.length > 1_000_000) {
    return NextResponse.json({ error: "Body çox böyükdür" }, { status: 413 });
  }
  const signature = req.headers.get("x-signature") ?? req.headers.get("x-hub-signature-256");

  // 1. Tap kanal üçün bütün sahibkar secret-lərini, müqayisə et
  const secrets = await findWebhookSecretsForKanal(kanal);
  if (secrets.length === 0) {
    return NextResponse.json(
      { error: "Bu kanal üçün webhook secret yaradılmayıb" },
      { status: 404 },
    );
  }
  const matched = secrets.find((s) => verifyWebhookSignature(rawBody, signature, s.secret));
  if (!matched) {
    return NextResponse.json({ error: "Signature etibarsızdır" }, { status: 401 });
  }
  const sahibkarId = matched.sahibkar_id;

  // 2. Body parse
  type IncomingItem = { sku?: string | null; barkod?: string | null; miqdar: number; qiymet: number; ad?: string };
  type Incoming = {
    external_id: string;
    musteri?: { ad?: string; telefon?: string; email?: string } | null;
    items: IncomingItem[];
    umumi_mebleg?: number;
    valyuta?: string;
    status?: string;
    qeyd?: string;
  };
  let body: Incoming;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "JSON parse xətası" }, { status: 400 });
  }
  if (!body.external_id) return NextResponse.json({ error: "external_id tələb olunur" }, { status: 400 });
  if (!Array.isArray(body.items) || body.items.length === 0) {
    return NextResponse.json({ error: "items boşdur" }, { status: 400 });
  }

  return runWithTenant(
    {
      sahibkarId,
      istifadeciId: "00000000-0000-0000-0000-000000000000",
      rolId: 0,
      icazeler: [],
    },
    async () => {
      // 3. Duplicate yoxla — audit_log-da bu external_id ilə qeyd var?
      const dup = await prisma.audit_log.findFirst({
        where: {
          sahibkar_id: sahibkarId,
          resurs_nov: "webhook_order",
          resurs_id: `${kanal}:${body.external_id}`,
        },
        select: { id: true },
      });
      if (dup) {
        return NextResponse.json(
          { ok: true, duplicate: true, message: "Sifariş artıq qəbul olunub" },
          { status: 200 },
        );
      }

      // 4. SKU/barkod → mehsul.id resolve
      const skus = body.items.map((i) => i.sku).filter((s): s is string => !!s);
      const barkodlar = body.items.map((i) => i.barkod).filter((s): s is string => !!s);
      const products = await prisma.mehsullar.findMany({
        where: {
          sahibkar_id: sahibkarId,
          OR: [
            ...(skus.length > 0 ? [{ kod: { in: skus } }] : []),
            ...(barkodlar.length > 0 ? [{ barkod: { in: barkodlar } }] : []),
          ],
        },
        select: { id: true, kod: true, barkod: true, ad: true, stok_cemi: true },
      });
      const bySku = new Map(products.filter((p) => p.kod).map((p) => [p.kod!, p]));
      const byBarkod = new Map(products.filter((p) => p.barkod).map((p) => [p.barkod!, p]));

      // Default anbar — webhook satışları üçün stok hərəkəti (audit #24).
      const defaultAnbar = await prisma.anbarlar.findFirst({
        where: { sahibkar_id: sahibkarId },
        orderBy: { id: "asc" },
        select: { id: true },
      });

      // 🔒 Faktiki per-anbar stok (audit #2/#235) — catismir/azaldilan `stok_cemi`
      // (bütün anbarların cəmi) yox, SATIŞ anbarının (defaultAnbar) real miqdarına
      // əsaslanmalı. Əks halda stok başqa anbarda olduqda "stok var" deyilir, düşmə
      // alınmır, amma xəbərdarlıq da yaranmır.
      const defaultStokMap = new Map<string, number>();
      if (defaultAnbar && products.length > 0) {
        const stokRows = await prisma.stok.findMany({
          where: { anbar_id: defaultAnbar.id, mehsul_id: { in: products.map((p) => p.id) } },
          select: { mehsul_id: true, miqdar: true },
        });
        for (const s of stokRows) if (s.mehsul_id) defaultStokMap.set(s.mehsul_id, Number(s.miqdar ?? 0));
      }

      // 5. Müştəri upsert (telefon ya ad üzrə) — satışdan əvvəl
      let musteriId: string | null = null;
      const phone = body.musteri?.telefon?.trim() ?? null;
      const ad = body.musteri?.ad?.trim() ?? null;
      if (phone || ad) {
        const existing = phone
          ? await prisma.kontragentler.findFirst({
              where: { sahibkar_id: sahibkarId, telefon: phone },
              select: { id: true },
            })
          : null;
        if (existing) {
          musteriId = existing.id;
        } else {
          const created = await prisma.kontragentler.create({
            data: {
              sahibkar_id: sahibkarId,
              nov: "musteri",
              ad: ad ?? phone ?? "Webhook müştəri",
              telefon: phone,
              email: body.musteri?.email ?? null,
              qaynaq: kanal,
            },
            select: { id: true },
          });
          musteriId = created.id;
        }
      }

      // 6/7. Kanonik satış axını — TRANSACTION daxilində (audit #24): stok düzgün
      // `stok` cədvəlindən safeStockDecrement ilə azalır, anbar_hereketleri yazılır,
      // idempotentlik external_id unikal indeksi ilə təmin olunur. Əvvəl
      // mehsullar.stok_cemi yenilənirdi, hərəkət/transaction yox idi.
      const nomre = `WH-${kanal.toUpperCase()}-${body.external_id}`.slice(0, 50);
      // 🔒 Cəmi HƏMİŞƏ line-item-lərdən hesabla (audit #7) — xarici umumi_mebleg-ə
      // etibar etmə (HMAC imza yalnız gövdə bütövlüyünü təsdiqləyir, məbləğ
      // düzgünlüyünü yox → qiymət/gəlir manipulyasiyası). umumi_mebleg yalnız tolerans.
      const lineSum = body.items.reduce(
        (s, it) => s + Math.max(0, Number(it.miqdar) || 0) * Math.max(0, Number(it.qiymet) || 0),
        0,
      );
      const cem = Math.round(lineSum * 100) / 100;
      if (body.umumi_mebleg && Math.abs(Number(body.umumi_mebleg) - lineSum) > 0.01) {
        console.warn("[webhook] umumi_mebleg line-item cəmindən fərqlidir:", {
          kanal, external_id: body.external_id, umumi_mebleg: body.umumi_mebleg, lineSum,
        });
      }
      const itemResults: Array<{ sku: string | null; resolved_id: string | null; miqdar: number; stok_catismir: boolean; azaldilan: number }> = [];

      // QA-K22: manual axınla (createMarketSatis) EYNİ komissiya tətbiqi —
      // əvvəl webhook satışı komisyon/xalis yazmır, payout YARATMIRDI
      // (gross net kimi görünürdü, payout izlənmirdi).
      const { getDefaultCommission, PLATFORM_DEFAULTS } = await import("@/features/maliyye/marketplace-commission");
      let komissiyaFaiz: number;
      try {
        komissiyaFaiz = await getDefaultCommission(kanal);
      } catch (error) {
        // Komissiya axtarışı uğursuz olarsa səssizcə 0% ilə davam etmə —
        // maliyyə uyğunsuzluğu yaranır. Loglayıb platforma default-una düş.
        console.error("[webhook] commission lookup failed:", { kanal, error });
        komissiyaFaiz = PLATFORM_DEFAULTS[kanal] ?? 0;
      }
      const komissiyaMebleg = +(cem * (komissiyaFaiz / 100)).toFixed(2);
      const netMebleg = Math.max(0, +(cem - komissiyaMebleg).toFixed(2));

      let satisId: string;
      try {
        satisId = await prisma.$transaction(
          async (tx) => {
            const sale = await tx.satis_sifarisleri.create({
              data: {
                sahibkar_id: sahibkarId,
                nomre,
                external_id: `${kanal}:${body.external_id}`,
                musteri_id: musteriId,
                anbar_id: defaultAnbar?.id ?? null,
                tarix: new Date(),
                status: body.status === "legv" ? "legv" : "tamamlandi",
                odenis_nov: "kart",
                umumi_mebleg: cem,
                son_mebleg: cem,
                odenilmis: cem,
                komisyon_meblegh: komissiyaMebleg,
                xalis_meblegh: netMebleg,
                qaralama: false,
                marketplace_platform: kanal,
                qeyd: `Webhook · external_id: ${body.external_id}${body.qeyd ? ` · ${body.qeyd}` : ""}`,
              },
              select: { id: true },
            });

            // QA-K22: gözləyən payout — bank yalnız payout qəbul ediləndə artır.
            // (audit #11) netMebleg>0 şərti — boş/sıfır payout sətirləri hesabatı çirkləndirməsin.
            if (body.status !== "legv" && netMebleg > 0.001) {
              const today = new Date();
              await tx.finance_marketplace_payments.create({
                data: {
                  sahibkar_id: sahibkarId,
                  platforma: kanal,
                  magaza: kanal,
                  donem_baslama: today,
                  donem_bitme: today,
                  gozlenen_meblegh: netMebleg,
                  komissiya: komissiyaMebleg,
                  status: "gozleyir",
                  qeyd: `[ORDER:${kanal}:${body.external_id}] Webhook satış`,
                },
              });
            }

            // QA-#24: ləğv sifariş stok düşürməməlidir — yalnız header yazılır.
            // Bütün satır dövrəsi (satış satırı + stok mexaric + anbar hərəkəti)
            // yalnız ləğv olmayan sifariş üçün işləyir. Ləğv halında itemResults boş
            // qalır (audit/notif/emitStockChange sıfır item ilə düzgün işləyir).
            if (body.status !== "legv") {
              for (const it of body.items) {
                const p = (it.sku && bySku.get(it.sku)) || (it.barkod && byBarkod.get(it.barkod)) || null;
                // Faktiki SATIŞ anbarının stoku (audit #2/#235) — stok_cemi yox.
                const availableDefault = p ? (defaultStokMap.get(p.id) ?? 0) : 0;
                let azaldilan = 0;
                if (p) {
                  // Xarici sifariş — sətir TAM miqdarla yazılır (platforma artıq
                  // müştəridən bu qədər aldı); çatışmayan hissə aşağıda flag olunur.
                  await tx.satis_sifaris_satirlari.create({
                    data: {
                      sahibkar_id: sahibkarId,
                      sifaris_id: sale.id,
                      mehsul_id: p.id,
                      miqdar: it.miqdar,
                      vahid_qiymet: it.qiymet,
                    },
                  });
                  if (defaultAnbar && availableDefault > 0) {
                    const want = Math.min(availableDefault, it.miqdar);
                    const dec = await safeStockDecrement(tx, {
                      mehsulId: p.id,
                      anbarId: defaultAnbar.id,
                      miqdar: want,
                      mehsulAd: p.ad ?? undefined,
                      // audit #10 — aktiv bron altındakı malı kanal sifarişinə satma.
                      rezervNezereAl: true,
                    });
                    if (dec.ok) {
                      azaldilan = want;
                      await tx.anbar_hereketleri.create({
                        data: {
                          sahibkar_id: sahibkarId,
                          anbar_id: defaultAnbar.id,
                          mehsul_id: p.id,
                          nov: "mexaric",
                          miqdar: azaldilan,
                          qiymet: it.qiymet,
                          ref_nov: "satis_sifarisi",
                          ref_id: sale.id,
                          qeyd: `Webhook satış (${kanal} #${body.external_id})`,
                        },
                      });
                    }
                  }
                }
                // stok_catismir FAKTİKİ düşməyə əsaslanır (audit #2/#235) — beləcə
                // stok başqa anbarda/bron altında olduqda xəbərdarlıq düzgün yaranır.
                const catismir = !p || azaldilan < it.miqdar;
                itemResults.push({
                  sku: it.sku ?? null,
                  resolved_id: p?.id ?? null,
                  miqdar: it.miqdar,
                  azaldilan,
                  stok_catismir: catismir,
                });
              }
            }

            if (musteriId) {
              const { recalculateCustomerBalance } = await import("@/lib/balance/customer-balance");
              await recalculateCustomerBalance(musteriId, tx);
            }
            return sale.id;
          },
          { timeout: 20_000 },
        );
      } catch (e) {
        // external_id unikal indeksi — eyni sifariş təkrar gəldi (idempotent)
        if (e && typeof e === "object" && "code" in e && (e as { code?: string }).code === "P2002") {
          return NextResponse.json(
            { ok: true, duplicate: true, message: "Sifariş artıq qəbul olunub" },
            { status: 200 },
          );
        }
        throw e;
      }

      // 8. Audit log — tarixçə (idempotentlik artıq external_id indeksindədir).
      // (audit #8) Satış ARTIQ commit olub — audit yazısı çöksə sifarişi geri qaytarma.
      try {
        await prisma.audit_log.create({
          data: {
            sahibkar_id: sahibkarId,
            istifadeci_ad: `webhook:${kanal}`,
            emeliyyat: "WEBHOOK_ORDER",
            resurs_nov: "webhook_order",
            resurs_id: `${kanal}:${body.external_id}`,
            yeni_data: {
              kanal,
              external_id: body.external_id,
              satis_id: satisId,
              musteri_id: musteriId,
              musteri: body.musteri ?? null,
              items: itemResults,
              cem_mebleg: cem,
              valyuta: body.valyuta ?? "AZN",
              status: body.status ?? "yeni",
            } as object,
          },
        });
      } catch (e) {
        console.error("[webhook] audit_log yazıla bilmədi:", e);
      }

      const anyShort = itemResults.some((r) => r.stok_catismir);

      // 9. In-app bildiriş — sahibkar (rol 9) və admin (rol 1) istifadəçilərə
      try {
        const admins = await prisma.istifadeciler.findMany({
          where: { sahibkar_id: sahibkarId, aktiv: true, rol_id: { in: [1, 9] } },
          select: { id: true },
        });
        if (admins.length > 0) {
          await prisma.bildirisler.createMany({
            data: admins.map((a) => ({
              sahibkar_id: sahibkarId,
              istifadeci_id: a.id,
              basliq: `Yeni ${kanal} sifariş — ${cem.toFixed(2)} ₼`,
              metn: `${body.musteri?.ad ?? "Naməlum müştəri"} · ${body.items.length} item${anyShort ? " · ⚠ stok yetmir" : ""}`,
              nov: anyShort ? "warning" : "success",
              link: `/marketplace/webhook-orders?kanal=${encodeURIComponent(kanal)}`,
              resurs_nov: "webhook_order",
              resurs_id: `${kanal}:${body.external_id}`,
            })),
          });
        }
      } catch (e) {
        // Bildiriş yazılması uğursuz olsa sifarişi geri qaytarmırıq
        console.error("[webhook] bildirisler yazıla bilmədi:", e);
      }

      // 10. Telegram bildiriş (opsiyonel — env-də TELEGRAM_BOT_TOKEN + sahibkar chat_id qoyulubsa)
      try {
        const { getTelegramConfigForSahibkar } = await import("@/features/telegram/actions");
        const { sendTelegramMessage, escapeTelegramHtml, isTelegramConfigured } = await import(
          "@/lib/telegram/notifier"
        );
        const tg = await getTelegramConfigForSahibkar(sahibkarId);
        if (isTelegramConfigured() && tg.chat_id && tg.events.includes("webhook_order")) {
          const itemsList = body.items
            .slice(0, 5)
            .map((it) => `• ${escapeTelegramHtml(it.sku ?? "?")} × ${it.miqdar} × ${it.qiymet}₼`)
            .join("\n");
          const more = body.items.length > 5 ? `\n<i>... və ${body.items.length - 5} item daha</i>` : "";
          const warn = anyShort ? `\n⚠️ <b>Bəzi məhsulların stoku yetmir</b>` : "";
          const baseUrl = process.env.NEXTAUTH_URL ?? "";
          await sendTelegramMessage({
            chatId: tg.chat_id,
            text:
              `🛒 <b>Yeni sifariş — ${kanal.toUpperCase()}</b>\n` +
              `<b>Məbləğ:</b> ${cem.toFixed(2)} ₼\n` +
              `<b>Müştəri:</b> ${escapeTelegramHtml(body.musteri?.ad ?? "—")}\n` +
              `<b>Telefon:</b> ${escapeTelegramHtml(body.musteri?.telefon ?? "—")}\n` +
              `<b>External:</b> <code>${escapeTelegramHtml(body.external_id)}</code>\n\n` +
              itemsList + more + warn,
            parseMode: "HTML",
            inlineKeyboard: baseUrl
              ? [[{ text: "ERP-də aç", url: `${baseUrl}/ticaret/satislar/${satisId}` }]]
              : undefined,
          });
        }
      } catch (e) {
        console.error("[webhook] telegram göndərilə bilmədi:", e);
      }

      // 10b. Email bildiriş (opsiyonel — env-də provider + sahibkar email qoyulubsa)
      try {
        const { getEmailConfigForSahibkar } = await import("@/features/email/actions");
        const { sendEmail, isEmailRealMode } = await import("@/lib/email/adapter");
        const em = await getEmailConfigForSahibkar(sahibkarId);
        if (isEmailRealMode() && em.recipient && em.events.includes("webhook_order")) {
          const itemsHtml = body.items
            .slice(0, 10)
            .map((it) => `<tr><td>${it.sku ?? "?"}</td><td>×${it.miqdar}</td><td>${it.qiymet}₼</td></tr>`)
            .join("");
          const more = body.items.length > 10 ? `<p><em>... və ${body.items.length - 10} item daha</em></p>` : "";
          const warn = anyShort ? `<p style="color:#dc2626"><strong>⚠️ Bəzi məhsulların stoku yetmir</strong></p>` : "";
          const baseUrl = process.env.NEXTAUTH_URL ?? "";
          await sendEmail({
            to: em.recipient,
            subject: `🛒 Yeni ${kanal} sifariş — ${cem.toFixed(2)} ₼`,
            html: `
              <div style="font-family:system-ui,sans-serif;max-width:640px;padding:24px;background:#f8fafc">
                <h1 style="color:#0f172a;margin:0 0 16px">🛒 Yeni sifariş — ${kanal.toUpperCase()}</h1>
                <table style="width:100%;border-collapse:collapse;background:white;border-radius:8px">
                  <tr><td style="padding:8px"><strong>Məbləğ:</strong></td><td style="padding:8px">${cem.toFixed(2)} ₼</td></tr>
                  <tr><td style="padding:8px"><strong>Müştəri:</strong></td><td style="padding:8px">${body.musteri?.ad ?? "—"}</td></tr>
                  <tr><td style="padding:8px"><strong>Telefon:</strong></td><td style="padding:8px">${body.musteri?.telefon ?? "—"}</td></tr>
                  <tr><td style="padding:8px"><strong>External:</strong></td><td style="padding:8px"><code>${body.external_id}</code></td></tr>
                </table>
                <h3 style="color:#0f172a;margin-top:24px">Item-lər</h3>
                <table style="width:100%;border-collapse:collapse;background:white">
                  <thead><tr style="background:#e2e8f0"><th style="padding:8px;text-align:left">SKU</th><th style="padding:8px">Miqdar</th><th style="padding:8px">Qiymət</th></tr></thead>
                  <tbody>${itemsHtml}</tbody>
                </table>
                ${more}${warn}
                ${baseUrl ? `<a href="${baseUrl}/ticaret/satislar/${satisId}" style="display:inline-block;margin-top:16px;padding:12px 24px;background:#0f172a;color:white;text-decoration:none;border-radius:8px">ERP-də aç →</a>` : ""}
              </div>`,
          });
        }
      } catch (e) {
        console.error("[webhook] email göndərilə bilmədi:", e);
      }

      // 11. Stok dəyişən məhsulları DIGƏR kanallara avtomatik sync — arxa fonda
      try {
        const { emitStockChange } = await import("@/lib/stock-change-emitter");
        const changedIds = itemResults
          .map((r) => r.resolved_id)
          .filter((id): id is string => !!id);
        emitStockChange(changedIds);
      } catch (e) {
        console.error("[webhook] emitStockChange:", e);
      }

      return NextResponse.json({
        ok: true,
        kanal,
        external_id: body.external_id,
        satis_id: satisId,
        satis_nomre: nomre,
        musteri_id: musteriId,
        items: itemResults,
        cem_mebleg: cem,
        warning: anyShort ? "Bəzi məhsulların stoku yetmir — qismən qəbul olundu" : null,
      });
    },
  );
}
