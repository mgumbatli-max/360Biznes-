"use server";

import { randomBytes } from "node:crypto";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { nextDocNumber } from "@/lib/db/sened-nomre";
import { getQuickProducts, type QuickProductRow } from "./quick-products-queries";

/* -------------------------------------------------------------------------- */
/*  Quick products (top-selling this week)                                    */
/* -------------------------------------------------------------------------- */
export async function getQuickProductsAction(
  anbarId?: number,
): Promise<QuickProductRow[]> {
  return getQuickProducts(anbarId, 10);
}

/* -------------------------------------------------------------------------- */
/*  Inline create customer (POS combobox "+ Yeni müştəri")                    */
/* -------------------------------------------------------------------------- */
const QuickCustomerSchema = z.object({
  ad: z.string().min(2).max(200),
  telefon: z.string().trim().max(30).nullish(),
});

export type CreateQuickCustomerResult =
  | { ok: true; id: string; ad: string; telefon: string | null }
  | { ok: false; error: string };

export async function createQuickCustomer(input: {
  ad: string;
  telefon?: string | null;
}): Promise<CreateQuickCustomerResult> {
  const parsed = QuickCustomerSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Müştəri adı ən az 2 simvol olmalıdır" };
  }
  const { requireTicaretActionPerm } = await import("@/features/ticaret/access-guard");
  const permCheck = await requireTicaretActionPerm(["pos.satis", "musteri.yarat"]);
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  return withTenant(async () => {
    try {
      const { sahibkarId, istifadeciId } = requireTenant();
      const created = await prisma.kontragentler.create({
        data: {
          sahibkar_id: sahibkarId,
          getirdi_id: istifadeciId,
          ad: parsed.data.ad.trim(),
          telefon: parsed.data.telefon?.trim() || null,
          nov: "musteri",
          aktiv: true,
        },
        select: { id: true, ad: true, telefon: true },
      });
      revalidatePath("/pos");
      return { ok: true, id: created.id, ad: created.ad, telefon: created.telefon };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Bilinməyən xəta";
      return { ok: false, error: msg };
    }
  });
}

/* -------------------------------------------------------------------------- */
/*  Mock: Vergi çeki göndər (placeholder — real ASAN imza inteqrasiyası deyil)*/
/* -------------------------------------------------------------------------- */
export type SendVergiCekResult =
  | { ok: true; cek_id: string; cek_nomresi: string }
  | { ok: false; error: string };

export async function sendVergiCekAction(
  satisId: string,
): Promise<SendVergiCekResult> {
  if (!satisId) return { ok: false, error: "Satış ID boşdur" };
  const { requireTicaretActionPerm } = await import("@/features/ticaret/access-guard");
  const permCheck = await requireTicaretActionPerm(["pos.satis", "vergi.idare"]);
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  return withTenant(async () => {
    try {
      const { sahibkarId, istifadeciId } = requireTenant();
      const sale = await prisma.satis_sifarisleri.findFirst({
        where: { id: satisId, sahibkar_id: sahibkarId },
        select: { id: true, son_mebleg: true, kassa_id: true, nomre: true },
      });
      if (!sale) return { ok: false, error: "Satış tapılmadı" };

      // Generate a mock check number
      const cekNomresi = `VC-${new Date().getFullYear()}-${Math.floor(
        Math.random() * 1_000_000,
      )
        .toString()
        .padStart(6, "0")}`;

      const cek = await prisma.vergi_cekleri.create({
        data: {
          sahibkar_id: sahibkarId,
          satis_id: sale.id,
          kassa_id: sale.kassa_id,
          cek_nov: "satis",
          cek_nomresi: cekNomresi,
          mebleg: sale.son_mebleg ?? 0,
          status: "vurulub",
          vurulma_de: new Date(),
          istifadeci_id: istifadeciId,
        },
        select: { id: true, cek_nomresi: true },
      });

      await prisma.satis_sifarisleri.update({
        where: { id: sale.id },
        data: {
          cek_status: "vurulub",
          cek_nomresi: cekNomresi,
          cek_vurulma_de: new Date(),
          vergi_kassasina_vur: true,
        },
      });

      return { ok: true, cek_id: cek.id, cek_nomresi: cek.cek_nomresi ?? cekNomresi };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Bilinməyən xəta";
      return { ok: false, error: msg };
    }
  });
}

