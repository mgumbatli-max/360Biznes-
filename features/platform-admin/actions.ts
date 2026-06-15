"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prismaUnscoped } from "@/lib/db/prisma";
import { requirePlatformAdmin } from "@/lib/platform-admin/guard";
import { safeAuditLog } from "@/lib/audit/safe-log";
import { hashPassword } from "@/lib/auth/password";
import { planTierFlag } from "./queries";

export async function setTenantStatus(id: string, status: "aktiv" | "dayandirildi"): Promise<{ ok: true } | { ok: false; error: string }> {
  await requirePlatformAdmin();
  try {
    await prismaUnscoped.sahibkarlar.update({ where: { id }, data: { status } });
    revalidatePath("/platform-admin/tenantlar");
    revalidatePath(`/platform-admin/tenantlar/${id}`);
    return { ok: true };
  } catch (e) {
    console.error("[setTenantStatus]", e);
    return { ok: false, error: "Status dəyişmədi" };
  }
}

/**
 * Impersonate a tenant — yalnız audit_log-a yazır. Faktiki sessiya dəyişikliyi
 * NextAuth-da edilməlidir; bu sadə implementasiya redirect ilə işarə verir.
 */
export async function impersonateTenant(sahibkar_id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = await requirePlatformAdmin();
  const target = await prismaUnscoped.sahibkarlar.findUnique({ where: { id: sahibkar_id }, select: { id: true, ad: true } });
  if (!target) return { ok: false, error: "Sahibkar tapılmadı" };
  // IMPERSONATE — kritik təhlükəsizlik logu, fail-də outbox-a düşməlidir.
  await safeAuditLog({
    sahibkar_id: target.id,
    istifadeci_id: admin.id,
    istifadeci_ad: admin.ad_soyad ?? "platform_admin",
    emeliyyat: "IMPERSONATE",
    resurs_nov: "sahibkar",
    resurs_id: target.id,
    yeni_data: { target_name: target.ad, at: new Date().toISOString() },
    sebeb: "Support/test üçün impersonate",
    status: "ugur",
  });
  redirect("/dashboard");
}

const PlanSchema = z.object({
  id: z.coerce.number().int().positive().optional(),
  kod: z.string().min(1).max(30).regex(/^[a-z0-9_-]+$/i, "Yalnız hərf/rəqəm/_/-"),
  ad: z.string().min(1).max(80),
  ayl_q_qiymet: z.coerce.number().min(0).max(1000000),
  illik_qiymet: z.coerce.number().min(0).max(10000000).optional().or(z.literal("")),
  max_istifadeci: z.coerce.number().int().min(0).max(100000).optional().or(z.literal("")),
  max_mehsul: z.coerce.number().int().min(0).max(10000000).optional().or(z.literal("")),
  max_mesaj_ayl_q: z.coerce.number().int().min(0).max(10000000).optional().or(z.literal("")),
  storage_mb: z.coerce.number().int().min(0).max(10000000).optional().or(z.literal("")),
  aktiv: z.union([z.string(), z.boolean()]).optional(),
});

export async function savePlan(input: FormData): Promise<{ ok: true; id: number } | { ok: false; error: string }> {
  await requirePlatformAdmin();
  const parsed = PlanSchema.safeParse(Object.fromEntries(input.entries()));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Forma yanlışdır" };
  const d = parsed.data;
  try {
    const storage = typeof d.storage_mb === "number" ? d.storage_mb : null;
    const data = {
      kod: d.kod.toLowerCase(),
      ad: d.ad.trim(),
      ayl_q_qiymet: d.ayl_q_qiymet,
      illik_qiymet: typeof d.illik_qiymet === "number" ? d.illik_qiymet : null,
      max_istifadeci: typeof d.max_istifadeci === "number" ? d.max_istifadeci : null,
      max_mehsul: typeof d.max_mehsul === "number" ? d.max_mehsul : null,
      max_mesaj_ayl_q: typeof d.max_mesaj_ayl_q === "number" ? d.max_mesaj_ayl_q : null,
      funksiyalar: storage !== null ? { storage_mb: storage } : undefined,
      aktiv: d.aktiv === "on" || d.aktiv === "true" || d.aktiv === true,
    };
    let row;
    if (d.id) row = await prismaUnscoped.abune_planlari.update({ where: { id: d.id }, data });
    else row = await prismaUnscoped.abune_planlari.create({ data });
    revalidatePath("/platform-admin/paketler");
    return { ok: true, id: row.id };
  } catch (e) {
    console.error("[savePlan]", e);
    return { ok: false, error: "Yaddasaxlama alınmadı (kod təkrarlanır?)" };
  }
}

