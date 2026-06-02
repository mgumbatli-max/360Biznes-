"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { createApprovalRequest, shouldRequireDocApproval } from "@/features/tesdiq/create";
import { auth } from "@/auth";
import { getRequestPermissions } from "@/lib/auth/get-permissions";
import { audit, diffObjects } from "@/lib/audit/log";

/** Anbar üçün ortaq icazə yoxlaması (sahibkar/admin/owner default keçir). */
async function requireAnbarActionPerm(perm: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Giriş tələb olunur" };
  const rolAd = (session.user.rol_ad ?? "").toLowerCase();
  if (rolAd.includes("sahibkar") || rolAd.includes("owner") || rolAd.includes("admin")) {
    return { ok: true };
  }
  const perms = await getRequestPermissions();
  if (!perms.includes(perm)) return { ok: false, error: `Bu əməliyyat üçün «${perm}» icazəsi lazımdır` };
  return { ok: true };
}

const ProductSchema = z.object({
  id: z.string().uuid().optional(),
  // Əsas
  ad: z.string().min(2).max(200),
  kod: z.string().max(50).optional().or(z.literal("")),
  barkod: z.string().max(100).optional().or(z.literal("")),
  kateqoriya_id: z.coerce.number().int().positive().optional(),
  marka_id: z.coerce.number().int().positive().optional(),
  olcu_id: z.coerce.number().int().positive().optional(),
  // Şəkil və təsvir
  sekil_url: z.string().url().optional().or(z.literal("")),
  qisaca_tesvir: z.string().max(500).optional().or(z.literal("")),
  aciqlamaq: z.string().max(5000).optional().or(z.literal("")),
  // Qiymətlər
  alish_qiymeti: z.coerce.number().min(0).default(0),
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

type ActionResult<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };
type SaveProductData = { id: string; pending_approval?: boolean; message?: string };

export async function saveProduct(input: FormData | z.input<typeof ProductSchema>): Promise<ActionResult<SaveProductData>> {
  const raw = input instanceof FormData ? Object.fromEntries(input.entries()) : input;
  // Browser omits unchecked checkboxes from FormData — set false defaults for all boolean flags
  if (input instanceof FormData) {
    const flags = ["aktiv","serial_lazim","imei_lazim","partiya_lazim","servis_lazim","bron_icaze","rezerv_icaze","konsiq_icaze","edv_daxil","yol_vergisi","etiketsiz"];
    for (const f of flags) if (!(f in raw)) (raw as Record<string, unknown>)[f] = false;
  }
  // İcazə yoxlaması — yarat / redaktə
  const isEdit = !!(raw as { id?: string }).id;
  const permCheck = await requireAnbarActionPerm(isEdit ? "mehsul.duzelt" : "mehsul.yarat");
  if (!permCheck.ok) return { ok: false, error: permCheck.error };

  const parsed = ProductSchema.safeParse(raw);
  if (!parsed.success) {
    const first = Object.values(parsed.error.flatten().fieldErrors).flat()[0];
    return { ok: false, error: first ?? "Forma yanlışdır" };
  }
  const d = parsed.data;

  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    try {
      const toNum = (v: unknown) => (v === "" || v == null ? null : Number(v));
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
        alish_qiymeti: d.alish_qiymeti,
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
          const updated = await prisma.mehsullar.update({ where: { id: d.id }, data });
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
      return {
        ok: true,
        data: {
          id,
          pending_approval: pendingApproval,
          message: pendingApproval
            ? "Dəyişiklik təsdiqə göndərildi. Təsdiqdən sonra tətbiq olunacaq."
            : undefined,
        },
      };
    } catch (e) {
      console.error("[saveProduct]", e);
      return { ok: false, error: "Yadda saxlanmadı" };
    }
  });
}

/** Decimal və Date-ı JSON-safe formaya çevir. */
function serializeForJson<T extends Record<string, unknown>>(o: T | null | undefined): Record<string, unknown> {
  if (!o) return {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(o)) {
    if (v == null) out[k] = null;
    else if (typeof v === "object" && "toString" in v && v.constructor.name === "Decimal") out[k] = Number(v.toString());
    else if (v instanceof Date) out[k] = v.toISOString();
    else out[k] = v;
  }
  return out;
}

