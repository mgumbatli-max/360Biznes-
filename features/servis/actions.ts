"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { parseLocalDate } from "@/lib/utils/date-parse";
import { safeAuditLog } from "@/lib/audit/safe-log";

/* ---------- Audit helper — outbox-safe via safeAuditLog ---------- */

async function writeServisAudit(
  emeliyyat: string,
  resurs_id: string,
  data: Record<string, unknown> | null,
): Promise<void> {
  const { sahibkarId, istifadeciId } = requireTenant();
  await safeAuditLog({
    sahibkar_id: sahibkarId,
    istifadeci_id: istifadeciId,
    emeliyyat,
    resurs_nov: "servis",
    resurs_id,
    yeni_data: (data ?? undefined) as Record<string, unknown> | undefined as never,
    status: "ugur",
  });
}

const STATUSES = [
  "qebul_edildi",
  "diaqnostikada",
  "teklif_gozleyir",
  "usta_baxir",
  "ehtiyat_hisse",
  "temir_olunur",
  "temir_edildi",
  "musteriye_tehvil",
  "qaytarildi",
  "redd_edildi",
] as const;

type Status = (typeof STATUSES)[number];
type ActionResult<T = undefined> = { ok: true; id?: string; data?: T } | { ok: false; error: string };

const SERVIS_PREFIX = "SR";

/* ---------- Helpers ---------- */

async function nextNomre(): Promise<string> {
  const year = new Date().getFullYear();
  const last = await prisma.servis_qeydleri.findFirst({
    where: { nomre: { startsWith: `${SERVIS_PREFIX}-${year}-` } },
    orderBy: { nomre: "desc" },
    select: { nomre: true },
  });
  const lastNum = last ? Number(last.nomre.split("-").pop()) || 0 : 0;
  return `${SERVIS_PREFIX}-${year}-${String(lastNum + 1).padStart(5, "0")}`;
}

function setPriorityTag(existing: string | null | undefined, prio: string | undefined): string {
  const clean = (existing ?? "").replace(/\bprioritet:(asagi|orta|yuksek|tecili)\b/gi, "").trim();
  if (!prio) return clean;
  return `${clean ? `${clean} ` : ""}prioritet:${prio}`.trim();
}

/* ---------- Create ---------- */

const ServisSchema = z.object({
  musteri_id: z.string().uuid().optional().or(z.literal("")),
  musteri_ad: z.string().min(2).max(200),
  musteri_telefon: z.string().min(5).max(30),
  mehsul_id: z.string().uuid().optional().or(z.literal("")),
  mehsul_ad: z.string().min(2).max(255),
  mehsul_seri_nomresi: z.string().max(120).optional().or(z.literal("")),
  satis_tarixi: z.string().optional().or(z.literal("")),
  problem_tesviri: z.string().min(5),
  daxili_qeyd: z.string().optional().or(z.literal("")),
  zemanet_var: z.coerce.boolean().default(false),
  prioritet: z.enum(["asagi", "orta", "yuksek", "tecili"]).optional(),
  texmini_tehvil: z.string().optional().or(z.literal("")),
  servis_iscisi_id: z.string().uuid().optional().or(z.literal("")),
  filial_id: z.coerce.number().int().optional().or(z.literal("")),
  defekt_kateq_id: z.coerce.number().int().optional().or(z.literal("")),
  komplektasiya: z.string().optional().or(z.literal("")),
  // İlkin məbləğlər — qəbul edən kassir hələ qəbz aldıqda doldurur.
  musteriden_alinan: z.coerce.number().min(0).default(0),
  temir_xerci: z.coerce.number().min(0).default(0),
  xidmet_hesab_id: z.string().uuid().optional().or(z.literal("")),
});

