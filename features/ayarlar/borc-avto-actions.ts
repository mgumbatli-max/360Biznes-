"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";

type Result = { ok: true } | { ok: false; error: string };

const SETTINGS: Array<{ key: string; type: "bool" | "num" | "str"; min?: number; max?: number; def?: string }> = [
  { key: "aktiv", type: "bool" },
  { key: "gun_threshold", type: "num", min: 1, max: 365, def: "30" },
  { key: "tekrar_gun", type: "num", min: 1, max: 90, def: "7" },
  { key: "mesul_id", type: "str" },
];

export async function saveBorcAvtoSettings(fd: FormData): Promise<Result> {
  const s = await auth();
  if (!s?.user) return { ok: false, error: "Sessiya yoxdur" };
  if (s.user.rol_id !== 9 && s.user.rol_id !== 1) return { ok: false, error: "İcazəniz yoxdur" };

  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    try {
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
      return { ok: true };
    } catch (e) {
      console.error("[saveBorcAvtoSettings]", e);
      return { ok: false, error: "Yadda saxlanmadı" };
    }
  });
}
