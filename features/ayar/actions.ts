"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { audit } from "@/lib/audit/log";

// Form data only has strings; `z.coerce.boolean()` treats "false" as true
// (any non-empty string is truthy). Use this helper instead for live toggles.
const boolFromForm = z.string().transform((s) => s === "true" || s === "1");

const CompanySchema = z.object({
  ad: z.string().min(2).max(150),
  email: z.string().email().max(150).optional().or(z.literal("")),
  voen: z.string().max(20).optional().or(z.literal("")),
  telefon: z.string().max(30).optional().or(z.literal("")),
  unvan: z.string().max(500).optional().or(z.literal("")),
  seher: z.string().max(80).optional().or(z.literal("")),
  domen: z.string().max(100).optional().or(z.literal("")),
  brend_rengi: z.string().max(20).optional().or(z.literal("")),
  brend_tonu: z.string().max(20).optional().or(z.literal("")),
  loqo_url: z.string().max(500).optional().or(z.literal("")),
  biznes_novu: z.string().max(50).optional().or(z.literal("")),
});

type ActionResult = { ok: true } | { ok: false; error: string };

export async function saveCompany(input: FormData): Promise<ActionResult> {
  const parsed = CompanySchema.safeParse(Object.fromEntries(input.entries()));
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Forma yanlışdır";
    return { ok: false, error: msg };
  }
  const d = parsed.data;
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    try {
      await prisma.sahibkarlar.update({
        where: { id: sahibkarId },
        data: {
          ad: d.ad.trim(),
          email: d.email?.trim() || undefined,
          voen: d.voen?.trim() || null,
          telefon: d.telefon?.trim() || null,
          unvan: d.unvan?.trim() || null,
          seh_r: d.seher?.trim() || null,
          domen: d.domen?.trim() || null,
          brend_rengi: d.brend_rengi?.trim() || null,
          brend_tonu: d.brend_tonu?.trim() || null,
          loqo_url: d.loqo_url?.trim() || null,
          biznes_novu: d.biznes_novu?.trim() || null,
        },
      });
      revalidatePath("/ayarlar/kompaniya");
      revalidatePath("/ayarlar");
      return { ok: true };
    } catch (e) {
      console.error("[saveCompany]", e);
      return { ok: false, error: "Yadda saxlanmadı" };
    }
  });
}

export async function uploadCompanyLogo(input: FormData): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const file = input.get("logo");
  if (!(file instanceof Blob)) return { ok: false, error: "Fayl seçilməyib" };
  if (file.size > 2 * 1024 * 1024) return { ok: false, error: "Logo 2 MB-dan böyükdür" };

  const type = "type" in file ? (file as Blob).type : "";
  if (!/^image\/(png|jpe?g|webp|gif|svg\+xml)$/.test(type)) {
    return { ok: false, error: "Yalnız PNG / JPG / WebP / GIF / SVG" };
  }

  try {
    const fs = await import("fs/promises");
    const path = await import("path");
    return await withTenant(async () => {
      const { sahibkarId } = requireTenant();
      const buf = Buffer.from(await file.arrayBuffer());
      const ext = type.split("/")[1].replace("svg+xml", "svg").replace("jpeg", "jpg");
      const dir = path.join(process.cwd(), "public", "uploads", "logos");
      await fs.mkdir(dir, { recursive: true });
      const filename = `logo-${sahibkarId}-${Date.now()}.${ext}`;
      const filePath = path.join(dir, filename);
      await fs.writeFile(filePath, buf);
      const url = `/uploads/logos/${filename}`;
      await prisma.sahibkarlar.update({ where: { id: sahibkarId }, data: { loqo_url: url } });
      revalidatePath("/ayarlar/kompaniya");
      revalidatePath("/ayarlar");
      return { ok: true as const, url };
    });
  } catch (e) {
    console.error("[uploadCompanyLogo]", e);
    return { ok: false, error: "Yüklənmədi" };
  }
}

const PasswordSchema = z
  .object({
    kohne: z.string().min(6),
    yeni: z.string().min(6).max(100),
    yeni_tekrar: z.string(),
  })
  .refine((d) => d.yeni === d.yeni_tekrar, { message: "Şifrələr uyğun gəlmir", path: ["yeni_tekrar"] });

export async function changePassword(input: FormData): Promise<ActionResult> {
  const parsed = PasswordSchema.safeParse(Object.fromEntries(input.entries()));
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Forma yanlışdır" };
  }
  return withTenant(async () => {
    const { istifadeciId } = requireTenant();
    const user = await prisma.istifadeciler.findUnique({ where: { id: istifadeciId } });
    if (!user) return { ok: false, error: "İstifadəçi tapılmadı" };
    const ok = await verifyPassword(parsed.data.kohne, user.sifre_hash);
    if (!ok) return { ok: false, error: "Köhnə şifrə səhvdir" };
    const newHash = await hashPassword(parsed.data.yeni);
    await prisma.istifadeciler.update({
      where: { id: istifadeciId },
      data: { sifre_hash: newHash, yenilendi: new Date() },
    });
    await audit("yenile", "istifadeci_sifre", istifadeciId, {
      sebeb: "İstifadəçi öz şifrəsini dəyişdi",
    });
    return { ok: true };
  });
}

const RolePermsSchema = z.object({
  rol_id: z.coerce.number().int().positive(),
  icaze_ids: z.string().optional(),
});

