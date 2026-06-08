"use server";

import { revalidatePath } from "next/cache";
import { Prisma, prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { safeAuditLog } from "@/lib/audit/safe-log";
import { audit } from "@/lib/audit/log";
import { safeUserMessage } from "@/lib/error/user-message";
import { requireMaliyyePerm, requireMaliyyeActionPerm, bustMaliyyeCache } from "./access-guard";

type ActionResult<T = void> = { ok: true; data?: T } | { ok: false; error: string };

/* =========================================================================
 * 1. ACTIVITY FEED — son 100 maliyə hadisəsi (audit_log əsasında)
 * ======================================================================= */
export type MaliyyeActivityItem = {
  id: string;
  emeliyyat: string;
  resurs_nov: string;
  resurs_id: string | null;
  istifadeci_ad: string | null;
  sebeb: string | null;
  status: string | null;
  yaradildi: Date;
};

export async function getMaliyyeActivityFeed(limit = 100): Promise<MaliyyeActivityItem[]> {
  await requireMaliyyePerm();
  const safeLimit = Math.min(500, Math.max(1, limit));
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const rows = await prisma.audit_log.findMany({
      where: {
        sahibkar_id: sahibkarId,
        resurs_nov: {
          in: [
            "finance_operations",
            "maliye_hesabi",
            "xerc",
            "xerc_kateqoriya",
            "bank_cixarisi",
            "marketplace_payment",
            "gun_sonu",
            "maliyye_threshold",
            "recurring_rule",
            "finance_attachment",
            "kontragent",
          ],
        },
      },
      orderBy: { yaradildi: "desc" },
      take: safeLimit,
      select: {
        id: true,
        emeliyyat: true,
        resurs_nov: true,
        resurs_id: true,
        istifadeci_ad: true,
        sebeb: true,
        status: true,
        yaradildi: true,
      },
    });
    return rows.map((r) => ({
      id: String(r.id),
      emeliyyat: r.emeliyyat,
      resurs_nov: r.resurs_nov,
      resurs_id: r.resurs_id,
      istifadeci_ad: r.istifadeci_ad,
      sebeb: r.sebeb,
      status: r.status,
      yaradildi: r.yaradildi ?? new Date(),
    }));
  });
}

/* =========================================================================
 * 2. BULK APPROVE/REJECT OPERATIONS — çoxlu əməliyyatı toplu təsdiq/rədd
 * ======================================================================= */
export async function bulkApproveOperations(
  ids: string[],
): Promise<ActionResult<{ approved: number; failed: number }>> {
  const permCheck = await requireMaliyyeActionPerm(["fin_op.tesdiq", "tesdiq.yoxla", "maliyye.idare"]);
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  if (!Array.isArray(ids) || ids.length === 0) return { ok: false, error: "Heç bir əməliyyat seçilməyib" };
  if (ids.length > 200) return { ok: false, error: "Bir dəfəyə 200-dən çox olmamalıdır" };
  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    try {
      const r = await prisma.finance_operations.updateMany({
        where: {
          sahibkar_id: sahibkarId,
          id: { in: ids },
          status: { in: ["gozleyen_tesdiq", "gozleyir"] },
        },
        data: {
          status: "aktiv",
          tesdiq_eden_id: istifadeciId ?? null,
          tesdiq_de: new Date(),
          yenilendi: new Date(),
        },
      });
      try {
        await safeAuditLog({
          sahibkar_id: sahibkarId,
          istifadeci_id: istifadeciId,
          emeliyyat: "bulk_tesdiq",
          resurs_nov: "finance_operations",
          resurs_id: null,
          yeni_data: { requested: ids.length, approved: r.count },
          status: "ugur",
        });
      } catch { /* non-fatal */ }
      revalidatePath("/maliyye/emeliyyat");
      revalidatePath("/tesdiq");
      bustMaliyyeCache();
      return { ok: true, data: { approved: r.count, failed: ids.length - r.count } };
    } catch (e) {
      console.error("[bulkApproveOperations]", e);
      return { ok: false, error: safeUserMessage(e, "Toplu təsdiq alınmadı") };
    }
  });
}

