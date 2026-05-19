import "server-only";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { loadTesdiqCfg, type TesdiqCfg } from "./settings";

export type CreateApprovalInput = {
  emeliyyat_nov: ApprovalKind;
  resurs_nov?: string;       // "satis_sifaris", "mehsul", "kontragent", etc.
  resurs_id?: string;        // entity id (UUID or int as string)
  basliq: string;
  risk_sebeb?: string;       // why does this need approval
  mebleg?: number;
  prioritet?: "asagi" | "orta" | "yuxsek" | "kritik";
  detay_json?: Record<string, unknown>;
};

export type ApprovalKind =
  | "endirim"            // big discount on a sale
  | "qiymet_deyisdi"     // product price change
  | "maya_alti"          // selling below cost
  | "borc_limit"         // exceeding customer credit limit
  | "silme"              // deleting a record (sale, product, etc.)
  | "qaytarma"           // refund / return
  | "xerc"               // big expense
  | "stok_duzelis"       // stock adjustment / write-off
  // ── 4-eyes (tam-sənəd) təsdiqi ──
  | "alis_qaime"         // hər alış qaiməsi yaradanda — kassir/menecer üçün
  | "satis_qaime"        // hər satış qaiməsi yaradanda
  | "mehsul_yaratma"     // hər yeni məhsul yaradanda
  | "ticaret_emeliyyat"  // transfer, qaytarma, digər ticarət əməliyyatları
  | "diger";             // generic

type Result =
  | { ok: true; id: number; auto_approved: boolean }
  | { ok: false; error: string };

/**
 * Module-friendly approval factory.
 *
 * Behavior:
 *  - If the relevant rule is disabled in settings → skips creation (returns ok:true, id:0, auto_approved:true)
 *  - If mebleg ≤ auto_approve_mebleg → auto-creates as already "tesdiq"
 *  - Otherwise creates a pending request, also writes initial log entry
 *
 * Other modules call this whenever a sensitive operation happens. Example:
 *
 *   await createApprovalRequest({
 *     emeliyyat_nov: "endirim",
 *     resurs_nov: "satis_sifaris",
 *     resurs_id: order.id,
 *     basliq: `${customer.ad} — 28% endirim`,
 *     risk_sebeb: "Endirim 20% threshold-u keçir",
 *     mebleg: discount_amount,
 *     prioritet: "yuxsek",
 *   });
 */
