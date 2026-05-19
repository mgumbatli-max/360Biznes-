"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";

type ActionResult<T = unknown> = { ok: true; data?: T } | { ok: false; error: string };

async function nextCode(sahibkarId: string): Promise<string> {
  const last = await prisma.satinalma_teklif.findFirst({
    where: { sahibkar_id: sahibkarId },
    orderBy: { yaradildi: "desc" },
    select: { kod: true },
  });
  const num = last?.kod?.match(/(\d+)$/)?.[1];
  const n = num ? Number(num) + 1 : 1;
  return `SP-${String(n).padStart(5, "0")}`;
}

async function recalcTotals(teklifId: number) {
  const lines = await prisma.satinalma_teklif_satir.findMany({
    where: { teklif_id: teklifId },
    select: { miqdar: true, teklif_qiymeti: true, son_alish_qiymeti: true },
  });
  const cemi_say = lines.length;
  const cemi_meblegh = lines.reduce((s, l) => s + Number(l.miqdar) * Number(l.teklif_qiymeti ?? 0), 0);
  const cemi_maya = lines.reduce((s, l) => s + Number(l.miqdar) * Number(l.son_alish_qiymeti ?? 0), 0);
  await prisma.satinalma_teklif.update({
    where: { id: teklifId },
    data: { cemi_say, cemi_meblegh, cemi_maya, yenilendi: new Date() },
  });
}

const CreateSchema = z.object({
  ad: z.string().max(200).optional().or(z.literal("")),
  filial_id: z.coerce.number().int().positive().optional(),
  qeyd: z.string().max(2000).optional().or(z.literal("")),
});

export async function createProposal(input: FormData): Promise<ActionResult<{ id: number }>> {
  const parsed = CreateSchema.safeParse(Object.fromEntries(input.entries()));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Forma yanlışdır" };
  const d = parsed.data;
  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    if (!istifadeciId) return { ok: false, error: "Giriş tələb olunur" };
    try {
      const kod = await nextCode(sahibkarId);
      const teklif = await prisma.satinalma_teklif.create({
        data: {
          sahibkar_id: sahibkarId,
          kod,
          ad: d.ad?.trim() || null,
          filial_id: d.filial_id ?? null,
          qeyd: d.qeyd?.trim() || null,
          yaradan_id: istifadeciId,
          status: "draft",
        },
      });
      revalidatePath("/anbar/satinalma");
      return { ok: true, data: { id: teklif.id } };
    } catch (e) {
      console.error("[createProposal]", e);
      return { ok: false, error: "Yaradılmadı" };
    }
  });
}

const LineSchema = z.object({
  teklif_id: z.coerce.number().int().positive(),
  mehsul_id: z.string().uuid().optional().or(z.literal("")),
  mehsul_adi: z.string().min(1).max(300),
  mehsul_kod: z.string().max(100).optional().or(z.literal("")),
  marka: z.string().max(100).optional().or(z.literal("")),
  kateqoriya: z.string().max(100).optional().or(z.literal("")),
  vahid: z.string().max(10).default("ed"),
  miqdar: z.coerce.number().positive(),
  teyinat: z.string().max(2000).optional().or(z.literal("")),
  bazar_qiymeti: z.coerce.number().min(0).optional(),
  son_alish_qiymeti: z.coerce.number().min(0).optional(),
  teklif_qiymeti: z.coerce.number().min(0).optional(),
  satis_qiymeti: z.coerce.number().min(0).optional(),
  techizatci_id: z.string().uuid().optional().or(z.literal("")),
  techizatci_ad: z.string().max(200).optional().or(z.literal("")),
  shekil_url: z.string().max(500).optional().or(z.literal("")),
  qeyd: z.string().max(2000).optional().or(z.literal("")),
  yeni_mehsul: z.string().optional().transform((s) => s === "true"),
  servis_mehsulu: z.string().optional().transform((s) => s === "true"),
});

