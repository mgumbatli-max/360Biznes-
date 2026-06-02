import "server-only";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";

/**
 * Risk qaydaları — sahibkarın icra zamanı tətbiq olunan globalı parametrlər.
 * `ayarlar` cədvəlində (qrup="risk") açar-dəyər kimi saxlanılır.
 */
const QRUP = "risk";

export type RiskRules = {
  /** Maya altı satışa hansı davranış: xəbərdarlıq, təsdiq tələbi, və ya qadağa */
  maya_alti_action: "warn" | "approve" | "block";
  /** Müştəri borc limitini aşan satışda hansı davranış */
  borc_limit_action: "warn" | "approve" | "block";
  /** Stok azaldıqda alert yaratmaq üçün default eşik (ədəd) */
  stok_alert_threshold: number;
  /** Anormal sayım fərqi % — bu səviyyədən böyük fərq təsdiq tələb edir */
  sayim_anomaly_pct: number;
  /** Eyni müştəridən qaytarma sayı 30 gündə bu sayı aşarsa alert */
  return_anomaly_30d: number;
  /** Manuel stok düzəlişində bu sayı aşan dəyişiklik təsdiq tələb edir (vahid) */
  stok_change_threshold_unit: number;
  /** Manuel stok düzəlişində bu məbləği aşan dəyər (AZN) təsdiq tələb edir */
  stok_change_threshold_azn: number;
};

const DEFAULTS: RiskRules = {
  maya_alti_action: "approve",
  borc_limit_action: "approve",
  stok_alert_threshold: 5,
  sayim_anomaly_pct: 10,
  return_anomaly_30d: 3,
  stok_change_threshold_unit: 100,
  stok_change_threshold_azn: 1000,
};

const KEYS: Record<keyof RiskRules, string> = {
  maya_alti_action: "maya_alti_action",
  borc_limit_action: "borc_limit_action",
  stok_alert_threshold: "stok_alert_threshold",
  sayim_anomaly_pct: "sayim_anomaly_pct",
  return_anomaly_30d: "return_anomaly_30d",
  stok_change_threshold_unit: "stok_change_threshold_unit",
  stok_change_threshold_azn: "stok_change_threshold_azn",
};

export async function getRiskRules(): Promise<RiskRules> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const rows = await prisma.ayarlar.findMany({
      where: { sahibkar_id: sahibkarId, qrup: QRUP, acar: { in: Object.values(KEYS) } },
    });
    const out: RiskRules = { ...DEFAULTS };
    for (const row of rows) {
      for (const [k, key] of Object.entries(KEYS) as [keyof RiskRules, string][]) {
        if (row.acar === key && row.deyer != null) {
          if (k === "maya_alti_action" || k === "borc_limit_action") {
            if (["warn", "approve", "block"].includes(row.deyer)) {
              out[k] = row.deyer as RiskRules["maya_alti_action"];
            }
          } else {
            const n = Number(row.deyer);
            if (Number.isFinite(n) && n >= 0) (out as Record<keyof RiskRules, number | string>)[k] = n;
          }
        }
      }
    }
    return out;
  });
}

export async function setRiskRules(rules: Partial<RiskRules>): Promise<void> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    for (const [k, key] of Object.entries(KEYS) as [keyof RiskRules, string][]) {
      const val = rules[k];
      if (val === undefined) continue;
      await prisma.ayarlar.upsert({
        where: { sahibkar_id_qrup_acar: { sahibkar_id: sahibkarId, qrup: QRUP, acar: key } },
        update: { deyer: String(val), yenilendi: new Date(), nov: typeof val === "number" ? "number" : "string" },
        create: {
          sahibkar_id: sahibkarId,
          qrup: QRUP,
          acar: key,
          deyer: String(val),
          nov: typeof val === "number" ? "number" : "string",
          tesvir: `Risk qaydası: ${k}`,
        },
      });
    }
  });
}
