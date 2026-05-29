"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma, prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { safeStockDecrement } from "@/lib/db/stock-guards";
import { nextDocNumber } from "@/lib/db/sened-nomre";

/**
 * "Marketdən satış" — marketplace platforma satışları
 * (Bolt Food / Wolt / Yango Deli / Tap.az / ProGo / Digər).
 *
 * Adi POS satışına oxşar barkod-əsaslı sürətli satış, lakin əlavə sahələr:
 * - platform: marketplace platforması (məcburi)
 * - sifaris_nomresi: xarici platformanın order ID-si (məcburi, tenant başına unikal)
 * - komissiya_faiz: platforma komissiyası (default 0)
 * - musteri_id: opsional (marketplace adətən anonimdir)
 * - catdirma_unvani: opsional çatdırılma ünvanı
 */

const LineSchema = z.object({
  mehsul_id: z.string().uuid(),
  miqdar: z.coerce.number().positive(),
  qiymet: z.coerce.number().min(0),
  endirim_faiz: z.coerce.number().min(0).max(100).default(0),
});

const PLATFORM_VALUES = [
  "bolt_food",
  "wolt",
  "yango_deli",
  "tap_az",
  "progo",
  "diger",
] as const;

const CreateMarketSatisSchema = z.object({
  platform: z.enum(PLATFORM_VALUES),
  sifaris_nomresi: z.string().min(1, "Sifariş kodu məcburidir").max(100),
  qaime_nomresi: z.string().max(50).nullish(),
  komissiya_faiz: z.coerce.number().min(0).max(100).default(0),
  anbar_id: z.coerce.number().int().positive(),
  musteri_id: z.string().uuid().nullish(),
  catdirma_unvani: z.string().max(500).nullish(),
  hesab_id: z.string().uuid().nullish(),
  endirim_mebleg: z.coerce.number().min(0).default(0),
  qeyd: z.string().max(2000).nullish(),
  lines: z.array(LineSchema).min(1, "Ən az 1 məhsul olmalıdır"),
});

export type CreateMarketSatisInput = z.input<typeof CreateMarketSatisSchema>;
export type CreateMarketSatisResult =
  | { ok: true; satis_id: string; nomre: string; son_mebleg: number; net_meblegh: number }
  | { ok: false; error: string };

const PLATFORM_LABELS: Record<(typeof PLATFORM_VALUES)[number], string> = {
  bolt_food: "Bolt Food",
  wolt: "Wolt",
  yango_deli: "Yango Deli",
  tap_az: "Tap.az",
  progo: "ProGo",
  diger: "Digər",
};

const SALE_PREFIX = "MS";