export async function addProposalLine(input: FormData): Promise<ActionResult> {
  const parsed = LineSchema.safeParse(Object.fromEntries(input.entries()));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Forma yanlışdır" };
  const d = parsed.data;
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    try {
      const teklif = await prisma.satinalma_teklif.findFirst({
        where: { id: d.teklif_id, sahibkar_id: sahibkarId },
      });
      if (!teklif) return { ok: false, error: "Təklif tapılmadı" };
      if (teklif.status !== "draft") return { ok: false, error: "Yalnız draft halında redaktə olunur" };

      await prisma.satinalma_teklif_satir.create({
        data: {
          teklif_id: d.teklif_id,
          mehsul_id: d.mehsul_id || null,
          mehsul_adi: d.mehsul_adi.trim(),
          mehsul_kod: d.mehsul_kod?.trim() || null,
          marka: d.marka?.trim() || null,
          kateqoriya: d.kateqoriya?.trim() || null,
          vahid: d.vahid,
          miqdar: d.miqdar,
          teyinat: d.teyinat?.trim() || null,
          bazar_qiymeti: d.bazar_qiymeti ?? null,
          son_alish_qiymeti: d.son_alish_qiymeti ?? null,
          teklif_qiymeti: d.teklif_qiymeti ?? null,
          satis_qiymeti: d.satis_qiymeti ?? null,
          techizatci_id: d.techizatci_id || null,
          techizatci_ad: d.techizatci_ad?.trim() || null,
          shekil_url: d.shekil_url?.trim() || null,
          qeyd: d.qeyd?.trim() || null,
          yeni_mehsul: d.yeni_mehsul,
          servis_mehsulu: d.servis_mehsulu,
        },
      });
      await recalcTotals(d.teklif_id);
      revalidatePath(`/satinalma/${d.teklif_id}`);
      return { ok: true };
    } catch (e) {
      console.error("[addProposalLine]", e);
      return { ok: false, error: "Əlavə olunmadı" };
    }
  });
}

const LineUpdateSchema = z.object({
  id: z.coerce.number().int().positive(),
  field: z.enum(["miqdar", "teklif_qiymeti", "satis_qiymeti", "bazar_qiymeti", "teyinat", "qeyd", "shekil_url"]),
  value: z.string(),
});

export async function updateLineField(input: FormData): Promise<ActionResult> {
  const parsed = LineUpdateSchema.safeParse(Object.fromEntries(input.entries()));
  if (!parsed.success) return { ok: false, error: "Forma yanlışdır" };
  const d = parsed.data;
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    try {
      const line = await prisma.satinalma_teklif_satir.findFirst({
        where: { id: d.id, teklif: { sahibkar_id: sahibkarId } },
        select: { teklif_id: true, teklif: { select: { status: true } } },
      });
      if (!line) return { ok: false, error: "Sətir tapılmadı" };
      if (line.teklif.status !== "draft") return { ok: false, error: "Redaktə bağlıdır" };

      const updateData: Record<string, unknown> = {};
      if (d.field === "teyinat" || d.field === "qeyd" || d.field === "shekil_url") {
        updateData[d.field] = d.value.trim() || null;
      } else {
        const num = Number(d.value);
        if (!Number.isFinite(num) || num < 0) return { ok: false, error: "Düzgün rəqəm daxil edin" };
        updateData[d.field] = num;
      }

      await prisma.satinalma_teklif_satir.update({ where: { id: d.id }, data: updateData });
      await recalcTotals(line.teklif_id);
      revalidatePath(`/satinalma/${line.teklif_id}`);
      return { ok: true };
    } catch (e) {
      console.error("[updateLineField]", e);
      return { ok: false, error: "Yenilənmədi" };
    }
  });
}

