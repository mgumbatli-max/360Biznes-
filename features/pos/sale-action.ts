"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma, prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { checkDiscountLimit, requestDiscountApproval } from "@/features/ticaret/discount-approval";
import { checkCustomerCreditLimit } from "@/features/ticaret/customer-tier";

const LineSchema = z.object({
  mehsul_id: z.string().uuid(),
  miqdar: z.coerce.number().positive(),
  qiymet: z.coerce.number().min(0),
  endirim_faiz: z.coerce.number().min(0).max(100).default(0),
});

const CreateSaleSchema = z.object({
  kassa_id: z.string().uuid(),
  anbar_id: z.coerce.number().int().positive(),
  musteri_id: z.string().uuid().nullish(),
  satis_meneceri_id: z.string().uuid().nullish(),
  odenis_nov: z.enum(["negd", "kart", "kecirme", "nisye"]),
  endirim_mebleg: z.coerce.number().min(0).default(0),
  qeyd: z.string().max(2000).nullish(),
  lines: z.array(LineSchema).min(1, "Ən az 1 məhsul olmalıdır"),
  override_credit_limit: z.coerce.boolean().optional(),
  override_discount_limit: z.coerce.boolean().optional(),
});

export type CreateSaleInput = z.input<typeof CreateSaleSchema>;
export type CreateSaleResult =
  | {
      ok: true;
      satis_id: string;
      nomre: string;
      son_mebleg: number;
      pos_cek_nomresi: string;
    }
  | { ok: false; error: string };

const SALE_PREFIX = "SAT";