export async function createServisRequest(input: FormData): Promise<ActionResult> {
  const parsed = ServisSchema.safeParse(Object.fromEntries(input.entries()));
  if (!parsed.success) return { ok: false, error: "Forma yanlışdır" };
  const d = parsed.data;

  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    try {
      const nomre = await nextNomre();
      // Free-form daxili note + inline priority tag (legacy convention)
      const noteSeed = d.daxili_qeyd?.trim() || null;
      const daxili = setPriorityTag(noteSeed, d.prioritet);
      const created = await prisma.servis_qeydleri.create({
        data: {
          sahibkar_id: sahibkarId,
          nomre,
          musteri_id: d.musteri_id ? d.musteri_id : null,
          musteri_ad: d.musteri_ad.trim(),
          musteri_telefon: d.musteri_telefon.trim(),
          mehsul_id: d.mehsul_id ? d.mehsul_id : null,
          mehsul_ad: d.mehsul_ad.trim(),
          mehsul_seri_nomresi: d.mehsul_seri_nomresi?.trim() || null,
          satis_tarixi: d.satis_tarixi ? parseLocalDate(d.satis_tarixi) : null,
          problem_tesviri: d.problem_tesviri.trim(),
          zemanet_var: d.zemanet_var,
          qebul_eden_id: istifadeciId,
          servis_iscisi_id: d.servis_iscisi_id || null,
          filial_id: typeof d.filial_id === "number" ? d.filial_id : null,
          defekt_kateq_id: typeof d.defekt_kateq_id === "number" ? d.defekt_kateq_id : null,
          texmini_tehvil: d.texmini_tehvil ? parseLocalDate(d.texmini_tehvil) : null,
          komplektasiya: d.komplektasiya || null,
          status: "qebul_edildi",
          daxili_qeyd: daxili || null,
          temir_xerci: d.temir_xerci || 0,
          musteriden_alinan: 0, // ödəniş ayrı recordPayment ilə yazılır
          xidmet_hesab_id: d.xidmet_hesab_id || null,
        },
      });
      // Initial timeline entry
      await prisma.servis_status_tarixce.create({
        data: {
          servis_id: created.id,
          evvelki_status: null,
          yeni_status: "qebul_edildi",
          deyisen_id: istifadeciId,
          qeyd: "Servis qəbul edildi",
        },
      });

      // Qəbz zamanı müştəri məbləğ verirsə — avtomatik ödəniş əməliyyatı
      if (d.musteriden_alinan > 0 && d.xidmet_hesab_id) {
        try {
          const fd = new FormData();
          fd.set("id", created.id);
          fd.set("meblegh", String(d.musteriden_alinan));
          fd.set("odenis_nov", "negd");
          fd.set("hesab_id", d.xidmet_hesab_id);
          fd.set("kassaya_elave_et", "true");
          fd.set("satis_kimi_qeyd_et", "true");
          fd.set("qeyd", `İlkin ödəniş: ${d.mehsul_ad}`);
          await recordPayment(fd);
        } catch (err) {
          console.error("[createServisRequest] auto-payment failed:", err);
        }
      }

      // Müştəri son_temas yenilə
      if (d.musteri_id) {
        try {
          await prisma.kontragentler.update({
            where: { id: d.musteri_id },
            data: { son_temas: new Date() },
          });
        } catch (err) {
          console.warn("[createServisRequest] son_temas update failed:", err);
        }
      }

      // Audit
      await writeServisAudit("YARAT", created.id, {
        nomre: created.nomre,
        musteri_ad: d.musteri_ad,
        mehsul_ad: d.mehsul_ad,
        status: "qebul_edildi",
      });

      revalidatePath("/servis");
      return { ok: true, id: created.id };
    } catch (e) {
      console.error("[createServisRequest]", e);
      return { ok: false, error: e instanceof Error ? e.message : "Xəta" };
    }
  });
}

/* ---------- Status change ---------- */