export async function saveRolePerms(input: FormData): Promise<ActionResult> {
  const parsed = RolePermsSchema.safeParse(Object.fromEntries(input.entries()));
  if (!parsed.success) return { ok: false, error: "Forma yanlışdır" };
  const rolId = parsed.data.rol_id;
  const ids = (parsed.data.icaze_ids ?? "")
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);

  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    try {
      // Multi-tenant: yalnız sahibkarın ÖZ rolu redaktə oluna bilər.
      // Sistem rolları (template kataloqu) artıq UI-də görünmür və daxili də olsa,
      // sahibkara aid olmadığı üçün burada əlçatmaz qalır.
      const rol = await prisma.roles.findFirst({
        where: { id: rolId, sahibkar_id: sahibkarId, sistem: false },
      });
      if (!rol) return { ok: false, error: "Rol tapılmadı və ya icazəniz çatmır" };

      // Audit üçün əvvəlki icazələri çək
      const prevPerms = await prisma.rol_icazeleri.findMany({
        where: { rol_id: rolId },
        select: { icaze_id: true },
      });
      const prevIds = prevPerms.map((p) => p.icaze_id);

      await prisma.$transaction([
        prisma.rol_icazeleri.deleteMany({ where: { rol_id: rolId } }),
        prisma.rol_icazeleri.createMany({
          data: ids.map((icazeId) => ({ rol_id: rolId, icaze_id: icazeId })),
          skipDuplicates: true,
        }),
      ]);
      await audit("icaze_dəyişdir", "rol", rolId, {
        evvelki_data: { icaze_ids: prevIds.sort((a, b) => a - b), count: prevIds.length },
        yeni_data: {
          icaze_ids: ids.sort((a, b) => a - b),
          count: ids.length,
          added: ids.filter((i) => !prevIds.includes(i)),
          removed: prevIds.filter((i) => !ids.includes(i)),
        },
        sebeb: `Rol icazələri yeniləndi (${rol.ad})`,
      });
      // Permissions per role 300s cache-də saxlanır — invalidate et ki, bu rol
      // sahibi olan istifadəçilər dərhal yeni icazə paketi ilə yenilənsinlər.
      // Next 16: revalidateTag iki arqument istəyir — "max" = stale-while-revalidate.
      revalidateTag(`role-perms:${rolId}`, "max");
      revalidatePath("/ayarlar/rollar");
      revalidatePath(`/ayarlar/rollar/${rolId}`);
      return { ok: true };
    } catch (e) {
      console.error("[saveRolePerms]", e);
      return { ok: false, error: "Yadda saxlanmadı" };
    }
  });
}

const RoleSchema = z.object({
  id: z.coerce.number().int().positive().optional(),
  ad: z.string().min(2).max(50),
  aciqlamaq: z.string().max(500).optional().or(z.literal("")),
  reng: z.string().max(20).optional().or(z.literal("")),
});

export async function saveRole(
  input: FormData,
): Promise<{ ok: true; id: number } | { ok: false; error: string }> {
  const parsed = RoleSchema.safeParse(Object.fromEntries(input.entries()));
  if (!parsed.success) return { ok: false, error: "Forma yanlışdır" };
  const d = parsed.data;
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    try {
      const data = {
        ad: d.ad.trim(),
        aciqlamaq: d.aciqlamaq?.trim() || null,
        reng: d.reng?.trim() || null,
      };
      let resultId: number;
      if (d.id) {
        // Yalnız sahibkarın öz rolu redaktə oluna bilər
        const existing = await prisma.roles.findFirst({
          where: { id: d.id, sahibkar_id: sahibkarId, sistem: false },
        });
        if (!existing) return { ok: false, error: "Rol tapılmadı və ya icazəniz çatmır" };
        const updated = await prisma.roles.update({ where: { id: d.id }, data });
        resultId = updated.id;
        await audit("yenile", "rol", resultId, {
          evvelki_data: { ad: existing.ad, aciqlamaq: existing.aciqlamaq, reng: existing.reng },
          yeni_data: data,
          sebeb: "Rol məlumatları yeniləndi",
        });
      } else {
        // Boş rol yaradılanda heç bir icazə yoxdur — istifadəçi detal səhifəsinə
        // yönləndirilir ki, dərhal icazələri seçə bilsin.
        const created = await prisma.roles.create({
          data: { ...data, sahibkar_id: sahibkarId, sistem: false },
        });
        resultId = created.id;
        await audit("yarat", "rol", resultId, {
          yeni_data: data,
          sebeb: "Yeni rol yaradıldı",
        });
      }
      revalidatePath("/ayarlar/rollar");
      return { ok: true, id: resultId };
    } catch (e) {
      console.error("[saveRole]", e);
      return { ok: false, error: "Yadda saxlanmadı" };
    }
  });
}

const RoleTemplateSchema = z.object({
  template: z.enum(["satici", "anbardar", "kassir", "menecer", "muhasib", "kuryer"]),
});

