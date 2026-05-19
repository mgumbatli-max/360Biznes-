import "server-only";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";

export const TESDIQ_GROUP = "tesdiq";

/** Default rule values when an owner has not configured anything yet. */
export const DEFAULT_TESDIQ_CFG = {
  // Auto-approve threshold — anything at/below auto-passes without owner review
  auto_approve_mebleg: 0,           // 0 = disabled

  // Discount thresholds
  endirim_aktiv: true,
  endirim_limit_pct: 20,             // > 20% discount needs approval
  endirim_kritik_pct: 40,            // > 40% discount = kritik prioritet

  // Below-cost sales
  maya_alti_aktiv: true,

  // Refund / return
  qaytarma_aktiv: true,
  qaytarma_limit_mebleg: 500,        // refunds above 500 ₼ need approval

  // Write-off / delete
  silme_aktiv: true,
  silme_limit_mebleg: 100,           // any deletion above 100 ₼ value

  // Credit / debt limit override
  borc_limit_aktiv: true,
  borc_artirma_pct: 20,              // increasing customer credit limit by >20%

  // Price change
  qiymet_deyisdi_aktiv: true,
  qiymet_deyisdi_pct: 15,            // price changes >15% need approval

  // Expense approval (maliyye)
  xerc_aktiv: true,
  xerc_limit_mebleg: 500,            // expenses above 500 ₼

  // Stock adjustment
  stok_duzelis_aktiv: true,
  stok_duzelis_limit: 100,           // value of stock adjustment

  // ── 4-eyes (tam-sənəd) təsdiqi ──
  // Bu flagslər YANDIRILSA, ümumiyyətlə həmin sənəd növünü yaradan əməkdaş
  // sənədi "tesdiq_gozleyir" statusunda yaradır; təyin edilmiş təsdiq edən
  // şəxs Təsdiq Mərkəzində baxıb təsdiqlədikdən sonra sənəd aktiv olur.
  alis_qaime_aktiv: false,           // Alış qaiməsi yaradanda təsdiq
  satis_qaime_aktiv: false,          // Satış qaiməsi yaradanda təsdiq
  mehsul_yaratma_aktiv: false,       // Yeni məhsul kartı yaradanda təsdiq
  ticaret_emeliyyat_aktiv: false,    // Transfer / qaytarma / digər ticarət əməliyyatları
  // Hansı istifadəçi(lər) həmin "tam-sənəd" təsdiqlərini görüb baxa bilər.
  // CSV format — boş olarsa, sahibkar və adminlər default təsdiq edər.
  // Bu **ümumi/fallback** siyahıdır — aşağıdakı per-kind siyahıları boş olarsa
  // istifadə olunur.
  tesdiq_eden_idler: "",

  // ── Per-kind təsdiq edənlər (boş olarsa ümumi siyahıya düşür) ──
  // Hər əməliyyat növünə fərqli təsdiq edən təyin etmək olar.
  // Misal: Kamal yalnız alış, Aysel yalnız xərc təsdiq etsin.
  tesdiq_eden_alis_idler: "",
  tesdiq_eden_satis_idler: "",
  tesdiq_eden_mehsul_idler: "",
  tesdiq_eden_ticaret_idler: "",
  tesdiq_eden_endirim_idler: "",
  tesdiq_eden_qaytarma_idler: "",
  tesdiq_eden_xerc_idler: "",
  tesdiq_eden_silme_idler: "",
  tesdiq_eden_qiymet_idler: "",
  tesdiq_eden_stok_idler: "",
  tesdiq_eden_borc_idler: "",
  tesdiq_eden_maya_idler: "",

  // SLA — auto-escalate if owner hasn't responded
  sla_saat: 24,                      // hours; 0 = disabled

  // Notify channels
  bildir_telegram: false,
  bildir_email: true,
  bildir_erp: true,

  // Audit
  audit_aktiv: true,

  // Reject auto-expire (pending too long → auto-reject)
  expire_saat: 0,                    // 0 = never auto-expire
};

export type TesdiqCfg = typeof DEFAULT_TESDIQ_CFG;

function castValue<K extends keyof TesdiqCfg>(key: K, raw: string | null | undefined): TesdiqCfg[K] {
  if (raw == null) return DEFAULT_TESDIQ_CFG[key];
  const def = DEFAULT_TESDIQ_CFG[key];
  if (typeof def === "boolean") return ((raw === "1" || raw === "true") as unknown) as TesdiqCfg[K];
  if (typeof def === "number") {
    const n = Number(raw);
    return ((Number.isFinite(n) ? n : def) as unknown) as TesdiqCfg[K];
  }
  return (raw as unknown) as TesdiqCfg[K];
}

/** Load all təsdiq settings as a typed object, merging with defaults. */
export async function loadTesdiqCfg(): Promise<TesdiqCfg> {
  return withTenant(async () => {
    const rows = await prisma.ayarlar.findMany({
      where: { qrup: TESDIQ_GROUP },
      select: { acar: true, deyer: true },
    });
    const map = new Map(rows.map((r) => [r.acar, r.deyer ?? null]));
    const out = { ...DEFAULT_TESDIQ_CFG };
    for (const k of Object.keys(DEFAULT_TESDIQ_CFG) as (keyof TesdiqCfg)[]) {
      if (map.has(k)) {
        // typed cast via helper
        (out[k] as unknown) = castValue(k, map.get(k) ?? undefined);
      }
    }
    return out;
  });
}

function valueType(v: unknown): "boolean" | "number" | "string" {
  if (typeof v === "boolean") return "boolean";
  if (typeof v === "number") return "number";
  return "string";
}

/** Save (upsert) a single setting. */
export async function saveTesdiqSetting<K extends keyof TesdiqCfg>(key: K, value: TesdiqCfg[K]): Promise<void> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const stringValue = String(value);
    const nov = valueType(value);
    await prisma.ayarlar.upsert({
      where: { sahibkar_id_qrup_acar: { sahibkar_id: sahibkarId, qrup: TESDIQ_GROUP, acar: key as string } },
      create: {
        sahibkar_id: sahibkarId,
        qrup: TESDIQ_GROUP,
        acar: key as string,
        deyer: stringValue,
        nov,
      },
      update: { deyer: stringValue, nov, yenilendi: new Date() },
    });
  });
}

/** Save many at once (used by the settings form). */
export async function saveTesdiqSettings(updates: Partial<TesdiqCfg>): Promise<void> {
  for (const [k, v] of Object.entries(updates)) {
    await saveTesdiqSetting(k as keyof TesdiqCfg, v as TesdiqCfg[keyof TesdiqCfg]);
  }
}