/* -------------------------------------------------------------------------- */
/*  Warranty ticket: ensure zemanetler exist for a sale; returns first QR     */
/*  token so POS can open print page.                                         */
/* -------------------------------------------------------------------------- */
export type EnsureWarrantyResult =
  | { ok: true; tokens: string[]; count: number }
  | { ok: false; error: string };

export async function ensureWarrantyForSale(
  satisId: string,
  defaultMonths = 12,
): Promise<EnsureWarrantyResult> {
  if (!satisId) return { ok: false, error: "Satış ID boşdur" };
  const { requireTicaretActionPerm } = await import("@/features/ticaret/access-guard");
  const permCheck = await requireTicaretActionPerm(["pos.print_warranty", "pos.satis"]);
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  return withTenant(async () => {
    try {
      const { sahibkarId, istifadeciId } = requireTenant();
      const sale = await prisma.satis_sifarisleri.findFirst({
        where: { id: satisId, sahibkar_id: sahibkarId },
        include: {
          satis_sifaris_satirlari: {
            include: {
              mehsullar: { select: { id: true, ad: true } },
            },
          },
          kontragentler: { select: { id: true, ad: true, telefon: true } },
          zemanetler: true,
        },
      });
      if (!sale) return { ok: false, error: "Satış tapılmadı" };

      const existingTokens = sale.zemanetler.map((z) => z.qr_token);
      if (existingTokens.length > 0) {
        return { ok: true, tokens: existingTokens, count: existingTokens.length };
      }

      const startedAt = new Date();
      const endsAt = new Date(startedAt);
      endsAt.setMonth(endsAt.getMonth() + defaultMonths);

      // QA-perf: N+1 (sətir başına bir INSERT) → tək createMany.
      //
      // AUDIT 2026-09-02: kod artıq `Math.random().toString(36)` ilə DEYİL,
      // mərkəzi atomik `nextDocNumber("zemanet")` ilə verilir. Əvvəlki
      // generatorun iki qüsuru vardı:
      //   • 36^6 məkan — 10k zəmanətdə ~2.3%, 50k-da ~44% toqquşma ehtimalı;
      //   • toqquşanda `skipDuplicates: true` sətri SƏSSİZCƏ atırdı, yəni
      //     müştəri zəmanətsiz qalır və heç kim bunu bilmirdi.
      // `skipDuplicates` götürüldü: indi hər sətrin yaradılması təsdiqlənir,
      // gözlənilməz toqquşma səssiz itki yox, açıq xəta verir.
      //
      // `qr_token` kriptoqrafik təsadüfi qalır (qlobal UNIQUE, public açar).
      const zemanetRows = [];
      for (const sat of sale.satis_sifaris_satirlari) {
        zemanetRows.push({
          sahibkar_id: sahibkarId,
          unikal_kod: await nextDocNumber(prisma, sahibkarId, "zemanet"),
          qr_token: randomBytes(30).toString("hex").slice(0, 60),
          satis_id: sale.id,
          satis_satir_id: sat.id, filial_id: sale.filial_id, musteri_id: sale.musteri_id,
          musteri_ad: sale.kontragentler?.ad ?? null, musteri_telefon: sale.kontragentler?.telefon ?? null,
          mehsul_id: sat.mehsul_id, mehsul_ad: sat.mehsullar?.ad ?? null, miqdar: sat.miqdar,
          satis_qiymeti: sat.vahid_qiymet, baslama_tarixi: startedAt, bitme_tarixi: endsAt,
          ay_sayi: defaultMonths, status: "aktiv", yaradan_id: istifadeciId,
        });
      }
      const created = await prisma.zemanetler.createMany({ data: zemanetRows });
      if (created.count !== zemanetRows.length) {
        return { ok: false, error: `Zəmanət yaradılmadı: ${created.count}/${zemanetRows.length}` };
      }
      const tokens = zemanetRows.map((r) => r.qr_token);
      return { ok: true, tokens, count: tokens.length };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Bilinməyən xəta";
      return { ok: false, error: msg };
    }
  });
}
