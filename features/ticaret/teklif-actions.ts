"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma, prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { audit } from "@/lib/audit/log";
import { nextDocNumber } from "@/lib/db/sened-nomre";
import { parseLocalDate } from "@/lib/utils/date-parse";
import { requireTicaretActionPerm, bustTicaretCache } from "./access-guard";

type ActionResult<T = void> = { ok: true; data?: T } | { ok: false; error: string };

const ALLOWED_TEKLIF_STATUSES = [
  "qaralama",
  "gonderildi",
  "qebul",
  "redd",
  "satisa_cevrildi",
  "legv",
  "muddet_kecdi",
  "vaxti_bitdi",
] as const;

type TeklifStatus = (typeof ALLOWED_TEKLIF_STATUSES)[number];

const TEKLIF_TRANSITIONS: Record<TeklifStatus, readonly TeklifStatus[]> = {
  qaralama:        ["gonderildi", "legv"],
  gonderildi:      ["qebul", "redd", "muddet_kecdi", "vaxti_bitdi", "legv"],
  qebul:           ["satisa_cevrildi", "legv"],
  redd:            [],
  satisa_cevrildi: [],
  legv:            [],
  muddet_kecdi:    ["gonderildi", "legv"],
  vaxti_bitdi:     ["gonderildi", "legv"],
};

function canTransitionTeklif(from: string, to: string): boolean {
  if (!ALLOWED_TEKLIF_STATUSES.includes(from as TeklifStatus)) return false;
  if (!ALLOWED_TEKLIF_STATUSES.includes(to as TeklifStatus)) return false;
  if (from === to) return true;
  return TEKLIF_TRANSITIONS[from as TeklifStatus].includes(to as TeklifStatus);
}

/* ============================================================================
 * createTeklif — Yeni təklif yaradılması.
 *
 * Müqayisə üçün: satışdan fərqli olaraq:
 *   - stoku düşürmür
 *   - kassaya pul düşmür
 *   - müştəri borcu yaranmır
 * Sadəcə müştəriyə təklif sənədi yaradır.
 * ========================================================================== */
const TeklifLineSchema = z.object({
  mehsul_id: z.string().uuid(),
  ad: z.string().max(255),
  kod: z.string().max(100).nullish(),
  sayi: z.coerce.number().positive(),
  qiymet: z.coerce.number().min(0),
  endirim_faiz: z.coerce.number().min(0).max(100).default(0),
});

const CreateTeklifSchema = z.object({
  musteri_id: z.string().uuid().nullish(),
  musteri_ad: z.string().max(200).nullish(),
  musteri_telefon: z.string().max(30).nullish(),
  menecer_id: z.string().uuid().nullish(),
  tarix: z.string().optional(),
  bitme_tarixi: z.string().optional(),
  satish_tipi: z.enum(["perakende", "topdan", "vip", "partner"]).default("perakende"),
  endirim_meblegh: z.coerce.number().min(0).default(0),
  qeyd: z.string().max(2000).nullish(),
  shertler: z.string().max(2000).nullish(),
  status: z.enum(["qaralama", "gonderildi"]).default("qaralama"),
  lines: z.array(TeklifLineSchema).min(1, "Ən az 1 məhsul lazımdır"),
});

export type CreateTeklifInput = z.input<typeof CreateTeklifSchema>;
export type CreateTeklifResult =
  | { ok: true; teklif_id: string; nomre: string; son_meblegh: number }
  | { ok: false; error: string };