// Permission code patterns per template — uses icaze.kod matching.
// Hər şablon ROL TİPİNƏ UYĞUN dashboard.* alt-icazələri də avtomatik daxil edir,
// belə ki, "Kassir (custom)" rolu yaradıldıqdan sonra kassir əməkdaş dashboard-u
// boş tapmayacaq — öz iş axını üçün uyğun bölmələri görəcək.
const TEMPLATE_PERMISSIONS: Record<string, RegExp[]> = {
  satici: [
    /^satis\./, /^musteri\.view/, /^musteri\.create/, /^mehsul\.view/, /^stok\.view/,
    /^kassa\./, /^qaytarma\.view/, /^qaytarma\.create/,
    /^dashboard\.(oxu|aktivlik|tapshiriq|insight|alerts)$/,
  ],
  anbardar: [
    /^anbar\./, /^stok\./, /^mehsul\./, /^transfer\./, /^inventar\./,
    /^alis\.view/, /^alis\.qebul/, /^serial\./,
    /^dashboard\.(oxu|stok|tapshiriq|alerts|insight|sync)$/,
  ],
  kassir: [
    /^kassa\./, /^satis\./, /^odenis\./, /^cek\./, /^vergi\.cek/, /^musteri\.view/,
    /^dashboard\.(oxu|aktivlik|insight|tapshiriq)$/,
  ],
  menecer: [
    /^satis\./, /^alis\./, /^musteri\./, /^anbar\.view/, /^stok\.view/, /^hesabat\./,
    /^kpi\./, /^endirim\./, /^tesdiq\./, /^kontragent\./,
    /^dashboard\.(oxu|insight|kpi|cashflow|tapshiriq|aktivlik|alerts|charts|top5|feed)$/,
  ],
  muhasib: [
    /^maliyye\./, /^hesab\./, /^xerc\./, /^odenis\./, /^bank\./, /^qaime\./,
    /^hesabat\./, /^vergi\./, /^borc\./,
    /^dashboard\.(oxu|insight|kpi|cashflow|charts|alerts)$/,
  ],
  kuryer: [
    /^catdirma\./, /^satis\.view/, /^musteri\.view/, /^xerite\./,
    /^dashboard\.(oxu|tapshiriq|insight)$/,
  ],
};

export async function createRoleFromTemplate(
  input: FormData,
): Promise<{ ok: true; id: number } | { ok: false; error: string }> {
  const parsed = RoleTemplateSchema.safeParse(Object.fromEntries(input.entries()));
  if (!parsed.success) return { ok: false, error: "Şablon yanlışdır" };

  const { template } = parsed.data;
  const TEMPLATE_META: Record<string, { ad: string; aciqlamaq: string; reng: string }> = {
    satici: { ad: "Satıcı (custom)", aciqlamaq: "Satış əməliyyatları, müştəri yaratma, kassa", reng: "#10B981" },
    anbardar: { ad: "Anbardar (custom)", aciqlamaq: "Anbar, stok, transfer, inventar, sayım", reng: "#F59E0B" },
    kassir: { ad: "Kassir (custom)", aciqlamaq: "Yalnız kassa əməliyyatları və ödəniş qəbulu", reng: "#06B6D4" },
    menecer: { ad: "Menecer (custom)", aciqlamaq: "Tam satış+alış+hesabat, KPI, təsdiq", reng: "#6366F1" },
    muhasib: { ad: "Mühasib (custom)", aciqlamaq: "Maliyyə, hesabat, vergi, bank, borc", reng: "#8B5CF6" },
    kuryer: { ad: "Kuryer (custom)", aciqlamaq: "Çatdırma, xəritə, satış görmə", reng: "#EC4899" },
  };

  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    try {
      const meta = TEMPLATE_META[template];
      const patterns = TEMPLATE_PERMISSIONS[template];
      const allPerms = await prisma.icazeler.findMany();
      const matchedIds = allPerms
        .filter((p) => p.kod && patterns.some((rx) => rx.test(p.kod)))
        .map((p) => p.id);

      const rol = await prisma.roles.create({
        data: {
          sahibkar_id: sahibkarId,
          ad: meta.ad,
          aciqlamaq: meta.aciqlamaq,
          reng: meta.reng,
          sistem: false,
        },
      });

      if (matchedIds.length > 0) {
        await prisma.rol_icazeleri.createMany({
          data: matchedIds.map((icazeId) => ({ rol_id: rol.id, icaze_id: icazeId })),
          skipDuplicates: true,
        });
      }

      revalidatePath("/ayarlar/rollar");
      return { ok: true, id: rol.id };
    } catch (e) {
      console.error("[createRoleFromTemplate]", e);
      return { ok: false, error: "Şablondan yaradılmadı" };
    }
  });
}

const RoleCloneSchema = z.object({
  source_id: z.coerce.number().int().positive(),
  ad: z.string().min(2).max(50),
});

export async function cloneRole(
  input: FormData,
): Promise<{ ok: true; id: number } | { ok: false; error: string }> {
  const parsed = RoleCloneSchema.safeParse(Object.fromEntries(input.entries()));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Forma yanlışdır" };
  const d = parsed.data;
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    try {
      const source = await prisma.roles.findFirst({
        where: { id: d.source_id, OR: [{ sahibkar_id: sahibkarId }, { sistem: true }] },
        include: { rol_icazeleri: { select: { icaze_id: true } } },
      });
      if (!source) return { ok: false, error: "Mənbə rol tapılmadı" };

      const newRol = await prisma.roles.create({
        data: {
          sahibkar_id: sahibkarId,
          ad: d.ad.trim(),
          aciqlamaq: `«${source.ad}» rolunun surəti`,
          reng: source.reng,
          sistem: false,
        },
      });
      if (source.rol_icazeleri.length > 0) {
        await prisma.rol_icazeleri.createMany({
          data: source.rol_icazeleri.map((r) => ({ rol_id: newRol.id, icaze_id: r.icaze_id })),
          skipDuplicates: true,
        });
      }
      revalidatePath("/ayarlar/rollar");
      return { ok: true, id: newRol.id };
    } catch (e) {
      console.error("[cloneRole]", e);
      return { ok: false, error: "Klonlanmadı" };
    }
  });
}