export async function deleteProduct(id: string): Promise<ActionResult> {
  const permCheck = await requireAnbarActionPerm("mehsul.sil");
  if (!permCheck.ok) return { ok: false, error: permCheck.error };

  return withTenant(async () => {
    try {
      const { sahibkarId } = requireTenant();
      const snapshot = await prisma.mehsullar.findUnique({
        where: { id },
        select: { ad: true, kod: true, barkod: true, satis_qiymeti: true, alish_qiymeti: true, aktiv: true },
      });
      await prisma.mehsullar.update({ where: { id }, data: { aktiv: false } });
      await audit("sil", "mehsul", id, {
        evvelki_data: serializeForJson(snapshot),
        sebeb: "soft delete (aktiv=false)",
      });
      revalidateTag(`ref:${sahibkarId}:mehsullar`, "max");
      revalidateTag(`dashboard:${sahibkarId}`, "max");
      return { ok: true };
    } catch (e) {
      console.error("[deleteProduct]", e);
      return { ok: false, error: "Silinmədi" };
    }
  });
}

/**
 * Bulk update for product list operations: soft-delete, activate/deactivate,
 * or change category/brand for many products at once. Tenant-scoped via
 * `withTenant()`, so the Prisma extension transparently filters by
 * `sahibkar_id` on every mutation.
 */
const BulkOpSchema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("sil"), ids: z.array(z.string().uuid()).min(1) }),
  z.object({ op: z.literal("aktiv"), ids: z.array(z.string().uuid()).min(1) }),
  z.object({ op: z.literal("passiv"), ids: z.array(z.string().uuid()).min(1) }),
  z.object({
    op: z.literal("kateqoriya"),
    ids: z.array(z.string().uuid()).min(1),
    kateqoriya_id: z.coerce.number().int().positive(),
  }),
  z.object({
    op: z.literal("marka"),
    ids: z.array(z.string().uuid()).min(1),
    marka_id: z.coerce.number().int().positive(),
  }),
  // Faiz ilə qiymət dəyişimi: bütün seçilmiş məhsullarda satis_qiymeti × (1 + pct/100)
  // negative pct = endirim. ±50% məhdudiyyəti — yanlışlıqla 10x etmək olmasın.
  z.object({
    op: z.literal("qiymet_faiz"),
    ids: z.array(z.string().uuid()).min(1),
    pct: z.coerce.number().min(-50).max(50),
  }),
  // Endirimli qiymət təyin et (faizlə): endirimli_qiymet = satis_qiymeti × (1 - pct/100)
  z.object({
    op: z.literal("endirim_faiz"),
    ids: z.array(z.string().uuid()).min(1),
    pct: z.coerce.number().min(0).max(90),
  }),
  // Kritik stok səviyyəsi
  z.object({
    op: z.literal("kritik_stok"),
    ids: z.array(z.string().uuid()).min(1),
    kritik_stok: z.coerce.number().int().min(0).max(99999),
  }),
]);

