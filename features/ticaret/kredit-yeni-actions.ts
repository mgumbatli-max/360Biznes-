"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma, prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { parseLocalDate } from "@/lib/utils";
import { nextDocNumber } from "@/lib/db/sened-nomre";
import { audit } from "@/lib/audit/log";
import { safeStockDecrement } from "@/lib/db/stock-guards";
import { requireTicaretActionPerm, bustTicaretCache } from "./access-guard";

function parseSaleDate(s: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return parseLocalDate(s) ?? new Date();
  return new Date(s);
}

const LineSchema = z.object({
  mehsul_id: z.string().uuid(),
  miqdar: z.coerce.number().positive(),
  qiymet: z.coerce.number().min(0),
  endirim_faiz: z.coerce.number().min(0).max(100).default(0),
});

const CreateSchema = z.object({
  musteri_id: z.string().uuid(),
  anbar_id: z.coerce.number().int().positive(),
  tarix: z.string().min(1),

  // Bank/kredit təşkilatı qeydləri
  bank: z.string().min(1).max(100),
  muqavile_nomresi: z.string().max(60).nullish(),
  muddet_ay: z.coerce.number().int().min(1).max(120),
  aylik_faiz: z.coerce.number().min(0).max(100).default(0),

  // Mağaza tərəfi
  bank_komissiya_faiz: z.coerce.number().min(0).max(100).default(0),
  catma_tarix: z.string().nullish().or(z.literal("")),

  qeyd: z.string().max(500).nullish(),
  lines: z.array(LineSchema).min(1),
});

export type CreateKreditQeydInput = z.input<typeof CreateSchema>;
export type CreateKreditQeydResult =
  | { ok: true; satis_id: string; nomre: string; magaza_net: number; umumi: number; aylik_odenis: number }
  | { ok: false; error: string };

const PREFIX = "KRD";

/**
 * Yeni kredit qeydi yarat (yalnız QEYD — heç bir satış stoku düşürülmür,
 * heç bir maliyyə əməliyyatı avtomatik yaranmır).
 *
 * Bank ödədikdə → /maliyye/emeliyyat/yeni?tip=qaime ilə "Kredit gəlişi"
 * əməliyyatı əlavə olunur, sonra recordKreditPayment ilə bu qeydə bağlanır.
 */
