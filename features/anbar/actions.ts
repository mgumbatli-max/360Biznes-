"use server";

import { revalidateTag } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { auth } from "@/auth";
import { getRequestPermissions } from "@/lib/auth/get-permissions";
import { audit, diffObjects } from "@/lib/audit/log";
import { safeUserMessage } from "@/lib/error/user-message";
import { ProductSchema, saveProductCore, serializeForJson } from "./save-product-core";

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

type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | {
      ok: false;
      error: string;
      blockers?: import("@/lib/blockers/types").Blocker[];
      hint?: string;
    };
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
  // #10: qiymət dəyişikliyi ayrıca «qiymet.duzelt» icazəsi tələb edir (privileged bypass var)
  const canEditPrice = (await requireAnbarActionPerm("qiymet.duzelt")).ok;

  const parsed = ProductSchema.safeParse(raw);
  if (!parsed.success) {
    const first = Object.values(parsed.error.flatten().fieldErrors).flat()[0];
    return { ok: false, error: first ?? "Forma yanlışdır" };
  }

  return withTenant(async () => {
    const res = await saveProductCore(parsed.data, { canEditPrice });
    if (!res.ok) return { ok: false, error: res.error };
    return {
      ok: true,
      data: {
        id: res.id,
        pending_approval: res.pending_approval,
        message: res.pending_approval
          ? "Dəyişiklik təsdiqə göndərildi. Təsdiqdən sonra tətbiq olunacaq."
          : undefined,
      },
    };
  });
}

export async function deleteProduct(id: string, force?: boolean): Promise<ActionResult> {
  const permCheck = await requireAnbarActionPerm("mehsul.sil");
  if (!permCheck.ok) return { ok: false, error: permCheck.error };

  return withTenant(async () => {
    try {
      const { sahibkarId, istifadeciId } = requireTenant();
      const snapshot = await prisma.mehsullar.findUnique({
        where: { id },
        select: { ad: true, kod: true, barkod: true, satis_qiymeti: true, alish_qiymeti: true, aktiv: true },
      });
      if (!snapshot) return { ok: false, error: "Məhsul tapılmadı" };

      // 🛡️ Stok qalığı + açıq satış/alış yoxlaması — strukturlu blocker cavabı
      const stockRows = await prisma.$queryRaw<Array<{ toplam: number }>>`
        SELECT COALESCE(SUM(miqdar), 0)::float AS toplam
        FROM stok
        WHERE mehsul_id = ${id}::uuid AND sahibkar_id = ${sahibkarId}::uuid
      `;
      const toplamStok = Number(stockRows[0]?.toplam ?? 0);
      if (toplamStok > 0 && !force) {
        const { findProductBlockers } = await import("@/lib/blockers/find-product-blockers");
        const blockers = await findProductBlockers(id, sahibkarId);
        return {
          ok: false,
          error: `Bu məhsulun stok qalığı var (${toplamStok.toFixed(2)} ədəd) və ya açıq sənədləri var.`,
          blockers,
          hint: "Stoku boşaltmaq üçün aşağıdakı sənədləri açın və lazımi əməliyyatı edin. Force silmək üçün məsul şəxsdən icazə alın.",
        };
      }

      // Soft delete — STANDART pattern (deleted_at + aktiv=false)
      await prisma.mehsullar.update({
        where: { id },
        data: {
          aktiv: false,
          deleted_at: new Date(),
          deleted_by: istifadeciId,
          delete_reason: force ? "Stok qalıqlı silmə (force)" : "Standart silmə",
        },
      });
      await audit("sil", "mehsul", id, {
        evvelki_data: serializeForJson(snapshot),
        yeni_data: { stok_qaligi: toplamStok, force: !!force },
        sebeb: force ? "Force soft delete (stok qaliqi var idi)" : "Standart soft delete",
      });
      revalidateTag(`ref:${sahibkarId}:mehsullar`, "max");
      revalidateTag(`dashboard:${sahibkarId}`, "max");
      return { ok: true };
    } catch (e) {
      console.error("[deleteProduct]", e);
      return { ok: false, error: safeUserMessage(e, "Məhsul silinmədi") };
    }
  });
}

/**
 * Silinmiş məhsulu bərpa et — icazə + stok təhlükəsizliyi.
 */