export async function deleteLine(input: FormData): Promise<ActionResult> {
  const id = Number(input.get("id"));
  if (!id) return { ok: false, error: "Id yanlışdır" };
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    try {
      const line = await prisma.satinalma_teklif_satir.findFirst({
        where: { id, teklif: { sahibkar_id: sahibkarId } },
        select: { teklif_id: true, teklif: { select: { status: true } } },
      });
      if (!line) return { ok: false, error: "Sətir tapılmadı" };
      if (line.teklif.status !== "draft") return { ok: false, error: "Redaktə bağlıdır" };
      await prisma.satinalma_teklif_satir.delete({ where: { id } });
      await recalcTotals(line.teklif_id);
      revalidatePath(`/satinalma/${line.teklif_id}`);
      return { ok: true };
    } catch (e) {
      console.error("[deleteLine]", e);
      return { ok: false, error: "Silinmədi" };
    }
  });
}

export async function sendProposal(input: FormData): Promise<ActionResult> {
  const id = Number(input.get("id"));
  if (!id) return { ok: false, error: "Id yanlışdır" };
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    try {
      const teklif = await prisma.satinalma_teklif.findFirst({
        where: { id, sahibkar_id: sahibkarId },
        include: { _count: { select: { satirlar: true } } },
      });
      if (!teklif) return { ok: false, error: "Tapılmadı" };
      if (teklif.status !== "draft") return { ok: false, error: "Artıq göndərilib" };
      if (teklif._count.satirlar === 0) return { ok: false, error: "Ən az 1 sətir əlavə edin" };
      await prisma.satinalma_teklif.update({
        where: { id },
        data: { status: "gonderildi", gonderildi_de: new Date(), yenilendi: new Date() },
      });
      revalidatePath("/anbar/satinalma");
      revalidatePath(`/satinalma/${id}`);
      return { ok: true };
    } catch (e) {
      console.error("[sendProposal]", e);
      return { ok: false, error: "Göndərilmədi" };
    }
  });
}

const DecideSchema = z.object({
  id: z.coerce.number().int().positive(),
  qerar: z.enum(["tesdiq", "redd"]),
  qeyd: z.string().max(2000).optional().or(z.literal("")),
});

export async function decideProposal(input: FormData): Promise<ActionResult> {
  const parsed = DecideSchema.safeParse(Object.fromEntries(input.entries()));
  if (!parsed.success) return { ok: false, error: "Forma yanlışdır" };
  const d = parsed.data;
  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    if (!istifadeciId) return { ok: false, error: "Giriş tələb olunur" };
    try {
      const teklif = await prisma.satinalma_teklif.findFirst({
        where: { id: d.id, sahibkar_id: sahibkarId },
      });
      if (!teklif) return { ok: false, error: "Tapılmadı" };
      if (teklif.status !== "gonderildi") return { ok: false, error: "Yalnız göndərilmiş təkliflər təsdiq olunur" };
      await prisma.satinalma_teklif.update({
        where: { id: d.id },
        data: {
          status: d.qerar,
          baxan_id: istifadeciId,
          baxan_qeyd: d.qeyd?.trim() || null,
          baxildi_de: new Date(),
          yenilendi: new Date(),
        },
      });
      revalidatePath("/anbar/satinalma");
      revalidatePath(`/satinalma/${d.id}`);
      return { ok: true };
    } catch (e) {
      console.error("[decideProposal]", e);
      return { ok: false, error: "Yenilənmədi" };
    }
  });
}