export async function deletePlan(id: number): Promise<{ ok: true } | { ok: false; error: string }> {
  await requirePlatformAdmin();
  try {
    const inUse = await prismaUnscoped.abuneler.count({ where: { plan_id: id, status: "aktiv" } });
    if (inUse > 0) return { ok: false, error: `Bu plan ${inUse} aktiv abunədə istifadədədir` };
    await prismaUnscoped.abune_planlari.delete({ where: { id } });
    revalidatePath("/platform-admin/paketler");
    return { ok: true };
  } catch (e) {
    console.error("[deletePlan]", e);
    return { ok: false, error: "Silinmədi" };
  }
}

const ResetPasswordSchema = z.object({
  user_id: z.string().uuid("İstifadəçi ID yanlışdır"),
  yeni_sifre: z.string().min(6, "Şifrə ən azı 6 simvol olmalıdır"),
});

export async function adminResetUserPassword(formData: FormData): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = await requirePlatformAdmin();
  const parsed = ResetPasswordSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Forma yanlışdır" };
  const { user_id, yeni_sifre } = parsed.data;
  try {
    const target = await prismaUnscoped.istifadeciler.findUnique({
      where: { id: user_id },
      select: { id: true, ad_soyad: true, sahibkar_id: true },
    });
    if (!target) return { ok: false, error: "İstifadəçi tapılmadı" };

    const sifre_hash = await hashPassword(yeni_sifre);
    await prismaUnscoped.istifadeciler.update({
      where: { id: user_id },
      data: { sifre_hash, mecburi_sifre_deyis: true, son_sifre_deyis: new Date() },
    });

    await safeAuditLog({
      sahibkar_id: target.sahibkar_id,
      istifadeci_id: admin.id,
      istifadeci_ad: admin.ad_soyad ?? "platform_admin",
      emeliyyat: "RESET_PASSWORD",
      resurs_nov: "istifadeci",
      resurs_id: target.id,
      yeni_data: { target_name: target.ad_soyad, at: new Date().toISOString() },
      sebeb: "Platform admin",
      status: "ugur",
    });

    revalidatePath("/platform-admin/istifadeciler");
    return { ok: true };
  } catch (e) {
    console.error("[adminResetUserPassword]", e);
    return { ok: false, error: "Şifrə yenilənmədi" };
  }
}

const SetUserActiveSchema = z.object({
  user_id: z.string().uuid("İstifadəçi ID yanlışdır"),
  aktiv: z.enum(["true", "false"]),
});

export async function adminSetUserActive(formData: FormData): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = await requirePlatformAdmin();
  const parsed = SetUserActiveSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Forma yanlışdır" };
  const { user_id } = parsed.data;
  const aktiv = parsed.data.aktiv === "true";
  try {
    const target = await prismaUnscoped.istifadeciler.findUnique({
      where: { id: user_id },
      select: { id: true, ad_soyad: true, sahibkar_id: true },
    });
    if (!target) return { ok: false, error: "İstifadəçi tapılmadı" };

    await prismaUnscoped.istifadeciler.update({
      where: { id: user_id },
      data: { aktiv },
    });

    await safeAuditLog({
      sahibkar_id: target.sahibkar_id,
      istifadeci_id: admin.id,
      istifadeci_ad: admin.ad_soyad ?? "platform_admin",
      emeliyyat: aktiv ? "USER_AKTIV" : "USER_DEAKTIV",
      resurs_nov: "istifadeci",
      resurs_id: target.id,
      yeni_data: { target_name: target.ad_soyad, aktiv, at: new Date().toISOString() },
      sebeb: "Platform admin",
      status: "ugur",
    });

    revalidatePath("/platform-admin/istifadeciler");
    return { ok: true };
  } catch (e) {
    console.error("[adminSetUserActive]", e);
    return { ok: false, error: "Status dəyişmədi" };
  }
}

// ── Təhlükəsizlik əməliyyatları (force-logout / 2FA / soft-delete / restore) ──
const UserIdSchema = z.object({
  user_id: z.string().uuid("İstifadəçi ID yanlışdır"),
});

