"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma, prismaUnscoped } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { parseLocalDate } from "@/lib/utils/date-parse";
import { safeAuditLog } from "@/lib/audit/safe-log";
import {
  requireServisActionPerm,
  bustServisCache,
  checkCustomerEndpointRateLimit,
  verifyServisToken,
} from "./access-guard";

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
type ActionResult<T = undefined> = { ok: true; id?: string; data?: T; warning?: string } | { ok: false; error: string };

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
  const permCheck = await requireServisActionPerm(["servis.yarat", "servis.idare"]);
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
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

      // Qəbz zamanı müştəri məbləğ verirsə — avtomatik ödəniş əməliyyatı.
      // ÖNƏMLİ: Əgər hesab seçilməyibsə default aktiv nağd kassanı tapırıq ki,
      // ödəniş qaib qalmasın. Heç bir kassa yoxdursa, yalnız o zaman skip
      // edilir və audit log-a xəbərdarlıq yazılır.
      let paymentWarning: string | undefined;
      if (d.musteriden_alinan > 0) {
        let hesabId = d.xidmet_hesab_id;
        if (!hesabId) {
          // Default kassa fallback — sahibkarın ilk aktiv nağd hesabı
          const defaultKassa = await prisma.maliye_hesablari.findFirst({
            where: { sahibkar_id: sahibkarId, aktiv: true, nov: "negd" }, // QA-orta: kanonik nov "negd" — "nagd" ilə kassa heç vaxt tapılmırdı
            orderBy: { yaradildi: "asc" },
            select: { id: true },
          });
          hesabId = defaultKassa?.id;
        }
        if (hesabId) {
          try {
            const fd = new FormData();
            fd.set("id", created.id);
            fd.set("meblegh", String(d.musteriden_alinan));
            fd.set("odenis_nov", "negd");
            fd.set("hesab_id", hesabId);
            fd.set("kassaya_elave_et", "true");
            fd.set("satis_kimi_qeyd_et", "true");
            fd.set("qeyd", `İlkin ödəniş: ${d.mehsul_ad}`);
            const payRes = await recordPayment(fd);
            if (!payRes.ok) {
              // recordPayment uğursuz oldu (icazə/validasiya və s.) — pul itkisi riski.
              console.error(
                `[createServisRequest] ${created.id}: ${d.musteriden_alinan} AZN ödənişi yazılmadı — ${payRes.error}`,
              );
              await writeServisAudit("ODENIS_ITKI_RISKI", created.id, {
                mebleg: d.musteriden_alinan,
                hesab_id: hesabId,
                sebeb: `Ödəniş kassaya yazılmadı: ${payRes.error}`,
              });
              paymentWarning = `Diqqət: ${d.musteriden_alinan} AZN ödəniş kassaya yazılmadı (${payRes.error}). Zəhmət olmasa ödənişi əl ilə qeyd edin.`;
            }
          } catch (err) {
            console.error(
              `[createServisRequest] ${created.id}: auto-payment failed (${d.musteriden_alinan} AZN):`,
              err,
            );
            await writeServisAudit("ODENIS_XETA", created.id, {
              mebleg: d.musteriden_alinan,
              hesab_id: hesabId,
              error: err instanceof Error ? err.message : String(err),
            });
            paymentWarning = `Diqqət: ${d.musteriden_alinan} AZN ödəniş kassaya yazılmadı (xəta baş verdi). Zəhmət olmasa ödənişi əl ilə qeyd edin.`;
          }
        } else {
          // Heç bir kassa yoxdur — istifadəçi xəbərdarlandırılır audit log-da
          console.warn(
            `[createServisRequest] ${created.id}: ${d.musteriden_alinan} AZN alındı amma aktiv kassa yoxdur`,
          );
          await writeServisAudit("ODENIS_ITKI_RISKI", created.id, {
            mebleg: d.musteriden_alinan,
            sebeb: "Aktiv nağd kassa tapılmadı — ödəniş kassaya yazılmadı",
          });
          paymentWarning = `Diqqət: ${d.musteriden_alinan} AZN ödəniş kassaya yazılmadı (aktiv nağd kassa tapılmadı). Zəhmət olmasa əvvəlcə kassa yaradıb ödənişi əl ilə qeyd edin.`;
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
      bustServisCache();
      return { ok: true, id: created.id, warning: paymentWarning };
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
  const permCheck = await requireServisActionPerm(["servis.status", "servis.idare"]);
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  if (!(STATUSES as readonly string[]).includes(status)) return { ok: false, error: "Yanlış status" };
  // Rədd statusunda mütləq səbəb tələb olunur (audit + müştəri tarixçəsi üçün)
  if (status === "redd_edildi" && (!qeyd || qeyd.trim().length < 3)) {
    return { ok: false, error: "Rədd səbəbi tələb olunur" };
  }
  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    try {
      // 🔒 Açıq sahibkar_id qoruması
      const prev = await prisma.servis_qeydleri.findFirst({
        where: { id, sahibkar_id: sahibkarId },
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
      // ⚛️ Atomic — status update + history row birlikdə
      await prisma.$transaction(async (tx) => {
        await tx.servis_qeydleri.updateMany({ where: { id, sahibkar_id: sahibkarId }, data });
        await tx.servis_status_tarixce.create({
          data: {
            servis_id: id,
            evvelki_status: prev.status,
            yeni_status: status,
            deyisen_id: istifadeciId,
            qeyd: qeyd ?? null,
          },
        });
        // redd_edildi statusuna keçəndə servis borc balansa daxil olmamalıdır
        // → source-of-truth bunu nəzərə alır, sadəcə recalc çağırılır.
        if (status === "redd_edildi" && prev.musteri_id) {
          const { recalculateCustomerBalance } = await import("@/lib/balance/customer-balance");
          await recalculateCustomerBalance(prev.musteri_id, tx);
        }
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
      bustServisCache();
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
  const permCheck = await requireServisActionPerm(["servis.diaqnostika", "servis.idare"]);
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  const parsed = DiagSchema.safeParse(Object.fromEntries(input.entries()));
  if (!parsed.success) return { ok: false, error: "Yanlış məlumat" };
  const d = parsed.data;
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    try {
      // 🔒 Açıq sahibkar_id qoruması
      const prev = await prisma.servis_qeydleri.findFirst({
        where: { id: d.id, sahibkar_id: sahibkarId },
        select: { texniki_qeyd: true },
      });
      if (!prev) return { ok: false, error: "Servis tapılmadı" };
      const merged = [prev?.texniki_qeyd, `[${new Date().toLocaleString("az-AZ")}] ${d.texniki_qeyd}`]
        .filter(Boolean)
        .join("\n");
      await prisma.servis_qeydleri.updateMany({
        where: { id: d.id, sahibkar_id: sahibkarId },
        data: { texniki_qeyd: merged, yenilendi: new Date() },
      });
      revalidatePath(`/servis/${d.id}`);
      bustServisCache();
      try {
        await writeServisAudit("DIAQNOSTIKA", d.id, { uzunluq: d.texniki_qeyd.length });
      } catch { /* non-fatal */ }
      return { ok: true };
    } catch (e) {
      console.error("[addDiagnostika]", e);
      return { ok: false, error: "Qeyd əlavə olunmadı" };
    }
  });
}

const RepairNoteSchema = z.object({ id: z.string().uuid(), qeyd: z.string().min(1) });
export async function addRepairNote(input: FormData): Promise<ActionResult> {
  const permCheck = await requireServisActionPerm(["servis.idare", "servis.qeyd"]);
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  const parsed = RepairNoteSchema.safeParse(Object.fromEntries(input.entries()));
  if (!parsed.success) return { ok: false, error: "Yanlış məlumat" };
  const d = parsed.data;
  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    try {
      // 🔒 Servis sahibkar yoxlaması
      const owned = await prisma.servis_qeydleri.findFirst({
        where: { id: d.id, sahibkar_id: sahibkarId },
        select: { id: true },
      });
      if (!owned) return { ok: false, error: "Servis tapılmadı" };
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
      bustServisCache();
      try {
        await writeServisAudit("QEYD", d.id, { uzunluq: d.qeyd.length });
      } catch { /* non-fatal */ }
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
  const permCheck = await requireServisActionPerm(["servis.ehtiyat", "servis.idare"]);
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  const parsed = EhtiyatSchema.safeParse(Object.fromEntries(input.entries()));
  if (!parsed.success) return { ok: false, error: "Yanlış məlumat" };
  const d = parsed.data;
  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    try {
      const product = await prisma.mehsullar.findFirst({
        where: { id: d.mehsul_id, sahibkar_id: sahibkarId },
        select: { ad: true, kod: true },
      });
      if (!product) return { ok: false, error: "Məhsul tapılmadı" };

      // ⚛️ Atomic — servis cost + stock movement bir transaction
      await prisma.$transaction(async (tx) => {
        const sifaris = await tx.servis_qeydleri.findFirst({
          where: { id: d.id, sahibkar_id: sahibkarId },
          select: { temir_xerci: true, texniki_qeyd: true, musteri_id: true },
        });
        if (!sifaris) throw new Error("Servis tapılmadı");

        const newXerc = Number(sifaris.temir_xerci ?? 0) + d.qiymet * d.miqdar;
        const partLine = `[Ehtiyat] ${product.ad} (${product.kod ?? "—"}) × ${d.miqdar} = ${(d.qiymet * d.miqdar).toFixed(2)}`;
        const mergedNote = [sifaris.texniki_qeyd, partLine].filter(Boolean).join("\n");
        await tx.servis_qeydleri.updateMany({
          where: { id: d.id, sahibkar_id: sahibkarId },
          data: { temir_xerci: newXerc, texniki_qeyd: mergedNote, yenilendi: new Date() },
        });

        // Müştəri balansı recalc — temir_xerci dəyişdi, source-of-truth bundan asılıdır.
        if (sifaris.musteri_id) {
          const { recalculateCustomerBalance } = await import("@/lib/balance/customer-balance");
          await recalculateCustomerBalance(sifaris.musteri_id, tx);
        }

        // Stok hərəkəti — eyni transaction içində.
        // Əvvəlcə bu məhsulun stoku olan anbarı tapırıq (ən çox stok olan anbar
        // götürülür). Stok yoxdursa, ehtiyat hissə qeyd olunur amma stok
        // azaldılmır — `mənfi stok` riski qarşısı alınır.
        const stokRow = await tx.stok.findFirst({
          where: {
            sahibkar_id: sahibkarId,
            mehsul_id: d.mehsul_id,
            miqdar: { gt: 0 },
          },
          orderBy: { miqdar: "desc" },
          select: { anbar_id: true, miqdar: true },
        });
        if (stokRow && Number(stokRow.miqdar) >= d.miqdar) {
          // Atomik stok azaltma — race-safe decrement
          const updated = await tx.stok.updateMany({
            where: {
              sahibkar_id: sahibkarId,
              mehsul_id: d.mehsul_id,
              anbar_id: stokRow.anbar_id,
              miqdar: { gte: d.miqdar },
            },
            data: { miqdar: { decrement: d.miqdar } },
          });
          if (updated.count === 0) {
            throw new Error("Stok kifayət deyil — paralel əməliyyat ola bilər");
          }
          // Anbar hereket jurnalı
          await tx.anbar_hereketleri.create({
            data: {
              sahibkar_id: sahibkarId,
              mehsul_id: d.mehsul_id,
              anbar_id: stokRow.anbar_id,
              nov: "servis_mexaric",
              miqdar: d.miqdar,
              qiymet: d.qiymet,
              qeyd: `Servis ehtiyat hissə: ${d.id}`,
              ref_nov: "servis",
              ref_id: d.id,
              edilen_id: istifadeciId,
            },
          });
        } else {
          // Stok yoxdursa — yalnız jurnal yazılır, audit-də işarələnir
          // ki, anbarçı qəbul etsin və əlavə alış lazımdır.
          const firstAnbar = await tx.anbarlar.findFirst({
            where: { sahibkar_id: sahibkarId, aktiv: true },
            select: { id: true },
            orderBy: { id: "asc" },
          });
          if (firstAnbar) {
            await tx.anbar_hereketleri.create({
              data: {
                sahibkar_id: sahibkarId,
                mehsul_id: d.mehsul_id,
                anbar_id: firstAnbar.id,
                nov: "servis_mexaric_stoxsuz",
                miqdar: d.miqdar,
                qiymet: d.qiymet,
                qeyd: `Servis ehtiyat hissə (STOK YOX): ${d.id}`,
                ref_nov: "servis",
                ref_id: d.id,
                edilen_id: istifadeciId,
              },
            });
          }
        }
      });

      // Stok-altı yoxla → bildiriş (transaction xaricində — non-fatal)
      try {

        // Stok-altı yoxla → admin/işçilərə bildiriş
        const fullProduct = await prisma.mehsullar.findUnique({
          where: { id: d.mehsul_id },
          select: { ad: true, min_stok: true },
        });
        if (fullProduct) {
          // QA-orta: cari qalıq 'stok' cədvəlindən oxunur — anbar_hereketleri.miqdar
          // həmişə müsbətdir (istiqamət 'nov'-dadır), SUM dövriyyəni verirdi və
          // stok-altı xəbərdarlıq praktiki heç vaxt atəşlənmirdi.
          const stokSum = await prisma.stok.aggregate({
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
      bustServisCache();
      return { ok: true };
    } catch (e) {
      console.error("[addEhtiyatHisse]", e);
      return { ok: false, error: e instanceof Error ? e.message : "Hissə əlavə olunmadı" };
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
  const permCheck = await requireServisActionPerm(["servis.teklif", "servis.idare"]);
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  const parsed = TeklifSchema.safeParse(Object.fromEntries(input.entries()));
  if (!parsed.success) return { ok: false, error: "Yanlış məlumat" };
  const d = parsed.data;
  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    try {
      // 🔒 Servis sahibkar yoxlaması
      const owned = await prisma.servis_qeydleri.findFirst({
        where: { id: d.id, sahibkar_id: sahibkarId },
        select: { id: true, musteri_id: true },
      });
      if (!owned) return { ok: false, error: "Servis tapılmadı" };
      const cem = d.iscik + d.hisse + d.edv;
      await prisma.$transaction(async (tx) => {
        await tx.servis_qeydleri.updateMany({
          where: { id: d.id, sahibkar_id: sahibkarId },
          data: { temir_xerci: cem, yenilendi: new Date(), status: "teklif_gozleyir" },
        });
        await tx.servis_status_tarixce.create({
          data: {
            servis_id: d.id,
            evvelki_status: null,
            yeni_status: "teklif_gozleyir",
            deyisen_id: istifadeciId,
            qeyd: `Təklif: işçilik ${d.iscik}, hissə ${d.hisse}, ƏDV ${d.edv}, cəm ${cem}. ${d.qeyd ?? ""}`,
          },
        });
        // temir_xerci dəyişdi → müştəri balansı recalc lazımdır
        if (owned.musteri_id) {
          const { recalculateCustomerBalance } = await import("@/lib/balance/customer-balance");
          await recalculateCustomerBalance(owned.musteri_id, tx);
        }
      });
      revalidatePath(`/servis/${d.id}`);
      bustServisCache();
      try {
        await writeServisAudit("TEKLIF", d.id, { iscik: d.iscik, hisse: d.hisse, edv: d.edv, cem });
      } catch { /* non-fatal */ }
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
  idempotency_key: z.string().max(80).optional().or(z.literal("")),
});

const SERVIS_TYPE_META = {
  kod: "xidmet_geliri",
  ad: "Servis xidmət gəliri",
  qrup: "satish",
  yon: "daxil" as const,
};

export async function recordPayment(input: FormData): Promise<ActionResult> {
  const permCheck = await requireServisActionPerm(["servis.odenis", "servis.idare", "kassa.idare"]);
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  const parsed = PaymentSchema.safeParse(Object.fromEntries(input.entries()));
  if (!parsed.success) return { ok: false, error: "Yanlış məlumat" };
  const d = parsed.data;

  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    try {
      // 🛡️ İdempotensiya — son 5 dəqiqədə eyni key + servis + məbləğ varsa dublikat
      const idemKey = (d.idempotency_key || "").trim();
      if (idemKey) {
        const since = new Date(Date.now() - 5 * 60 * 1000);
        const dup = await prisma.finance_operations.findFirst({
          where: {
            sahibkar_id: sahibkarId,
            servis_id: d.id,
            meblegh: d.meblegh,
            yaradildi: { gte: since },
            qeyd: { contains: `[IDEM:${idemKey}]` },
          },
          select: { id: true },
        });
        if (dup) return { ok: true, id: dup.id };
      }

      // Atomic: kassa + satış + servis update bir transaction içində
      const result = await prisma.$transaction(async (tx) => {
        // 1) Servisi oxu — 🔒 sahibkar_id açıq filtri
        const servis = await tx.servis_qeydleri.findFirst({
          where: { id: d.id, sahibkar_id: sahibkarId },
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

        // 2) `borc` rejimi → kassa yox, satış yox.
        // Müştəri balansı SOURCE-OF-TRUTH (`customer-balance.ts`) servis_qeydleri-ni
        // (temir_xerci - musteriden_alinan) əsasında hesablayır.
        // Burada manual borc increment YOX — yalnız recalc çağırılır ki cache yenilənsin.
        if (d.odenis_nov === "borc") {
          await tx.servis_qeydleri.update({
            where: { id: servis.id },
            data: { yenilendi: new Date() },
          });
          if (servis.musteri_id) {
            const { recalculateCustomerBalance } = await import("@/lib/balance/customer-balance");
            await recalculateCustomerBalance(servis.musteri_id, tx);
          }
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
          // 🔒 Tenant ownership: client hesab_id CARI tenant-ə aid olmalıdır
          // (özgə hesab finance_operations-a yazılsa qurban balansını korlayar).
          if (d.hesab_id) {
            const own = await tx.maliye_hesablari.findFirst({
              where: { id: d.hesab_id, sahibkar_id: sahibkarId },
              select: { id: true },
            });
            if (!own) throw new Error("Seçilmiş hesab bu hesaba aid deyil");
          }
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
              qeyd: [
                idemKey ? `[IDEM:${idemKey}]` : "",
                `Servis: ${servis.nomre} — ${servis.mehsul_ad}${d.qeyd ? ` · ${d.qeyd}` : ""}`,
              ].filter(Boolean).join(" "),
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
              // satis_sifarisleri_odenis_nov_check: negd/kart/kecirme/nisye/kredit (bank YOX).
              // payment-form 'bank' göndərir → 23514. Bank köçürməsini 'kecirme'-yə map et.
              odenis_nov: d.odenis_nov === "bank" ? "kecirme" : d.odenis_nov,
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
          // QA-orta: müştərinin cihazını sətirə bağlama — COGS sorğuları
          // (JOIN mehsullar) cihazın alish_qiymeti-ni satılmış kimi xərcə
          // salırdı. Gəlir onsuz da header-dən (son_mebleg) hesablanır.
          await tx.satis_sifaris_satirlari.create({
            data: {
              sahibkar_id: sahibkarId,
              sifaris_id: sale.id,
              mehsul_id: null,
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

        // 7) Müştəri balansı recalc — source-of-truth servis qaliğını da hesablayır.
        if (servis.musteri_id) {
          const { recalculateCustomerBalance } = await import("@/lib/balance/customer-balance");
          await recalculateCustomerBalance(servis.musteri_id, tx);
        }

        return { kassaOpId, satisId };
      });

      revalidatePath(`/servis/${d.id}`);
      revalidatePath("/servis");
      revalidatePath("/maliyye");
      revalidatePath("/ticaret/satislar");
      bustServisCache();

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
  const permCheck = await requireServisActionPerm(["servis.bildiris", "servis.idare"]);
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  if (!message || message.trim().length < 3) return { ok: false, error: "Mesaj boş ola bilməz" };
  if (message.length > 500) return { ok: false, error: "Mesaj çox uzundur" };
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    try {
      const ts = new Date().toLocaleString("az-AZ");
      // 🔒 Sahibkar yoxlaması
      const s = await prisma.servis_qeydleri.findFirst({
        where: { id, sahibkar_id: sahibkarId },
        select: { daxili_qeyd: true },
      });
      if (!s) return { ok: false, error: "Servis tapılmadı" };
      const logLine = `[${ts}] [Bildiriş:${channel}${template ? `/${template}` : ""}] ${message.slice(0, 200)}`;
      const merged = [s?.daxili_qeyd, logLine].filter(Boolean).join("\n");
      await prisma.servis_qeydleri.updateMany({
        where: { id, sahibkar_id: sahibkarId },
        data: { son_musteri_xeber: new Date(), yenilendi: new Date(), daxili_qeyd: merged },
      });
      console.log(`[mock-notify] ${channel} → ${id}: ${message}`);
      await writeServisAudit("BILDIRIS_GONDERILDI", id, { channel, template, message: message.slice(0, 200) });
      revalidatePath(`/servis/${id}`);
      bustServisCache();
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
  token: z.string().min(10).max(120),
});

export async function submitCustomerReview(input: FormData): Promise<ActionResult> {
  const parsed = ReySchema.safeParse(Object.fromEntries(input.entries()));
  if (!parsed.success) return { ok: false, error: "Yanlış məlumat" };
  const d = parsed.data;

  // 🛡️ Public endpoint — rate-limit
  const rl = await checkCustomerEndpointRateLimit(d.servis_id, 5, 5);
  if (!rl.ok) return { ok: false, error: rl.error };

  try {
    // QA-K26: public endpoint — tenant kontekst YOXDUR; scoped prisma burada
    // tenant-guard ilə çökür. prismaUnscoped + token sahibkar bağını təsdiqləyir.
    const s = await prismaUnscoped.servis_qeydleri.findUnique({
      where: { id: d.servis_id },
      select: { daxili_qeyd: true, sahibkar_id: true, musteri_ad: true },
    });
    if (!s) return { ok: false, error: "Servis tapılmadı" };

    // 🔐 Token yoxlaması — UUID təxmin etməyi blok edir
    if (!(await verifyServisToken(d.token, d.servis_id, s.sahibkar_id))) {
      return { ok: false, error: "Token yanlışdır və ya köhnəlib" };
    }

    const ts = new Date().toLocaleString("az-AZ");
    const reyTag = `[Müştəri Rəyi] ${"★".repeat(d.ulduz)}${"☆".repeat(5 - d.ulduz)} ulduz:${d.ulduz} ${d.yazi ?? ""}`.trim();
    const logLine = `[${ts}] ${reyTag}`;
    const merged = [s.daxili_qeyd, logLine].filter(Boolean).join("\n");
    await prismaUnscoped.servis_qeydleri.updateMany({
      where: { id: d.servis_id, sahibkar_id: s.sahibkar_id },
      data: { daxili_qeyd: merged, yenilendi: new Date() },
    });
    // 🔒 Audit — tenant-li (sahibkar_id manual təyin edilir, çünki public endpoint-də withTenant yoxdur)
    try {
      await safeAuditLog({
        sahibkar_id: s.sahibkar_id,
        istifadeci_id: null,
        emeliyyat: "musteri_rey",
        resurs_nov: "servis",
        resurs_id: d.servis_id,
        yeni_data: { ulduz: d.ulduz, uzunluq: d.yazi?.length ?? 0, musteri: s.musteri_ad },
        status: "ugur",
      });
    } catch { /* non-fatal */ }
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
  token: z.string().min(10).max(120),
});

export async function customerApproveQuote(input: FormData): Promise<ActionResult> {
  const parsed = CustomerQuoteSchema.safeParse(Object.fromEntries(input.entries()));
  if (!parsed.success) return { ok: false, error: "Yanlış məlumat" };
  const d = parsed.data;

  // 🛡️ Public endpoint — rate-limit (eyni servis üçün 5 dəqiqədə maksimum 3)
  const rl = await checkCustomerEndpointRateLimit(d.servis_id, 3, 5);
  if (!rl.ok) return { ok: false, error: rl.error };

  try {
    // QA-K26: public endpoint — tenant kontekst YOXDUR; prismaUnscoped işlədilir
    // (token aşağıda id↔sahibkar bağını təsdiqləyir).
    const s = await prismaUnscoped.servis_qeydleri.findUnique({
      where: { id: d.servis_id },
      select: { id: true, status: true, daxili_qeyd: true, sahibkar_id: true, musteri_ad: true },
    });
    if (!s) return { ok: false, error: "Servis tapılmadı" };

    // 🔐 Token yoxlaması — UUID təxmin etməyi blok edir
    if (!(await verifyServisToken(d.token, d.servis_id, s.sahibkar_id))) {
      try {
        await safeAuditLog({
          sahibkar_id: s.sahibkar_id,
          istifadeci_id: null,
          emeliyyat: "musteri_onay_token_xeta",
          resurs_nov: "servis",
          resurs_id: d.servis_id,
          status: "xeta",
        });
      } catch { /* non-fatal */ }
      return { ok: false, error: "Token yanlışdır və ya köhnəlib" };
    }

    // Yalnız "teklif_gozleyir" statusda təsdiq/rədd qəbul olunur
    if (s.status !== "teklif_gozleyir") {
      return { ok: false, error: "Bu mərhələdə cavab qəbul olunmur" };
    }

    const ts = new Date().toLocaleString("az-AZ");
    const note = d.approved
      ? `[${ts}] [Müştəri TƏSDIQ] Təklif qəbul edildi. ${d.reason ?? ""}`.trim()
      : `[${ts}] [Müştəri RƏDD] Təklif rədd edildi. ${d.reason ?? ""}`.trim();
    const merged = [s.daxili_qeyd, note].filter(Boolean).join("\n");
    const newStatus = d.approved ? "temir_olunur" : "redd_edildi";
    await prismaUnscoped.$transaction(async (tx) => {
      await tx.servis_qeydleri.updateMany({
        where: { id: d.servis_id, sahibkar_id: s.sahibkar_id },
        data: { daxili_qeyd: merged, status: newStatus, yenilendi: new Date() },
      });
      await tx.servis_status_tarixce.create({
        data: {
          servis_id: d.servis_id,
          evvelki_status: s.status,
          yeni_status: newStatus,
          deyisen_id: null,
          deyisen_ad: "Müştəri (public)",
          qeyd: note,
        },
      });
    });
    try {
      await safeAuditLog({
        sahibkar_id: s.sahibkar_id,
        istifadeci_id: null,
        emeliyyat: d.approved ? "musteri_onay" : "musteri_redd",
        resurs_nov: "servis",
        resurs_id: d.servis_id,
        yeni_data: { approved: d.approved, reason: d.reason ?? null, musteri: s.musteri_ad },
        status: "ugur",
      });
    } catch { /* non-fatal */ }
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
  const permCheck = await requireServisActionPerm(["servis.ehtiyat", "servis.idare"]);
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  const parsed = EhtiyatDeleteSchema.safeParse(Object.fromEntries(input.entries()));
  if (!parsed.success) return { ok: false, error: "Yanlış məlumat" };
  const d = parsed.data;
  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    try {
      // 🔒 Sahibkar yoxlaması
      const h = await prisma.anbar_hereketleri.findFirst({
        where: { id: d.hereket_id, sahibkar_id: sahibkarId },
        select: { id: true, ref_id: true, ref_nov: true, nov: true, qiymet: true, miqdar: true, mehsul_id: true, anbar_id: true },
      });
      if (!h || h.ref_nov !== "servis" || h.ref_id !== d.servis_id) {
        return { ok: false, error: "Hərəkət tapılmadı" };
      }
      const geri = Number(h.qiymet ?? 0) * Math.abs(Number(h.miqdar ?? 0));

      // ⚛️ Atomic: REVERSAL row + servis cost geri çıx (hard-delete əvəzinə)
      await prisma.$transaction(async (tx) => {
        const evvel = await tx.servis_qeydleri.findFirst({
          where: { id: d.servis_id, sahibkar_id: sahibkarId },
          select: { temir_xerci: true, musteri_id: true },
        });
        if (!evvel) throw new Error("Servis tapılmadı");

        // Reversal row — orijinal mənfi miqdar üçün müsbət reverse yaz
        if (h.mehsul_id && h.anbar_id) {
          await tx.anbar_hereketleri.create({
            data: {
              sahibkar_id: sahibkarId,
              mehsul_id: h.mehsul_id,
              anbar_id: h.anbar_id,
              nov: "servis_iade",
              miqdar: Math.abs(Number(h.miqdar ?? 0)),
              qiymet: Number(h.qiymet ?? 0),
              qeyd: `Servis ehtiyat hissə qaytarıldı — ref hereket: ${d.hereket_id}`,
              ref_nov: "servis",
              ref_id: d.servis_id,
              edilen_id: istifadeciId,
            },
          });
          // 🚨 STOK CACHE bərpası — reversal ledger yazılır, amma stok cache də
          // artırılmalıdır (yoxsa mal satıla bilən stokda görünmür = daimi itki).
          // Yalnız orijinal hərəkət stoku azaltmışdısa (servis_mexaric); stoxsuz yolda toxunma.
          if (h.nov === "servis_mexaric") {
            await tx.stok.updateMany({
              where: { sahibkar_id: sahibkarId, mehsul_id: h.mehsul_id, anbar_id: h.anbar_id },
              data: { miqdar: { increment: Math.abs(Number(h.miqdar ?? 0)) } },
            });
          }
        }

        const yeni = Math.max(0, Number(evvel.temir_xerci ?? 0) - geri);
        await tx.servis_qeydleri.updateMany({
          where: { id: d.servis_id, sahibkar_id: sahibkarId },
          data: { temir_xerci: yeni, yenilendi: new Date() },
        });
        // temir_xerci azaldı → müştəri balansı recalc
        if (evvel.musteri_id) {
          const { recalculateCustomerBalance } = await import("@/lib/balance/customer-balance");
          await recalculateCustomerBalance(evvel.musteri_id, tx);
        }
      });

      await writeServisAudit("EHTIYAT_HISSE_QAYTARILDI", d.servis_id, {
        hereket_id: d.hereket_id,
        geri_xerc: geri,
      });
      revalidatePath(`/servis/${d.servis_id}`);
      bustServisCache();
      return { ok: true };
    } catch (e) {
      console.error("[deleteEhtiyatHisse]", e);
      return { ok: false, error: e instanceof Error ? e.message : "Silinmədi" };
    }
  });
}

/* ---------- Print helpers (mock pdf url) ---------- */

export async function printQebzPdf(id: string): Promise<ActionResult<{ url: string }>> {
  const permCheck = await requireServisActionPerm(["servis.oxu", "servis.qebz"]);
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  return { ok: true, data: { url: `/api/servis/${id}/qebz.pdf` } };
}

/* ---------- Servis fayl silmə ---------- */

export async function deleteServisFile(faylId: number, servisId: string): Promise<ActionResult> {
  const permCheck = await requireServisActionPerm(["servis.fayl", "servis.idare"]);
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    try {
      // 🔒 Tenant + servis sahibkar yoxlaması
      const servis = await prisma.servis_qeydleri.findFirst({
        where: { id: servisId, sahibkar_id: sahibkarId },
        select: { id: true },
      });
      if (!servis) return { ok: false, error: "Servis tapılmadı" };

      const fayl = await prisma.servis_fayllari.findFirst({
        where: { id: faylId, servis_id: servisId },
        select: { servis_id: true, fayl_adi: true },
      });
      if (!fayl) return { ok: false, error: "Fayl tapılmadı" };

      await prisma.servis_fayllari.deleteMany({ where: { id: faylId, servis_id: servisId } });
      await writeServisAudit("FAYL_SILINDI", servisId, { fayl_id: faylId, fayl_adi: fayl.fayl_adi });
      revalidatePath(`/servis/${servisId}`);
      bustServisCache();
      return { ok: true };
    } catch (e) {
      console.error("[deleteServisFile]", e);
      return { ok: false, error: "Fayl silinmədi" };
    }
  });
}