export async function createKreditSatis(
  input: CreateKreditQeydInput,
): Promise<CreateKreditQeydResult> {
  const permCheck = await requireTicaretActionPerm(["kredit.yarat", "kredit.idare", "satis.yarat"]);
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  const parsed = CreateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Forma yanlışdır" };
  }
  const d = parsed.data;

  // 📅 Real-time tarix məcburiyyəti
  const { validateOperationDate } = await import("@/lib/operation-date-guard");
  const dateCheck = await validateOperationDate(d.tarix, { fieldLabel: "Kredit tarixi" });
  if (!dateCheck.ok) return { ok: false, error: dateCheck.error };

  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    try {
      const result = await prisma.$transaction(async (tx) => {
        // Totals
        let umumi = 0;
        for (const line of d.lines) {
          umumi += line.miqdar * line.qiymet * (1 - line.endirim_faiz / 100);
        }
        // Mağazanın net çatacaq məbləği = ümumi − bank komissiyası
        const bankKomissiyaMeb = umumi * (d.bank_komissiya_faiz / 100);
        const magazaNet = umumi - bankKomissiyaMeb;
        // Müştəri tərəfi: aylıq sadə faiz ilə
        const musteriCemi = umumi * (1 + (d.aylik_faiz / 100) * d.muddet_ay);
        const aylik = d.muddet_ay > 0 ? musteriCemi / d.muddet_ay : 0;

        // Atomic, race-safe sənəd nömrəsi
        const nomre = await nextDocNumber(tx, sahibkarId, "kredit");

        // satis_sifarisleri — real satış kimi yaranır, çünki müştəri məhsulu fiziki olaraq götürür.
        // Müştəri borcu yaranmır (kredit şirkəti vasitəsilədir, müştəri bizə yox banka borcludur).
        // Status="yeni" — pul bankdan yatınca tamamlandı olur.
        // DB constraint `satis_odenis_nov_dogru` artıq "kredit"-i dəstəkləyir.
        // Mağaza neti = umumi − bank komissiyası. Bu məbləğ kassaya/banka düşür.
        // Müştəri borclu görünmür (kredit təşkilatı bizim qarşı tərəfimizdir).
        const sale = await tx.satis_sifarisleri.create({
          data: {
            sahibkar_id: sahibkarId,
            nomre,
            musteri_id: d.musteri_id,
            anbar_id: d.anbar_id,
            tarix: parseSaleDate(d.tarix),
            status: "yeni",
            odenis_nov: "kredit",
            umumi_mebleg: umumi,
            endirim_mebleg: 0,
            son_mebleg: umumi,
            // Mağaza neti pul kreditdən gəldikdə "tamamlandı"-ya keçər;
            // hələ qeyd statusunda odenilmis = 0.
            odenilmis: 0,
            qeyd: [
              `[KREDIT_QEYD]`,
              `bank=${d.bank}`,
              `müqavilə=${d.muqavile_nomresi ?? "—"}`,
              `müddət=${d.muddet_ay}ay`,
              `aylıq faiz=${d.aylik_faiz}%`,
              `bank komissiyası=${d.bank_komissiya_faiz}%`,
              `[MAGAZA_NET:${magazaNet.toFixed(2)}]`,
              d.qeyd ? `qeyd: ${d.qeyd}` : "",
            ].filter(Boolean).join(" "),
            yaradan_id: istifadeciId,
            satis_meneceri_id: istifadeciId,
            qaralama: false, // real satışdır — müştəri məhsulu götürür
          },
        });

        // Sətirlər + atomic stok düşürmə (müştəri məhsulu fiziki götürür)
        for (const line of d.lines) {
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

          // Race-safe stok düşürmə
          const dec = await safeStockDecrement(tx, {
            mehsulId: line.mehsul_id,
            anbarId: d.anbar_id,
            miqdar: line.miqdar,
          });
          if (!dec.ok) throw new Error(dec.error);

          // Anbar hərəkəti — audit izi üçün
          await tx.anbar_hereketleri.create({
            data: {
              sahibkar_id: sahibkarId,
              anbar_id: d.anbar_id,
              mehsul_id: line.mehsul_id,
              nov: "mexaric",
              miqdar: line.miqdar,
              qiymet: line.qiymet,
              ref_nov: "satis_sifarisi",
              ref_id: sale.id,
              edilen_id: istifadeciId,
              qeyd: `Kreditlə satış: ${nomre} (bank: ${d.bank})`,
            },
          });
        }

        // kredit_satislari — yalnız qeyd kimi yarat (status="qeyd")
        await tx.kredit_satislari.create({
          data: {
            sahibkar_id: sahibkarId,
            satis_id: sale.id,
            bank: d.bank,
            muddet_ay: d.muddet_ay,
            faiz_illik: new Prisma.Decimal((d.aylik_faiz * 12).toFixed(3)),
            magaza_net: new Prisma.Decimal(magazaNet.toFixed(2)),
            musteri_cemi: new Prisma.Decimal(musteriCemi.toFixed(2)),
            aylik_odenis: new Prisma.Decimal(aylik.toFixed(2)),
            faiz_cemi: new Prisma.Decimal((musteriCemi - umumi).toFixed(2)),
            bank_komissiya: new Prisma.Decimal(bankKomissiyaMeb.toFixed(2)),
            ilk_odenis: new Prisma.Decimal("0"),
            baslama_tarixi: parseSaleDate(d.tarix),
            bitme_tarixi: d.catma_tarix
              ? parseSaleDate(d.catma_tarix)
              : new Date(parseSaleDate(d.tarix).getTime() + d.muddet_ay * 30 * 24 * 60 * 60 * 1000),
            status: "qeyd", // bank pulu gəlməyincə "qeyd" statusunda qalır
            qeyd: [
              `Müqavilə № ${d.muqavile_nomresi ?? "—"}`,
              d.catma_tarix ? `Çatma: ${d.catma_tarix}` : "",
              d.qeyd ?? "",
            ].filter(Boolean).join(" | "),
            yaradan_id: istifadeciId,
            pul_alindi: false,
          },
        });

        // Müştəri balansı recalc — kredit satış müştəri borcu YARATMIR
        // (source-of-truth `odenis_nov IN ('nisye','borc')` filter-i kredit-i istisna edir),
        // amma cache field-in drift olmaması üçün defensive çağırış.
        if (d.musteri_id) {
          const { recalculateCustomerBalance } = await import("@/lib/balance/customer-balance");
          await recalculateCustomerBalance(d.musteri_id, tx);
        }

        return { id: sale.id, nomre, magazaNet, umumi, aylik };
      });

      revalidatePath("/ticaret/kredit");
      revalidatePath("/ticaret/kredit-yeni");
      bustTicaretCache();
      await audit("yarat", "kredit_satis", result.id, {
        yeni_data: {
          nomre: result.nomre,
          musteri_id: parsed.data.musteri_id,
          anbar_id: parsed.data.anbar_id,
          bank: parsed.data.bank,
          muqavile_nomresi: parsed.data.muqavile_nomresi ?? null,
          muddet_ay: parsed.data.muddet_ay,
          umumi: result.umumi,
          magaza_net: result.magazaNet,
          aylik_odenis: result.aylik,
          line_count: parsed.data.lines.length,
        },
        sebeb: `Yeni kredit qeydi (${parsed.data.bank})`,
      });
      return {
        ok: true,
        satis_id: result.id,
        nomre: result.nomre,
        magaza_net: result.magazaNet,
        umumi: result.umumi,
        aylik_odenis: result.aylik,
      };
    } catch (e) {
      const { logAndFriendly } = await import("@/lib/error/user-message");
      return { ok: false, error: logAndFriendly("createKreditSatis", e, "Kreditlə satış yaradılmadı") };
    }
  });
}