export async function changeServisStatus(
  id: string,
  status: Status,
  qeyd?: string,
  options?: { extendWarranty?: boolean },
): Promise<ActionResult> {
  if (!(STATUSES as readonly string[]).includes(status)) return { ok: false, error: "Yanlış status" };
  // Rədd statusunda mütləq səbəb tələb olunur (audit + müştəri tarixçəsi üçün)
  if (status === "redd_edildi" && (!qeyd || qeyd.trim().length < 3)) {
    return { ok: false, error: "Rədd səbəbi tələb olunur" };
  }
  return withTenant(async () => {
    const { istifadeciId } = requireTenant();
    try {
      const prev = await prisma.servis_qeydleri.findUnique({
        where: { id },
        select: { status: true, daxili_qeyd: true, mehsul_id: true, musteri_id: true },
      });
      if (!prev) return { ok: false, error: "Sifariş tapılmadı" };

      const data: Record<string, unknown> = { status, yenilendi: new Date() };
      if (status === "musteriye_tehvil") {
        data.qapanma_tarixi = new Date();
        data.qapayan_id = istifadeciId;
      }
      if (status === "redd_edildi" && qeyd) {
        // Səbəbi daxili qeydə append et — audit izi üçün
        const ts = new Date().toLocaleString("az-AZ");
        const appendLine = `[${ts}] [Rədd] ${qeyd}`;
        const merged = [prev.daxili_qeyd, appendLine].filter(Boolean).join("\n");
        data.daxili_qeyd = merged;
        data.qapanma_tarixi = new Date();
        data.qapayan_id = istifadeciId;
      }
      await prisma.servis_qeydleri.update({ where: { id }, data });
      await prisma.servis_status_tarixce.create({
        data: {
          servis_id: id,
          evvelki_status: prev.status,
          yeni_status: status,
          deyisen_id: istifadeciId,
          qeyd: qeyd ?? null,
        },
      });

      // Zəmanət uzadılması — yalnız "musteriye_tehvil" və options.extendWarranty
      if (status === "musteriye_tehvil" && options?.extendWarranty && prev.mehsul_id) {
        try {
          const active = await prisma.zemanetler.findFirst({
            where: { mehsul_id: prev.mehsul_id, status: "aktiv", bitme_tarixi: { gte: new Date() } },
            orderBy: { bitme_tarixi: "desc" },
          });
          if (active) {
            const newEnd = new Date(active.bitme_tarixi);
            newEnd.setMonth(newEnd.getMonth() + 3);
            await prisma.zemanetler.update({
              where: { id: active.id },
              data: { bitme_tarixi: newEnd, qeyd: `${active.qeyd ?? ""}\n[Servis ${id}] 3 ay uzadıldı`.trim() },
            });
            await writeServisAudit("ZEMANET_UZADILDI", id, {
              zemanet_id: active.id,
              old_end: active.bitme_tarixi,
              new_end: newEnd,
            });
          }
        } catch (err) {
          console.warn("[changeServisStatus] warranty extend failed:", err);
        }
      }

      // Müştəri son_temas yenilə
      if (prev.musteri_id) {
        try {
          await prisma.kontragentler.update({
            where: { id: prev.musteri_id },
            data: { son_temas: new Date() },
          });
        } catch {}
      }

      // Audit
      await writeServisAudit("STATUS_DEYISDI", id, {
        evvelki: prev.status,
        yeni: status,
        qeyd: qeyd ?? null,
      });

      revalidatePath("/servis");
      revalidatePath(`/servis/${id}`);
      return { ok: true };
    } catch (e) {
      console.error("[changeServisStatus]", e);
      return { ok: false, error: "Status dəyişmədi" };
    }
  });
}

/* ---------- Diagnostika / repair notes ---------- */

const DiagSchema = z.object({
  id: z.string().uuid(),
  texniki_qeyd: z.string().min(1),
});
export async function addDiagnostika(input: FormData): Promise<ActionResult> {
  const parsed = DiagSchema.safeParse(Object.fromEntries(input.entries()));
  if (!parsed.success) return { ok: false, error: "Yanlış məlumat" };
  const d = parsed.data;
  return withTenant(async () => {
    try {
      const prev = await prisma.servis_qeydleri.findUnique({ where: { id: d.id }, select: { texniki_qeyd: true } });
      const merged = [prev?.texniki_qeyd, `[${new Date().toLocaleString("az-AZ")}] ${d.texniki_qeyd}`]
        .filter(Boolean)
        .join("\n");
      await prisma.servis_qeydleri.update({
        where: { id: d.id },
        data: { texniki_qeyd: merged, yenilendi: new Date() },
      });
      revalidatePath(`/servis/${d.id}`);
      return { ok: true };
    } catch (e) {
      console.error("[addDiagnostika]", e);
      return { ok: false, error: "Qeyd əlavə olunmadı" };
    }
  });
}

const RepairNoteSchema = z.object({ id: z.string().uuid(), qeyd: z.string().min(1) });
export async function addRepairNote(input: FormData): Promise<ActionResult> {
  const parsed = RepairNoteSchema.safeParse(Object.fromEntries(input.entries()));
  if (!parsed.success) return { ok: false, error: "Yanlış məlumat" };
  const d = parsed.data;
  return withTenant(async () => {
    const { istifadeciId } = requireTenant();
    try {
      await prisma.servis_status_tarixce.create({
        data: {
          servis_id: d.id,
          evvelki_status: null,
          yeni_status: "qeyd",
          deyisen_id: istifadeciId,
          qeyd: d.qeyd,
        },
      });
      revalidatePath(`/servis/${d.id}`);
      return { ok: true };
    } catch (e) {
      console.error("[addRepairNote]", e);
      return { ok: false, error: "Qeyd əlavə olunmadı" };
    }
  });
}

/* ---------- Ehtiyat hissə (stok decrement) ---------- */