export async function restoreProduct(id: string): Promise<ActionResult> {
  const { canRestoreRecords } = await import("@/lib/soft-delete/record-filter");
  const can = await canRestoreRecords();
  if (!can) return { ok: false, error: "Bərpa üçün icazə yoxdur (qeyd.berpa)" };

  return withTenant(async () => {
    try {
      const { sahibkarId, istifadeciId } = requireTenant();
      const m = await prisma.mehsullar.findUnique({
        where: { id },
        select: { ad: true, deleted_at: true },
      });
      if (!m) return { ok: false, error: "Məhsul tapılmadı" };
      if (!m.deleted_at) return { ok: false, error: "Bu məhsul silinməyib" };

      await prisma.mehsullar.update({
        where: { id },
        data: {
          aktiv: true,
          deleted_at: null,
          restored_at: new Date(),
          restored_by: istifadeciId,
        },
      });
      try {
        await audit("yenile", "mehsul", id, {
          yeni_data: { restored: true, ad: m.ad },
          sebeb: "Silinmiş məhsul bərpa olundu",
        });
      } catch { /* non-fatal */ }
      revalidateTag(`ref:${sahibkarId}:mehsullar`, "max");
      return { ok: true };
    } catch (e) {
      console.error("[restoreProduct]", e);
      return { ok: false, error: safeUserMessage(e, "Bərpa alınmadı") };
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
  // Bulk price/discount → qiymet.idare, digər → mehsul.idare
  const isPriceOp = d.op === "qiymet_faiz" || d.op === "endirim_faiz";
  const { requireAnbarActionPerm } = await import("./access-guard");
  const permCheck = await requireAnbarActionPerm(isPriceOp ? ["qiymet.idare", "mehsul.idare"] : ["mehsul.idare"]);
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  // 1000 məhsul cap
  if (d.ids.length > 1000) return { ok: false, error: "Bir dəfəyə 1000-dən çox məhsul ola bilməz" };
  return withTenant(async () => {
    try {
      // ⚠️ Tenant izolyasiyası: raw $executeRaw Prisma tenant-extension-i ÖTÜR
      // (yalnız model əməliyyatları scoped olur). Ona görə sahibkarId-i ƏVVƏL götür
      // və aşağıdakı raw UPDATE-lərə `AND sahibkar_id` əlavə et (cross-tenant yazını qarşıla).
      const { sahibkarId } = requireTenant();
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
           WHERE id = ANY(${d.ids}::uuid[]) AND sahibkar_id = ${sahibkarId}::uuid
        `;
        count = r;
      } else if (d.op === "endirim_faiz") {
        const factor = 1 - d.pct / 100;
        const r = await prisma.$executeRaw`
          UPDATE mehsullar
             SET endirimli_qiymet = ROUND(satis_qiymeti * ${factor}::numeric, 2),
                 yenilendi = NOW()
           WHERE id = ANY(${d.ids}::uuid[]) AND sahibkar_id = ${sahibkarId}::uuid
        `;
        count = r;
      } else if (d.op === "kritik_stok") {
        const r = await prisma.mehsullar.updateMany({
          where: { id: { in: d.ids } },
          data: { kritik_stok: d.kritik_stok },
        });
        count = r.count;
      }
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
      return { ok: false, error: safeUserMessage(e, "Məhsullar yenilənmədi") };
    }
  });
}

const BrandSchema = z.object({
  id: z.coerce.number().int().positive().optional(),
  ad: z.string().min(1).max(100),
  qeyd: z.string().max(2000).optional().or(z.literal("")),
  logo_url: z.preprocess(
    (v) => (typeof v === "string" ? v.trim() : v ?? ""),
    z.string().max(2000).optional().default(""),
  ),
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
      return { ok: false, error: safeUserMessage(e, "Marka yadda saxlanmadı") };
    }
  });
}

export async function deleteBrand(id: number, force?: boolean): Promise<ActionResult> {
  // QA-audit: icazə guard yox idi (deleteProduct və digər mutasiyalardan fərqli) — istənilən istifadəçi
  // marka silə bilirdi.
  const permCheck = await requireAnbarActionPerm("mehsul.duzelt");
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    try {
      const before = await prisma.markalar.findUnique({ where: { id }, select: { ad: true, aktiv: true } });
      if (!before) return { ok: false, error: "Marka tapılmadı" };

      // 🛑 Aktiv məhsulu varsa — blocker
      if (!force) {
        const { findBrandBlockers } = await import("@/lib/blockers/find-brand-blockers");
        const blockers = await findBrandBlockers(id, sahibkarId);
        if (blockers.length > 0) {
          return {
            ok: false,
            error: `${before.ad} markasında aktiv məhsullar var.`,
            blockers,
            hint: "Məhsulları başqa markaya köçürün və ya əvvəlcə arxivləyin.",
          };
        }
      }

      await prisma.markalar.update({ where: { id }, data: { aktiv: false } });
      await audit("sil", "marka", id, { evvelki_data: before as Record<string, unknown> | null, sebeb: "soft delete" });
      revalidateTag(`ref:${sahibkarId}:brands`, "max");
      return { ok: true };
    } catch (e) {
      console.error("[deleteBrand]", e);
      return { ok: false, error: safeUserMessage(e, "Marka silinmədi") };
    }
  });
}