export async function deleteRole(formData: FormData): Promise<ActionResult> {
  const id = Number(formData.get("id"));
  if (!id) return { ok: false, error: "Id yanlışdır" };
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    try {
      const existing = await prisma.roles.findFirst({
        where: { id, sahibkar_id: sahibkarId, sistem: false },
      });
      if (!existing) return { ok: false, error: "Rol tapılmadı və ya icazəniz çatmır" };
      const userCount = await prisma.istifadeciler.count({ where: { rol_id: id } });
      if (userCount > 0) return { ok: false, error: `Bu rolda ${userCount} istifadəçi var — əvvəlcə onları başqa rola köçür` };
      await prisma.roles.delete({ where: { id } });
      revalidatePath("/ayarlar/rollar");
      return { ok: true };
    } catch (e) {
      console.error("[deleteRole]", e);
      return { ok: false, error: "Silinmədi" };
    }
  });
}

const FilialSchema = z.object({
  id: z.coerce.number().int().positive().optional(),
  ad: z.string().min(2).max(100),
  kod: z.string().max(20).optional().or(z.literal("")),
  tip: z.string().max(30).optional().or(z.literal("")),
  unvan: z.string().max(500).optional().or(z.literal("")),
  telefon: z.string().max(20).optional().or(z.literal("")),
  seher: z.string().max(80).optional().or(z.literal("")),
  rayon: z.string().max(80).optional().or(z.literal("")),
  cavabdeh_id: z.string().uuid().optional().or(z.literal("")),
  ish_baslangic: z.string().max(8).optional().or(z.literal("")),
  ish_son: z.string().max(8).optional().or(z.literal("")),
  qeyd: z.string().max(2000).optional().or(z.literal("")),
  aktiv: z.coerce.boolean().default(true),
});

function timeStringToDate(s: string | undefined | null): Date | null {
  if (!s) return null;
  const m = s.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const d = new Date("1970-01-01T00:00:00Z");
  d.setUTCHours(Number(m[1]), Number(m[2]));
  return d;
}

export async function saveFilial(input: FormData): Promise<ActionResult> {
  const parsed = FilialSchema.safeParse(Object.fromEntries(input.entries()));
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Forma yanlışdır" };
  }
  const d = parsed.data;
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    try {
      const data = {
        ad: d.ad.trim(),
        kod: d.kod?.trim() || null,
        tip: d.tip?.trim() || "magaza",
        unvan: d.unvan?.trim() || null,
        telefon: d.telefon?.trim() || null,
        seh_r: d.seher?.trim() || null,
        rayon: d.rayon?.trim() || null,
        cavabdeh_id: d.cavabdeh_id?.trim() || null,
        ish_saat_baslangic: timeStringToDate(d.ish_baslangic),
        ish_saat_son: timeStringToDate(d.ish_son),
        qeyd: d.qeyd?.trim() || null,
        aktiv: d.aktiv,
      };
      if (d.id) {
        await prisma.filiallar.update({ where: { id: d.id }, data });
      } else {
        await prisma.filiallar.create({ data: { sahibkar_id: sahibkarId, ...data } });
      }
      revalidatePath("/ayarlar/filiallar");
      revalidatePath("/ayarlar");
      return { ok: true };
    } catch (e) {
      console.error("[saveFilial]", e);
      if (e instanceof Error && e.message.includes("Unique")) {
        return { ok: false, error: "Bu filial adı artıq istifadədədir" };
      }
      return { ok: false, error: "Yadda saxlanmadı" };
    }
  });
}

export async function deleteFilial(input: FormData): Promise<ActionResult> {
  const id = Number(input.get("id"));
  if (!id) return { ok: false, error: "Id yanlışdır" };
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    try {
      const f = await prisma.filiallar.findFirst({
        where: { id, sahibkar_id: sahibkarId },
        include: { _count: { select: { anbarlar: true, kassalar: true } } },
      });
      if (!f) return { ok: false, error: "Filial tapılmadı" };
      if (f._count.anbarlar > 0) return { ok: false, error: `Filialın ${f._count.anbarlar} anbarı var — əvvəl onları başqa filiala köçürün` };
      await prisma.filiallar.delete({ where: { id } });
      revalidatePath("/ayarlar/filiallar");
      return { ok: true };
    } catch (e) {
      console.error("[deleteFilial]", e);
      return { ok: false, error: "Silinmədi" };
    }
  });
}

const IsolationSchema = z.object({
  filial_id: z.coerce.number().int().positive(),
  field: z.enum(["izole", "qiymet_independent", "aktiv"]),
  value: boolFromForm,
});

export async function saveFilialIsolation(input: FormData): Promise<ActionResult> {
  const parsed = IsolationSchema.safeParse(Object.fromEntries(input.entries()));
  if (!parsed.success) return { ok: false, error: "Forma yanlışdır" };
  const d = parsed.data;
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    try {
      const f = await prisma.filiallar.findFirst({
        where: { id: d.filial_id, sahibkar_id: sahibkarId },
      });
      if (!f) return { ok: false, error: "Filial tapılmadı" };
      await prisma.filiallar.update({
        where: { id: d.filial_id },
        data: { [d.field]: d.value },
      });
      revalidatePath("/ayarlar/filiallar");
      revalidatePath("/ayarlar");
      return { ok: true };
    } catch (e) {
      console.error("[saveFilialIsolation]", e);
      return { ok: false, error: "Yadda saxlanmadı" };
    }
  });
}