const EhtiyatSchema = z.object({
  id: z.string().uuid(),
  mehsul_id: z.string().uuid(),
  miqdar: z.coerce.number().positive(),
  qiymet: z.coerce.number().min(0).default(0),
});
export async function addEhtiyatHisse(input: FormData): Promise<ActionResult> {
  const parsed = EhtiyatSchema.safeParse(Object.fromEntries(input.entries()));
  if (!parsed.success) return { ok: false, error: "Yanlış məlumat" };
  const d = parsed.data;
  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    try {
      const product = await prisma.mehsullar.findUnique({
        where: { id: d.mehsul_id },
        select: { ad: true, kod: true },
      });
      if (!product) return { ok: false, error: "Məhsul tapılmadı" };

      // Increment repair cost on servis record
      const sifaris = await prisma.servis_qeydleri.findUnique({
        where: { id: d.id },
        select: { temir_xerci: true, texniki_qeyd: true },
      });
      const newXerc = Number(sifaris?.temir_xerci ?? 0) + d.qiymet * d.miqdar;
      const partLine = `[Ehtiyat] ${product.ad} (${product.kod ?? "—"}) × ${d.miqdar} = ${(d.qiymet * d.miqdar).toFixed(2)}`;
      const mergedNote = [sifaris?.texniki_qeyd, partLine].filter(Boolean).join("\n");
      await prisma.servis_qeydleri.update({
        where: { id: d.id },
        data: { temir_xerci: newXerc, texniki_qeyd: mergedNote, yenilendi: new Date() },
      });

      // Best-effort stok decrement via anbar_hereketleri (negative movement)
      try {
        const firstAnbar = await prisma.anbarlar.findFirst({
          where: { sahibkar_id: sahibkarId, aktiv: true },
          select: { id: true },
          orderBy: { id: "asc" },
        });
        if (firstAnbar) {
          await prisma.anbar_hereketleri.create({
            data: {
              sahibkar_id: sahibkarId,
              mehsul_id: d.mehsul_id,
              anbar_id: firstAnbar.id,
              nov: "servis_mexaric",
              miqdar: -Math.abs(d.miqdar),
              qiymet: d.qiymet,
              qeyd: `Servis ehtiyat hissə: ${d.id}`,
              ref_nov: "servis",
              ref_id: d.id,
              edilen_id: istifadeciId,
            },
          });
        }

        // Stok-altı yoxla → admin/işçilərə bildiriş
        const fullProduct = await prisma.mehsullar.findUnique({
          where: { id: d.mehsul_id },
          select: { ad: true, min_stok: true },
        });
        if (fullProduct) {
          const stokSum = await prisma.anbar_hereketleri.aggregate({
            where: { mehsul_id: d.mehsul_id, sahibkar_id: sahibkarId },
            _sum: { miqdar: true },
          });
          const cariStok = Number(stokSum._sum.miqdar ?? 0);
          const minStok = Number(fullProduct.min_stok ?? 0);
          if (minStok > 0 && cariStok <= minStok) {
            try {
              const admins = await prisma.istifadeciler.findMany({
                where: { aktiv: true },
                select: { id: true },
                take: 5,
              });
              for (const u of admins) {
                await prisma.bildirisler.create({
                  data: {
                    sahibkar_id: sahibkarId,
                    istifadeci_id: u.id,
                    basliq: `Stok-altı: ${fullProduct.ad}`,
                    metn: `Servis ehtiyat hissə istifadəsindən sonra cari stok: ${cariStok} (min: ${minStok})`,
                    nov: "warning",
                    link: `/anbar/mehsullar/${d.mehsul_id}`,
                    resurs_nov: "mehsul",
                    resurs_id: d.mehsul_id,
                  },
                });
              }
            } catch (e) {
              console.warn("[addEhtiyatHisse] stok-altı bildiriş failed:", e);
            }
          }
        }
      } catch (e) {
        console.warn("[addEhtiyatHisse] stok hərəkəti yazılmadı:", e);
      }

      await writeServisAudit("EHTIYAT_HISSE", d.id, {
        mehsul_id: d.mehsul_id,
        mehsul_ad: product.ad,
        miqdar: d.miqdar,
        qiymet: d.qiymet,
      });

      revalidatePath(`/servis/${d.id}`);
      return { ok: true };
    } catch (e) {
      console.error("[addEhtiyatHisse]", e);
      return { ok: false, error: "Hissə əlavə olunmadı" };
    }
  });
}

/* ---------- Qiymət təklifi ---------- */

