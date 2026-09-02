"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";

type Result = { ok: true } | { ok: false; error: string };

/**
 * Gizli rejimi aktivləşdir / söndür. Yalnız sahibkar (rol_id=9) icra edə bilər.
 *
 * Cookie-lər:
 *  - stealth_mode: "1" | undefined
 *  - stealth_scale: "0.2" və s. (0-1 arası)
 *
 * Cookie-lər http-only deyil — UI client tərəfdə də banner göstərə bilsin.
 * Lakin cookie-ni dəyişmək yalnız bu server action ilə mümkündür (PIN tələbi var).
 */
export async function setStealthMode(formData: FormData): Promise<Result> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Sessiya yoxdur" };
  if (session.user.rol_ad !== "sahibkar") return { ok: false, error: "Yalnız sahibkar" };

  const action = String(formData.get("action") ?? "");
  const scale = Number(formData.get("scale") ?? "0.2");
  const pin = String(formData.get("pin") ?? "");

  // PIN yoxlanışı — sahibkar PIN-i ilə eyni
  const valid = await verifySahibkarPin(pin);
  if (!valid) return { ok: false, error: "PIN yanlışdır" };

  const c = await cookies();
  if (action === "on") {
    if (!Number.isFinite(scale) || scale <= 0 || scale >= 1) {
      return { ok: false, error: "Scale 0 ilə 1 arası olmalıdır" };
    }
    c.set("stealth_mode", "1", {
      httpOnly: false,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 12, // 12 saat — sonra avto-söndürülür
    });
    c.set("stealth_scale", String(scale), {
      httpOnly: false,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 12,
    });
  } else {
    c.delete("stealth_mode");
    c.delete("stealth_scale");
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

async function verifySahibkarPin(pin: string): Promise<boolean> {
  if (!pin) return false;
  return withTenant(async () => {
    const cfg = await prisma.sahibkar_ayar.findFirst({
      select: { sifre_hash: true },
      omit: { sifre_hash: false },
    });
    if (!cfg?.sifre_hash) return false;
    // bcryptjs hash müqayisəsi
    try {
      const bcrypt = await import("bcryptjs");
      return await bcrypt.compare(pin, cfg.sifre_hash);
    } catch {
      return false;
    }
  });
}