export async function bulkRejectOperations(
  ids: string[],
  sebeb: string,
): Promise<ActionResult<{ rejected: number; failed: number }>> {
  const permCheck = await requireMaliyyeActionPerm(["fin_op.tesdiq", "tesdiq.yoxla", "maliyye.idare"]);
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  if (!Array.isArray(ids) || ids.length === 0) return { ok: false, error: "Heç bir əməliyyat seçilməyib" };
  if (ids.length > 200) return { ok: false, error: "Bir dəfəyə 200-dən çox olmamalıdır" };
  const cleanSebeb = (sebeb ?? "").trim().slice(0, 500);
  if (!cleanSebeb) return { ok: false, error: "Səbəb göstərilməlidir" };
  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    try {
      const r = await prisma.finance_operations.updateMany({
        where: {
          sahibkar_id: sahibkarId,
          id: { in: ids },
          status: { in: ["gozleyen_tesdiq", "gozleyir"] },
        },
        data: {
          status: "redd",
          legv_eden_id: istifadeciId ?? null,
          legv_de: new Date(),
          legv_sebeb: cleanSebeb,
          yenilendi: new Date(),
        },
      });
      try {
        await safeAuditLog({
          sahibkar_id: sahibkarId,
          istifadeci_id: istifadeciId,
          emeliyyat: "bulk_redd",
          resurs_nov: "finance_operations",
          resurs_id: null,
          yeni_data: { requested: ids.length, rejected: r.count, sebeb: cleanSebeb },
          status: "ugur",
        });
      } catch { /* non-fatal */ }
      revalidatePath("/maliyye/emeliyyat");
      revalidatePath("/tesdiq");
      bustMaliyyeCache();
      return { ok: true, data: { rejected: r.count, failed: ids.length - r.count } };
    } catch (e) {
      console.error("[bulkRejectOperations]", e);
      return { ok: false, error: safeUserMessage(e, "Toplu rədd alınmadı") };
    }
  });
}

/* =========================================================================
 * 3. CASHFLOW FORECAST — son 90 günün ortalama gündəlik daxil/xaric →
 *    gələcək 30 gün üçün proqnoz
 * ======================================================================= */
export type CashflowForecast = {
  son_90_daxil_orta: number;
  son_90_xaric_orta: number;
  son_90_net_orta: number;
  proqnoz_30: {
    daxil: number;
    xaric: number;
    net: number;
  };
  guven_faiz: number;
};

export async function getCashflowForecast(): Promise<CashflowForecast> {
  await requireMaliyyePerm("hesabat.oxu");
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const [daxil, xaric] = await Promise.all([
      prisma.finance_operations.aggregate({
        where: { sahibkar_id: sahibkarId, y_n: "daxil", tarix: { gte: since }, status: "aktiv" },
        _sum: { azn_meblegh: true },
      }),
      prisma.finance_operations.aggregate({
        where: { sahibkar_id: sahibkarId, y_n: "xaric", tarix: { gte: since }, status: "aktiv" },
        _sum: { azn_meblegh: true },
      }),
    ]);
    const daxilCem = Number(daxil._sum.azn_meblegh ?? 0);
    const xaricCem = Number(xaric._sum.azn_meblegh ?? 0);
    const daxilOrta = daxilCem / 90;
    const xaricOrta = xaricCem / 90;
    const guven = daxilCem > 0 || xaricCem > 0 ? 85 : 0;
    return {
      son_90_daxil_orta: Math.round(daxilOrta * 100) / 100,
      son_90_xaric_orta: Math.round(xaricOrta * 100) / 100,
      son_90_net_orta: Math.round((daxilOrta - xaricOrta) * 100) / 100,
      proqnoz_30: {
        daxil: Math.round(daxilOrta * 30 * 100) / 100,
        xaric: Math.round(xaricOrta * 30 * 100) / 100,
        net: Math.round((daxilOrta - xaricOrta) * 30 * 100) / 100,
      },
      guven_faiz: guven,
    };
  });
}

/* =========================================================================
 * 4. DEBTOR/CREDITOR AGING REPORTS — 30/60/90/120+ gün bucket-lərə görə
 * ======================================================================= */
export type AgingBucket = { bucket: string; sayi: number; cem: number };