export async function createMarketSatis(
  input: CreateMarketSatisInput,
): Promise<CreateMarketSatisResult> {
  const parsed = CreateMarketSatisSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Forma yanlışdır" };
  }
  const data = parsed.data;

  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();

    try {
      // Validate: sifaris_nomresi tenant başına unikal olsun
      // qeyd sahəsində `[ORDER:<platform>:<sifaris_no>]` regex-axtarırıq
      // (eyni platforma + sifaris_no kombinasiyasını bloklayır).
      const dupTag = `[ORDER:${data.platform}:${data.sifaris_nomresi}]`;
      const existing = await prisma.satis_sifarisleri.findFirst({
        where: {
          sahibkar_id: sahibkarId,
          marketplace_platform: data.platform,
          qeyd: { contains: dupTag },
          status: { not: "legv" },
        },
        select: { id: true, nomre: true },
      });
      if (existing) {
        return {
          ok: false,
          error: `Bu sifariş kodu artıq qeydiyyatdadır: ${existing.nomre}`,
        };
      }

      const result = await prisma.$transaction(
        async (tx) => {
          // 1. Compute totals
          let umumi = 0;
          for (const line of data.lines) {
            umumi += line.miqdar * line.qiymet * (1 - line.endirim_faiz / 100);
          }
          const sonMebleg = Math.max(0, umumi - data.endirim_mebleg);
          const komissiyaMebleg =
            Math.round(sonMebleg * (data.komissiya_faiz / 100) * 100) / 100;
          const netMebleg = Math.max(0, sonMebleg - komissiyaMebleg);

          // 2. Lock stok rows and verify availability
          const stokRows = await tx.$queryRaw<
            { id: number; mehsul_id: string; miqdar: number }[]
          >(
            Prisma.sql`
              SELECT id, mehsul_id::text, COALESCE(miqdar, 0)::float AS miqdar
                FROM stok
               WHERE sahibkar_id = ${sahibkarId}::uuid
                 AND anbar_id = ${data.anbar_id}::int
                 AND mehsul_id IN (${Prisma.join(
                   data.lines.map((l) => Prisma.sql`${l.mehsul_id}::uuid`),
                 )})
               FOR UPDATE
            `,
          );
          const stokByMehsul = new Map(stokRows.map((r) => [r.mehsul_id, r]));
          for (const line of data.lines) {
            const row = stokByMehsul.get(line.mehsul_id);
            if (!row) {
              throw new Error(`Stok qeydi tapılmadı (məhsul ID ${line.mehsul_id})`);
            }
            if (row.miqdar < line.miqdar) {
              throw new Error(
                `Stok kifayət etmir (mövcud: ${row.miqdar}, tələb: ${line.miqdar})`,
              );
            }
          }

          // 3. Generate sale number (MS-YYYY-NNNNN)
          const year = new Date().getFullYear();
          const nomre = await nextDocNumber(tx, sahibkarId, "market");

          // 4. Build qeyd metadata
          // Regex-searchable order tag for bank reconciliation & qaytarma code-search.
          const platformLabel = PLATFORM_LABELS[data.platform];
          const qeydParts: string[] = [];
          qeydParts.push(
            `[ORDER:${data.platform}:${data.sifaris_nomresi}] platform=${platformLabel} sifaris_no=${data.sifaris_nomresi} komissiya=${data.komissiya_faiz}% net=${netMebleg.toFixed(2)} AZN`,
          );
          if (data.qaime_nomresi) {
            qeydParts.push(`[QAIME:${data.qaime_nomresi}]`);
          }
          if (data.catdirma_unvani) {
            qeydParts.push(`[Çatdırılma] ${data.catdirma_unvani}`);
          }
          if (data.qeyd) qeydParts.push(`[Qeyd] ${data.qeyd}`);
          const qeyd = qeydParts.join("\n");

          // 5. Sale header
          const sale = await tx.satis_sifarisleri.create({
            data: {
              sahibkar_id: sahibkarId,
              nomre,
              musteri_id: data.musteri_id ?? null,
              anbar_id: data.anbar_id,
              tarix: new Date(),
              status: "tamamlandi",
              odenis_nov: "kart",
              umumi_mebleg: umumi,
              endirim_mebleg: data.endirim_mebleg,
              son_mebleg: sonMebleg,
              odenilmis: sonMebleg,
              qaralama: false,
              qeyd,
              yaradan_id: istifadeciId,
              satis_meneceri_id: istifadeciId,
              marketplace_platform: data.platform,
              komisyon_meblegh: komissiyaMebleg,
              xalis_meblegh: netMebleg,
              qaime_nomresi: data.qaime_nomresi ?? null,
            },
          });

          // 6. Lines + stock decrement + warehouse movement
          for (const line of data.lines) {
            await tx.satis_sifaris_satirlari.create({
              data: {
                sahibkar_id: sahibkarId,
                sifaris_id: sale.id,
                mehsul_id: line.mehsul_id,
                miqdar: line.miqdar,
                vahid_qiymet: line.qiymet,
                endirim_faiz: line.endirim_faiz,
              },
            });

            const dec = await safeStockDecrement(tx, {
              mehsulId: line.mehsul_id,
              anbarId: data.anbar_id,
              miqdar: line.miqdar,
            });
            if (!dec.ok) throw new Error(dec.error);

            await tx.anbar_hereketleri.create({
              data: {
                sahibkar_id: sahibkarId,
                anbar_id: data.anbar_id,
                mehsul_id: line.mehsul_id,
                nov: "mexaric",
                miqdar: line.miqdar,
                qiymet: line.qiymet,
                ref_nov: "satis_sifarisi",
                ref_id: sale.id,
                edilen_id: istifadeciId,
                qeyd: `Marketdən satış (${platformLabel} #${data.sifaris_nomresi})`,
              },
            });
          }

          // 7. Finance operation: marketplace payout (net amount → seçilmiş hesab)
          if (data.hesab_id && netMebleg > 0) {
            try {
              // Find or create the operation type "marketplace_payout"
              let type = await tx.finance_operation_types
                .findUnique({ where: { kod: "marketplace_payout" } })
                .catch(() => null);
              if (!type) {
                type = await tx.finance_operation_types
                  .create({
                    data: {
                      kod: "marketplace_payout",
                      ad: "Marketplace ödənişi",
                      qrup: "satis",
                      y_n: "daxil",
                      link_satish: true,
                      link_marketplace: true,
                    },
                  })
                  .catch(() => null);
              }
              if (type) {
                await tx.finance_operations.create({
                  data: {
                    sahibkar_id: sahibkarId,
                    type_id: type.id,
                    type_kod: type.kod,
                    y_n: type.y_n,
                    tarix: new Date(),
                    meblegh: netMebleg,
                    valyuta: "AZN",
                    mezenne: 1,
                    azn_meblegh: netMebleg,
                    komissiya: komissiyaMebleg,
                    hesab_id: data.hesab_id,
                    satis_id: sale.id,
                    sened_nomresi: data.sifaris_nomresi,
                    qarsi_teref_ad: platformLabel,
                    qeyd: `${platformLabel} #${data.sifaris_nomresi} — net ${netMebleg.toFixed(2)} (komissiya ${komissiyaMebleg.toFixed(2)})`,
                    yaradan_id: istifadeciId,
                  },
                });
              }
            } catch (err) {
              console.error("[createMarketSatis] finance_operations skipped:", err);
            }
          }

          return { id: sale.id, nomre, sonMebleg, netMebleg };
        },
        { timeout: 20_000 },
      );

      revalidatePath("/ticaret/emeliyyat");
      revalidatePath("/ticaret/market-satis");
      revalidatePath("/ticaret/satislar");

      // Market satışı (Wolt/Bolt/və s. manual) — kanal-larına sync
      try {
        const { emitStockChange } = await import("@/lib/stock-change-emitter");
        emitStockChange(data.lines.map((l) => l.mehsul_id));
      } catch (e) {
        console.error("[createMarketSatis.emitStockChange]", e);
      }

      return {
        ok: true as const,
        satis_id: result.id,
        nomre: result.nomre,
        son_mebleg: result.sonMebleg,
        net_meblegh: result.netMebleg,
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Bilinməyən xəta";
      console.error("[createMarketSatis]", e);
      return { ok: false as const, error: msg };
    }
  });
}