export async function bulkUpdateProducts(
  input: z.input<typeof BulkOpSchema>,
): Promise<ActionResult<{ count: number }>> {
  const parsed = BulkOpSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Forma yanlışdır" };
  const d = parsed.data;
  return withTenant(async () => {
    try {
      let count = 0;
      if (d.op === "sil" || d.op === "passiv") {
        const r = await prisma.mehsullar.updateMany({
          where: { id: { in: d.ids } },
          data: { aktiv: false },
        });
        count = r.count;
      } else if (d.op === "aktiv") {
        const r = await prisma.mehsullar.updateMany({
          where: { id: { in: d.ids } },
          data: { aktiv: true },
        });
        count = r.count;
      } else if (d.op === "kateqoriya") {
        const r = await prisma.mehsullar.updateMany({
          where: { id: { in: d.ids } },
          data: { kateqoriya_id: d.kateqoriya_id },
        });
        count = r.count;
      } else if (d.op === "marka") {
        const r = await prisma.mehsullar.updateMany({
          where: { id: { in: d.ids } },
          data: { marka_id: d.marka_id },
        });
        count = r.count;
      } else if (d.op === "qiymet_faiz") {
        // Multiplikator faktorla satis_qiymeti yenilə (raw SQL — Prisma column math etmir)
        const factor = 1 + d.pct / 100;
        const r = await prisma.$executeRaw`
          UPDATE mehsullar
             SET satis_qiymeti = ROUND(satis_qiymeti * ${factor}::numeric, 2),
                 yenilendi = NOW()
           WHERE id = ANY(${d.ids}::uuid[])
        `;
        count = r;
      } else if (d.op === "endirim_faiz") {
        const factor = 1 - d.pct / 100;
        const r = await prisma.$executeRaw`
          UPDATE mehsullar
             SET endirimli_qiymet = ROUND(satis_qiymeti * ${factor}::numeric, 2),
                 yenilendi = NOW()
           WHERE id = ANY(${d.ids}::uuid[])
        `;
        count = r;
      } else if (d.op === "kritik_stok") {
        const r = await prisma.mehsullar.updateMany({
          where: { id: { in: d.ids } },
          data: { kritik_stok: d.kritik_stok },
        });
        count = r.count;
      }
      const { sahibkarId } = requireTenant();
      // Bulk operasiya — hər ID üçün ayrıca audit log yazırıq ki, hər
      // məhsulun history-si gəzilərkən bu kütləvi dəyişiklik də görünsün.
      // Resurs_id-ləri yaymaq əvəzinə bir "bulk" log + N "yenile" log yazırıq.
      await audit("yenile", "mehsul_bulk", null, {
        yeni_data: { op: d.op, ids_count: d.ids.length, payload: { ...d, ids: undefined } as unknown as Record<string, unknown> },
        sebeb: `Kütləvi əməliyyat: ${d.op}`,
      });
      for (const id of d.ids) {
        await audit("yenile", "mehsul", id, {
          yeni_data: { bulk_op: d.op },
        });
      }
      revalidateTag(`ref:${sahibkarId}:mehsullar`, "max");
      revalidateTag(`dashboard:${sahibkarId}`, "max");
      revalidateTag(`stok:${sahibkarId}`, "max");
      return { ok: true, data: { count } };
    } catch (e) {
      console.error("[bulkUpdateProducts]", e);
      return { ok: false, error: "Yenilənmədi" };
    }
  });
}

const BrandSchema = z.object({
  id: z.coerce.number().int().positive().optional(),
  ad: z.string().min(1).max(100),
  qeyd: z.string().max(2000).optional().or(z.literal("")),
  logo_url: z.string().url().optional().or(z.literal("")),
  aktiv: z.coerce.boolean().default(true),
});

export async function saveBrand(input: FormData): Promise<ActionResult<{ id: number }>> {
  const raw = Object.fromEntries(input.entries());
  // Coerce missing checkbox to false
  if (!("aktiv" in raw)) (raw as Record<string, unknown>).aktiv = false;
  const parsed = BrandSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Forma yanlışdır" };
  const d = parsed.data;

  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    try {
      const data = {
        ad: d.ad.trim(),
        qeyd: d.qeyd || null,
        logo_url: d.logo_url || null,
        aktiv: d.aktiv,
      };
      let id: number;
      if (d.id) {
        const before = await prisma.markalar.findUnique({ where: { id: d.id }, select: { ad: true, aktiv: true, qeyd: true } });
        const updated = await prisma.markalar.update({ where: { id: d.id }, data });
        id = updated.id;
        const diff = diffObjects(before as Record<string, unknown> | null, data as Record<string, unknown>);
        if (diff) await audit("yenile", "marka", id, { evvelki_data: diff.before, yeni_data: diff.after });
      } else {
        const created = await prisma.markalar.create({ data: { sahibkar_id: sahibkarId, ...data } });
        id = created.id;
        await audit("yarat", "marka", id, { yeni_data: { ad: d.ad } });
      }
      revalidateTag(`ref:${sahibkarId}:brands`, "max");
      return { ok: true, data: { id } };
    } catch (e) {
      console.error("[saveBrand]", e);
      return { ok: false, error: "Yadda saxlanmadı" };
    }
  });
}

export async function deleteBrand(id: number): Promise<ActionResult> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    try {
      const before = await prisma.markalar.findUnique({ where: { id }, select: { ad: true, aktiv: true } });
      await prisma.markalar.update({ where: { id }, data: { aktiv: false } });
      await audit("sil", "marka", id, { evvelki_data: before as Record<string, unknown> | null, sebeb: "soft delete" });
      revalidateTag(`ref:${sahibkarId}:brands`, "max");
      return { ok: true };
    } catch (e) {
      console.error("[deleteBrand]", e);
      return { ok: false, error: "Silinmədi" };
    }
  });
}
