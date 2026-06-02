"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { safeStockDecrement, stockIncrement } from "@/lib/db/stock-guards";
import { auth } from "@/auth";
import { getRequestPermissions } from "@/lib/auth/get-permissions";
import { audit } from "@/lib/audit/log";
import { createApprovalRequest } from "@/features/tesdiq/create";
import { getRiskRules } from "@/features/ayarlar/risk-rules";

async function requireStockPerm(perm: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Giriş tələb olunur" };
  const rolAd = (session.user.rol_ad ?? "").toLowerCase();
  if (rolAd.includes("sahibkar") || rolAd.includes("owner") || rolAd.includes("admin")) {
    return { ok: true };
  }
  const perms = await getRequestPermissions();
  if (!perms.includes(perm)) return { ok: false, error: `«${perm}» icazəsi lazımdır` };
  return { ok: true };
}

const StockAdjustSchema = z.object({
  mehsul_id: z.string().uuid(),
  anbar_id: z.coerce.number().int().positive(),
  nov: z.enum(["medaxil", "mexaric", "inventar"]),
  miqdar: z.coerce.number().positive(),
  qiymet: z.coerce.number().min(0).default(0),
  sebeb: z.string().min(2).max(500),
});

type ActionResult =
  | { ok: true; pending_approval?: boolean; message?: string }
  | { ok: false; error: string };

/**
 * Manuel stok düzəlişi.
 *
 * Sahibkar/admin olmayan istifadəçilər üçün risk qaydalarına görə yoxlanılır:
 *  - miqdar > stok_change_threshold_unit (default 100)
 *  - miqdar × qiymet > stok_change_threshold_azn (default 1000)
 *
 * İstənilən aşılırsa stok dəyişmir, təsdiq mərkəzinə göndərilir.
 * Sahibkar/admin yaxud `skipApprovalCheck: true` (propagation) ilə icra
 * birbaşa tətbiq olunur.
 */