export async function createApprovalRequest(input: CreateApprovalInput): Promise<Result> {
  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    const cfg = await loadTesdiqCfg();

    // Per-type enabling gate
    if (!isKindEnabled(input.emeliyyat_nov, cfg)) {
      return { ok: true, id: 0, auto_approved: true };
    }

    // Auto-approve small amounts
    const autoApprove = cfg.auto_approve_mebleg > 0 && (input.mebleg ?? 0) <= cfg.auto_approve_mebleg;

    // Dublikat qarşısı: eyni resurs üçün gözləyən sorğu varsa, onu yenilə
    // (məhsul update halında əməkdaş bir neçə dəfə save basa bilər).
    if (!autoApprove && input.resurs_nov && input.resurs_id) {
      const existing = await prisma.tesdiq_telep.findFirst({
        where: {
          sahibkar_id: sahibkarId,
          resurs_nov: input.resurs_nov,
          resurs_id: input.resurs_id,
          status: "gozleyir",
        },
        select: { id: true },
      });
      if (existing) {
        await prisma.tesdiq_telep.update({
          where: { id: existing.id },
          data: {
            basliq: input.basliq,
            risk_sebeb: input.risk_sebeb ?? null,
            mebleg: input.mebleg ?? null,
            prioritet: input.prioritet ?? "orta",
            detay_json: input.detay_json ? (input.detay_json as object) : undefined,
            yaradan_id: istifadeciId,
          },
        });
        try {
          await prisma.tesdiq_log.create({
            data: {
              telep_id: existing.id,
              istifadeci_id: istifadeciId,
              emeliyyat: "yenilendi",
              evvelki_status: "gozleyir",
              yeni_status: "gozleyir",
              qeyd: "Eyni resurs üçün yeni cəhd — sorğu yeniləndi",
            },
          });
        } catch {
          /* log skip */
        }
        return { ok: true, id: existing.id, auto_approved: false };
      }
    }

    try {
      const row = await prisma.tesdiq_telep.create({
        data: {
          sahibkar_id: sahibkarId,
          yaradan_id: istifadeciId,
          emeliyyat_nov: input.emeliyyat_nov,
          resurs_nov: input.resurs_nov ?? null,
          resurs_id: input.resurs_id ?? null,
          basliq: input.basliq,
          risk_sebeb: input.risk_sebeb ?? null,
          mebleg: input.mebleg ?? null,
          prioritet: input.prioritet ?? "orta",
          status: autoApprove ? "tesdiq" : "gozleyir",
          baxan_id: autoApprove ? istifadeciId : null,
          netice_tarix: autoApprove ? new Date() : null,
          netice_qeyd: autoApprove ? "Auto-təsdiq (kiçik məbləğ)" : null,
          detay_json: input.detay_json ? (input.detay_json as object) : undefined,
        },
        select: { id: true },
      });

      // Log creation
      try {
        await prisma.tesdiq_log.create({
          data: {
            telep_id: row.id,
            istifadeci_id: istifadeciId,
            emeliyyat: autoApprove ? "auto_tesdiq" : "yaradildi",
            evvelki_status: null,
            yeni_status: autoApprove ? "tesdiq" : "gozleyir",
            qeyd: autoApprove ? "Sistem tərəfindən auto-təsdiq" : input.risk_sebeb ?? null,
          },
        });
      } catch (e) {
        console.warn("[createApprovalRequest] log skipped:", e);
      }

      // Bildiriş — yalnız gözləyən sorğularda
      if (!autoApprove) {
        await notifyApprovers({
          sahibkarId,
          telepId: row.id,
          basliq: input.basliq,
          emeliyyatNov: input.emeliyyat_nov,
          prioritet: input.prioritet ?? "orta",
          excludeUserId: istifadeciId,
          approverIdsCsv: cfg.tesdiq_eden_idler ?? "",
        });
      }

      return { ok: true, id: row.id, auto_approved: autoApprove };
    } catch (e) {
      console.error("[createApprovalRequest]", e);
      return { ok: false, error: "Təsdiq tələbi yaradıla bilmədi" };
    }
  });
}

/**
 * Təsdiq sorğusu yarananda təyin olunmuş təsdiq edən şəxslərə + sahibkar(lar)a
 * in-app bildiriş göndərir. Email/SMS deyil — yalnız sistem daxili "zəng".
 */
async function notifyApprovers(p: {
  sahibkarId: string;
  telepId: number;
  basliq: string;
  emeliyyatNov: string;
  prioritet: string;
  excludeUserId: string;
  approverIdsCsv: string;
}): Promise<void> {
  try {
    const designated = p.approverIdsCsv
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    // Boş siyahıda admin/sahibkar-a (rol 1 və 9) düşür
    let recipientIds: string[];
    if (designated.length > 0) {
      recipientIds = designated;
    } else {
      const adminUsers = await prisma.istifadeciler.findMany({
        where: { sahibkar_id: p.sahibkarId, aktiv: true, rol_id: { in: [1, 9] } },
        select: { id: true },
        take: 10,
      });
      recipientIds = adminUsers.map((u) => u.id);
    }

    const filtered = recipientIds.filter((id) => id !== p.excludeUserId);
    if (filtered.length === 0) return;

    await prisma.bildirisler.createMany({
      data: filtered.map((uid) => ({
        sahibkar_id: p.sahibkarId,
        istifadeci_id: uid,
        basliq: `Təsdiq tələbi: ${p.basliq}`,
        metn: `Yeni "${p.emeliyyatNov}" sorğusu cavab gözləyir.`,
        nov: p.prioritet === "kritik" || p.prioritet === "yuxsek" ? "warning" : "info",
        link: `/tesdiq/${p.telepId}`,
        resurs_nov: "tesdiq_telep",
        resurs_id: String(p.telepId),
        oxundu: false,
      })),
      skipDuplicates: true,
    });
  } catch (e) {
    console.warn("[notifyApprovers] skipped:", e);
  }
}