const TeklifSchema = z.object({
  id: z.string().uuid(),
  iscik: z.coerce.number().min(0).default(0),
  hisse: z.coerce.number().min(0).default(0),
  edv: z.coerce.number().min(0).default(0),
  qeyd: z.string().optional(),
});
export async function createQiymetTeklif(input: FormData): Promise<ActionResult<{ cem: number }>> {
  const parsed = TeklifSchema.safeParse(Object.fromEntries(input.entries()));
  if (!parsed.success) return { ok: false, error: "Yanlış məlumat" };
  const d = parsed.data;
  return withTenant(async () => {
    const { istifadeciId } = requireTenant();
    try {
      const cem = d.iscik + d.hisse + d.edv;
      await prisma.servis_qeydleri.update({
        where: { id: d.id },
        data: { temir_xerci: cem, yenilendi: new Date(), status: "teklif_gozleyir" },
      });
      await prisma.servis_status_tarixce.create({
        data: {
          servis_id: d.id,
          evvelki_status: null,
          yeni_status: "teklif_gozleyir",
          deyisen_id: istifadeciId,
          qeyd: `Təklif: işçilik ${d.iscik}, hissə ${d.hisse}, ƏDV ${d.edv}, cəm ${cem}. ${d.qeyd ?? ""}`,
        },
      });
      revalidatePath(`/servis/${d.id}`);
      return { ok: true, data: { cem } };
    } catch (e) {
      console.error("[createQiymetTeklif]", e);
      return { ok: false, error: "Təklif yaradılmadı" };
    }
  });
}

/* ---------- Ödəniş (kassa + satış avto-yaratma) ---------- */

const PaymentSchema = z.object({
  id: z.string().uuid(),
  meblegh: z.coerce.number().positive(),
  // Ödəniş üsulu: negd / kart / bank / borc
  odenis_nov: z.enum(["negd", "kart", "bank", "borc"]).default("negd"),
  hesab_id: z.string().uuid().optional().or(z.literal("")),
  // İstifadəçi seçimləri (default ikisi də ON)
  kassaya_elave_et: z.coerce.boolean().default(true),
  satis_kimi_qeyd_et: z.coerce.boolean().default(true),
  qeyd: z.string().optional().or(z.literal("")),
});

const SERVIS_TYPE_META = {
  kod: "xidmet_geliri",
  ad: "Servis xidmət gəliri",
  qrup: "satish",
  yon: "daxil" as const,
};