export async function createTeklif(input: CreateTeklifInput): Promise<CreateTeklifResult> {
  const permCheck = await requireTicaretActionPerm(["teklif.yarat", "teklif.idare"]);
  if (!permCheck.ok) return { ok: false, error: permCheck.error };

  const parsed = CreateTeklifSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Forma yanlışdır" };
  }
  const d = parsed.data;

  // Müştəri identifikasiyası: musteri_id və ya musteri_ad olmalıdır
  if (!d.musteri_id && (!d.musteri_ad || d.musteri_ad.trim().length < 2)) {
    return { ok: false, error: "Müştəri seçin və ya adını yazın" };
  }

  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    try {
      const result = await prisma.$transaction(async (tx) => {
        // Sənəd nömrəsi
        const nomre = await nextDocNumber(tx, sahibkarId, "teklif");

        // Cəmi hesabla
        let umumi = 0;
        for (const line of d.lines) {
          umumi += line.sayi * line.qiymet * (1 - line.endirim_faiz / 100);
        }
        const son = Math.max(0, umumi - d.endirim_meblegh);

        // Default bitme_tarixi: 7 gün
        const tarix = d.tarix ? parseLocalDate(d.tarix) : new Date();
        const bitme = d.bitme_tarixi
          ? parseLocalDate(d.bitme_tarixi)
          : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

        // Müştəri adını mövcud kontragentdən gətirmək
        let musteriAd = d.musteri_ad ?? null;
        let musteriTel = d.musteri_telefon ?? null;
        if (d.musteri_id) {
          const k = await tx.kontragentler.findFirst({
            where: { id: d.musteri_id, sahibkar_id: sahibkarId },
            select: { ad: true, telefon: true },
          });
          if (!k) throw new Error("Müştəri tapılmadı");
          musteriAd = musteriAd ?? k.ad;
          musteriTel = musteriTel ?? k.telefon;
        }

        const created = await tx.teklifler.create({
          data: {
            sahibkar_id: sahibkarId,
            nomre,
            musteri_id: d.musteri_id ?? null,
            musteri_ad: musteriAd,
            musteri_telefon: musteriTel,
            menecer_id: d.menecer_id ?? istifadeciId,
            tarix,
            bitme_tarixi: bitme,
            satish_tipi: d.satish_tipi,
            umumi_meblegh: new Prisma.Decimal(umumi.toFixed(2)),
            endirim_meblegh: new Prisma.Decimal(d.endirim_meblegh.toFixed(2)),
            son_meblegh: new Prisma.Decimal(son.toFixed(2)),
            status: d.status,
            qeyd: d.qeyd ?? null,
            shertler: d.shertler ?? null,
            yaradan_id: istifadeciId,
          },
          select: { id: true, nomre: true },
        });

        // Sətirlər
        for (const line of d.lines) {
          const satir = line.sayi * line.qiymet * (1 - line.endirim_faiz / 100);
          await tx.teklif_satirlari.create({
            data: {
              teklif_id: created.id,
              mehsul_id: line.mehsul_id,
              mehsul_ad: line.ad,
              barkod: line.kod ?? null,
              sayi: new Prisma.Decimal(line.sayi.toFixed(3)),
              qiymet: new Prisma.Decimal(line.qiymet.toFixed(2)),
              endirim_faiz: new Prisma.Decimal(line.endirim_faiz.toFixed(2)),
              satir_meblegh: new Prisma.Decimal(satir.toFixed(2)),
            },
          });
        }

        return { id: created.id, nomre: created.nomre, son };
      });

      revalidatePath("/ticaret/teklif");
      revalidatePath("/ticaret");
      bustTicaretCache();

      try {
        await audit("yarat", "teklif", result.id, {
          yeni_data: {
            nomre: result.nomre,
            son_meblegh: result.son,
            line_count: d.lines.length,
            status: d.status,
          },
          sebeb: `Yeni təklif: ${result.nomre}`,
        });
      } catch { /* non-fatal */ }

      return { ok: true, teklif_id: result.id, nomre: result.nomre, son_meblegh: result.son };
    } catch (e) {
      console.error("[createTeklif]", e);
      return { ok: false, error: e instanceof Error ? e.message : "Təklif yaradılmadı" };
    }
  });
}

/**
 * Update a teklif's status (e.g. gonderildi, qebul, redd, legv).
 */