// === FILIAL CROSS-VISIBILITY ===

const GorunushFieldSchema = z.enum([
  "kassa_gor",
  "anbar_gor",
  "stok_gor",
  "musteri_gor",
  "techizatci_gor",
  "borc_gor",
  "mehsul_gor",
  "satis_gor",
  "alis_gor",
  "emekdas_gor",
  "hesabat_gor",
  "servis_gor",
]);

const GorunushToggleSchema = z.object({
  source_filial_id: z.coerce.number().int().positive(),
  target_filial_id: z.coerce.number().int().positive(),
  field: GorunushFieldSchema,
  value: boolFromForm,
});

export async function toggleFilialGorunush(input: FormData): Promise<ActionResult> {
  const parsed = GorunushToggleSchema.safeParse(Object.fromEntries(input.entries()));
  if (!parsed.success) return { ok: false, error: "Forma yanlışdır" };
  const d = parsed.data;
  if (d.source_filial_id === d.target_filial_id) {
    return { ok: false, error: "Eyni filial özünə görünüş qura bilməz" };
  }
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    try {
      const [source, target] = await Promise.all([
        prisma.filiallar.findFirst({ where: { id: d.source_filial_id, sahibkar_id: sahibkarId } }),
        prisma.filiallar.findFirst({ where: { id: d.target_filial_id, sahibkar_id: sahibkarId } }),
      ]);
      if (!source || !target) return { ok: false, error: "Filial tapılmadı" };

      await prisma.filial_gorunush.upsert({
        where: {
          source_filial_id_target_filial_id: {
            source_filial_id: d.source_filial_id,
            target_filial_id: d.target_filial_id,
          },
        },
        create: {
          sahibkar_id: sahibkarId,
          source_filial_id: d.source_filial_id,
          target_filial_id: d.target_filial_id,
          [d.field]: d.value,
        },
        update: { [d.field]: d.value, yenilendi: new Date() },
      });
      revalidatePath("/ayarlar/filiallar");
      return { ok: true };
    } catch (e) {
      console.error("[toggleFilialGorunush]", e);
      return { ok: false, error: "Yenilənmədi" };
    }
  });
}

const GorunushBulkSchema = z.object({
  source_filial_id: z.coerce.number().int().positive(),
  target_filial_id: z.coerce.number().int().positive(),
  mode: z.enum(["all", "none", "view-only"]), // view-only = read-only fields (no modify)
});

const ALL_GORUNUSH_FIELDS = [
  "kassa_gor",
  "anbar_gor",
  "stok_gor",
  "musteri_gor",
  "techizatci_gor",
  "borc_gor",
  "mehsul_gor",
  "satis_gor",
  "alis_gor",
  "emekdas_gor",
  "hesabat_gor",
  "servis_gor",
] as const;

const VIEW_ONLY_FIELDS = [
  "anbar_gor",
  "stok_gor",
  "musteri_gor",
  "techizatci_gor",
  "mehsul_gor",
  "hesabat_gor",
] as const;

export async function bulkSetFilialGorunush(input: FormData): Promise<ActionResult> {
  const parsed = GorunushBulkSchema.safeParse(Object.fromEntries(input.entries()));
  if (!parsed.success) return { ok: false, error: "Forma yanlışdır" };
  const d = parsed.data;
  if (d.source_filial_id === d.target_filial_id) {
    return { ok: false, error: "Eyni filial üçün tətbiq olmaz" };
  }
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    try {
      const allowed = new Set<string>(
        d.mode === "all"
          ? ALL_GORUNUSH_FIELDS
          : d.mode === "view-only"
          ? VIEW_ONLY_FIELDS
          : []
      );

      const data: Record<string, boolean> = {};
      for (const f of ALL_GORUNUSH_FIELDS) data[f] = allowed.has(f);

      await prisma.filial_gorunush.upsert({
        where: {
          source_filial_id_target_filial_id: {
            source_filial_id: d.source_filial_id,
            target_filial_id: d.target_filial_id,
          },
        },
        create: {
          sahibkar_id: sahibkarId,
          source_filial_id: d.source_filial_id,
          target_filial_id: d.target_filial_id,
          ...data,
        },
        update: { ...data, yenilendi: new Date() },
      });
      revalidatePath("/ayarlar/filiallar");
      return { ok: true };
    } catch (e) {
      console.error("[bulkSetFilialGorunush]", e);
      return { ok: false, error: "Yenilənmədi" };
    }
  });
}

const PermSchema = z.object({
  filial_id: z.coerce.number().int().positive(),
  istifadeci_id: z.string().uuid(),
  field: z.enum([
    "bax_biler",
    "satish_biler",
    "alish_biler",
    "kassa_biler",
    "xerc_biler",
    "transfer_biler",
    "stok_biler",
    "stok_dey_biler",
    "qiymet_biler",
    "musteri_biler",
    "techizatci_biler",
    "hesabat_biler",
    "gizli_alish_biler",
    "esas",
  ]),
  value: boolFromForm,
});

export async function saveFilialUserPerm(input: FormData): Promise<ActionResult> {
  const parsed = PermSchema.safeParse(Object.fromEntries(input.entries()));
  if (!parsed.success) return { ok: false, error: "Forma yanlışdır" };
  const d = parsed.data;
  return withTenant(async () => {
    try {
      await prisma.istifadeci_filial.update({
        where: { istifadeci_id_filial_id: { istifadeci_id: d.istifadeci_id, filial_id: d.filial_id } },
        data: { [d.field]: d.value },
      });
      revalidatePath("/ayarlar/filiallar");
      return { ok: true };
    } catch (e) {
      console.error("[saveFilialUserPerm]", e);
      return { ok: false, error: "Yenilənmədi" };
    }
  });
}

