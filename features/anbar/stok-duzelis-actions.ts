"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { auth } from "@/auth";
import { getRequestPermissions } from "@/lib/auth/get-permissions";
import { audit } from "@/lib/audit/log";

/**
 * STOK DÜZƏLİŞ AKTI — yalnız sahibkar/admin/owner üçün məhdud icazəli əməliyyat.
 *
 * Bu vahid yerdir ki, stok manual artırıla/azaldıla bilər (yanlışlıqları
 * təshih etmək üçün). Bütün digər stok dəyişiklikləri Ticarət modulundan
 * (satış/alış/qaytarma) və ya anbar əməliyyatlarından (transfer/defekt/sayım)
 * gəlməlidir.
 *
 * Hər düzəliş üçün:
 *   - Məcburi səbəb
 *   - Audit log (kim, nə vaxt, nə üçün, hansı miqdar dəyişdi)
 *   - anbar_hereketleri-də "stok_duzelis" növlü qeyd
 */

type ActionResult = { ok: true; id: string } | { ok: false; error: string };

const StokDuzelisSchema = z.object({
  anbar_id: z.coerce.number().int().positive(),
  mehsul_id: z.string().uuid(),
  yeni_miqdar: z.coerce.number().min(0, "Stok mənfi ola bilməz"),
  sebeb: z
    .string()
    .min(10, "Səbəb ən azı 10 simvol olmalıdır — niyə dəyişdirilir, nə yanlışlıq idi?")
    .max(2000),
});

async function requireStokDuzelisPerm(): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Giriş tələb olunur" };
  const rolAd = (session.user.rol_ad ?? "").toLowerCase();
  if (rolAd.includes("sahibkar") || rolAd.includes("admin") || rolAd.includes("owner")) {
    return { ok: true };
  }
  const perms = await getRequestPermissions();
  if (perms.includes("stok.duzelis")) return { ok: true };
  return {
    ok: false,
    error: "Stok düzəlişi yalnız «stok.duzelis» icazəsi olan istifadəçilərə açıqdır",
  };
}

export async function applyStokDuzelis(
  input: z.input<typeof StokDuzelisSchema>,
): Promise<ActionResult> {
  const perm = await requireStokDuzelisPerm();
  if (!perm.ok) return { ok: false, error: perm.error };

  const parsed = StokDuzelisSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Forma yanlışdır" };
  }
  const d = parsed.data;

  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    try {
      const result = await prisma.$transaction(async (tx) => {
        // Mövcud stok-u oxu
        const existing = await tx.stok.findFirst({
          where: { mehsul_id: d.mehsul_id, anbar_id: d.anbar_id, sahibkar_id: sahibkarId },
          select: { id: true, miqdar: true, son_qiymet: true },
        });
        const koheneMiqdar = Number(existing?.miqdar ?? 0);
        const ferq = d.yeni_miqdar - koheneMiqdar;

        if (Math.abs(ferq) < 0.001) {
          throw new Error("Yeni miqdar köhnə miqdarla eynidir — düzəlişə ehtiyac yoxdur");
        }

        // Atomic upsert
        await tx.stok.upsert({
          where: {
            mehsul_id_anbar_id: { mehsul_id: d.mehsul_id, anbar_id: d.anbar_id },
          },
          update: { miqdar: d.yeni_miqdar },
          create: {
            sahibkar_id: sahibkarId,
            mehsul_id: d.mehsul_id,
            anbar_id: d.anbar_id,
            miqdar: d.yeni_miqdar,
            son_qiymet: null,
          },
        });

        // anbar_hereketleri jurnal qeydi (source-of-truth)
        await tx.anbar_hereketleri.create({
          data: {
            sahibkar_id: sahibkarId,
            anbar_id: d.anbar_id,
            mehsul_id: d.mehsul_id,
            nov: ferq > 0 ? "medaxil" : "mexaric",
            miqdar: Math.abs(ferq),
            qiymet: existing?.son_qiymet ?? null,
            ref_nov: "stok_duzelis",
            qeyd: `Stok düzəliş aktı: ${koheneMiqdar} → ${d.yeni_miqdar} (${ferq > 0 ? "+" : ""}${ferq.toFixed(3)}). Səbəb: ${d.sebeb}`,
            edilen_id: istifadeciId,
          },
        });

        // mehsullar.stok_cemi triggeri avtomatik yeniləyir.

        return {
          id: existing?.id?.toString() ?? d.mehsul_id,
          kohne: koheneMiqdar,
          yeni: d.yeni_miqdar,
          ferq,
        };
      });

      try {
        await audit("yenile", "stok_duzelis", `${d.mehsul_id}_${d.anbar_id}`, {
          evvelki_data: { miqdar: result.kohne },
          yeni_data: { miqdar: result.yeni, ferq: result.ferq },
          sebeb: `Stok düzəliş aktı: ${d.sebeb}`,
        });
      } catch { /* non-fatal */ }

      revalidatePath("/anbar/stok");
      revalidatePath("/anbar/stok/duzelis");
      revalidatePath("/anbar/mehsullar");
      revalidatePath("/anbar/hereketler");
      return { ok: true, id: result.id };
    } catch (e) {
      console.error("[applyStokDuzelis]", e);
      return { ok: false, error: e instanceof Error ? e.message : "Düzəliş alınmadı" };
    }
  });
}