const SoftDeleteSchema = z.object({
  user_id: z.string().uuid("İstifadəçi ID yanlışdır"),
  sebeb: z.string().max(500).optional().or(z.literal("")),
});

const BlockIpSchema = z.object({
  ip_adres: z.string().trim().min(1, "IP ünvanı boş ola bilməz").max(50),
  sebeb: z.string().max(500).optional().or(z.literal("")),
  bitme: z.string().optional().or(z.literal("")),
});

const UnblockIpSchema = z.object({
  id: z.coerce.number().int().positive("ID yanlışdır"),
});

export async function adminForceLogout(formData: FormData): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = await requirePlatformAdmin();
  const parsed = UserIdSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Forma yanlışdır" };
  const { user_id } = parsed.data;
  try {
    const target = await prismaUnscoped.istifadeciler.findUnique({
      where: { id: user_id },
      select: { id: true, ad_soyad: true, sahibkar_id: true },
    });
    if (!target) return { ok: false, error: "İstifadəçi tapılmadı" };

    const res = await prismaUnscoped.istifadeci_sessiya.updateMany({
      where: { istifadeci_id: user_id, bitirilib: false },
      data: { bitirilib: true, bitirilme_seb: "platform_admin" },
    });

    await safeAuditLog({
      sahibkar_id: target.sahibkar_id,
      istifadeci_id: admin.id,
      istifadeci_ad: admin.ad_soyad ?? "platform_admin",
      emeliyyat: "FORCE_LOGOUT",
      resurs_nov: "istifadeci",
      resurs_id: target.id,
      yeni_data: { target_name: target.ad_soyad, sessiya_sayi: res.count, at: new Date().toISOString() },
      sebeb: "Platform admin",
      status: "ugur",
    });

    revalidatePath("/platform-admin/istifadeciler");
    return { ok: true };
  } catch (e) {
    console.error("[adminForceLogout]", e);
    return { ok: false, error: "Sessiyalar bitirilmədi" };
  }
}

export async function adminDisable2FA(formData: FormData): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = await requirePlatformAdmin();
  const parsed = UserIdSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Forma yanlışdır" };
  const { user_id } = parsed.data;
  try {
    const target = await prismaUnscoped.istifadeciler.findUnique({
      where: { id: user_id },
      select: { id: true, ad_soyad: true, sahibkar_id: true },
    });
    if (!target) return { ok: false, error: "İstifadəçi tapılmadı" };

    await prismaUnscoped.istifadeciler.update({
      where: { id: user_id },
      data: { iki_fa_aktiv: false, iki_fa_secret: null },
    });

    await safeAuditLog({
      sahibkar_id: target.sahibkar_id,
      istifadeci_id: admin.id,
      istifadeci_ad: admin.ad_soyad ?? "platform_admin",
      emeliyyat: "FORCE_2FA_DISABLE",
      resurs_nov: "istifadeci",
      resurs_id: target.id,
      yeni_data: { target_name: target.ad_soyad, at: new Date().toISOString() },
      sebeb: "Platform admin",
      status: "ugur",
    });

    revalidatePath("/platform-admin/istifadeciler");
    return { ok: true };
  } catch (e) {
    console.error("[adminDisable2FA]", e);
    return { ok: false, error: "2FA söndürülmədi" };
  }
}

export async function adminSoftDeleteUser(formData: FormData): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = await requirePlatformAdmin();
  const parsed = SoftDeleteSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Forma yanlışdır" };
  const { user_id } = parsed.data;
  const sebeb = parsed.data.sebeb && parsed.data.sebeb.length > 0 ? parsed.data.sebeb : null;
  try {
    const target = await prismaUnscoped.istifadeciler.findUnique({
      where: { id: user_id },
      select: { id: true, ad_soyad: true, sahibkar_id: true },
    });
    if (!target) return { ok: false, error: "İstifadəçi tapılmadı" };

    await prismaUnscoped.istifadeciler.update({
      where: { id: user_id },
      data: { deleted_at: new Date(), deleted_by: admin.id, delete_reason: sebeb, aktiv: false },
    });

    await safeAuditLog({
      sahibkar_id: target.sahibkar_id,
      istifadeci_id: admin.id,
      istifadeci_ad: admin.ad_soyad ?? "platform_admin",
      emeliyyat: "USER_DELETE",
      resurs_nov: "istifadeci",
      resurs_id: target.id,
      yeni_data: { target_name: target.ad_soyad, at: new Date().toISOString() },
      sebeb: sebeb ?? "Platform admin",
      status: "ugur",
    });

    revalidatePath("/platform-admin/istifadeciler");
    return { ok: true };
  } catch (e) {
    console.error("[adminSoftDeleteUser]", e);
    return { ok: false, error: "İstifadəçi silinmədi" };
  }
}