// === USER MANAGEMENT ===

const UserCreateSchema = z.object({
  ad_soyad: z.string().min(2).max(100),
  email: z.string().email().max(150),
  telefon: z.string().max(20).optional().or(z.literal("")),
  vezife: z.string().max(100).optional().or(z.literal("")),
  isci_kod: z.string().max(20).optional().or(z.literal("")),
  rol_id: z.coerce.number().int().positive(),
  default_filial_id: z.coerce.number().int().positive().optional(),
  sifre: z.string().min(6).max(100),
  mecburi_sifre_deyis: z.coerce.boolean().default(true),
});

export async function createUser(input: FormData): Promise<ActionResult> {
  const parsed = UserCreateSchema.safeParse(Object.fromEntries(input.entries()));
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Forma yanlışdır" };
  }
  const d = parsed.data;
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    try {
      const existing = await prisma.istifadeciler.findFirst({
        where: { sahibkar_id: sahibkarId, email: d.email.toLowerCase() },
      });
      if (existing) return { ok: false, error: "Bu email artıq mövcuddur" };

      const sifre_hash = await hashPassword(d.sifre);
      const user = await prisma.istifadeciler.create({
        data: {
          sahibkar_id: sahibkarId,
          ad_soyad: d.ad_soyad.trim(),
          email: d.email.toLowerCase().trim(),
          telefon: d.telefon?.trim() || null,
          vezife: d.vezife?.trim() || null,
          isci_kod: d.isci_kod?.trim() || null,
          rol_id: d.rol_id,
          default_filial_id: d.default_filial_id ?? null,
          sifre_hash,
          aktiv: true,
          mecburi_sifre_deyis: d.mecburi_sifre_deyis,
        },
      });
      revalidatePath("/ayarlar/istifadeci");
      revalidatePath("/iscilier");
      return { ok: true };
    } catch (e) {
      console.error("[createUser]", e);
      return { ok: false, error: "İstifadəçi yaradılmadı" };
    }
  });
}

const UserProfileSchema = z.object({
  id: z.string().uuid(),
  ad_soyad: z.string().min(2).max(100),
  telefon: z.string().max(20).optional().or(z.literal("")),
  vezife: z.string().max(100).optional().or(z.literal("")),
  isci_kod: z.string().max(20).optional().or(z.literal("")),
  ehtiyat_telefon: z.string().max(30).optional().or(z.literal("")),
  dil: z.string().max(8).optional(),
  time_zone: z.string().max(40).optional(),
  qeyd: z.string().max(2000).optional().or(z.literal("")),
});

export async function updateUserProfile(input: FormData): Promise<ActionResult> {
  const parsed = UserProfileSchema.safeParse(Object.fromEntries(input.entries()));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Forma yanlışdır" };
  const d = parsed.data;
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    try {
      const u = await prisma.istifadeciler.findFirst({
        where: { id: d.id, sahibkar_id: sahibkarId },
      });
      if (!u) return { ok: false, error: "İstifadəçi tapılmadı" };
      await prisma.istifadeciler.update({
        where: { id: d.id },
        data: {
          ad_soyad: d.ad_soyad.trim(),
          telefon: d.telefon?.trim() || null,
          vezife: d.vezife?.trim() || null,
          isci_kod: d.isci_kod?.trim() || null,
          ehtiyat_telefon: d.ehtiyat_telefon?.trim() || null,
          dil: d.dil ?? "az",
          time_zone: d.time_zone ?? "Asia/Baku",
          qeyd: d.qeyd?.trim() || null,
        },
      });
      revalidatePath("/ayarlar/istifadeci");
      return { ok: true };
    } catch (e) {
      console.error("[updateUserProfile]", e);
      return { ok: false, error: "Yadda saxlanmadı" };
    }
  });
}

const ToggleUserSchema = z.object({
  id: z.string().uuid(),
  field: z.enum([
    "aktiv",
    "iki_fa_aktiv",
    "mecburi_sifre_deyis",
    "bildiris_push",
    "bildiris_email",
    "bildiris_sms",
    "bildiris_telegram",
    "butun_filiallari_gor",
  ]),
  value: boolFromForm,
});

export async function toggleUserField(input: FormData): Promise<ActionResult> {
  const parsed = ToggleUserSchema.safeParse(Object.fromEntries(input.entries()));
  if (!parsed.success) return { ok: false, error: "Forma yanlışdır" };
  const d = parsed.data;
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    try {
      const u = await prisma.istifadeciler.findFirst({
        where: { id: d.id, sahibkar_id: sahibkarId },
      });
      if (!u) return { ok: false, error: "İstifadəçi tapılmadı" };

      const updateData: Record<string, unknown> = { [d.field]: d.value };
      if (d.field === "aktiv" && !d.value) {
        updateData.deaktiv_tarix = new Date();
      } else if (d.field === "aktiv" && d.value) {
        updateData.deaktiv_tarix = null;
        updateData.deaktiv_sebeb = null;
      }

      await prisma.istifadeciler.update({ where: { id: d.id }, data: updateData });
      revalidatePath("/ayarlar/istifadeci");
      return { ok: true };
    } catch (e) {
      console.error("[toggleUserField]", e);
      return { ok: false, error: "Yenilənmədi" };
    }
  });
}

