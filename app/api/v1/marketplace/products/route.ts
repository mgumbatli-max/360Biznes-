import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { runWithTenant } from "@/lib/db/tenant-context";
import { verifyApiKey } from "@/features/qiymet-kanal/api-key-actions";
import { recordKanalApiCall } from "@/features/qiymet-kanal/api-stats";
import { getKanalExtraServer } from "@/features/qiymet-kanal/kanal-extra";
import { computeChannelPrice, type KanalQiymetFormula } from "@/features/qiymet-kanal/types";
import { rateAllow, rateRetryAfterSec } from "@/lib/rate-limiter";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Item = {
  sku: string | null;
  barkod: string | null;
  ad: string;
  ad_uzun: string | null;
  kateqoriya: string | null;
  marka: string | null;
  vahid: string | null;
  stok: number;
  qiymet: number;
  valyuta: string;
  sekil_url: string | null;
  aktiv: boolean;
};

function badRequest(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

/**
 * Public marketplace API — platforma adapterləri (Wolt, Birmarket, Tap.az, sayt)
 * bu endpoint-i öz vaxtında çağırır və kanal-spesifik qiymət + stok alır.
 *
 * GET /api/v1/marketplace/products?kanal=<kod>&key=<api_key>
 *   - limit (default 500, max 5000)
 *   - offset (default 0)
 *   - only_active (default true) — yalnız aktiv məhsullar
 *   - only_in_stock (default false) — yalnız stoku > 0 olanlar
 *
 * Cavab:
 *   { kanal: "...", count: 100, total: 1500, items: [{ sku, ad, stok, qiymet, ... }] }
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const kanal = sp.get("kanal")?.trim();
  const key = sp.get("key")?.trim();

  if (!kanal) return badRequest("`kanal` query param tələb olunur");
  if (!key) return badRequest("`key` query param tələb olunur", 401);

  const sahibkarId = await verifyApiKey(key, kanal);
  if (!sahibkarId) return badRequest("API key etibarsızdır və ya kanal mövcud deyil", 401);

  // Kanal əlavə ayarları (stok buffer, rate limit)
  const extra = await getKanalExtraServer(sahibkarId, kanal);
  const rateKey = `${sahibkarId}:${kanal}`;
  if (extra.rate_limit_per_min > 0 && !rateAllow(rateKey, extra.rate_limit_per_min)) {
    const retry = rateRetryAfterSec(rateKey);
    return new NextResponse(
      JSON.stringify({ error: `Rate limit aşıldı (${extra.rate_limit_per_min}/dəq)`, retry_after_sec: retry }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": String(retry),
          "X-RateLimit-Limit": String(extra.rate_limit_per_min),
          "Access-Control-Allow-Origin": "*",
        },
      },
    );
  }

  const limit = Math.min(5000, Math.max(1, Number(sp.get("limit") ?? 500)));
  const offset = Math.max(0, Number(sp.get("offset") ?? 0));
  const onlyActive = sp.get("only_active") !== "false";
  const onlyInStock = sp.get("only_in_stock") === "true";
  const format = (sp.get("format") ?? "json").toLowerCase();
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;

  return runWithTenant(
    {
      sahibkarId,
      istifadeciId: "00000000-0000-0000-0000-000000000000", // sistem
      rolId: 0,
      icazeler: [],
    },
    async () => {
      const [kanalRow, total, products, overrides] = await Promise.all([
        prisma.qiymet_kanal_komissiya.findUnique({
          where: { sahibkar_id_kanal: { sahibkar_id: sahibkarId, kanal } },
        }),
        prisma.mehsullar.count({
          where: {
            sahibkar_id: sahibkarId,
            ...(onlyActive ? { aktiv: true } : {}),
            ...(onlyInStock ? { stok_cemi: { gt: extra.stok_buffer ?? 0 } } : {}),
          },
        }),
        prisma.mehsullar.findMany({
          where: {
            sahibkar_id: sahibkarId,
            ...(onlyActive ? { aktiv: true } : {}),
            ...(onlyInStock ? { stok_cemi: { gt: extra.stok_buffer ?? 0 } } : {}),
            // Bu kanal üçün "gizli" işarələnmiş məhsulları çıxar
            NOT: {
              qiymet_kanal: {
                some: {
                  sahibkar_id: sahibkarId,
                  kanal,
                  formula_kod: "gizli",
                },
              },
            },
          },
          orderBy: { ad: "asc" },
          take: limit,
          skip: offset,
          select: {
            id: true,
            ad: true,
            kod: true,
            barkod: true,
            aciqlamaq: true,
            qisaca_tesvir: true,
            satis_qiymeti: true,
            min_satis_qiymeti: true,
            stok_cemi: true,
            sekil_url: true,
            aktiv: true,
            kateqoriyalar: { select: { ad: true } },
            markalar: { select: { ad: true } },
            olcu_vahidleri: { select: { ad: true, qisa_ad: true } },
          },
        }),
        prisma.qiymet_kanal.findMany({
          where: { sahibkar_id: sahibkarId, kanal },
          select: { mehsul_id: true, qiymet: true, formula_kod: true },
        }),
      ]);

      const ovMap = new Map(overrides.map((o) => [o.mehsul_id, o]));
      const items: Item[] = products.map((p) => {
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
          sku: p.kod,
          barkod: p.barkod,
          ad: p.ad,
          ad_uzun: p.qisaca_tesvir ?? p.aciqlamaq,
          kateqoriya: p.kateqoriyalar?.ad ?? null,
          marka: p.markalar?.ad ?? null,
          vahid: p.olcu_vahidleri?.qisa_ad ?? p.olcu_vahidleri?.ad ?? null,
          stok: Math.max(0, Number(p.stok_cemi ?? 0) - (extra.stok_buffer ?? 0)),
          qiymet: effective,
          valyuta: "AZN",
          sekil_url: p.sekil_url,
          aktiv: p.aktiv ?? true,
        };
      });

      // Stats qeyd et (uğurlu çağırış)
      void recordKanalApiCall({
        sahibkarId,
        kanal,
        status: 200,
        itemCount: items.length,
        ip,
      });

      if (format === "csv") {
        const header = "sku,barkod,ad,kateqoriya,marka,vahid,stok,qiymet,valyuta,aktiv,sekil_url";
        const csvEscape = (v: unknown): string => {
          if (v === null || v === undefined) return "";
          const s = String(v);
          return s.includes(",") || s.includes('"') || s.includes("\n")
            ? `"${s.replace(/"/g, '""')}"`
            : s;
        };
        const lines = items.map((it) =>
          [
            it.sku,
            it.barkod,
            it.ad,
            it.kateqoriya,
            it.marka,
            it.vahid,
            it.stok,
            it.qiymet,
            it.valyuta,
            it.aktiv,
            it.sekil_url,
          ]
            .map(csvEscape)
            .join(","),
        );
        const csv = [header, ...lines].join("\n");
        const filename = `${kanal}-products-${new Date().toISOString().slice(0, 10)}.csv`;
        return new NextResponse(csv, {
          status: 200,
          headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": `attachment; filename="${filename}"`,
            "Access-Control-Allow-Origin": "*",
            "Cache-Control": "no-store",
            "X-Item-Count": String(items.length),
            "X-Total-Count": String(total),
          },
        });
      }

      const res = NextResponse.json({
        kanal,
        count: items.length,
        total,
        offset,
        limit,
        items,
      });
      // CORS — platformalar browser tərəfdən də oxuya bilsin
      res.headers.set("Access-Control-Allow-Origin", "*");
      res.headers.set("Cache-Control", "no-store");
      return res;
    },
  );
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Max-Age": "86400",
    },
  });
}