export async function recordPayment(input: FormData): Promise<ActionResult> {
  const parsed = PaymentSchema.safeParse(Object.fromEntries(input.entries()));
  if (!parsed.success) return { ok: false, error: "Yanlış məlumat" };
  const d = parsed.data;

  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    try {
      // Atomic: kassa + satış + servis update bir transaction içində
      const result = await prisma.$transaction(async (tx) => {
        // 1) Servisi oxu
        const servis = await tx.servis_qeydleri.findUnique({
          where: { id: d.id },
          select: {
            id: true,
            nomre: true,
            mehsul_id: true,
            mehsul_ad: true,
            musteri_id: true,
            musteri_ad: true,
            problem_tesviri: true,
            musteriden_alinan: true,
            filial_id: true,
            satis_id: true,
          },
        });
        if (!servis) throw new Error("Servis tapılmadı");

        // 2) `borc` rejimi → kassa yox, satış yox, yalnız kontragentin borcunu artır + servisdə "musteriden_alinan" *artır* (sayır kimi)
        if (d.odenis_nov === "borc") {
          // borc rejimində kassaya keçməz, amma "musteriden_alinan" hesabı saxlamır → biz artırmırıq.
          // Yalnız kontragentdə borc artır.
          if (servis.musteri_id) {
            await tx.kontragentler.update({
              where: { id: servis.musteri_id },
              data: { borc: { increment: d.meblegh }, yenilendi: new Date() },
            });
          }
          await tx.servis_qeydleri.update({
            where: { id: servis.id },
            data: { yenilendi: new Date() },
          });
          return { kassaOpId: null as string | null, satisId: null as string | null };
        }

        // 3) finance_operation_types yoxla / yarat (xidmet_geliri)
        let type = await tx.finance_operation_types.findUnique({
          where: { kod: SERVIS_TYPE_META.kod },
        }).catch(() => null);
        if (!type) {
          type = await tx.finance_operation_types.create({
            data: {
              kod: SERVIS_TYPE_META.kod,
              ad: SERVIS_TYPE_META.ad,
              qrup: SERVIS_TYPE_META.qrup,
              y_n: SERVIS_TYPE_META.yon,
              link_servis: true,
            },
          });
        }

        // 4) finance_operations sətri yarat (xidmet geliri)
        let kassaOpId: string | null = null;
        if (d.kassaya_elave_et) {
          const op = await tx.finance_operations.create({
            data: {
              sahibkar_id: sahibkarId,
              type_id: type.id,
              type_kod: type.kod,
              y_n: type.y_n,
              tarix: new Date(),
              meblegh: d.meblegh,
              valyuta: "AZN",
              mezenne: 1,
              azn_meblegh: d.meblegh,
              hesab_id: d.hesab_id || null,
              kontragent_id: servis.musteri_id ?? null,
              servis_id: servis.id,
              filial_id: servis.filial_id ?? null,
              qarsi_teref_ad: servis.musteri_ad,
              qeyd: `Servis: ${servis.nomre} — ${servis.mehsul_ad}${d.qeyd ? ` · ${d.qeyd}` : ""}`,
              yaradan_id: istifadeciId,
            },
          });
          kassaOpId = op.id;
        }

        // 5) satis_sifarisleri sətri yarat (xidmət kimi)
        let satisId: string | null = servis.satis_id;
        if (d.satis_kimi_qeyd_et) {
          // Generate unique nomre
          const PREFIX = "S";
          const year = new Date().getFullYear();
          const last = await tx.satis_sifarisleri.findFirst({
            where: { nomre: { startsWith: `${PREFIX}-${year}-` } },
            orderBy: { nomre: "desc" },
            select: { nomre: true },
          });
          const lastNum = last ? Number(last.nomre.split("-").pop()) || 0 : 0;
          const nomre = `${PREFIX}-${year}-${String(lastNum + 1).padStart(5, "0")}`;

          const sale = await tx.satis_sifarisleri.create({
            data: {
              sahibkar_id: sahibkarId,
              nomre,
              musteri_id: servis.musteri_id ?? null,
              tarix: new Date(),
              status: "tamamlandi",
              odenis_nov: d.odenis_nov,
              umumi_mebleg: d.meblegh,
              endirim_mebleg: 0,
              son_mebleg: d.meblegh,
              odenilmis: d.meblegh,
              kassa_id: null,
              filial_id: servis.filial_id ?? null,
              qeyd: `[XIDMET] Servis: ${servis.nomre} — ${servis.problem_tesviri.slice(0, 80)}`,
              yaradan_id: istifadeciId,
              satis_meneceri_id: istifadeciId,
              qaralama: false,
            },
          });
          // Bir sətir: xidmət ünvanı
          await tx.satis_sifaris_satirlari.create({
            data: {
              sahibkar_id: sahibkarId,
              sifaris_id: sale.id,
              mehsul_id: servis.mehsul_id ?? null,
              miqdar: 1,
              vahid_qiymet: d.meblegh,
              endirim_faiz: 0,
            },
          });
          // Servisdən satışa link bağla
          if (!servis.satis_id) {
            await tx.servis_qeydleri.update({
              where: { id: servis.id },
              data: { satis_id: sale.id },
            });
            satisId = sale.id;
          }
        }

        // 6) Servis qeydini yenilə (musteriden_alinan += mebleg)
        await tx.servis_qeydleri.update({
          where: { id: servis.id },
          data: {
            musteriden_alinan: Number(servis.musteriden_alinan ?? 0) + d.meblegh,
            xidmet_hesab_id: d.hesab_id || undefined,
            xidmet_geliri_op_id: kassaOpId ?? undefined,
            yenilendi: new Date(),
          },
        });

        return { kassaOpId, satisId };
      });

      revalidatePath(`/servis/${d.id}`);
      revalidatePath("/servis");
      revalidatePath("/maliyye");
      revalidatePath("/ticaret/satislar");

      await writeServisAudit("ODENIS", d.id, {
        meblegh: d.meblegh,
        odenis_nov: d.odenis_nov,
        hesab_id: d.hesab_id || null,
        kassa_op_id: result.kassaOpId,
        satis_id: result.satisId,
      });

      return { ok: true, id: result.kassaOpId ?? undefined };
    } catch (e) {
      console.error("[recordPayment]", e);
      return { ok: false, error: e instanceof Error ? e.message : "Ödəniş yazılmadı" };
    }
  });
}

/* ---------- Yekun ---------- */

export async function completeServis(
  id: string,
  qeyd?: string,
  extendWarranty?: boolean,
): Promise<ActionResult> {
  return changeServisStatus(id, "musteriye_tehvil", qeyd, { extendWarranty });
}

/* ---------- Bildiriş (mock) — şablon ilə ---------- */