const ChangeUserRoleSchema = z.object({
  id: z.string().uuid(),
  rol_id: z.coerce.number().int().positive(),
});

export async function changeUserRole(input: FormData): Promise<ActionResult> {
  const parsed = ChangeUserRoleSchema.safeParse(Object.fromEntries(input.entries()));
  if (!parsed.success) return { ok: false, error: "Forma yanlışdır" };
  const d = parsed.data;
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    try {
      const [user, rol] = await Promise.all([
        prisma.istifadeciler.findFirst({ where: { id: d.id, sahibkar_id: sahibkarId } }),
        prisma.roles.findFirst({
          where: { id: d.rol_id, OR: [{ sahibkar_id: sahibkarId }, { sistem: true }] },
        }),
      ]);
      if (!user) return { ok: false, error: "İstifadəçi tapılmadı" };
      if (!rol) return { ok: false, error: "Rol tapılmadı" };
      await prisma.istifadeciler.update({ where: { id: d.id }, data: { rol_id: d.rol_id } });
      revalidatePath("/ayarlar/istifadeci");
      return { ok: true };
    } catch (e) {
      console.error("[changeUserRole]", e);
      return { ok: false, error: "Yenilənmədi" };
    }
  });
}

const ResetUserPasswordSchema = z.object({
  id: z.string().uuid(),
  yeni_sifre: z.string().min(6).max(100),
  mecburi_deyis: z.coerce.boolean().default(true),
});

export async function resetUserPassword(input: FormData): Promise<ActionResult> {
  const parsed = ResetUserPasswordSchema.safeParse(Object.fromEntries(input.entries()));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Forma yanlışdır" };
  const d = parsed.data;
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    try {
      const u = await prisma.istifadeciler.findFirst({
        where: { id: d.id, sahibkar_id: sahibkarId },
      });
      if (!u) return { ok: false, error: "İstifadəçi tapılmadı" };
      const sifre_hash = await hashPassword(d.yeni_sifre);
      await prisma.istifadeciler.update({
        where: { id: d.id },
        data: {
          sifre_hash,
          son_sifre_deyis: new Date(),
          mecburi_sifre_deyis: d.mecburi_deyis,
        },
      });
      revalidatePath("/ayarlar/istifadeci");
      return { ok: true };
    } catch (e) {
      console.error("[resetUserPassword]", e);
      return { ok: false, error: "Yadda saxlanmadı" };
    }
  });
}

export async function deleteUser(input: FormData): Promise<ActionResult> {
  const id = String(input.get("id") ?? "");
  if (!id) return { ok: false, error: "Id yanlışdır" };
  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    try {
      if (id === istifadeciId) return { ok: false, error: "Özünüzü silə bilməzsiniz" };
      const u = await prisma.istifadeciler.findFirst({
        where: { id, sahibkar_id: sahibkarId },
      });
      if (!u) return { ok: false, error: "İstifadəçi tapılmadı" };
      // Soft delete by deactivating instead of hard delete (preserves audit)
      await prisma.istifadeciler.update({
        where: { id },
        data: {
          aktiv: false,
          deaktiv_tarix: new Date(),
          deaktiv_sebeb: "Silindi (deaktiv olundu)",
        },
      });
      revalidatePath("/ayarlar/istifadeci");
      return { ok: true };
    } catch (e) {
      console.error("[deleteUser]", e);
      return { ok: false, error: "Silinmədi" };
    }
  });
}

const IpRestrictionSchema = z.object({
  id: z.string().uuid(),
  action: z.enum(["add", "remove"]),
  ip: z.string().min(1).max(45),
});

export async function updateUserIpRestriction(input: FormData): Promise<ActionResult> {
  const parsed = IpRestrictionSchema.safeParse(Object.fromEntries(input.entries()));
  if (!parsed.success) return { ok: false, error: "Forma yanlışdır" };
  const d = parsed.data;
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    try {
      const u = await prisma.istifadeciler.findFirst({
        where: { id: d.id, sahibkar_id: sahibkarId },
        select: { ip_meqdudiyyet: true },
      });
      if (!u) return { ok: false, error: "İstifadəçi tapılmadı" };
      const current = new Set(u.ip_meqdudiyyet);
      if (d.action === "add") current.add(d.ip);
      else current.delete(d.ip);
      await prisma.istifadeciler.update({
        where: { id: d.id },
        data: { ip_meqdudiyyet: Array.from(current) },
      });
      revalidatePath("/ayarlar/istifadeci");
      return { ok: true };
    } catch (e) {
      console.error("[updateUserIpRestriction]", e);
      return { ok: false, error: "Yenilənmədi" };
    }
  });
}

const UserSessionLimitSchema = z.object({
  id: z.string().uuid(),
  limit: z.coerce.number().int().min(0).max(50),
});

export async function setUserSessionLimit(input: FormData): Promise<ActionResult> {
  const parsed = UserSessionLimitSchema.safeParse(Object.fromEntries(input.entries()));
  if (!parsed.success) return { ok: false, error: "Forma yanlışdır" };
  const d = parsed.data;
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    try {
      const u = await prisma.istifadeciler.findFirst({
        where: { id: d.id, sahibkar_id: sahibkarId },
      });
      if (!u) return { ok: false, error: "İstifadəçi tapılmadı" };
      await prisma.istifadeciler.update({
        where: { id: d.id },
        data: { sessiya_limit: d.limit },
      });
      revalidatePath("/ayarlar/istifadeci");
      return { ok: true };
    } catch (e) {
      console.error("[setUserSessionLimit]", e);
      return { ok: false, error: "Yenilənmədi" };
    }
  });
}