export async function adjustStock(
  input: z.input<typeof StockAdjustSchema>,
  opts?: { skipApprovalCheck?: boolean },
): Promise<ActionResult> {
  const permCheck = await requireStockPerm("stok.duzelis");
  if (!permCheck.ok) return { ok: false, error: permCheck.error };

  const parsed = StockAdjustSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Forma yanlışdır" };
  const d = parsed.data;

  return withTenant(async () => {
    const { sahibkarId, istifadeciId, rolAd } = requireTenant();

    // Threshold yoxlama — yalnız "adi" istifadəçilər üçün
    const r = (rolAd ?? "").toLowerCase();
    const isPrivileged = r.includes("sahibkar") || r.includes("owner") || r.includes("admin");
    if (!isPrivileged && !opts?.skipApprovalCheck) {
      try {
        const rules = await getRiskRules();
        const valueAzn = d.miqdar * (d.qiymet || 0);
        const overUnit = rules.stok_change_threshold_unit > 0 && d.miqdar > rules.stok_change_threshold_unit;
        const overAzn = rules.stok_change_threshold_azn > 0 && valueAzn > rules.stok_change_threshold_azn;
        if (overUnit || overAzn) {
          const mehsul = await prisma.mehsullar.findUnique({
            where: { id: d.mehsul_id },
            select: { ad: true },
          }).catch(() => null);
          const anbar = await prisma.anbarlar.findUnique({
            where: { id: d.anbar_id },
            select: { ad: true },
          }).catch(() => null);
          const novLabel = d.nov === "medaxil" ? "mədaxil" : d.nov === "mexaric" ? "məxariç" : "inventar";
          const reasons: string[] = [];
          if (overUnit) reasons.push(`${d.miqdar} vahid > ${rules.stok_change_threshold_unit} həddi`);
          if (overAzn) reasons.push(`${valueAzn.toFixed(2)} ₼ > ${rules.stok_change_threshold_azn} ₼ həddi`);
          await createApprovalRequest({
            emeliyyat_nov: "stok_duzelis",
            resurs_nov: "stok",
            resurs_id: d.mehsul_id,
            basliq: `Böyük stok düzəlişi: ${mehsul?.ad ?? d.mehsul_id.slice(0, 8)} (${novLabel} ${d.miqdar})`,
            risk_sebeb: reasons.join("; "),
            mebleg: valueAzn || undefined,
            prioritet: overAzn && valueAzn > rules.stok_change_threshold_azn * 5 ? "yuxsek" : "orta",
            detay_json: {
              mehsul_id: d.mehsul_id,
              mehsul_ad: mehsul?.ad ?? null,
              anbar_id: d.anbar_id,
              anbar_ad: anbar?.ad ?? null,
              nov: d.nov,
              miqdar: d.miqdar,
              qiymet: d.qiymet,
              sebeb: d.sebeb,
              value_azn: valueAzn,
            },
          });
          await audit("yarat", "stok_duzelis_tesdiq", d.mehsul_id, {
            yeni_data: { nov: d.nov, miqdar: d.miqdar, anbar_id: d.anbar_id, value_azn: valueAzn },
            sebeb: `Böyük stok düzəlişi təsdiq mərkəzinə göndərildi: ${reasons.join("; ")}`,
          });
          revalidatePath("/tesdiq");
          return {
            ok: true,
            pending_approval: true,
            message: `Dəyişiklik təsdiqə göndərildi (${reasons.join("; ")}). Təsdiqlənmədən stok dəyişməyəcək.`,
          };
        }
      } catch (e) {
        console.warn("[adjustStock] threshold check failed, continuing:", e);
      }
    }

    try {
      await prisma.$transaction(async (tx) => {
        // medaxil → race-safe upsert (additive əməliyyat heç bir invariant pozmur)
        // mexaric → atomic decrement, yoxsa TOCTOU race ilə paralel mexariclər
        //   mənfi stok yarada bilər
        // inventar → mütləq dəyər təyin et (force-set)
        if (d.nov === "medaxil") {
          await stockIncrement(tx, {
            sahibkarId,
            mehsulId: d.mehsul_id,
            anbarId: d.anbar_id,
            miqdar: d.miqdar,
            ...(d.qiymet > 0 ? { sonQiymet: d.qiymet } : {}),
          });
        } else if (d.nov === "mexaric") {
          const dec = await safeStockDecrement(tx, {
            mehsulId: d.mehsul_id,
            anbarId: d.anbar_id,
            miqdar: d.miqdar,
          });
          if (!dec.ok) throw new Error(dec.error);
        } else {
          // inventar = mütləq dəyər (force-set)
          await tx.stok.upsert({
            where: { mehsul_id_anbar_id: { mehsul_id: d.mehsul_id, anbar_id: d.anbar_id } },
            update: { miqdar: d.miqdar },
            create: {
              sahibkar_id: sahibkarId,
              mehsul_id: d.mehsul_id,
              anbar_id: d.anbar_id,
              miqdar: d.miqdar,
              son_qiymet: d.qiymet || null,
            },
          });
        }

        await tx.anbar_hereketleri.create({
          data: {
            sahibkar_id: sahibkarId,
            anbar_id: d.anbar_id,
            mehsul_id: d.mehsul_id,
            nov: d.nov,
            miqdar: d.miqdar,
            qiymet: d.qiymet || null,
            ref_nov: "manual_adjust",
            edilen_id: istifadeciId,
            qeyd: d.sebeb,
          },
        });
      });

      revalidateTag(`stok:${sahibkarId}`, "max");
      revalidateTag(`dashboard:${sahibkarId}`, "max");

      // Audit: stok düzəlişi — bütün manual stok dəyişiklikləri izlənilməlidir
      await audit("yenile", "stok", d.mehsul_id, {
        yeni_data: { nov: d.nov, miqdar: d.miqdar, anbar_id: d.anbar_id, qiymet: d.qiymet || null },
        sebeb: d.sebeb,
      });

      // Manual stok düzəlişi — auto-push kanal-larına yenilik göndər
      const { emitStockChange } = await import("@/lib/stock-change-emitter");
      emitStockChange([d.mehsul_id]);

      return { ok: true };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Xəta";
      console.error("[adjustStock]", e);
      return { ok: false, error: msg };
    }
  });
}