export async function adminRestoreUser(formData: FormData): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = await requirePlatformAdmin();
  const parsed = UserIdSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Forma yanlışdır" };
  const { user_id } = parsed.data;
  try {
    const target = await prismaUnscoped.istifadeciler.findUnique({
      where: { id: user_id },
      select: { id: true, ad_soyad: true, sahibkar_id: true },
    });
    if (!target) return { ok: false, error: "İstifadəçi tapılmadı" };

    await prismaUnscoped.istifadeciler.update({
      where: { id: user_id },
      data: { deleted_at: null, restored_at: new Date(), restored_by: admin.id, aktiv: true },
    });

    await safeAuditLog({
      sahibkar_id: target.sahibkar_id,
      istifadeci_id: admin.id,
      istifadeci_ad: admin.ad_soyad ?? "platform_admin",
      emeliyyat: "USER_RESTORE",
      resurs_nov: "istifadeci",
      resurs_id: target.id,
      yeni_data: { target_name: target.ad_soyad, at: new Date().toISOString() },
      sebeb: "Platform admin",
      status: "ugur",
    });

    revalidatePath("/platform-admin/istifadeciler");
    return { ok: true };
  } catch (e) {
    console.error("[adminRestoreUser]", e);
    return { ok: false, error: "İstifadəçi bərpa olunmadı" };
  }
}

export async function adminBlockIp(formData: FormData): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = await requirePlatformAdmin();
  const sahibkar_id = (process.env.SUPER_ADMIN_SAHIBKAR_ID ?? "").trim();
  if (!sahibkar_id) return { ok: false, error: "Konfiqurasiya yoxdur" };
  const parsed = BlockIpSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Forma yanlışdır" };
  const ip_adres = parsed.data.ip_adres.trim();
  if (!ip_adres) return { ok: false, error: "IP ünvanı boş ola bilməz" };
  const sebeb = parsed.data.sebeb && parsed.data.sebeb.length > 0 ? parsed.data.sebeb : null;
  const bitme_tarixi = parsed.data.bitme && parsed.data.bitme.length > 0 ? new Date(parsed.data.bitme) : null;
  if (bitme_tarixi && Number.isNaN(bitme_tarixi.getTime())) return { ok: false, error: "Bitmə tarixi yanlışdır" };
  try {
    const row = await prismaUnscoped.ip_bloklari.upsert({
      where: { sahibkar_id_ip_adres: { sahibkar_id, ip_adres } },
      create: { sahibkar_id, ip_adres, sebeb, aktiv: true, bloklayan_id: admin.id, bitme_tarixi },
      update: { sebeb, aktiv: true, bloklayan_id: admin.id, bitme_tarixi },
    });

    await safeAuditLog({
      sahibkar_id,
      istifadeci_id: admin.id,
      istifadeci_ad: admin.ad_soyad ?? "platform_admin",
      emeliyyat: "IP_BLOCK",
      resurs_nov: "ip_bloklari",
      resurs_id: String(row.id),
      yeni_data: { ip_adres, sebeb, bitme_tarixi: bitme_tarixi?.toISOString() ?? null, at: new Date().toISOString() },
      sebeb: sebeb ?? "Platform admin",
      status: "ugur",
    });

    revalidatePath("/platform-admin/ip-bloklari");
    return { ok: true };
  } catch (e) {
    console.error("[adminBlockIp]", e);
    return { ok: false, error: "IP bloklanmadı (ünvan yanlış ola bilər)" };
  }
}