export async function createSale(input: CreateSaleInput): Promise<CreateSaleResult> {
  const parsed = CreateSaleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Forma yanlışdır" };
  const data = parsed.data;

  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();

    try {
      // Pre-flight: compute totals first to check credit and discount limits.
      let preUmumi = 0;
      let maxLineDiscount = 0;
      for (const line of data.lines) {
        preUmumi += line.miqdar * line.qiymet * (1 - line.endirim_faiz / 100);
        if (line.endirim_faiz > maxLineDiscount) maxLineDiscount = line.endirim_faiz;
      }
      const preSonMebleg = Math.max(0, preUmumi - data.endirim_mebleg);
      const overallDiscountPct =
        preUmumi > 0 ? Math.round(((preUmumi - preSonMebleg) / preUmumi) * 1000) / 10 : 0;
      const effectiveMaxPct = Math.max(maxLineDiscount, overallDiscountPct);

      // Credit-limit check for nisye sales.
      if (data.odenis_nov === "nisye" && data.musteri_id && !data.override_credit_limit) {
        const check = await checkCustomerCreditLimit(data.musteri_id, preSonMebleg);
        if (!check.ok) {
          return {
            ok: false as const,
            error: `Borc limiti aşılır (${check.current.toFixed(2)} + ${check.addAmount.toFixed(2)} > ${check.limit.toFixed(2)} AZN). Menecer override edə bilər.`,
          };
        }
      }

      // Discount-limit check: if user is over their role's cap and didn't
      // explicitly override, create a tesdiq_telep and refuse for now.
      if (effectiveMaxPct > 0 && !data.override_discount_limit) {
        const dCheck = await checkDiscountLimit(effectiveMaxPct);
        if (!dCheck.ok) {
          // Create an approval request (no sale yet — uses a placeholder ref).
          await requestDiscountApproval(
            "pending-sale",
            effectiveMaxPct,
            `Endirim: ${effectiveMaxPct.toFixed(1)}% (limit ${dCheck.limit}%)`,
            preSonMebleg
          );
          return {
            ok: false as const,
            error: `Endirim limit aşılır (${effectiveMaxPct.toFixed(1)}% > ${dCheck.limit}%). Sahibkar təsdiqi tələb olunur.`,
          };
        }
      }

      const result = await prisma.$transaction(async (tx) => {
        // 1. Verify kassa is open
        const kassa = await tx.kassalar.findFirst({
          where: { id: data.kassa_id, status: "acig" },
        });
        if (!kassa) throw new Error("Kassa sessiyası açıq deyil");

        // 2. Compute totals + load product costs
        let umumi = 0;
        for (const line of data.lines) {
          umumi += line.miqdar * line.qiymet * (1 - line.endirim_faiz / 100);
        }
        const sonMebleg = Math.max(0, umumi - data.endirim_mebleg);

        // 3. Lock stok rows and verify availability
        const stokRows = await tx.$queryRaw<{ id: number; mehsul_id: string; miqdar: number }[]>(
          Prisma.sql`
            SELECT id, mehsul_id::text, COALESCE(miqdar, 0)::float AS miqdar
              FROM stok
             WHERE sahibkar_id = ${sahibkarId}::uuid
               AND anbar_id = ${data.anbar_id}::int
               AND mehsul_id IN (${Prisma.join(data.lines.map((l) => Prisma.sql`${l.mehsul_id}::uuid`))})
             FOR UPDATE
          `
        );
        const stokByMehsul = new Map(stokRows.map((r) => [r.mehsul_id, r]));
        for (const line of data.lines) {
          const row = stokByMehsul.get(line.mehsul_id);
          if (!row) throw new Error(`Stok qeydi tapılmadı (məhsul ID ${line.mehsul_id})`);
          if (row.miqdar < line.miqdar) {
            throw new Error(`Stok kifayət etmir (mövcud: ${row.miqdar}, tələb: ${line.miqdar})`);
          }
        }

        // 4. Load product cost info for maya_alti flag
        const products = await tx.mehsullar.findMany({
          where: { id: { in: data.lines.map((l) => l.mehsul_id) } },
          select: { id: true, alish_qiymeti: true, min_satis_qiymeti: true },
        });
        const productById = new Map(products.map((p) => [p.id, p]));
        let mayaAlti = false;
        let minQiymetAlti = false;
        for (const line of data.lines) {
          const p = productById.get(line.mehsul_id);
          if (!p) continue;
          const effective = line.qiymet * (1 - line.endirim_faiz / 100);
          if (effective < Number(p.alish_qiymeti ?? 0)) mayaAlti = true;
          if (Number(p.min_satis_qiymeti ?? 0) > 0 && effective < Number(p.min_satis_qiymeti ?? 0)) {
            minQiymetAlti = true;
          }
        }

        // 5. Sale number (race-safe inside transaction)
        const year = new Date().getFullYear();
        const last = await tx.satis_sifarisleri.findFirst({
          where: { nomre: { startsWith: `${SALE_PREFIX}-${year}-` } },
          orderBy: { nomre: "desc" },
          select: { nomre: true },
        });
        const lastNum = last ? Number(last.nomre.split("-").pop()) || 0 : 0;
        const nomre = `${SALE_PREFIX}-${year}-${String(lastNum + 1).padStart(5, "0")}`;

        // 5b. POS receipt number sequence per kassa session
        // Format: POS-{year}-{kassa_short}-{seq} where kassa_short = last 4 chars of kassa.id
        const kassaShort = kassa.id.replace(/-/g, "").slice(-4).toUpperCase();
        const posPrefix = `POS-${year}-${kassaShort}-`;
        const lastPos = await tx.satis_sifarisleri.findFirst({
          where: {
            kassa_id: data.kassa_id,
            qaime_nomresi: { startsWith: posPrefix },
          },
          orderBy: { qaime_nomresi: "desc" },
          select: { qaime_nomresi: true },
        });
        const lastPosNum = lastPos?.qaime_nomresi
          ? Number(lastPos.qaime_nomresi.split("-").pop()) || 0
          : 0;
        const posCekNomresi = `${posPrefix}${String(lastPosNum + 1).padStart(5, "0")}`;

        // 6. Sale header
        const sale = await tx.satis_sifarisleri.create({
          data: {
            sahibkar_id: sahibkarId,
            nomre,
            musteri_id: data.musteri_id ?? null,
            anbar_id: data.anbar_id,
            kassa_id: data.kassa_id,
            tarix: new Date(),
            status: "tamamlandi",
            odenis_nov: data.odenis_nov,
            umumi_mebleg: umumi,
            endirim_mebleg: data.endirim_mebleg,
            son_mebleg: sonMebleg,
            odenilmis: data.odenis_nov === "nisye" ? 0 : sonMebleg,
            filial_id: kassa.filial_id,
            satis_meneceri_id: data.satis_meneceri_id ?? istifadeciId,
            yaradan_id: istifadeciId,
            qaralama: false,
            maya_alti: mayaAlti,
            min_qiymet_alti: minQiymetAlti,
            qeyd: data.qeyd ?? null,
            qaime_nomresi: posCekNomresi,
          },
        });

        // 7. Sale lines + stock decrement + warehouse movement
        for (const line of data.lines) {
          await tx.satis_sifaris_satirlari.create({
            data: {
              sahibkar_id: sahibkarId,
              sifaris_id: sale.id,
              mehsul_id: line.mehsul_id,
              miqdar: line.miqdar,
              vahid_qiymet: line.qiymet,
              endirim_faiz: line.endirim_faiz,
              // `cemi` is GENERATED — do not set
            },
          });

          await tx.stok.updateMany({
            where: { sahibkar_id: sahibkarId, mehsul_id: line.mehsul_id, anbar_id: data.anbar_id },
            data: { miqdar: { decrement: line.miqdar } },
          });

          await tx.anbar_hereketleri.create({
            data: {
              sahibkar_id: sahibkarId,
              anbar_id: data.anbar_id,
              mehsul_id: line.mehsul_id,
              nov: "mexaric", // CHECK constraint allows: medaxil/mexaric/transfer_*/inventar/qaytarma_*
              miqdar: line.miqdar,
              qiymet: line.qiymet,
              ref_nov: "satis_sifarisi",
              ref_id: sale.id,
              edilen_id: istifadeciId,
            },
          });
        }

        // 8. Cash register operation (skip for borc)
        if (data.odenis_nov !== "nisye") {
          await tx.kassa_emeliyyatlari.create({
            data: {
              sahibkar_id: sahibkarId,
              kassa_id: data.kassa_id,
              emeliyyat_nov: "satis",
              odenis_nov: data.odenis_nov,
              mebleg: sonMebleg,
              ref_nov: "satis_sifarisi",
              ref_id: sale.id,
              istifadeci_id: istifadeciId,
            },
          });
        }

        // 9. Customer debt
        if (data.odenis_nov === "nisye" && data.musteri_id) {
          await tx.kontragentler.update({
            where: { id: data.musteri_id },
            data: { borc: { increment: sonMebleg } },
          });
        }

        return { id: sale.id, nomre, sonMebleg, posCekNomresi };
      }, { timeout: 20_000 });

      revalidatePath("/pos");
      revalidatePath("/dashboard");
      return {
        ok: true as const,
        satis_id: result.id,
        nomre: result.nomre,
        son_mebleg: result.sonMebleg,
        pos_cek_nomresi: result.posCekNomresi,
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Bilinməyən xəta";
      console.error("[createSale]", e);
      return { ok: false as const, error: msg };
    }
  });
}