export async function deleteProposal(input: FormData): Promise<ActionResult> {
  const id = Number(input.get("id"));
  if (!id) return { ok: false, error: "Id yanlışdır" };
  return withTenant(async () => {
    const { sahibkarId, istifadeciId, rolId, icazeler } = requireTenant();
    if (!istifadeciId) return { ok: false, error: "Giriş tələb olunur" };
    try {
      const teklif = await prisma.satinalma_teklif.findFirst({
        where: { id, sahibkar_id: sahibkarId },
      });
      if (!teklif) return { ok: false, error: "Tapılmadı" };

      // Sahibkar (rol_id=9) və administrator (rol_id=1) həmişə silə bilərlər
      const isPrivileged = rolId === 1 || rolId === 9;

      // Draft: hər kəs silə bilər (icazəyə ehtiyac yoxdur)
      // Non-draft: icazə tələb olunur (lakin sahibkar/admin daima icazəlidir)
      if (teklif.status !== "draft" && !isPrivileged) {
        const hasPermission = icazeler.includes("satinalma.tesdiq_silme");
        if (!hasPermission) {
          return {
            ok: false,
            error:
              "Təsdiqlənmiş və ya rədd olunmuş təklifi silmək üçün xüsusi icazə lazımdır (ayarlar → rollar → satinalma.tesdiq_silme)",
          };
        }
      }

      await prisma.satinalma_teklif.delete({ where: { id } });
      revalidatePath("/anbar/satinalma");
      revalidatePath("/anbar/satinalma");
      return { ok: true };
    } catch (e) {
      console.error("[deleteProposal]", e);
      return { ok: false, error: "Silinmədi" };
    }
  });
}

const SuggestSchema = z.object({
  teklif_id: z.coerce.number().int().positive(),
  mehsul_id: z.string().uuid(),
  miqdar: z.coerce.number().positive(),
});

export async function addSuggestedLine(input: FormData): Promise<ActionResult> {
  const parsed = SuggestSchema.safeParse(Object.fromEntries(input.entries()));
  if (!parsed.success) return { ok: false, error: "Forma yanlışdır" };
  const d = parsed.data;
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    try {
      const teklif = await prisma.satinalma_teklif.findFirst({
        where: { id: d.teklif_id, sahibkar_id: sahibkarId },
      });
      if (!teklif) return { ok: false, error: "Təklif tapılmadı" };
      if (teklif.status !== "draft") return { ok: false, error: "Redaktə bağlıdır" };

      const mehsul = await prisma.mehsullar.findFirst({
        where: { id: d.mehsul_id, sahibkar_id: sahibkarId },
        select: {
          ad: true,
          kod: true,
          marka: true,
          alish_qiymeti: true,
          satis_qiymeti: true,
          kateqoriyalar: { select: { ad: true } },
        },
      });
      if (!mehsul) return { ok: false, error: "Məhsul tapılmadı" };

      const existing = await prisma.satinalma_teklif_satir.findFirst({
        where: { teklif_id: d.teklif_id, mehsul_id: d.mehsul_id },
      });
      if (existing) return { ok: false, error: "Bu məhsul artıq təklifdə var" };

      await prisma.satinalma_teklif_satir.create({
        data: {
          teklif_id: d.teklif_id,
          mehsul_id: d.mehsul_id,
          mehsul_adi: mehsul.ad,
          mehsul_kod: mehsul.kod,
          marka: mehsul.marka,
          kateqoriya: mehsul.kateqoriyalar?.ad ?? null,
          miqdar: d.miqdar,
          son_alish_qiymeti: mehsul.alish_qiymeti,
          teklif_qiymeti: mehsul.alish_qiymeti,
          satis_qiymeti: mehsul.satis_qiymeti,
          ai_analiz: "AI tövsiyəsi — stok azalır, satış aktivdir",
          ai_skor: 75,
        },
      });
      await recalcTotals(d.teklif_id);
      revalidatePath(`/satinalma/${d.teklif_id}`);
      return { ok: true };
    } catch (e) {
      console.error("[addSuggestedLine]", e);
      return { ok: false, error: "Əlavə olunmadı" };
    }
  });
}

