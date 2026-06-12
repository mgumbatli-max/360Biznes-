import "server-only";
import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireTenant } from "@/lib/db/tenant-context";
import { createApprovalRequest, shouldRequireDocApproval } from "@/features/tesdiq/create";
import { audit, diffObjects } from "@/lib/audit/log";
import { safeUserMessage } from "@/lib/error/user-message";

/**
 * Məhsul yarat/redaktə üçün ortaq Zod sxeması — TƏK mənbə.
 * Həm web server action (`saveProduct`), həm də mobil route bu sxemadan istifadə edir.
 */
export const ProductSchema = z.object({
  id: z.string().uuid().optional(),
  // Əsas
  ad: z.string().min(2).max(200),
  kod: z.string().max(50).optional().or(z.literal("")),
  barkod: z.string().max(100).optional().or(z.literal("")),
  kateqoriya_id: z.coerce.number().int().positive().optional(),
  marka_id: z.coerce.number().int().positive().optional(),
  olcu_id: z.coerce.number().int().positive().optional(),
  // Şəkil və təsvir — URL formatına məcburi deyil (boş, relative path,
  // blob:, data: hamısı qəbul olunur ki, formdan gələn dəyər heç vaxt
  // "Invalid URL" xətasına səbəb olmasın).
  sekil_url: z.preprocess(
    (v) => (typeof v === "string" ? v.trim() : v ?? ""),
    z.string().max(2000).optional().default(""),
  ),
  qisaca_tesvir: z.string().max(500).optional().or(z.literal("")),
  aciqlamaq: z.string().max(5000).optional().or(z.literal("")),
  // Qiymətlər
  // NOT: `alish_qiymeti` (maya) məhsul kartından əl ilə yazılmamalıdır.
  // Maya YALNIZ alış qaiməsindən (`receivePurchase`) yenilənir.
  // Bu sahə forma input-undan boş gələrsə 0 olur — köhnə qiymət dəyişməz
  // çünki UPDATE zamanı 0 dəyər varsa, biz onu skip edirik (aşağıda yoxlanılır).
  alish_qiymeti: z.coerce.number().min(0).optional().default(0),
  satis_qiymeti: z.coerce.number().min(0).default(0),
  endirimli_qiymet: z.coerce.number().min(0).optional().or(z.literal("")),
  min_satis_qiymeti: z.coerce.number().min(0).default(0),
  topdan_qiymeti: z.coerce.number().min(0).default(0),
  partnyor_qiymeti: z.coerce.number().min(0).default(0),
  vip_qiymeti: z.coerce.number().min(0).default(0),
  komissiya_faiz: z.coerce.number().min(0).max(100).default(0),
  catdirilma_xerci: z.coerce.number().min(0).default(0),
  diger_xerc: z.coerce.number().min(0).default(0),
  // Texniki xüsusiyyətlər
  model: z.string().max(100).optional().or(z.literal("")),
  rang: z.string().max(50).optional().or(z.literal("")),
  istehsalci: z.string().max(150).optional().or(z.literal("")),
  cheki_kg: z.coerce.number().min(0).optional().or(z.literal("")),
  hecm_m3: z.coerce.number().min(0).optional().or(z.literal("")),
  olculer: z.string().max(60).optional().or(z.literal("")),
  qutu_say: z.coerce.number().int().min(0).optional().or(z.literal("")),
  // Stok limitləri
  kritik_stok: z.coerce.number().min(0).optional(),
  min_stok: z.coerce.number().min(0).optional().or(z.literal("")),
  max_stok: z.coerce.number().min(0).optional().or(z.literal("")),
  // Zəmanət və izləmə
  zemanet_ay: z.coerce.number().int().min(0).default(0),
  serial_lazim: z.coerce.boolean().default(false),
  imei_lazim: z.coerce.boolean().default(false),
  partiya_lazim: z.coerce.boolean().default(false),
  servis_lazim: z.coerce.boolean().default(false),
  // İcazələr
  bron_icaze: z.coerce.boolean().default(true),
  rezerv_icaze: z.coerce.boolean().default(true),
  konsiq_icaze: z.coerce.boolean().default(false),
  // EDV və valyuta
  valyuta: z.string().max(3).default("AZN"),
  edv_status: z.enum(["edv_var", "edv_yox", "edv_azad"]).default("edv_var"),
  edv_daxil: z.coerce.boolean().default(false),
  yol_vergisi: z.coerce.boolean().default(false),
  // SEO / Marketing
  seo_acharlar: z.string().max(500).optional().or(z.literal("")),
  etiketsiz: z.coerce.boolean().default(false),
  aktiv: z.coerce.boolean().default(true),
});

