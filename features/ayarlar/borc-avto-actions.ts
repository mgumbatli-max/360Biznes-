"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { audit } from "@/lib/audit/log";
import { requireAyarActionPerm, bustAyarCache } from "./access-guard";

type Result = { ok: true } | { ok: false; error: string };

const SETTINGS: Array<{ key: string; type: "bool" | "num" | "str"; min?: number; max?: number; def?: string }> = [
  { key: "aktiv", type: "bool" },
  { key: "gun_threshold", type: "num", min: 1, max: 365, def: "30" },
  { key: "tekrar_gun", type: "num", min: 1, max: 90, def: "7" },
  { key: "mesul_id", type: "str" },
];

export async function saveBorcAvtoSettings(fd: FormData): Promise<Result> {
  // FIX: Hardcoded rol_id (9, 1) əvəzinə requireAyarActionPerm istifadə olunur
  const permCheck = await requireAyarActionPerm("ayar.idare");
  if (!permCheck.ok) return { ok: false, error: permCheck.error };

  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    try {
      // Köhnə dəyərləri al — audit üçün
      const before = await prisma.ayarlar.findMany({
        where: { sahibkar_id: sahibkarId, qrup: "borc_avto" },
        select: { acar: true, deyer: true },
      });
      const beforeMap = new Map(before.map((r) => [r.acar, r.deyer]));

      const changes: Record<string, { from: string | null; to: string }> = {};
      for (const cfg of SETTINGS) {
        let val: string;
        if (cfg.type === "bool") {
          const v = fd.get(cfg.key);
          val = v === "on" || v === "1" || v === "true" ? "1" : "0";
        } else if (cfg.type === "num") {
          const raw = String(fd.get(cfg.key) ?? cfg.def ?? "0");
          let n = Number(raw);
          if (!Number.isFinite(n)) n = Number(cfg.def ?? "0");
          if (cfg.min != null && n < cfg.min) n = cfg.min;
          if (cfg.max != null && n > cfg.max) n = cfg.max;
          val = String(n);
        } else {
          val = String(fd.get(cfg.key) ?? "");
        }
        const oldVal = beforeMap.get(cfg.key) ?? null;
        if (oldVal !== val) changes[cfg.key] = { from: oldVal, to: val };
        await prisma.ayarlar.upsert({
          where: {
            sahibkar_id_qrup_acar: { sahibkar_id: sahibkarId, qrup: "borc_avto", acar: cfg.key },
          },
          create: {
            sahibkar_id: sahibkarId,
            qrup: "borc_avto",
            acar: cfg.key,
            deyer: val,
            nov: cfg.type === "bool" ? "boolean" : cfg.type === "num" ? "number" : "string",
          },
          update: { deyer: val, yenilendi: new Date() },
        });
      }
      revalidatePath("/ayarlar/borc-avto");
      bustAyarCache();
      if (Object.keys(changes).length > 0) {
        await audit("yenile", "borc_avto_ayar", null, {
          yeni_data: changes,
          sebeb: "Avto-borc xatırlatma ayarları dəyişdirildi",
        });
      }
      return { ok: true };
    } catch (e) {
      console.error("[saveBorcAvtoSettings]", e);
      const msg = e instanceof Error ? e.message : "naməlum səhv";
      return { ok: false, error: `Yadda saxlanmadı: ${msg}` };
    }
  });
}