async function agingReport(side: "debitor" | "kreditor"): Promise<AgingBucket[]> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const novFilter = side === "debitor" ? ["musteri", "her_ikisi"] : ["techizatci", "her_ikisi"];
    const balanceField = side === "debitor" ? "alacaq" : "borc";

    // Raw query: borc/alacaq müsbət olan kontragentlərə yatırılan son əməliyyat tarixinə görə yaş hesabla
    const rows = await prisma.$queryRaw<{ bucket: string; sayi: bigint; cem: number }[]>(
      Prisma.sql`
        WITH base AS (
          SELECT k.id,
                 k.${Prisma.raw(balanceField)} AS qaliq,
                 COALESCE((
                   SELECT MAX(fo.tarix)
                     FROM finance_operations fo
                    WHERE fo.sahibkar_id = ${sahibkarId}::uuid
                      AND fo.kontragent_id = k.id
                      AND fo.status = 'aktiv'
                 ), k.yaradildi::date) AS son_tarix
            FROM kontragentler k
           WHERE k.sahibkar_id = ${sahibkarId}::uuid
             AND k.nov = ANY(${novFilter}::text[])
             AND k.${Prisma.raw(balanceField)} > 0
        )
        SELECT CASE
                 WHEN CURRENT_DATE - son_tarix <= 30  THEN '0-30'
                 WHEN CURRENT_DATE - son_tarix <= 60  THEN '31-60'
                 WHEN CURRENT_DATE - son_tarix <= 90  THEN '61-90'
                 WHEN CURRENT_DATE - son_tarix <= 120 THEN '91-120'
                 ELSE '120+'
               END AS bucket,
               COUNT(*)::bigint AS sayi,
               COALESCE(SUM(qaliq), 0)::float AS cem
          FROM base
         GROUP BY bucket
         ORDER BY MIN(CURRENT_DATE - son_tarix)
      `,
    );
    return rows.map((r) => ({
      bucket: r.bucket,
      sayi: Number(r.sayi),
      cem: Number(r.cem),
    }));
  });
}

export async function getDebtorAgingReport(): Promise<AgingBucket[]> {
  await requireMaliyyePerm("debitor.oxu");
  return agingReport("debitor");
}

export async function getCreditorAgingReport(): Promise<AgingBucket[]> {
  await requireMaliyyePerm("kreditor.oxu");
  return agingReport("kreditor");
}

/* =========================================================================
 * 5. EXPORT FINANCE CSV — əməliyyatları CSV kimi (audit ilə)
 * ======================================================================= */
export async function exportFinanceCsv(
  baslangic?: string,
  son?: string,
): Promise<ActionResult<{ csv: string; sayi: number }>> {
  const permCheck = await requireMaliyyeActionPerm(["maliyye.export", "hesabat.export", "maliyye.oxu"]);
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    try {
      const where: Prisma.finance_operationsWhereInput = { sahibkar_id: sahibkarId };
      if (baslangic) where.tarix = { ...(where.tarix as object ?? {}), gte: new Date(baslangic) };
      if (son) where.tarix = { ...(where.tarix as object ?? {}), lte: new Date(son) };
      const rows = await prisma.finance_operations.findMany({
        where,
        orderBy: { tarix: "desc" },
        take: 5000,
        select: {
          tarix: true,
          sened_nomresi: true,
          type_kod: true,
          y_n: true,
          meblegh: true,
          valyuta: true,
          azn_meblegh: true,
          status: true,
          maliye_hesablari_finance_operations_hesab_idTomaliye_hesablari: { select: { ad: true } },
          kontragentler: { select: { ad: true } },
          qeyd: true,
        },
      });
      const escape = (s: unknown): string => {
        const v = String(s ?? "").replace(/"/g, '""');
        return /[",\n]/.test(v) ? `"${v}"` : v;
      };
      const header = "Tarix,Sənəd №,Növ,Yön,Məbləğ,Valyuta,AZN ekvivalent,Status,Hesab,Kontragent,Qeyd";
      const lines = rows.map((r) =>
        [
          r.tarix.toISOString().slice(0, 10),
          r.sened_nomresi ?? "",
          r.type_kod,
          r.y_n,
          Number(r.meblegh).toFixed(2),
          r.valyuta ?? "AZN",
          Number(r.azn_meblegh ?? 0).toFixed(2),
          r.status,
          r.maliye_hesablari_finance_operations_hesab_idTomaliye_hesablari?.ad ?? "",
          r.kontragentler?.ad ?? "",
          r.qeyd ?? "",
        ]
          .map(escape)
          .join(","),
      );
      const csv = [header, ...lines].join("\n");
      try {
        await audit("export", "finance_operations", null, {
          yeni_data: { sayi: rows.length, baslangic: baslangic ?? null, son: son ?? null },
          sebeb: "Maliyə əməliyyatları CSV kimi export edildi",
        });
      } catch { /* non-fatal */ }
      return { ok: true, data: { csv, sayi: rows.length } };
    } catch (e) {
      console.error("[exportFinanceCsv]", e);
      return { ok: false, error: safeUserMessage(e, "Export alınmadı") };
    }
  });
}