/** Convert approved proposal to actual alış sənədi (purchase order) */
export async function convertProposalToPurchaseOrder(
  input: FormData
): Promise<{ ok: true; data: { sifaris_id: string; nomre: string } } | { ok: false; error: string }> {
  const id = Number(input.get("id"));
  if (!id) return { ok: false, error: "Id yanlışdır" };
  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    if (!istifadeciId) return { ok: false, error: "Giriş tələb olunur" };

    try {
      const teklif = await prisma.satinalma_teklif.findFirst({
        where: { id, sahibkar_id: sahibkarId },
        include: { satirlar: true },
      });
      if (!teklif) return { ok: false, error: "Tapılmadı" };
      if (teklif.status !== "tesdiq") return { ok: false, error: "Yalnız təsdiqlənmiş təkliflər çevrilə bilər" };

      // Use first supplier from lines (assume single supplier per proposal)
      const supplierId = teklif.satirlar.find((s) => s.techizatci_id)?.techizatci_id ?? null;

      // Find next purchase number
      const last = await prisma.alis_sifarisleri.findFirst({
        where: { sahibkar_id: sahibkarId },
        orderBy: { yaradildi: "desc" },
        select: { nomre: true },
      });
      const lastNum = last?.nomre?.match(/(\d+)$/)?.[1];
      const n = lastNum ? Number(lastNum) + 1 : 1;
      const nomre = `AS-${new Date().getFullYear()}-${String(n).padStart(5, "0")}`;

      // Get default anbar
      const anbar = await prisma.anbarlar.findFirst({
        where: { sahibkar_id: sahibkarId, aktiv: true },
        orderBy: { id: "asc" },
      });

      const order = await prisma.alis_sifarisleri.create({
        data: {
          sahibkar_id: sahibkarId,
          nomre,
          tarix: new Date(),
          techiazatci_id: supplierId,
          anbar_id: anbar?.id ?? null,
          yaradan_id: istifadeciId,
          status: "gozlemede",
          umumi_mebleg: Number(teklif.cemi_meblegh ?? 0),
          qaime_nomre: teklif.kod, // link back to proposal
        },
      });

      // Create line items
      for (const line of teklif.satirlar) {
        if (!line.mehsul_id) continue; // skip new products without catalog id
        await prisma.alis_sifaris_satirlari.create({
          data: {
            sahibkar_id: sahibkarId,
            sifaris_id: order.id,
            mehsul_id: line.mehsul_id,
            miqdar: line.miqdar,
            vahid_qiymet: Number(line.teklif_qiymeti ?? line.son_alish_qiymeti ?? 0),
          },
        });
      }

      revalidatePath("/anbar/satinalma");
      revalidatePath("/ticaret/alis");
      return { ok: true, data: { sifaris_id: order.id, nomre } };
    } catch (e) {
      console.error("[convertProposalToPurchaseOrder]", e);
      return { ok: false, error: "Çevirmə alınmadı" };
    }
  });
}

/** Bulk create proposal from a list of selected products (from planning table) */
const BulkCreateSchema = z.object({
  ad: z.string().max(200).optional().or(z.literal("")),
  qeyd: z.string().max(2000).optional().or(z.literal("")),
  grup_by_supplier: z.string().optional().transform((s) => s === "true"),
  items: z.string(), // JSON: [{mehsul_id, miqdar}]
});

