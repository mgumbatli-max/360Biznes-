"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { auth } from "@/auth";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { getRequestPermissions } from "@/lib/auth/get-permissions";
import { saveTesdiqSettings, type TesdiqCfg, DEFAULT_TESDIQ_CFG } from "./settings";

type Result = { ok: true } | { ok: false; error: string };

async function guardSettingsAccess(): Promise<Result | null> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Sessiya yoxdur" };
  const rol = (session.user.rol_ad ?? "").toLowerCase();
  const privileged =
    rol.includes("sahibkar") || rol.includes("admin") || rol.includes("owner");
  if (privileged) return null;
  const icaze = await getRequestPermissions();
  if (!icaze.includes("nezaret.ayarlar")) {
    return { ok: false, error: "İcazə yoxdur" };
  }
  return null;
}

function bustNezaretCache() {
  try {
    const { sahibkarId } = requireTenant();
    revalidateTag(`nezaret:${sahibkarId}`, "max");
    revalidateTag(`alerts:${sahibkarId}`, "max");
  } catch {
    // tenant context yox — sessəizcə ötür
  }
  revalidatePath("/nezaret-merkezi/ayarlar");
  revalidatePath("/nezaret-merkezi");
  revalidatePath("/tesdiq/ayarlar");
  revalidatePath("/tesdiq");
}

const Schema = z.object({
  auto_approve_mebleg: z.coerce.number().min(0).max(1_000_000),
  endirim_aktiv: z.coerce.boolean(),
  endirim_limit_pct: z.coerce.number().min(0).max(100),
  endirim_kritik_pct: z.coerce.number().min(0).max(100),
  maya_alti_aktiv: z.coerce.boolean(),
  qaytarma_aktiv: z.coerce.boolean(),
  qaytarma_limit_mebleg: z.coerce.number().min(0).max(1_000_000),
  silme_aktiv: z.coerce.boolean(),
  silme_limit_mebleg: z.coerce.number().min(0).max(1_000_000),
  borc_limit_aktiv: z.coerce.boolean(),
  borc_artirma_pct: z.coerce.number().min(0).max(500),
  qiymet_deyisdi_aktiv: z.coerce.boolean(),
  qiymet_deyisdi_pct: z.coerce.number().min(0).max(100),
  xerc_aktiv: z.coerce.boolean(),
  xerc_limit_mebleg: z.coerce.number().min(0).max(1_000_000),
  stok_duzelis_aktiv: z.coerce.boolean(),
  stok_duzelis_limit: z.coerce.number().min(0).max(1_000_000),
  alis_qaime_aktiv: z.coerce.boolean(),
  satis_qaime_aktiv: z.coerce.boolean(),
  mehsul_yaratma_aktiv: z.coerce.boolean(),
  ticaret_emeliyyat_aktiv: z.coerce.boolean(),
  tesdiq_eden_idler: z.string().max(2000),
  tesdiq_eden_alis_idler: z.string().max(2000),
  tesdiq_eden_satis_idler: z.string().max(2000),
  tesdiq_eden_mehsul_idler: z.string().max(2000),
  tesdiq_eden_ticaret_idler: z.string().max(2000),
  tesdiq_eden_endirim_idler: z.string().max(2000),
  tesdiq_eden_qaytarma_idler: z.string().max(2000),
  tesdiq_eden_xerc_idler: z.string().max(2000),
  tesdiq_eden_silme_idler: z.string().max(2000),
  tesdiq_eden_qiymet_idler: z.string().max(2000),
  tesdiq_eden_stok_idler: z.string().max(2000),
  tesdiq_eden_borc_idler: z.string().max(2000),
  tesdiq_eden_maya_idler: z.string().max(2000),
  sla_saat: z.coerce.number().min(0).max(720),
  bildir_telegram: z.coerce.boolean(),
  bildir_email: z.coerce.boolean(),
  bildir_erp: z.coerce.boolean(),
  audit_aktiv: z.coerce.boolean(),
  expire_saat: z.coerce.number().min(0).max(720),
});

function readBool(fd: FormData, key: string): boolean {
  const v = fd.get(key);
  return v === "on" || v === "1" || v === "true";
}