function isKindEnabled(kind: ApprovalKind, cfg: TesdiqCfg): boolean {
  switch (kind) {
    case "endirim": return cfg.endirim_aktiv;
    case "qiymet_deyisdi": return cfg.qiymet_deyisdi_aktiv;
    case "maya_alti": return cfg.maya_alti_aktiv;
    case "borc_limit": return cfg.borc_limit_aktiv;
    case "silme": return cfg.silme_aktiv;
    case "qaytarma": return cfg.qaytarma_aktiv;
    case "xerc": return cfg.xerc_aktiv;
    case "stok_duzelis": return cfg.stok_duzelis_aktiv;
    case "alis_qaime": return cfg.alis_qaime_aktiv;
    case "satis_qaime": return cfg.satis_qaime_aktiv;
    case "mehsul_yaratma": return cfg.mehsul_yaratma_aktiv;
    case "ticaret_emeliyyat": return cfg.ticaret_emeliyyat_aktiv;
    case "diger": return true;
  }
}

/**
 * Müəyyən bir sənəd növü yaradılanda 4-eyes təsdiq tələb olunurmu?
 * Hər hansı yaratma action-ı çağırmadan əvvəl bu helper ilə yoxlayın.
 */
export async function shouldRequireDocApproval(
  kind: "alis_qaime" | "satis_qaime" | "mehsul_yaratma" | "ticaret_emeliyyat",
): Promise<boolean> {
  const cfg = await loadTesdiqCfg();
  switch (kind) {
    case "alis_qaime": return cfg.alis_qaime_aktiv;
    case "satis_qaime": return cfg.satis_qaime_aktiv;
    case "mehsul_yaratma": return cfg.mehsul_yaratma_aktiv;
    case "ticaret_emeliyyat": return cfg.ticaret_emeliyyat_aktiv;
  }
}

/**
 * Helper: should this discount on a sale require approval?
 * Modules call this BEFORE creating the request to know if/what.
 */
export async function shouldApproveDiscount(pct: number): Promise<{ needed: boolean; kritik: boolean; pct: number }> {
  const cfg = await loadTesdiqCfg();
  if (!cfg.endirim_aktiv) return { needed: false, kritik: false, pct: cfg.endirim_limit_pct };
  return {
    needed: pct > cfg.endirim_limit_pct,
    kritik: pct >= cfg.endirim_kritik_pct,
    pct: cfg.endirim_limit_pct,
  };
}

export async function shouldApproveRefund(amount: number): Promise<{ needed: boolean; limit: number }> {
  const cfg = await loadTesdiqCfg();
  if (!cfg.qaytarma_aktiv) return { needed: false, limit: cfg.qaytarma_limit_mebleg };
  return { needed: amount > cfg.qaytarma_limit_mebleg, limit: cfg.qaytarma_limit_mebleg };
}

export async function shouldApproveExpense(amount: number): Promise<{ needed: boolean; limit: number }> {
  const cfg = await loadTesdiqCfg();
  if (!cfg.xerc_aktiv) return { needed: false, limit: cfg.xerc_limit_mebleg };
  return { needed: amount > cfg.xerc_limit_mebleg, limit: cfg.xerc_limit_mebleg };
}

export async function shouldApprovePriceChange(oldPrice: number, newPrice: number): Promise<{ needed: boolean; pct: number; threshold_pct: number }> {
  const cfg = await loadTesdiqCfg();
  const pct = oldPrice > 0 ? Math.abs((newPrice - oldPrice) / oldPrice) * 100 : 100;
  if (!cfg.qiymet_deyisdi_aktiv) return { needed: false, pct, threshold_pct: cfg.qiymet_deyisdi_pct };
  return { needed: pct > cfg.qiymet_deyisdi_pct, pct, threshold_pct: cfg.qiymet_deyisdi_pct };
}

export async function shouldApproveBelowCost(salePrice: number, cost: number): Promise<{ needed: boolean }> {
  const cfg = await loadTesdiqCfg();
  if (!cfg.maya_alti_aktiv) return { needed: false };
  return { needed: salePrice < cost };
}