export async function adminUnblockIp(formData: FormData): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = await requirePlatformAdmin();
  const parsed = UnblockIpSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Forma yanlışdır" };
  const { id } = parsed.data;
  try {
    const row = await prismaUnscoped.ip_bloklari.update({
      where: { id },
      data: { aktiv: false },
      select: { id: true, ip_adres: true, sahibkar_id: true },
    });

    await safeAuditLog({
      sahibkar_id: row.sahibkar_id,
      istifadeci_id: admin.id,
      istifadeci_ad: admin.ad_soyad ?? "platform_admin",
      emeliyyat: "IP_UNBLOCK",
      resurs_nov: "ip_bloklari",
      resurs_id: String(row.id),
      yeni_data: { ip_adres: String(row.ip_adres), at: new Date().toISOString() },
      sebeb: "Platform admin",
      status: "ugur",
    });

    revalidatePath("/platform-admin/ip-bloklari");
    return { ok: true };
  } catch (e) {
    console.error("[adminUnblockIp]", e);
    return { ok: false, error: "Blok ləğv olunmadı" };
  }
}

// ── Tenant-üzrə modul aç/bağla (per-tenant module entitlement) ──────────────
const SetTenantModuleSchema = z.object({
  sahibkar_id: z.string().uuid("Sahibkar ID yanlışdır"),
  modul_kod: z.string().min(1).max(40),
  aktiv: z.enum(["true", "false"]),
  bitme: z.string().optional().or(z.literal("")),
});

export async function setTenantModule(formData: FormData): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = await requirePlatformAdmin();
  const parsed = SetTenantModuleSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Forma yanlışdır" };
  const { sahibkar_id, modul_kod } = parsed.data;
  const aktiv = parsed.data.aktiv === "true";
  const bitme = parsed.data.bitme && parsed.data.bitme.length > 0 ? new Date(parsed.data.bitme) : null;
  if (bitme && Number.isNaN(bitme.getTime())) return { ok: false, error: "Bitmə tarixi yanlışdır" };
  try {
    await prismaUnscoped.sahibkar_modullar.upsert({
      where: { sahibkar_id_modul_kod: { sahibkar_id, modul_kod } },
      create: { sahibkar_id, modul_kod, aktiv, bitme, baslama: new Date() },
      update: { aktiv, bitme },
    });

    await safeAuditLog({
      sahibkar_id,
      istifadeci_id: admin.id,
      istifadeci_ad: admin.ad_soyad ?? "platform_admin",
      emeliyyat: "MODULE_TOGGLE",
      resurs_nov: "modul",
      resurs_id: modul_kod,
      yeni_data: { modul_kod, aktiv, bitme: bitme?.toISOString() ?? null, at: new Date().toISOString() },
      sebeb: "Platform admin",
      status: "ugur",
    });

    revalidatePath(`/platform-admin/tenantlar/${sahibkar_id}`);
    return { ok: true };
  } catch (e) {
    console.error("[setTenantModule]", e);
    return { ok: false, error: "Modul dəyişmədi" };
  }
}

// ── Modul kataloqu: qiymət + plan flag-larını yaddaşda saxla (super-admin) ───
const SaveModulSchema = z.object({
  kod: z.string().min(1).max(40),
  aylik_qiymet: z.coerce.number().min(0).max(1000000),
  illik_qiymet: z.coerce.number().min(0).max(10000000).optional().or(z.literal("")),
  start_daxil: z.enum(["true", "false"]),
  business_daxil: z.enum(["true", "false"]),
  pro_daxil: z.enum(["true", "false"]),
  enterprise_daxil: z.enum(["true", "false"]),
  ayrica_alina_biler: z.enum(["true", "false"]),
  aktiv: z.enum(["true", "false"]),
});

export async function saveModul(formData: FormData): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = await requirePlatformAdmin();
  const parsed = SaveModulSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Forma yanlışdır" };
  const d = parsed.data;
  try {
    const data = {
      aylik_qiymet: d.aylik_qiymet,
      illik_qiymet: typeof d.illik_qiymet === "number" ? d.illik_qiymet : null,
      start_daxil: d.start_daxil === "true",
      business_daxil: d.business_daxil === "true",
      pro_daxil: d.pro_daxil === "true",
      enterprise_daxil: d.enterprise_daxil === "true",
      ayrica_alina_biler: d.ayrica_alina_biler === "true",
      aktiv: d.aktiv === "true",
    };
    await prismaUnscoped.modullar.update({ where: { kod: d.kod }, data });

    // audit_log.sahibkar_id MƏCBURİDİR (non-null UUID) — platforma-sahibi tenantı
    // (SUPER_ADMIN_SAHIBKAR_ID), yoxdursa admin-in öz sahibkar_id-i.
    const auditSahibkar = (process.env.SUPER_ADMIN_SAHIBKAR_ID ?? "").trim() || admin.sahibkar_id;
    await safeAuditLog({
      sahibkar_id: auditSahibkar,
      istifadeci_id: admin.id,
      istifadeci_ad: admin.ad_soyad ?? "platform_admin",
      emeliyyat: "MODUL_SAVE",
      resurs_nov: "modul",
      resurs_id: d.kod,
      yeni_data: { ...data, at: new Date().toISOString() },
      sebeb: "Platform admin — modul kataloqu",
      status: "ugur",
    });

    revalidatePath("/platform-admin/modullar");
    return { ok: true };
  } catch (e) {
    console.error("[saveModul]", e);
    return { ok: false, error: "Yaddasaxlama alınmadı" };
  }
}