/* =========================================================================
 * 6. EMERGENCY FREEZE FINANCE — bütün maliyə əməliyyatlarını dayandır
 * ======================================================================= */
export async function emergencyFreezeFinance(
  freeze: boolean,
  reason: string,
): Promise<ActionResult<{ freeze: boolean }>> {
  const permCheck = await requireMaliyyeActionPerm(["maliyye.freeze", "ayarlar.idare"]);
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  if (freeze && !reason.trim()) return { ok: false, error: "Səbəb göstərilməlidir" };
  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    try {
      await prisma.ayarlar.upsert({
        where: { sahibkar_id_qrup_acar: { sahibkar_id: sahibkarId, qrup: "maliyye", acar: "freeze" } },
        update: { deyer: String(freeze), yenilendi: new Date(), nov: "boolean" },
        create: {
          sahibkar_id: sahibkarId,
          qrup: "maliyye",
          acar: "freeze",
          deyer: String(freeze),
          nov: "boolean",
          tesvir: "Maliyə əməliyyatlarını dayandırma kill-switch",
        },
      });
      try {
        await safeAuditLog({
          sahibkar_id: sahibkarId,
          istifadeci_id: istifadeciId,
          emeliyyat: freeze ? "freeze" : "unfreeze",
          resurs_nov: "maliyye_freeze",
          resurs_id: null,
          yeni_data: { freeze, reason: reason.slice(0, 500) },
          status: "ugur",
        });
      } catch { /* non-fatal */ }
      revalidatePath("/maliyye");
      bustMaliyyeCache();
      return { ok: true, data: { freeze } };
    } catch (e) {
      console.error("[emergencyFreezeFinance]", e);
      return { ok: false, error: safeUserMessage(e, "Maliyə dayandırılması icra olunmadı") };
    }
  });
}

export async function isMaliyyeFrozen(): Promise<boolean> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const row = await prisma.ayarlar.findUnique({
      where: { sahibkar_id_qrup_acar: { sahibkar_id: sahibkarId, qrup: "maliyye", acar: "freeze" } },
    });
    return row?.deyer === "true";
  });
}

/* =========================================================================
 * 7. RECURRING SCHEDULE HEALTH — gecikən / söndürülmüş rule-lar
 * ======================================================================= */
export type RecurringHealth = {
  cem_rule: number;
  aktiv: number;
  sondurulmus: number;
  son_30_gun_yaradilmis: number;
  next_due: { id: string; tarix: Date; type_kod: string; meblegh: number; qeyd: string | null }[];
};

export async function getRecurringScheduleHealth(): Promise<RecurringHealth> {
  await requireMaliyyePerm();
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [cem, aktiv, sondurulmus, son30, nextDue] = await Promise.all([
      prisma.finance_operations.count({
        where: { sahibkar_id: sahibkarId, OR: [{ qeyd: { contains: "[RECUR:" } }, { qeyd: { contains: "[RECUR_OFF]" } }] },
      }),
      prisma.finance_operations.count({
        where: { sahibkar_id: sahibkarId, qeyd: { contains: "[RECUR:" } },
      }),
      prisma.finance_operations.count({
        where: { sahibkar_id: sahibkarId, qeyd: { contains: "[RECUR_OFF]" } },
      }),
      prisma.finance_operations.count({
        where: { sahibkar_id: sahibkarId, qeyd: { contains: "[RECUR:" }, yaradildi: { gte: since30 } },
      }),
      prisma.finance_operations.findMany({
        where: { sahibkar_id: sahibkarId, qeyd: { contains: "[RECUR:" }, status: "aktiv" },
        orderBy: { tarix: "asc" },
        take: 20,
        select: { id: true, tarix: true, type_kod: true, meblegh: true, qeyd: true },
      }),
    ]);
    return {
      cem_rule: cem,
      aktiv,
      sondurulmus,
      son_30_gun_yaradilmis: son30,
      next_due: nextDue.map((n) => ({
        id: n.id,
        tarix: n.tarix,
        type_kod: n.type_kod,
        meblegh: Number(n.meblegh),
        qeyd: n.qeyd,
      })),
    };
  });
}

