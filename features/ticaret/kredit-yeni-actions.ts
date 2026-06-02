"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma, prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { parseLocalDate } from "@/lib/utils";
import { nextDocNumber } from "@/lib/db/sened-nomre";
import { audit } from "@/lib/audit/log";

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
  const parsed = CreateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Forma yanlışdır" };
  }
  const d = parsed.data;

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

        const year = new Date().getFullYear();
        const last = await tx.satis_sifarisleri.findFirst({
          where: { nomre: { startsWith: `${PREFIX}-${year}-` } },
          orderBy: { nomre: "desc" },
          select: { nomre: true },
        });
        const lastNum = last ? Number(last.nomre.split("-").pop()) || 0 : 0;
        const nomre = `${PREFIX}-${year}-${String(lastNum + 1).padStart(5, "0")}`;

        // satis_sifarisleri — `qaralama=true` ilə yaradılır,
        // bu qeyd ödəniş gəlinənə qədər real satış kimi sayılmasın.
        const sale = await tx.satis_sifarisleri.create({
          data: {
            sahibkar_id: sahibkarId,
            nomre,
            musteri_id: d.musteri_id,
            anbar_id: d.anbar_id,
            tarix: parseSaleDate(d.tarix),
            status: "yeni",
            odenis_nov: "kredit_qeyd",
            umumi_mebleg: umumi,
            endirim_mebleg: 0,
            son_mebleg: umumi,
            odenilmis: 0,
            qeyd: [
              `[KREDIT_QEYD]`,
              `bank=${d.bank}`,
              `müqavilə=${d.muqavile_nomresi ?? "—"}`,
              `müddət=${d.muddet_ay}ay`,
              `aylıq faiz=${d.aylik_faiz}%`,
              `bank komissiyası=${d.bank_komissiya_faiz}%`,
              d.qeyd ? `qeyd: ${d.qeyd}` : "",
            ].filter(Boolean).join(" "),
            yaradan_id: istifadeciId,
            satis_meneceri_id: istifadeciId,
            qaralama: true, // qeyd statusunda saxla, bank ödədikdə aktivləşdir
          },
        });

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
          // Qeyd statusunda stok düşürülmür — bank ödəyəndə düşür.
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

        return { id: sale.id, nomre, magazaNet, umumi, aylik };
      });

      revalidatePath("/ticaret/kredit");
      revalidatePath("/ticaret/kredit-yeni");
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
      console.error("[createKreditSatis]", e);
      return { ok: false, error: e instanceof Error ? e.message : "Xəta" };
    }
  });
}