export async function extendSubscription(sahibkar_id: string, daysToAdd: number): Promise<{ ok: true } | { ok: false; error: string }> {
  await requirePlatformAdmin();
  try {
    const latest = await prismaUnscoped.abuneler.findFirst({
      where: { sahibkar_id },
      orderBy: { yaradildi: "desc" },
    });
    if (!latest) return { ok: false, error: "Aktiv abunə tapılmadı" };
    const newBitme = new Date(latest.bitme);
    newBitme.setDate(newBitme.getDate() + daysToAdd);
    await prismaUnscoped.abuneler.update({
      where: { id: latest.id },
      data: { bitme: newBitme, status: "aktiv" },
    });
    revalidatePath(`/platform-admin/tenantlar/${sahibkar_id}`);
    return { ok: true };
  } catch (e) {
    console.error("[extendSubscription]", e);
    return { ok: false, error: "Uzatma alınmadı" };
  }
}

// ── Plan tier-inə görə modulları tenant-a tətbiq et (super-admin) ────────────
// Seçilmiş planın tier bayrağı (*_daxil) true olan bütün modulları tenant üçün
// sahibkar_modullar-da aktivləşdirir (upsert). Mövcud əlavə (add-on) modulları
// DEAKTİV ETMİR; yalnız plan modullarını aktiv edir. Mövcud sətrin `bitme`
// dəyərinə toxunmur (sıfırlamır); yeni yaradılanda `baslama` qoyulur.
const ApplyPlanModulesSchema = z.object({
  sahibkar_id: z.string().uuid("Sahibkar ID yanlışdır"),
  plan_kod: z.string().min(1).max(30),
});

export async function applyPlanModules(formData: FormData): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = await requirePlatformAdmin();
  const parsed = ApplyPlanModulesSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Forma yanlışdır" };
  const { sahibkar_id, plan_kod } = parsed.data;
  const flag = planTierFlag(plan_kod);
  if (!flag) return { ok: false, error: "Plan tanınmadı" };
  try {
    // Bu plan tier-inə daxil olan modulların kodları.
    const modules = await prismaUnscoped.modullar.findMany({
      where: { aktiv: true, [flag]: true },
      select: { kod: true },
    });
    const kodlar = modules.map((m) => m.kod);

    for (const modul_kod of kodlar) {
      await prismaUnscoped.sahibkar_modullar.upsert({
        where: { sahibkar_id_modul_kod: { sahibkar_id, modul_kod } },
        // Mövcud sətr: aktiv et + bitme-ni sıfırla (müddətsiz) — köhnə bitme gate-i bloklayırdı.
        update: { aktiv: true, bitme: null },
        // Yeni sətr: aktiv + baslama (bitme = null → müddətsiz).
        create: { sahibkar_id, modul_kod, aktiv: true, baslama: new Date() },
      });
    }

    await safeAuditLog({
      sahibkar_id,
      istifadeci_id: admin.id,
      istifadeci_ad: admin.ad_soyad ?? "platform_admin",
      emeliyyat: "APPLY_PLAN_MODULES",
      resurs_nov: "sahibkar",
      resurs_id: sahibkar_id,
      yeni_data: { plan_kod, flag, modul_sayi: kodlar.length, kodlar, at: new Date().toISOString() },
      sebeb: "Platform admin — plan modullarını tətbiq",
      status: "ugur",
    });

    revalidatePath(`/platform-admin/tenantlar/${sahibkar_id}`);
    return { ok: true };
  } catch (e) {
    console.error("[applyPlanModules]", e);
    return { ok: false, error: "Plan modulları tətbiq olunmadı" };
  }
}