export async function updateTeklifStatus(teklifId: string, status: string): Promise<ActionResult> {
  const permCheck = await requireTicaretActionPerm(["teklif.idare", "teklif.status"]);
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  if (!ALLOWED_TEKLIF_STATUSES.includes(status as (typeof ALLOWED_TEKLIF_STATUSES)[number])) {
    return { ok: false, error: "Status yanlışdır" };
  }
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    try {
      // 🔒 Açıq sahibkar_id filtri — cross-tenant qoruması
      const prev = await prisma.teklifler.findFirst({
        where: { id: teklifId, sahibkar_id: sahibkarId },
        select: { status: true },
      });
      if (!prev) return { ok: false, error: "Təklif tapılmadı" };

      if (!canTransitionTeklif(prev.status ?? "qaralama", status)) {
        return {
          ok: false,
          error: `Statusu «${prev.status}» → «${status}» kimi dəyişmək olmaz`,
        };
      }

      await prisma.teklifler.updateMany({
        where: { id: teklifId, sahibkar_id: sahibkarId },
        data: { status, yenilendi: new Date() },
      });
      revalidatePath("/ticaret/teklif");
      revalidatePath("/ticaret");
      bustTicaretCache();
      try {
        await audit("yenile", "teklif", teklifId, {
          evvelki_data: { status: prev.status },
          yeni_data: { status },
          sebeb: `Təklif statusu dəyişdi: ${prev.status} → ${status}`,
        });
      } catch { /* non-fatal */ }
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Xəta baş verdi" };
    }
  });
}

/**
 * Convert a teklif into a real satis_sifarisleri. Creates a new sale plus
 * lines mirroring the quote, then links teklif.satish_id back. Stock is
 * not deducted here (sale starts as 'yeni' status) - that happens in POS or
 * via a separate flow.
 */