function readNum(fd: FormData, key: string, def = 0): number {
  const v = fd.get(key);
  if (v == null || v === "") return def;
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

export async function updateTesdiqSettings(fd: FormData): Promise<Result> {
  const denied = await guardSettingsAccess();
  if (denied) return denied;
  const candidate: TesdiqCfg = {
    auto_approve_mebleg: readNum(fd, "auto_approve_mebleg"),
    endirim_aktiv: readBool(fd, "endirim_aktiv"),
    endirim_limit_pct: readNum(fd, "endirim_limit_pct", 20),
    endirim_kritik_pct: readNum(fd, "endirim_kritik_pct", 40),
    maya_alti_aktiv: readBool(fd, "maya_alti_aktiv"),
    qaytarma_aktiv: readBool(fd, "qaytarma_aktiv"),
    qaytarma_limit_mebleg: readNum(fd, "qaytarma_limit_mebleg", 500),
    silme_aktiv: readBool(fd, "silme_aktiv"),
    silme_limit_mebleg: readNum(fd, "silme_limit_mebleg", 100),
    borc_limit_aktiv: readBool(fd, "borc_limit_aktiv"),
    borc_artirma_pct: readNum(fd, "borc_artirma_pct", 20),
    qiymet_deyisdi_aktiv: readBool(fd, "qiymet_deyisdi_aktiv"),
    qiymet_deyisdi_pct: readNum(fd, "qiymet_deyisdi_pct", 15),
    xerc_aktiv: readBool(fd, "xerc_aktiv"),
    xerc_limit_mebleg: readNum(fd, "xerc_limit_mebleg", 500),
    stok_duzelis_aktiv: readBool(fd, "stok_duzelis_aktiv"),
    stok_duzelis_limit: readNum(fd, "stok_duzelis_limit", 100),
    alis_qaime_aktiv: readBool(fd, "alis_qaime_aktiv"),
    satis_qaime_aktiv: readBool(fd, "satis_qaime_aktiv"),
    mehsul_yaratma_aktiv: readBool(fd, "mehsul_yaratma_aktiv"),
    ticaret_emeliyyat_aktiv: readBool(fd, "ticaret_emeliyyat_aktiv"),
    tesdiq_eden_idler: fd.getAll("tesdiq_eden_idler").map((v) => String(v)).filter(Boolean).join(","),
    tesdiq_eden_alis_idler: fd.getAll("tesdiq_eden_alis_idler").map((v) => String(v)).filter(Boolean).join(","),
    tesdiq_eden_satis_idler: fd.getAll("tesdiq_eden_satis_idler").map((v) => String(v)).filter(Boolean).join(","),
    tesdiq_eden_mehsul_idler: fd.getAll("tesdiq_eden_mehsul_idler").map((v) => String(v)).filter(Boolean).join(","),
    tesdiq_eden_ticaret_idler: fd.getAll("tesdiq_eden_ticaret_idler").map((v) => String(v)).filter(Boolean).join(","),
    tesdiq_eden_endirim_idler: fd.getAll("tesdiq_eden_endirim_idler").map((v) => String(v)).filter(Boolean).join(","),
    tesdiq_eden_qaytarma_idler: fd.getAll("tesdiq_eden_qaytarma_idler").map((v) => String(v)).filter(Boolean).join(","),
    tesdiq_eden_xerc_idler: fd.getAll("tesdiq_eden_xerc_idler").map((v) => String(v)).filter(Boolean).join(","),
    tesdiq_eden_silme_idler: fd.getAll("tesdiq_eden_silme_idler").map((v) => String(v)).filter(Boolean).join(","),
    tesdiq_eden_qiymet_idler: fd.getAll("tesdiq_eden_qiymet_idler").map((v) => String(v)).filter(Boolean).join(","),
    tesdiq_eden_stok_idler: fd.getAll("tesdiq_eden_stok_idler").map((v) => String(v)).filter(Boolean).join(","),
    tesdiq_eden_borc_idler: fd.getAll("tesdiq_eden_borc_idler").map((v) => String(v)).filter(Boolean).join(","),
    tesdiq_eden_maya_idler: fd.getAll("tesdiq_eden_maya_idler").map((v) => String(v)).filter(Boolean).join(","),
    sla_saat: readNum(fd, "sla_saat", 24),
    bildir_telegram: readBool(fd, "bildir_telegram"),
    bildir_email: readBool(fd, "bildir_email"),
    bildir_erp: readBool(fd, "bildir_erp"),
    audit_aktiv: readBool(fd, "audit_aktiv"),
    expire_saat: readNum(fd, "expire_saat", 0),
  };
  const parsed = Schema.safeParse(candidate);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Yanlış" };

  try {
    await withTenant(async () => {
      await saveTesdiqSettings(parsed.data);
    });
    bustNezaretCache();
    return { ok: true };
  } catch (e) {
    console.error("[updateTesdiqSettings]", e);
    return { ok: false, error: "Yadda saxlanılmadı" };
  }
}

export async function resetTesdiqSettings(): Promise<Result> {
  const denied = await guardSettingsAccess();
  if (denied) return denied;
  try {
    await withTenant(async () => {
      await saveTesdiqSettings(DEFAULT_TESDIQ_CFG);
    });
    bustNezaretCache();
    return { ok: true };
  } catch (e) {
    console.error("[resetTesdiqSettings]", e);
    return { ok: false, error: "Sıfırlanmadı" };
  }
}
