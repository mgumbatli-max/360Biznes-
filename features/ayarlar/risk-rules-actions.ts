"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { setRiskRules } from "./risk-rules";
import { audit } from "@/lib/audit/log";
import { requireAyarActionPerm } from "./access-guard";

const ActionSchema = z.enum(["warn", "approve", "block"]);

const Schema = z.object({
  maya_alti_action: ActionSchema.optional(),
  borc_limit_action: ActionSchema.optional(),
  stok_alert_threshold: z.coerce.number().int().min(0).max(99999).optional(),
  sayim_anomaly_pct: z.coerce.number().int().min(0).max(100).optional(),
  return_anomaly_30d: z.coerce.number().int().min(0).max(100).optional(),
  stok_change_threshold_unit: z.coerce.number().int().min(0).max(999999).optional(),
  stok_change_threshold_azn: z.coerce.number().int().min(0).max(99999999).optional(),
});

type Result = { ok: true } | { ok: false; error: string };

export async function saveRiskRules(input: FormData): Promise<Result> {
  // QA-K5: backend icazə guard-ı (əvvəl yalnız frontend gizlədirdi)
  const __g = await requireAyarActionPerm("ayar.idare");
  if (!__g.ok) return { ok: false, error: __g.error };
  const raw = Object.fromEntries(input.entries());
  const parsed = Schema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Yanlış məlumat" };
  }
  try {
    await setRiskRules(parsed.data);
    await audit("ayar_dəyiş", "risk_qayda", null, {
      yeni_data: parsed.data,
      sebeb: "Risk qaydaları yeniləndi",
    });
    revalidatePath("/ayarlar/risk-qayda");
    return { ok: true };
  } catch (e) {
    console.error("[saveRiskRules]", e);
    return { ok: false, error: "Yadda saxlanmadı" };
  }
}