export async function convertTeklifToSale(teklifId: string): Promise<ActionResult<{ id: string }>> {
  const permCheck = await requireTicaretActionPerm(["teklif.idare", "satis.yarat"]);
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    try {
      const result = await prisma.$transaction(async (tx) => {
        const t = await tx.teklifler.findFirst({
          where: { id: teklifId, sahibkar_id: sahibkarId },
          include: { teklif_satirlari: true },
        });
        if (!t) throw new Error("Təklif tapılmadı");
        if (t.satish_id) throw new Error("Bu təklif artıq satışa çevrilib");
        if (t.status === "redd" || t.status === "legv") {
          throw new Error("Rədd edilmiş və ya ləğv olunmuş təklifi satışa çevirmək olmaz");
        }

        // Atomic sənəd nömrəsi — race-safe
        const nomre = await nextDocNumber(tx, sahibkarId, "satis");

        const firstAnbar = await tx.anbarlar.findFirst({
          where: { sahibkar_id: sahibkarId },
          select: { id: true },
          orderBy: { id: "asc" },
        });

        const sale = await tx.satis_sifarisleri.create({
          data: {
            sahibkar_id: sahibkarId,
            nomre,
            musteri_id: t.musteri_id,
            anbar_id: firstAnbar?.id ?? null,
            tarix: new Date(),
            status: "yeni",
            // ⚠️ Pul-itkisi fix: stok burada düşür, amma ödəniş alınmır (odenilmis=0).
            // "negd" olsaydı recalculateCustomerBalance bunu borca saymaz (yalnız
            // nisye/borc sayır) → dəyər tamamilə itərdi. "nisye" ilə son_mebleg
            // müştəri borcuna (alacaq) düşür; ödəniş gələndə recordSalePayment düzəldir.
            // (createOrUpdateSatisYeni-dəki "ödənilməyən → nisye" məntiqi ilə eyni.)
            odenis_nov: "nisye",
            umumi_mebleg: t.umumi_meblegh ?? 0,
            endirim_mebleg: t.endirim_meblegh ?? 0,
            son_mebleg: t.son_meblegh ?? 0,
            odenilmis: 0,
            qeyd: t.qeyd ?? `Təklif #${t.nomre} əsasında`,
            yaradan_id: istifadeciId,
            satis_meneceri_id: t.menecer_id,
            filial_id: t.filial_id,
            qaralama: false,
          },
        });

        // 🚨 KRİTİK: Stok düşürülür və anbar_hereketleri yazılır.
        // Köhnə kod stok dəyişdirmirdi — bu real anbarda data-pozulması idi.
        const { safeStockDecrement } = await import("@/lib/db/stock-guards");
        for (const line of t.teklif_satirlari) {
          if (!line.mehsul_id) continue;
          await tx.satis_sifaris_satirlari.create({
            data: {
              sahibkar_id: sahibkarId,
              sifaris_id: sale.id,
              mehsul_id: line.mehsul_id,
              miqdar: line.sayi,
              vahid_qiymet: line.qiymet,
              endirim_faiz: line.endirim_faiz ?? 0,
            },
          });
          // Anbar varsa stoku düş
          if (firstAnbar?.id) {
            const dec = await safeStockDecrement(tx, {
              mehsulId: line.mehsul_id,
              anbarId: firstAnbar.id,
              miqdar: Number(line.sayi),
            });
            if (!dec.ok) throw new Error(`${line.mehsul_id}: ${dec.error}`);
            await tx.anbar_hereketleri.create({
              data: {
                sahibkar_id: sahibkarId,
                anbar_id: firstAnbar.id,
                mehsul_id: line.mehsul_id,
                nov: "mexaric",
                miqdar: Number(line.sayi),
                qiymet: Number(line.qiymet ?? 0),
                ref_nov: "satis_sifarisi",
                ref_id: sale.id,
                edilen_id: istifadeciId,
                qeyd: `Təklif #${t.nomre}-dən satış çevrimi`,
              },
            });
          }
        }

        await tx.teklifler.update({
          where: { id: t.id },
          data: { satish_id: sale.id, status: "satisa_cevrildi", yenilendi: new Date() },
        });

        // Müştəri balansı recalc — satış nisyə kimi yaradıldığı üçün son_mebleg
        // müştərinin alacağına (borcuna) düşür. Ödəniş gələndə recordSalePayment düzəldir.
        if (t.musteri_id) {
          const { recalculateCustomerBalance } = await import("@/lib/balance/customer-balance");
          await recalculateCustomerBalance(t.musteri_id, tx);
        }

        return { id: sale.id, nomre, teklif_nomre: t.nomre };
      });

      revalidatePath("/ticaret/teklif");
      revalidatePath("/ticaret/satislar");
      revalidatePath("/ticaret");
      bustTicaretCache();
      try {
        await audit("yarat", "satis_sifarisi", result.id, {
          yeni_data: { nomre: result.nomre, teklif_id: teklifId, teklif_nomre: result.teklif_nomre },
          sebeb: `Təklif satışa çevrildi: ${result.teklif_nomre} → ${result.nomre}`,
        });
      } catch { /* non-fatal */ }
      return { ok: true, data: { id: result.id } };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Xəta baş verdi" };
    }
  });
}

/**
 * Delete a teklif (only if not converted).
 */
export async function deleteTeklif(teklifId: string): Promise<ActionResult> {
  const permCheck = await requireTicaretActionPerm(["teklif.sil", "teklif.idare"]);
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    try {
      // 🔒 Açıq sahibkar_id filtri
      const t = await prisma.teklifler.findFirst({
        where: { id: teklifId, sahibkar_id: sahibkarId },
        select: { satish_id: true, nomre: true },
      });
      if (!t) return { ok: false, error: "Təklif tapılmadı" };
      if (t.satish_id) return { ok: false, error: "Satışa çevrilmiş təklifi silmək olmaz" };

      await prisma.teklifler.deleteMany({ where: { id: teklifId, sahibkar_id: sahibkarId } });
      revalidatePath("/ticaret/teklif");
      bustTicaretCache();
      try {
        await audit("sil", "teklif", teklifId, {
          evvelki_data: { nomre: t.nomre },
          sebeb: `Təklif silindi: ${t.nomre}`,
        });
      } catch { /* non-fatal */ }
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Xəta baş verdi" };
    }
  });
}