export type ProductInput = z.input<typeof ProductSchema>;
export type ProductData = z.output<typeof ProductSchema>;

export type SaveProductCoreResult =
  | { ok: true; id: string; pending_approval?: boolean }
  | { ok: false; error: string };

/** Decimal və Date-ı JSON-safe formaya çevir. */
export function serializeForJson<T extends Record<string, unknown>>(
  o: T | null | undefined,
): Record<string, unknown> {
  if (!o) return {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(o)) {
    if (v == null) out[k] = null;
    else if (v instanceof Date) out[k] = v.toISOString();
    // Prisma Decimal (decimal.js): minified runtime-da constructor.name "Decimal"
    // DEYİL (məs. "i") — duck-typing işlədirik: toNumber() metodu olan obyekt Decimal-dir.
    else if (typeof v === "object" && typeof (v as { toNumber?: unknown }).toNumber === "function") {
      out[k] = (v as { toNumber: () => number }).toNumber();
    } else out[k] = v;
  }
  return out;
}

/**
 * Məhsul yarat/redaktə nüvə məntiqi — tenant kontekstinin AKTİV olduğunu fərz edir
 * (`requireTenant()` işləməlidir). Çağıran tərəf bunu `withTenant()` (web) və ya
 * `runWithTenant()` (mobil — `withMobile` vasitəsilə) içində işə salır.
 *
 * Qiymət gözətçisi (`canEditPrice`), avtomatik qiymət formulları, yarat/redaktə,
 * 4-eyes təsdiqi və audit logları — `saveProduct`-dakı `withTenant` daxili məntiqlə
 * eyni davranır (1:1).
 */
