"use server";

import { revalidateTag } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";

type Result = { ok: true } | { ok: false; error: string };

/** Tək bildirişi oxunmuş kimi işarələ. */
export async function markBildirisRead(id: string): Promise<Result> {
  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    try {
      await prisma.bildirisler.updateMany({
        where: { id, istifadeci_id: istifadeciId, sahibkar_id: sahibkarId },
        data: { oxundu: true },
      });
      revalidateTag(`bildirisler:${sahibkarId}:${istifadeciId}`, "max");
      return { ok: true };
    } catch (e) {
      console.error("[markBildirisRead]", e);
      return { ok: false, error: "Alınmadı" };
    }
  });
}

/** İstifadəçinin bütün bildirişlərini oxunmuş et. */
export async function markAllBildirisRead(): Promise<Result> {
  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    try {
      await prisma.bildirisler.updateMany({
        where: { istifadeci_id: istifadeciId, sahibkar_id: sahibkarId, oxundu: false },
        data: { oxundu: true },
      });
      revalidateTag(`bildirisler:${sahibkarId}:${istifadeciId}`, "max");
      return { ok: true };
    } catch (e) {
      console.error("[markAllBildirisRead]", e);
      return { ok: false, error: "Alınmadı" };
    }
  });
}