export const NOTIFICATION_TEMPLATES = {
  qebul: { label: "Servisiniz qəbul edildi", text: "Hörmətli {ad}, servisiniz {nomre} nömrəsi ilə qəbul edildi. Status izləmə: {link}" },
  hazir: { label: "Hazırdır, götürə bilərsiniz", text: "Hörmətli {ad}, {nomre} servisiniz hazırdır. Mağazaya təşrif buyurun." },
  ved_yaxin: { label: "Vəd tarixi yaxınlaşır", text: "Hörmətli {ad}, {nomre} servisinizin vəd tarixi yaxınlaşır." },
  odenis: { label: "Ödəniş tələb olunur", text: "Hörmətli {ad}, {nomre} servisi üçün ödəniş tələb olunur." },
  reklam: { label: "Servis dəyərləndirməsi", text: "Servisimizdən razı qaldınızmı? Rəyinizi paylaşın: {link}" },
} as const;
export type NotificationTemplate = keyof typeof NOTIFICATION_TEMPLATES;

export async function sendCustomerNotification(
  id: string,
  channel: "sms" | "email" | "whatsapp",
  message: string,
  template?: NotificationTemplate,
): Promise<ActionResult> {
  return withTenant(async () => {
    try {
      const ts = new Date().toLocaleString("az-AZ");
      const s = await prisma.servis_qeydleri.findUnique({
        where: { id },
        select: { daxili_qeyd: true },
      });
      const logLine = `[${ts}] [Bildiriş:${channel}${template ? `/${template}` : ""}] ${message.slice(0, 200)}`;
      const merged = [s?.daxili_qeyd, logLine].filter(Boolean).join("\n");
      await prisma.servis_qeydleri.update({
        where: { id },
        data: { son_musteri_xeber: new Date(), yenilendi: new Date(), daxili_qeyd: merged },
      });
      console.log(`[mock-notify] ${channel} → ${id}: ${message}`);
      await writeServisAudit("BILDIRIS_GONDERILDI", id, { channel, template, message: message.slice(0, 200) });
      revalidatePath(`/servis/${id}`);
      return { ok: true };
    } catch (e) {
      console.error("[sendCustomerNotification]", e);
      return { ok: false, error: "Göndərilmədi" };
    }
  });
}

/* ---------- Müştəri rey (servis reytinqi) ---------- */

const ReySchema = z.object({
  servis_id: z.string().uuid(),
  ulduz: z.coerce.number().int().min(1).max(5),
  yazi: z.string().max(1000).optional().or(z.literal("")),
});

export async function submitCustomerReview(input: FormData): Promise<ActionResult> {
  const parsed = ReySchema.safeParse(Object.fromEntries(input.entries()));
  if (!parsed.success) return { ok: false, error: "Yanlış məlumat" };
  const d = parsed.data;
  try {
    const ts = new Date().toLocaleString("az-AZ");
    const s = await prisma.servis_qeydleri.findUnique({
      where: { id: d.servis_id },
      select: { daxili_qeyd: true },
    });
    if (!s) return { ok: false, error: "Servis tapılmadı" };
    const reyTag = `[Müştəri Rəyi] ${"★".repeat(d.ulduz)}${"☆".repeat(5 - d.ulduz)} ulduz:${d.ulduz} ${d.yazi ?? ""}`.trim();
    const logLine = `[${ts}] ${reyTag}`;
    const merged = [s.daxili_qeyd, logLine].filter(Boolean).join("\n");
    await prisma.servis_qeydleri.update({
      where: { id: d.servis_id },
      data: { daxili_qeyd: merged, yenilendi: new Date() },
    });
    revalidatePath(`/servis/${d.servis_id}`);
    return { ok: true };
  } catch (e) {
    console.error("[submitCustomerReview]", e);
    return { ok: false, error: "Rəy yazılmadı" };
  }
}

/* ---------- Müştəri təklif təsdiqi (public) ---------- */

const CustomerQuoteSchema = z.object({
  servis_id: z.string().uuid(),
  approved: z.string().transform((s) => s === "true" || s === "1"),
  reason: z.string().max(500).optional().or(z.literal("")),
});