export async function saveProductCore(
  d: ProductData,
  opts: { canEditPrice: boolean },
): Promise<SaveProductCoreResult> {
  const { canEditPrice } = opts;
  const { sahibkarId } = requireTenant();
  try {
    const toNum = (v: unknown) => (v === "" || v == null ? null : Number(v));
    // Maya (alish_qiymeti) məhsul kartından əl ilə yazılmamalıdır.
    // Yarat zamanı 0 (default) → null (cache boşdur, ilk alışda yazılacaq).
    // Redaktə zamanı 0 → mövcud dəyər saxlanılır (aşağıda yoxlanılır).
    const data = {
      ad: d.ad.trim(),
      kod: d.kod?.trim() || null,
      barkod: d.barkod?.trim() || null,
      kateqoriya_id: d.kateqoriya_id ?? null,
      marka_id: d.marka_id ?? null,
      olcu_id: d.olcu_id ?? null,
      sekil_url: d.sekil_url || null,
      qisaca_tesvir: d.qisaca_tesvir || null,
      aciqlamaq: d.aciqlamaq || null,
      alish_qiymeti: d.alish_qiymeti && d.alish_qiymeti > 0 ? d.alish_qiymeti : null,
      satis_qiymeti: d.satis_qiymeti,
      endirimli_qiymet: toNum(d.endirimli_qiymet),
      min_satis_qiymeti: d.min_satis_qiymeti,
      topdan_qiymeti: d.topdan_qiymeti,
      partnyor_qiymeti: d.partnyor_qiymeti,
      vip_qiymeti: d.vip_qiymeti,
      komissiya_faiz: d.komissiya_faiz,
      catdirilma_xerci: d.catdirilma_xerci,
      diger_xerc: d.diger_xerc,
      model: d.model || null,
      rang: d.rang || null,
      istehsalci: d.istehsalci || null,
      cheki_kg: toNum(d.cheki_kg),
      hecm_m3: toNum(d.hecm_m3),
      olculer: d.olculer || null,
      qutu_say: toNum(d.qutu_say),
      kritik_stok: d.kritik_stok ?? null,
      min_stok: toNum(d.min_stok),
      max_stok: toNum(d.max_stok),
      zemanet_ay: d.zemanet_ay,
      serial_lazim: d.serial_lazim,
      imei_lazim: d.imei_lazim,
      partiya_lazim: d.partiya_lazim,
      servis_lazim: d.servis_lazim,
      bron_icaze: d.bron_icaze,
      rezerv_icaze: d.rezerv_icaze,
      konsiq_icaze: d.konsiq_icaze,
      valyuta: d.valyuta || "AZN",
      edv_status: d.edv_status,
      edv_daxil: d.edv_daxil,
      yol_vergisi: d.yol_vergisi,
      seo_acharlar: d.seo_acharlar || null,
      etiketsiz: d.etiketsiz,
      aktiv: d.aktiv,
    };
    // #10: qiymət icazəsi yoxdursa, redaktədə qiymət sahələri dəyişdirilə bilməz —
    // mövcud dəyərlər saxlanılır (frontend gating-i UI-dir; əsl qoruma buradadır).
    if (d.id && !canEditPrice) {
      const cur = await prisma.mehsullar.findUnique({
        where: { id: d.id },
        select: {
          satis_qiymeti: true, alish_qiymeti: true, endirimli_qiymet: true,
          min_satis_qiymeti: true, topdan_qiymeti: true, partnyor_qiymeti: true, vip_qiymeti: true,
        },
      });
      if (cur) {
        data.satis_qiymeti = Number(cur.satis_qiymeti ?? 0);
        data.alish_qiymeti = cur.alish_qiymeti != null ? Number(cur.alish_qiymeti) : null;
        data.endirimli_qiymet = cur.endirimli_qiymet != null ? Number(cur.endirimli_qiymet) : null;
        data.min_satis_qiymeti = Number(cur.min_satis_qiymeti ?? 0);
        data.topdan_qiymeti = Number(cur.topdan_qiymeti ?? 0);
        data.partnyor_qiymeti = Number(cur.partnyor_qiymeti ?? 0);
        data.vip_qiymeti = Number(cur.vip_qiymeti ?? 0);
      }
    }

    // Apply auto price formulas from qiymet_novleri (only fill empty fields)
    const { applyPriceFormulas } = await import("@/features/ayarlar/apply-price-formulas");
    const formulaResult = await applyPriceFormulas(sahibkarId, {
      alish_qiymeti: data.alish_qiymeti ?? null,
      satis_qiymeti: data.satis_qiymeti ?? null,
      topdan_qiymeti: data.topdan_qiymeti ?? null,
      vip_qiymeti: data.vip_qiymeti ?? null,
      partnyor_qiymeti: data.partnyor_qiymeti ?? null,
      endirimli_qiymet: data.endirimli_qiymet ?? null,
    });
    Object.assign(data, formulaResult);

    // 4-eyes təsdiqi: məhsul yaratma / dəyişikliyi aktivdirsə
    // — Yaratma: məhsul aktiv=false ilə yaradılır, təsdiqdən sonra aktivləşir
    // — Dəyişiklik: heç nə yazılmır, təklif edilən sahələr tesdiq_telep.detay_json-da
    //    saxlanır, təsdiqdən sonra propagateDocumentApproval onları tətbiq edir
    const needsApproval = await shouldRequireDocApproval("mehsul_yaratma");

    let id: string;
    let pendingApproval = false;

    if (d.id) {
      // ── UPDATE ────────────────────────────────────────────────
      if (needsApproval) {
        // Mövcud product-u oxu (təsdiq edən diff görsün deyə)
        const before = await prisma.mehsullar.findUnique({
          where: { id: d.id },
          select: {
            ad: true, kod: true, barkod: true, alish_qiymeti: true, satis_qiymeti: true,
            min_satis_qiymeti: true, topdan_qiymeti: true, vip_qiymeti: true,
            partnyor_qiymeti: true, endirimli_qiymet: true, kritik_stok: true,
            kateqoriya_id: true, marka_id: true, model: true, aktiv: true,
          },
        });
        id = d.id;
        await createApprovalRequest({
          emeliyyat_nov: "mehsul_yaratma",
          resurs_nov: "mehsul",
          resurs_id: id,
          basliq: `Məhsul dəyişikliyi: ${d.ad}`,
          risk_sebeb: "Məhsul kartında dəyişikliklər təsdiq tələb edir",
          detay_json: {
            tip: "update",
            before: serializeForJson(before),
            after: serializeForJson(data),
          },
        });
        pendingApproval = true;
      } else {
        // Audit üçün əvvəlki snapshot (yalnız dəyişəcək sahələr)
        const beforeForAudit = await prisma.mehsullar.findUnique({
          where: { id: d.id },
          select: {
            ad: true, kod: true, barkod: true, alish_qiymeti: true, satis_qiymeti: true,
            min_satis_qiymeti: true, topdan_qiymeti: true, vip_qiymeti: true,
            partnyor_qiymeti: true, endirimli_qiymet: true, kritik_stok: true,
            kateqoriya_id: true, marka_id: true, model: true, aktiv: true,
          },
        });
        // Redaktədə alish_qiymeti null/0 gəlibsə → mövcud dəyəri qoru.
        // Bu, məhsulu redaktə edən satıcının mayanı təsadüfən sıfırlamasının qarşısını alır.
        const updateData = { ...data };
        if (updateData.alish_qiymeti == null && beforeForAudit?.alish_qiymeti != null) {
          updateData.alish_qiymeti = beforeForAudit.alish_qiymeti as unknown as number;
        }
        const updated = await prisma.mehsullar.update({ where: { id: d.id }, data: updateData });
        id = updated.id;
        const diff = diffObjects(
          serializeForJson(beforeForAudit),
          serializeForJson(data as unknown as Record<string, unknown>),
        );
        if (diff) {
          await audit("yenile", "mehsul", id, {
            evvelki_data: diff.before,
            yeni_data: diff.after,
          });
        }

        // 📊 QİYMƏT TARİXÇƏSİ — hər qiymət növü üçün ayrıca log
        const priceFields: Array<{ key: keyof typeof data; nov: string }> = [
          { key: "satis_qiymeti",     nov: "satis" },
          { key: "topdan_qiymeti",    nov: "topdan" },
          { key: "partnyor_qiymeti",  nov: "partnyor" },
          { key: "vip_qiymeti",       nov: "vip" },
          { key: "min_satis_qiymeti", nov: "min" },
          { key: "alish_qiymeti",     nov: "alis" },
          { key: "endirimli_qiymet",  nov: "endirimli" },
        ];
        const istifadeci_id = requireTenant().istifadeciId;
        for (const pf of priceFields) {
          const evvelki = Number((beforeForAudit as Record<string, unknown>)?.[pf.key as string] ?? 0);
          const yeni = Number((data as Record<string, unknown>)[pf.key as string] ?? 0);
          if (Math.abs(yeni - evvelki) > 0.001) {
            try {
              await prisma.qiymet_tarixce.create({
                data: {
                  sahibkar_id: sahibkarId,
                  mehsul_id: id,
                  qiymet_novu: pf.nov,
                  kohne_qiymet: evvelki || null,
                  yeni_qiymet: yeni,
                  istifadeci_id: istifadeci_id,
                },
              });
            } catch (e) {
              console.warn("[qiymet_tarixce] skipped:", e);
            }
          }
        }
      }
    } else {
      // ── CREATE ────────────────────────────────────────────────
      const created = await prisma.mehsullar.create({
        data: {
          sahibkar_id: sahibkarId,
          ...data,
          // Təsdiq gözləyirsə məhsul deaktiv yaradılır — siyahıda görsənmir
          aktiv: needsApproval ? false : data.aktiv,
        },
      });
      id = created.id;
      await audit("yarat", "mehsul", id, {
        yeni_data: { ad: d.ad, kod: d.kod, barkod: d.barkod, satis_qiymeti: d.satis_qiymeti, alish_qiymeti: d.alish_qiymeti, pending_approval: needsApproval },
      });
      if (needsApproval) {
        await createApprovalRequest({
          emeliyyat_nov: "mehsul_yaratma",
          resurs_nov: "mehsul",
          resurs_id: id,
          basliq: `Yeni məhsul: ${d.ad}`,
          risk_sebeb: "Yeni məhsul kartı təsdiq tələb edir",
          detay_json: { tip: "create", after: serializeForJson(data) },
        });
        pendingApproval = true;
      }
    }

    // Granular cache invalidation — yalnız mehsul cache-i təmizlə.
    // revalidatePath("/anbar") bütün anbar route cache-ini purge edir.
    revalidateTag(`ref:${sahibkarId}:mehsullar`, "max");
    revalidateTag(`dashboard:${sahibkarId}`, "max"); // low-stock widget üçün
    if (pendingApproval) revalidatePath("/tesdiq");
    return { ok: true, id, pending_approval: pendingApproval };
  } catch (e) {
    console.error("[saveProductCore]", e);
    return { ok: false, error: safeUserMessage(e, "Məhsul yadda saxlanmadı") };
  }
}
