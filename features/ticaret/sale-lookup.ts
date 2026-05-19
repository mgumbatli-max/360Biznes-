"use server";

import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";

/**
 * Resolve a sale (satis_sifarisleri) by an external/reference code.
 *
 * Lookup order (within the current tenant):
 *   1. exact match on `nomre`          (internal MS-/SAT- number)
 *   2. exact match on `qaime_nomresi`  (B2B invoice number)
 *   3. regex/contains match on `qeyd`  for `[ORDER:<platform>:<code>]`
 *      (marketplace sifariş kodu — Bolt Food / Wolt / ...)
 *   4. fallback `qeyd ILIKE %sifaris_no=<code>%` (legacy format)
 *   5. fallback `qeyd ILIKE %[QAIME:<code>]%`   (qaimə in qeyd tag)
 *
 * Returns the full sale (with lines, customer, anbar, marketplace info)
 * or `null` if no match was found.
 *
 * NOTE: This is the canonical lookup used by:
 *   - Tez qaytarma "Sifariş kodu" axtarış rejimi
 *   - Bank reconciliation auto-close
 *   (see also: features/maliyye/bank-recon-helpers.ts → findSaleByExternalCode)
 */
export type SaleByCodeLine = {
  id: number;
  mehsul_id: string;
  mehsul_ad: string;
  mehsul_kod: string | null;
  miqdar: number;
  vahid_qiymet: number;
  endirim_faiz: number;
  cem: number;
};

export type SaleByCodeResult = {
  id: string;
  nomre: string;
  tarix: Date;
  status: string | null;
  anbar_id: number | null;
  anbar_ad: string | null;
  musteri_id: string | null;
  musteri_ad: string | null;
  marketplace_platform: string | null;
  sifaris_kodu: string | null;
  qaime_nomresi: string | null;
  umumi_mebleg: number;
  endirim_mebleg: number;
  son_mebleg: number;
  komisyon_meblegh: number;
  xalis_meblegh: number;
  qeyd: string | null;
  lines: SaleByCodeLine[];
  match_field: "nomre" | "qaime_nomresi" | "qeyd_order" | "qeyd_legacy" | "qeyd_qaime";
};

function extractSifarisKodu(qeyd: string | null): string | null {
  if (!qeyd) return null;
  const m = qeyd.match(/\[ORDER:[^:\]]+:([^\]]+)\]/);
  if (m) return m[1];
  const legacy = qeyd.match(/sifaris_no=([^\s\n]+)/);
  return legacy?.[1] ?? null;
}

export async function findSaleByCode(
  code: string,
): Promise<SaleByCodeResult | null> {
  const trimmed = code.trim();
  if (!trimmed) return null;

  return withTenant(async () => {
    const { sahibkarId } = requireTenant();

    const baseInclude = {
      kontragentler: { select: { ad: true } },
      anbarlar: { select: { ad: true } },
      satis_sifaris_satirlari: {
        include: {
          mehsullar: { select: { id: true, ad: true, kod: true } },
        },
      },
    } as const;

    // 1. exact internal nomre
    let row = await prisma.satis_sifarisleri.findFirst({
      where: { sahibkar_id: sahibkarId, nomre: trimmed },
      include: baseInclude,
    });
    let matchField: SaleByCodeResult["match_field"] | null = row ? "nomre" : null;

    // 2. exact qaime_nomresi
    if (!row) {
      row = await prisma.satis_sifarisleri.findFirst({
        where: { sahibkar_id: sahibkarId, qaime_nomresi: trimmed },
        include: baseInclude,
      });
      if (row) matchField = "qaime_nomresi";
    }

    // 3. [ORDER:<platform>:<code>] in qeyd
    if (!row) {
      row = await prisma.satis_sifarisleri.findFirst({
        where: {
          sahibkar_id: sahibkarId,
          qeyd: { contains: `:${trimmed}]` },
        },
        include: baseInclude,
      });
      if (row) {
        // Confirm the match is inside an [ORDER:...] tag, not a stray substring.
        if (row.qeyd && /\[ORDER:[^:\]]+:[^\]]+\]/.test(row.qeyd)) {
          matchField = "qeyd_order";
        } else {
          row = null;
        }
      }
    }

    // 4. legacy sifaris_no=<code>
    if (!row) {
      row = await prisma.satis_sifarisleri.findFirst({
        where: {
          sahibkar_id: sahibkarId,
          qeyd: { contains: `sifaris_no=${trimmed}` },
        },
        include: baseInclude,
      });
      if (row) matchField = "qeyd_legacy";
    }

    // 5. [QAIME:<code>] in qeyd
    if (!row) {
      row = await prisma.satis_sifarisleri.findFirst({
        where: {
          sahibkar_id: sahibkarId,
          qeyd: { contains: `[QAIME:${trimmed}]` },
        },
        include: baseInclude,
      });
      if (row) matchField = "qeyd_qaime";
    }

    if (!row || !matchField) return null;

    const lines: SaleByCodeLine[] = row.satis_sifaris_satirlari.map((l) => {
      const miqdar = Number(l.miqdar ?? 0);
      const qiymet = Number(l.vahid_qiymet ?? 0);
      const endirimFaiz = Number(l.endirim_faiz ?? 0);
      return {
        id: l.id,
        mehsul_id: l.mehsul_id ?? "",
        mehsul_ad: l.mehsullar?.ad ?? "—",
        mehsul_kod: l.mehsullar?.kod ?? null,
        miqdar,
        vahid_qiymet: qiymet,
        endirim_faiz: endirimFaiz,
        cem: miqdar * qiymet * (1 - endirimFaiz / 100),
      };
    });

    return {
      id: row.id,
      nomre: row.nomre,
      tarix: row.tarix,
      status: row.status,
      anbar_id: row.anbar_id,
      anbar_ad: row.anbarlar?.ad ?? null,
      musteri_id: row.musteri_id,
      musteri_ad: row.kontragentler?.ad ?? null,
      marketplace_platform: row.marketplace_platform,
      sifaris_kodu: extractSifarisKodu(row.qeyd),
      qaime_nomresi: row.qaime_nomresi,
      umumi_mebleg: Number(row.umumi_mebleg ?? 0),
      endirim_mebleg: Number(row.endirim_mebleg ?? 0),
      son_mebleg: Number(row.son_mebleg ?? 0),
      komisyon_meblegh: Number(row.komisyon_meblegh ?? 0),
      xalis_meblegh: Number(row.xalis_meblegh ?? 0),
      qeyd: row.qeyd,
      lines,
      match_field: matchField,
    };
  });
}