const TransferSchema = z.object({
  mehsul_id: z.string().uuid(),
  kaynak_anbar_id: z.coerce.number().int().positive(),
  hedef_anbar_id: z.coerce.number().int().positive(),
  miqdar: z.coerce.number().positive(),
  qeyd: z.string().max(500).optional().or(z.literal("")),
});

export async function transferStock(input: z.input<typeof TransferSchema>): Promise<ActionResult> {
  const permCheck = await requireStockPerm("stok.transfer");
  if (!permCheck.ok) return { ok: false, error: permCheck.error };

  const parsed = TransferSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Forma yanlışdır" };
  const d = parsed.data;

  if (d.kaynak_anbar_id === d.hedef_anbar_id) {
    return { ok: false, error: "Mənbə və hədəf anbarı eyni ola bilməz" };
  }

  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();

    try {
      await prisma.$transaction(async (tx) => {
        // 1+2. Atomic check-and-decrement at source — race-safe
        const dec = await safeStockDecrement(tx, {
          mehsulId: d.mehsul_id,
          anbarId: d.kaynak_anbar_id,
          miqdar: d.miqdar,
        });
        if (!dec.ok) throw new Error(dec.error);
        // Need source row for son_qiymet reference (used in dest create below)
        const source = await tx.stok.findFirst({
          where: { sahibkar_id: sahibkarId, mehsul_id: d.mehsul_id, anbar_id: d.kaynak_anbar_id },
          select: { son_qiymet: true },
        });

        // 3. Increment dest — race-safe upsert (paralel transfer-lər unique
        // constraint xətası vermir, increment additivdir)
        const refQiymet = source?.son_qiymet ?? null;
        await stockIncrement(tx, {
          sahibkarId,
          mehsulId: d.mehsul_id,
          anbarId: d.hedef_anbar_id,
          miqdar: d.miqdar,
          ...(refQiymet != null ? { sonQiymet: Number(refQiymet) } : {}),
        });

        // 4. Two movement records (source cıxış + hədəf giriş)
        await tx.anbar_hereketleri.createMany({
          data: [
            {
              sahibkar_id: sahibkarId,
              anbar_id: d.kaynak_anbar_id,
              mehsul_id: d.mehsul_id,
              nov: "transfer_cixis",
              miqdar: d.miqdar,
              qiymet: refQiymet ? Number(refQiymet) : null,
              ref_nov: "transfer",
              edilen_id: istifadeciId,
              qeyd: d.qeyd || null,
            },
            {
              sahibkar_id: sahibkarId,
              anbar_id: d.hedef_anbar_id,
              mehsul_id: d.mehsul_id,
              nov: "transfer_giris",
              miqdar: d.miqdar,
              qiymet: refQiymet ? Number(refQiymet) : null,
              ref_nov: "transfer",
              edilen_id: istifadeciId,
              qeyd: d.qeyd || null,
            },
          ],
        });
      });

      revalidateTag(`stok:${sahibkarId}`, "max");
      revalidateTag(`dashboard:${sahibkarId}`, "max");
      await audit("yenile", "stok_transfer", d.mehsul_id, {
        yeni_data: {
          kaynak_anbar_id: d.kaynak_anbar_id,
          hedef_anbar_id: d.hedef_anbar_id,
          miqdar: d.miqdar,
        },
        sebeb: d.qeyd || undefined,
      });
      return { ok: true };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Xəta";
      console.error("[transferStock]", e);
      return { ok: false, error: msg };
    }
  });
}