const AnbarSchema = z.object({
  filial_id: z.coerce.number().int().positive(),
  ad: z.string().min(2).max(100),
  unvan: z.string().max(500).optional().or(z.literal("")),
});

const AnbarUpdateSchema = z.object({
  id: z.coerce.number().int().positive(),
  ad: z.string().min(2).max(100),
  unvan: z.string().max(500).optional().or(z.literal("")),
  aktiv: z.coerce.boolean().default(true),
});

export async function updateFilialAnbar(input: FormData): Promise<ActionResult> {
  const parsed = AnbarUpdateSchema.safeParse(Object.fromEntries(input.entries()));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Forma yanlışdır" };
  const d = parsed.data;
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    try {
      const a = await prisma.anbarlar.findFirst({ where: { id: d.id, sahibkar_id: sahibkarId } });
      if (!a) return { ok: false, error: "Anbar tapılmadı" };
      await prisma.anbarlar.update({
        where: { id: d.id },
        data: { ad: d.ad.trim(), unvan: d.unvan?.trim() || null, aktiv: d.aktiv },
      });
      revalidatePath("/ayarlar/filiallar");
      revalidatePath("/ayarlar/anbar");
      return { ok: true };
    } catch (e) {
      console.error("[updateFilialAnbar]", e);
      return { ok: false, error: "Yenilənmədi" };
    }
  });
}

export async function deleteFilialAnbar(input: FormData): Promise<ActionResult> {
  const id = Number(input.get("id"));
  if (!id) return { ok: false, error: "Id yanlışdır" };
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    try {
      const a = await prisma.anbarlar.findFirst({
        where: { id, sahibkar_id: sahibkarId },
        include: { _count: { select: { anbar_hereketleri: true } } },
      });
      if (!a) return { ok: false, error: "Anbar tapılmadı" };

      const stokCount = await prisma.stok.count({ where: { anbar_id: id } });
      if (stokCount > 0) {
        return { ok: false, error: `Anbarda ${stokCount} məhsul stoku var — əvvəl başqa anbara köçürün` };
      }
      if (a._count.anbar_hereketleri > 0) {
        // Soft delete (deactivate) — preserves history
        await prisma.anbarlar.update({ where: { id }, data: { aktiv: false } });
        revalidatePath("/ayarlar/filiallar");
        return { ok: true };
      }

      await prisma.anbarlar.delete({ where: { id } });
      revalidatePath("/ayarlar/filiallar");
      return { ok: true };
    } catch (e) {
      console.error("[deleteFilialAnbar]", e);
      return { ok: false, error: "Silinmədi" };
    }
  });
}

const HesabCreateSchema = z.object({
  filial_id: z.coerce.number().int().positive(),
  ad: z.string().min(2).max(100),
  nov: z.enum(["negd", "bank", "kart"]),
  bank_adi: z.string().max(150).optional().or(z.literal("")),
  iban: z.string().max(50).optional().or(z.literal("")),
  kart_son4: z.string().max(4).optional().or(z.literal("")),
  valyuta: z.string().max(8).default("AZN"),
  qaliq: z.coerce.number().default(0),
  qeyd: z.string().max(500).optional().or(z.literal("")),
});

export async function createFilialHesab(input: FormData): Promise<ActionResult> {
  const parsed = HesabCreateSchema.safeParse(Object.fromEntries(input.entries()));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Forma yanlışdır" };
  const d = parsed.data;
  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    try {
      const f = await prisma.filiallar.findFirst({
        where: { id: d.filial_id, sahibkar_id: sahibkarId },
      });
      if (!f) return { ok: false, error: "Filial tapılmadı" };

      await prisma.maliye_hesablari.create({
        data: {
          sahibkar_id: sahibkarId,
          filial_id: d.filial_id,
          ad: d.ad.trim(),
          nov: d.nov,
          bank_adi: d.bank_adi?.trim() || null,
          iban: d.iban?.replace(/\s+/g, "").toUpperCase() || null,
          kart_son4: d.kart_son4?.trim() || null,
          valyuta: d.valyuta || "AZN",
          qaliq: d.qaliq,
          qeyd: d.qeyd?.trim() || null,
          aktiv: true,
          yaradan_id: istifadeciId ?? null,
        },
      });
      revalidatePath("/ayarlar/filiallar");
      revalidatePath("/ayarlar/bank");
      revalidatePath("/maliyye");
      return { ok: true };
    } catch (e) {
      console.error("[createFilialHesab]", e);
      return { ok: false, error: "Hesab yaradılmadı" };
    }
  });
}

export async function createFilialAnbar(input: FormData): Promise<ActionResult> {
  const parsed = AnbarSchema.safeParse(Object.fromEntries(input.entries()));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Forma yanlışdır" };
  const d = parsed.data;
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    try {
      const f = await prisma.filiallar.findFirst({
        where: { id: d.filial_id, sahibkar_id: sahibkarId },
      });
      if (!f) return { ok: false, error: "Filial tapılmadı" };
      await prisma.anbarlar.create({
        data: {
          sahibkar_id: sahibkarId,
          filial_id: d.filial_id,
          ad: d.ad.trim(),
          unvan: d.unvan?.trim() || null,
          aktiv: true,
        },
      });
      revalidatePath("/ayarlar/filiallar");
      return { ok: true };
    } catch (e) {
      console.error("[createFilialAnbar]", e);
      return { ok: false, error: "Anbar yaradılmadı" };
    }
  });
}