export async function customerApproveQuote(input: FormData): Promise<ActionResult> {
  const parsed = CustomerQuoteSchema.safeParse(Object.fromEntries(input.entries()));
  if (!parsed.success) return { ok: false, error: "Yanlış məlumat" };
  const d = parsed.data;
  try {
    const s = await prisma.servis_qeydleri.findUnique({
      where: { id: d.servis_id },
      select: { id: true, status: true, daxili_qeyd: true },
    });
    if (!s) return { ok: false, error: "Servis tapılmadı" };

    const ts = new Date().toLocaleString("az-AZ");
    const note = d.approved
      ? `[${ts}] [Müştəri TƏSDIQ] Təklif qəbul edildi. ${d.reason ?? ""}`.trim()
      : `[${ts}] [Müştəri RƏDD] Təklif rədd edildi. ${d.reason ?? ""}`.trim();
    const merged = [s.daxili_qeyd, note].filter(Boolean).join("\n");
    const newStatus = d.approved ? "temir_olunur" : "redd_edildi";
    await prisma.servis_qeydleri.update({
      where: { id: d.servis_id },
      data: { daxili_qeyd: merged, status: newStatus, yenilendi: new Date() },
    });
    await prisma.servis_status_tarixce.create({
      data: {
        servis_id: d.servis_id,
        evvelki_status: s.status,
        yeni_status: newStatus,
        deyisen_id: null,
        deyisen_ad: "Müştəri (public)",
        qeyd: note,
      },
    });
    revalidatePath(`/servis/${d.servis_id}`);
    return { ok: true };
  } catch (e) {
    console.error("[customerApproveQuote]", e);
    return { ok: false, error: "Təsdiq yazılmadı" };
  }
}

/* ---------- Ehtiyat hissə silmə ---------- */

const EhtiyatDeleteSchema = z.object({
  servis_id: z.string().uuid(),
  hereket_id: z.string().uuid(),
});

export async function deleteEhtiyatHisse(input: FormData): Promise<ActionResult> {
  const parsed = EhtiyatDeleteSchema.safeParse(Object.fromEntries(input.entries()));
  if (!parsed.success) return { ok: false, error: "Yanlış məlumat" };
  const d = parsed.data;
  return withTenant(async () => {
    try {
      const h = await prisma.anbar_hereketleri.findUnique({
        where: { id: d.hereket_id },
        select: { id: true, ref_id: true, ref_nov: true, qiymet: true, miqdar: true },
      });
      if (!h || h.ref_nov !== "servis" || h.ref_id !== d.servis_id) {
        return { ok: false, error: "Hərəkət tapılmadı" };
      }
      // Reverse: silmək əvəzinə geri-cıxış yaz (audit izi qalsın)
      await prisma.anbar_hereketleri.delete({ where: { id: d.hereket_id } });
      // Servisdən temir_xerci-ni geri çıx
      const evvel = await prisma.servis_qeydleri.findUnique({
        where: { id: d.servis_id },
        select: { temir_xerci: true },
      });
      const geri = Number(h.qiymet ?? 0) * Math.abs(Number(h.miqdar ?? 0));
      const yeni = Math.max(0, Number(evvel?.temir_xerci ?? 0) - geri);
      await prisma.servis_qeydleri.update({
        where: { id: d.servis_id },
        data: { temir_xerci: yeni, yenilendi: new Date() },
      });
      await writeServisAudit("EHTIYAT_HISSE_SILINDI", d.servis_id, {
        hereket_id: d.hereket_id,
        geri_xerc: geri,
      });
      revalidatePath(`/servis/${d.servis_id}`);
      return { ok: true };
    } catch (e) {
      console.error("[deleteEhtiyatHisse]", e);
      return { ok: false, error: "Silinmədi" };
    }
  });
}

/* ---------- Print helpers (mock pdf url) ---------- */

export async function printQebzPdf(id: string): Promise<ActionResult<{ url: string }>> {
  return { ok: true, data: { url: `/api/servis/${id}/qebz.pdf` } };
}

/* ---------- Servis fayl silmə ---------- */

export async function deleteServisFile(faylId: number, servisId: string): Promise<ActionResult> {
  return withTenant(async () => {
    try {
      // Owner-check: yalnız mövcud tenant-in servisi olub-olmadığını yoxla
      const fayl = await prisma.servis_fayllari.findUnique({
        where: { id: faylId },
        select: { servis_id: true, fayl_adi: true },
      });
      if (!fayl || fayl.servis_id !== servisId) return { ok: false, error: "Fayl tapılmadı" };

      // Tenant verify via servis include
      const servis = await prisma.servis_qeydleri.findUnique({
        where: { id: servisId },
        select: { id: true },
      });
      if (!servis) return { ok: false, error: "Servis tapılmadı" };

      await prisma.servis_fayllari.delete({ where: { id: faylId } });
      await writeServisAudit("FAYL_SILINDI", servisId, { fayl_id: faylId, fayl_adi: fayl.fayl_adi });
      revalidatePath(`/servis/${servisId}`);
      return { ok: true };
    } catch (e) {
      console.error("[deleteServisFile]", e);
      return { ok: false, error: "Fayl silinmədi" };
    }
  });
}