/* =========================================================================
 * 8. BANK ACCOUNT BALANCES — bütün hesabların qaliq xülasəsi
 * ======================================================================= */
export type AccountBalance = {
  id: string;
  ad: string;
  nov: string;
  valyuta: string;
  qaliq: number;
  bank_adi: string | null;
  aktiv: boolean;
};

export async function getBankAccountBalances(): Promise<AccountBalance[]> {
  await requireMaliyyePerm("hesab.oxu");
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const rows = await prisma.maliye_hesablari.findMany({
      where: { sahibkar_id: sahibkarId },
      orderBy: [{ aktiv: "desc" }, { nov: "asc" }, { ad: "asc" }],
      select: {
        id: true,
        ad: true,
        nov: true,
        valyuta: true,
        qaliq: true,
        bank_adi: true,
        aktiv: true,
      },
    });
    return rows.map((r) => ({
      id: r.id,
      ad: r.ad,
      nov: r.nov,
      valyuta: r.valyuta ?? "AZN",
      qaliq: Number(r.qaliq ?? 0),
      bank_adi: r.bank_adi,
      aktiv: r.aktiv ?? false,
    }));
  });
}

/* =========================================================================
 * 9. KASSA RECONCILIATION STATUS — açıq kassa & vərdiş gün-sonu yoxlanışı
 * ======================================================================= */
export type KassaReconStatus = {
  acig_kassa_sayi: number;
  son_gun_sonu: { tarix: Date | null; status: string | null; menfeet: number };
  bu_ay_son_acig_qaliq: number;
  tamamlanmamis_emeliyyat: number;
};

export async function getKassaReconciliationStatus(): Promise<KassaReconStatus> {
  await requireMaliyyePerm("kassa.oxu");
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const [acig, sonGunSonu, qaliqAgg, gozleyirEmel] = await Promise.all([
      prisma.kassalar.count({ where: { sahibkar_id: sahibkarId, status: "acig" } }),
      prisma.gun_sonu.findFirst({
        where: { sahibkar_id: sahibkarId },
        orderBy: { tarix: "desc" },
        select: { tarix: true, status: true, menfeet: true },
      }),
      prisma.kassalar.aggregate({
        where: { sahibkar_id: sahibkarId, status: "acig" },
        _sum: { acilis_qaligi: true },
      }),
      prisma.finance_operations.count({
        where: { sahibkar_id: sahibkarId, status: { in: ["gozleyen_tesdiq", "gozleyir"] } },
      }),
    ]);
    return {
      acig_kassa_sayi: acig,
      son_gun_sonu: {
        tarix: sonGunSonu?.tarix ?? null,
        status: sonGunSonu?.status ?? null,
        menfeet: Number(sonGunSonu?.menfeet ?? 0),
      },
      bu_ay_son_acig_qaliq: Number(qaliqAgg._sum.acilis_qaligi ?? 0),
      tamamlanmamis_emeliyyat: gozleyirEmel,
    };
  });
}

/* =========================================================================
 * 10. APPROVAL QUEUE FOR FINANCE — gözləyən maliyə təsdiq tələbləri
 * ======================================================================= */
export type FinanceApprovalQueueItem = {
  id: number;
  basliq: string | null;
  resurs_id: string | null;
  mebleg: number;
  prioritet: string;
  risk_sebeb: string | null;
  yaradildi: Date;
};

export async function approvalQueueForFinance(): Promise<FinanceApprovalQueueItem[]> {
  await requireMaliyyePerm("tesdiq.oxu");
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const rows = await prisma.tesdiq_telep.findMany({
      where: {
        sahibkar_id: sahibkarId,
        status: "gozleyir",
        emeliyyat_nov: { in: ["maliyye_op", "xerc", "transfer"] },
      },
      orderBy: [{ prioritet: "desc" }, { yaradildi: "desc" }],
      take: 100,
      select: {
        id: true,
        basliq: true,
        resurs_id: true,
        mebleg: true,
        prioritet: true,
        risk_sebeb: true,
        yaradildi: true,
      },
    });
    return rows.map((r) => ({
      id: r.id,
      basliq: r.basliq,
      resurs_id: r.resurs_id,
      mebleg: Number(r.mebleg ?? 0),
      prioritet: r.prioritet ?? "orta",
      risk_sebeb: r.risk_sebeb,
      yaradildi: r.yaradildi ?? new Date(),
    }));
  });
}