export async function bulkCreateProposal(
  input: FormData
): Promise<{ ok: true; data: { ids: number[] } } | { ok: false; error: string }> {
  const parsed = BulkCreateSchema.safeParse(Object.fromEntries(input.entries()));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Forma yanlışdır" };
  const d = parsed.data;

  let items: Array<{ mehsul_id: string; miqdar: number }>;
  try {
    items = JSON.parse(d.items);
    if (!Array.isArray(items) || items.length === 0) return { ok: false, error: "Heç bir məhsul seçilməyib" };
  } catch {
    return { ok: false, error: "Məhsul siyahısı yanlışdır" };
  }

  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    if (!istifadeciId) return { ok: false, error: "Giriş tələb olunur" };

    try {
      // Fetch product details to fill the lines
      const products = await prisma.mehsullar.findMany({
        where: { id: { in: items.map((i) => i.mehsul_id) }, sahibkar_id: sahibkarId },
        select: {
          id: true,
          ad: true,
          kod: true,
          marka: true,
          tedarukci_id: true,
          alish_qiymeti: true,
          satis_qiymeti: true,
          kateqoriyalar: { select: { ad: true } },
        },
      });
      const byId = new Map(products.map((p) => [p.id, p]));

      // Group by supplier if requested
      const groups: Map<string, typeof items> = new Map();
      if (d.grup_by_supplier) {
        for (const it of items) {
          const p = byId.get(it.mehsul_id);
          const supplierId = p?.tedarukci_id ?? "__no_supplier__";
          if (!groups.has(supplierId)) groups.set(supplierId, []);
          groups.get(supplierId)!.push(it);
        }
      } else {
        groups.set("__all__", items);
      }

      const createdIds: number[] = [];

      for (const [supplierKey, groupItems] of groups.entries()) {
        const kod = await nextCode(sahibkarId);
        // Get supplier name
        let supplierName: string | null = null;
        if (supplierKey !== "__no_supplier__" && supplierKey !== "__all__") {
          const sup = await prisma.kontragentler.findFirst({
            where: { id: supplierKey, sahibkar_id: sahibkarId },
            select: { ad: true },
          });
          supplierName = sup?.ad ?? null;
        }

        const teklif = await prisma.satinalma_teklif.create({
          data: {
            sahibkar_id: sahibkarId,
            kod,
            ad: d.ad?.trim() || (supplierName ? `${supplierName} — sifariş` : `Sifariş ${kod}`),
            yaradan_id: istifadeciId,
            qeyd: d.qeyd?.trim() || null,
            status: "draft",
            ai_tovsiyye: "AI tövsiyə ilə avto-yaradıldı",
            ai_skor: 80,
          },
        });

        for (const it of groupItems) {
          const p = byId.get(it.mehsul_id);
          if (!p) continue;
          await prisma.satinalma_teklif_satir.create({
            data: {
              teklif_id: teklif.id,
              mehsul_id: p.id,
              mehsul_adi: p.ad,
              mehsul_kod: p.kod,
              marka: p.marka,
              kateqoriya: p.kateqoriyalar?.ad ?? null,
              miqdar: it.miqdar,
              son_alish_qiymeti: p.alish_qiymeti,
              teklif_qiymeti: p.alish_qiymeti,
              satis_qiymeti: p.satis_qiymeti,
              techizatci_id: supplierKey === "__no_supplier__" || supplierKey === "__all__" ? null : supplierKey,
              ai_analiz: "Planlama cədvəlindən seçilib",
              ai_skor: 80,
            },
          });
        }

        await recalcTotals(teklif.id);
        createdIds.push(teklif.id);
      }

      revalidatePath("/anbar/satinalma");
      return { ok: true, data: { ids: createdIds } };
    } catch (e) {
      console.error("[bulkCreateProposal]", e);
      return { ok: false, error: "Yaradılmadı" };
    }
  });
}

export async function uploadProposalImage(input: FormData): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const file = input.get("file");
  if (!(file instanceof Blob)) return { ok: false, error: "Fayl seçilməyib" };
  if (file.size > 5 * 1024 * 1024) return { ok: false, error: "Şəkil 5 MB-dan böyükdür" };

  const type = (file as Blob).type ?? "";
  if (!/^image\/(png|jpe?g|webp|gif)$/.test(type)) {
    return { ok: false, error: "Yalnız PNG/JPG/WebP/GIF" };
  }
  try {
    const fs = await import("fs/promises");
    const path = await import("path");
    return await withTenant(async () => {
      const { sahibkarId } = requireTenant();
      const buf = Buffer.from(await file.arrayBuffer());
      const ext = type.split("/")[1].replace("jpeg", "jpg");
      const dir = path.join(process.cwd(), "public", "uploads", "satinalma");
      await fs.mkdir(dir, { recursive: true });
      const filename = `sp-${sahibkarId}-${Date.now()}.${ext}`;
      await fs.writeFile(path.join(dir, filename), buf);
      return { ok: true as const, url: `/uploads/satinalma/${filename}` };
    });
  } catch (e) {
    console.error("[uploadProposalImage]", e);
    return { ok: false, error: "Yüklənmədi" };
  }
}
