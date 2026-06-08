"use server";

import { revalidatePath } from "next/cache";
import { Prisma, prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { safeAuditLog } from "@/lib/audit/safe-log";
import { audit } from "@/lib/audit/log";
import {
  requireServisPerm,
  requireServisActionPerm,
  bustServisCache,
  generateServisCustomerToken,
} from "./access-guard";

type ActionResult<T = void> = { ok: true; data?: T } | { ok: false; error: string };

const OPEN_STATUSES = [
  "qebul_edildi",
  "diaqnostikada",
  "teklif_gozleyir",
  "usta_baxir",
  "ehtiyat_hisse",
  "temir_olunur",
  "temir_edildi",
];

/* =========================================================================
 * 1. ACTIVITY FEED — son 100 servis hadisəsi (audit_log əsasında)
 * ======================================================================= */
export type ServisActivityItem = {
  id: string;
  emeliyyat: string;
  resurs_nov: string;
  resurs_id: string | null;
  istifadeci_ad: string | null;
  sebeb: string | null;
  status: string | null;
  yaradildi: Date;
};

export async function getServisActivityFeed(limit = 100): Promise<ServisActivityItem[]> {
  await requireServisPerm();
  const safeLimit = Math.min(500, Math.max(1, limit));
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const rows = await prisma.audit_log.findMany({
      where: {
        sahibkar_id: sahibkarId,
        resurs_nov: { in: ["servis", "zemanet"] },
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
 * 2. BULK CHANGE STATUS — çoxlu servisin statusunu birlikdə dəyiş
 * ======================================================================= */
const ALLOWED_BULK_STATUSES = [
  "diaqnostikada",
  "teklif_gozleyir",
  "usta_baxir",
  "ehtiyat_hisse",
  "temir_olunur",
  "temir_edildi",
  "musteriye_tehvil",
] as const;

export async function bulkChangeServisStatus(
  ids: string[],
  yeni_status: (typeof ALLOWED_BULK_STATUSES)[number],
  qeyd?: string,
): Promise<ActionResult<{ updated: number }>> {
  const permCheck = await requireServisActionPerm(["servis.status", "servis.idare"]);
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  if (!Array.isArray(ids) || ids.length === 0) return { ok: false, error: "Heç bir servis seçilməyib" };
  if (ids.length > 100) return { ok: false, error: "Bir dəfəyə 100-dən çox servis olmamalıdır" };
  if (!ALLOWED_BULK_STATUSES.includes(yeni_status)) return { ok: false, error: "Status yanlışdır" };
  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    try {
      const r = await prisma.servis_qeydleri.updateMany({
        where: {
          sahibkar_id: sahibkarId,
          id: { in: ids },
          status: { notIn: ["qaytarildi", "redd_edildi", "musteriye_tehvil"] },
        },
        data: {
          status: yeni_status,
          yenilendi: new Date(),
          ...(yeni_status === "musteriye_tehvil"
            ? { qapanma_tarixi: new Date(), qapayan_id: istifadeciId }
            : {}),
        },
      });
      try {
        await safeAuditLog({
          sahibkar_id: sahibkarId,
          istifadeci_id: istifadeciId,
          emeliyyat: "bulk_status",
          resurs_nov: "servis",
          resurs_id: null,
          yeni_data: { yeni_status, requested: ids.length, updated: r.count, qeyd: qeyd ?? null },
          status: "ugur",
        });
      } catch { /* non-fatal */ }
      revalidatePath("/servis");
      bustServisCache();
      return { ok: true, data: { updated: r.count } };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Xəta" };
    }
  });
}

/* =========================================================================
 * 3. SLA REPORT — verilmiş günlərdən çox vaxt aparmış / aparan biletlər
 * ======================================================================= */
export type SlaRow = {
  id: string;
  nomre: string;
  musteri_ad: string;
  mehsul_ad: string;
  status: string;
  yaradildi: Date;
  texmini_tehvil: Date | null;
  gun_sayi: number;
  asilib: boolean;
};

export async function getServisSlaReport(slaGunSayi = 7): Promise<SlaRow[]> {
  await requireServisPerm("hesabat.oxu");
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const rows = await prisma.servis_qeydleri.findMany({
      where: { sahibkar_id: sahibkarId, status: { in: OPEN_STATUSES } },
      orderBy: { yaradildi: "asc" },
      take: 500,
      select: {
        id: true,
        nomre: true,
        musteri_ad: true,
        mehsul_ad: true,
        status: true,
        yaradildi: true,
        texmini_tehvil: true,
      },
    });
    const now = Date.now();
    return rows.map((r) => {
      const yardildi = r.yaradildi ?? new Date();
      const gunSayi = Math.floor((now - yardildi.getTime()) / (24 * 60 * 60 * 1000));
      const tehvilGecikdi = r.texmini_tehvil ? r.texmini_tehvil.getTime() < now : false;
      const asilib = gunSayi > slaGunSayi || tehvilGecikdi;
      return {
        id: r.id,
        nomre: r.nomre,
        musteri_ad: r.musteri_ad,
        mehsul_ad: r.mehsul_ad,
        status: r.status,
        yaradildi: yardildi,
        texmini_tehvil: r.texmini_tehvil,
        gun_sayi: gunSayi,
        asilib,
      };
    });
  });
}

/* =========================================================================
 * 4. OVERDUE LIST — texmini_tehvil keçmiş biletlər
 * ======================================================================= */
export async function getOverdueServisList(): Promise<SlaRow[]> {
  await requireServisPerm();
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const now = new Date();
    const rows = await prisma.servis_qeydleri.findMany({
      where: {
        sahibkar_id: sahibkarId,
        status: { in: OPEN_STATUSES },
        texmini_tehvil: { lt: now },
      },
      orderBy: { texmini_tehvil: "asc" },
      take: 200,
      select: {
        id: true,
        nomre: true,
        musteri_ad: true,
        mehsul_ad: true,
        status: true,
        yaradildi: true,
        texmini_tehvil: true,
      },
    });
    return rows.map((r) => {
      const y = r.yaradildi ?? now;
      const gunSayi = Math.floor((now.getTime() - y.getTime()) / (24 * 60 * 60 * 1000));
      return {
        id: r.id,
        nomre: r.nomre,
        musteri_ad: r.musteri_ad,
        mehsul_ad: r.mehsul_ad,
        status: r.status,
        yaradildi: y,
        texmini_tehvil: r.texmini_tehvil,
        gun_sayi: gunSayi,
        asilib: true,
      };
    });
  });
}

/* =========================================================================
 * 5. REPAIR COST ANALYTICS — bu ay ortalama xərc, mənfəət
 * ======================================================================= */
export type RepairCostAnalytics = {
  bu_ay_sayi: number;
  bu_ay_orta_xerc: number;
  bu_ay_cem_gelir: number;
  bu_ay_orta_gelir: number;
  bu_ay_menfeet: number;
  son_30_xerc_sum: number;
  son_30_gelir_sum: number;
};

export async function getRepairCostAnalytics(): Promise<RepairCostAnalytics> {
  await requireServisPerm("hesabat.oxu");
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const now = new Date();
    const startBu = new Date(now.getFullYear(), now.getMonth(), 1);
    const since30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const [buAy, son30] = await Promise.all([
      prisma.servis_qeydleri.aggregate({
        where: {
          sahibkar_id: sahibkarId,
          yaradildi: { gte: startBu },
          status: { not: "redd_edildi" },
        },
        _count: { _all: true },
        _sum: { temir_xerci: true, musteriden_alinan: true },
      }),
      prisma.servis_qeydleri.aggregate({
        where: {
          sahibkar_id: sahibkarId,
          yaradildi: { gte: since30 },
          status: { not: "redd_edildi" },
        },
        _sum: { temir_xerci: true, musteriden_alinan: true },
      }),
    ]);
    const buSayi = buAy._count._all;
    const buXerc = Number(buAy._sum.temir_xerci ?? 0);
    const buGelir = Number(buAy._sum.musteriden_alinan ?? 0);
    return {
      bu_ay_sayi: buSayi,
      bu_ay_orta_xerc: buSayi > 0 ? Math.round((buXerc / buSayi) * 100) / 100 : 0,
      bu_ay_cem_gelir: buGelir,
      bu_ay_orta_gelir: buSayi > 0 ? Math.round((buGelir / buSayi) * 100) / 100 : 0,
      bu_ay_menfeet: Math.round((buGelir - buXerc) * 100) / 100,
      son_30_xerc_sum: Number(son30._sum.temir_xerci ?? 0),
      son_30_gelir_sum: Number(son30._sum.musteriden_alinan ?? 0),
    };
  });
}

/* =========================================================================
 * 6. CUSTOMER SERVICE HISTORY — müştərinin servis tarixçəsi
 * ======================================================================= */
export type CustomerServiceHistory = {
  musteri: { id: string; ad: string } | null;
  son_servisler: {
    id: string;
    nomre: string;
    tarix: Date;
    mehsul_ad: string;
    status: string;
    temir_xerci: number;
    musteriden_alinan: number;
  }[];
  cem_xidmet: number;
  cem_gelir: number;
};

export async function getCustomerServiceHistory(musteriId: string): Promise<CustomerServiceHistory> {
  await requireServisPerm();
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const m = await prisma.kontragentler.findFirst({
      where: { id: musteriId, sahibkar_id: sahibkarId },
      select: { id: true, ad: true },
    });
    if (!m) return { musteri: null, son_servisler: [], cem_xidmet: 0, cem_gelir: 0 };

    const son = await prisma.servis_qeydleri.findMany({
      where: { sahibkar_id: sahibkarId, musteri_id: musteriId },
      orderBy: { yaradildi: "desc" },
      take: 30,
      select: {
        id: true,
        nomre: true,
        yaradildi: true,
        mehsul_ad: true,
        status: true,
        temir_xerci: true,
        musteriden_alinan: true,
      },
    });
    const agg = await prisma.servis_qeydleri.aggregate({
      where: {
        sahibkar_id: sahibkarId,
        musteri_id: musteriId,
        status: { not: "redd_edildi" },
      },
      _count: { _all: true },
      _sum: { musteriden_alinan: true },
    });
    return {
      musteri: { id: m.id, ad: m.ad },
      son_servisler: son.map((s) => ({
        id: s.id,
        nomre: s.nomre,
        tarix: s.yaradildi ?? new Date(),
        mehsul_ad: s.mehsul_ad,
        status: s.status,
        temir_xerci: Number(s.temir_xerci ?? 0),
        musteriden_alinan: Number(s.musteriden_alinan ?? 0),
      })),
      cem_xidmet: agg._count._all,
      cem_gelir: Number(agg._sum.musteriden_alinan ?? 0),
    };
  });
}

/* =========================================================================
 * 7. EXPORT SERVIS CSV — audit ilə
 * ======================================================================= */
export async function exportServisCsv(
  baslangic?: string,
  son?: string,
): Promise<ActionResult<{ csv: string; sayi: number }>> {
  const permCheck = await requireServisActionPerm(["servis.export", "hesabat.export", "servis.oxu"]);
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    try {
      const where: Prisma.servis_qeydleriWhereInput = { sahibkar_id: sahibkarId };
      if (baslangic) where.yaradildi = { ...(where.yaradildi as object ?? {}), gte: new Date(baslangic) };
      if (son) where.yaradildi = { ...(where.yaradildi as object ?? {}), lte: new Date(son) };
      const rows = await prisma.servis_qeydleri.findMany({
        where,
        orderBy: { yaradildi: "desc" },
        take: 5000,
        select: {
          nomre: true,
          yaradildi: true,
          musteri_ad: true,
          musteri_telefon: true,
          mehsul_ad: true,
          status: true,
          temir_xerci: true,
          musteriden_alinan: true,
        },
      });
      const escape = (s: unknown): string => {
        const v = String(s ?? "").replace(/"/g, '""');
        return /[",\n]/.test(v) ? `"${v}"` : v;
      };
      const header = "Nömrə,Tarix,Müştəri,Telefon,Məhsul,Status,Təmir xərci,Müştəridən alınan";
      const lines = rows.map((r) =>
        [
          r.nomre,
          (r.yaradildi ?? new Date()).toISOString().slice(0, 10),
          r.musteri_ad,
          r.musteri_telefon,
          r.mehsul_ad,
          r.status,
          Number(r.temir_xerci).toFixed(2),
          Number(r.musteriden_alinan).toFixed(2),
        ].map(escape).join(","),
      );
      const csv = [header, ...lines].join("\n");
      try {
        await audit("export", "servis", null, {
          yeni_data: { sayi: rows.length, baslangic: baslangic ?? null, son: son ?? null },
          sebeb: "Servis qeydləri CSV kimi export edildi",
        });
      } catch { /* non-fatal */ }
      return { ok: true, data: { csv, sayi: rows.length } };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Export alınmadı" };
    }
  });
}

/* =========================================================================
 * 8. EMERGENCY FREEZE — yeni servis qəbulunu dayandır
 * ======================================================================= */
export async function emergencyFreezeServis(
  freeze: boolean,
  reason: string,
): Promise<ActionResult<{ freeze: boolean }>> {
  const permCheck = await requireServisActionPerm(["servis.freeze", "ayarlar.idare"]);
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  if (freeze && !reason.trim()) return { ok: false, error: "Səbəb göstərilməlidir" };
  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    try {
      await prisma.ayarlar.upsert({
        where: { sahibkar_id_qrup_acar: { sahibkar_id: sahibkarId, qrup: "servis", acar: "freeze" } },
        update: { deyer: String(freeze), yenilendi: new Date(), nov: "boolean" },
        create: {
          sahibkar_id: sahibkarId,
          qrup: "servis",
          acar: "freeze",
          deyer: String(freeze),
          nov: "boolean",
          tesvir: "Servis qəbulu dayandırma kill-switch",
        },
      });
      try {
        await safeAuditLog({
          sahibkar_id: sahibkarId,
          istifadeci_id: istifadeciId,
          emeliyyat: freeze ? "freeze" : "unfreeze",
          resurs_nov: "servis_freeze",
          resurs_id: null,
          yeni_data: { freeze, reason: reason.slice(0, 500) },
          status: "ugur",
        });
      } catch { /* non-fatal */ }
      revalidatePath("/servis");
      bustServisCache();
      return { ok: true, data: { freeze } };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Xəta" };
    }
  });
}

export async function isServisFrozen(): Promise<boolean> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const row = await prisma.ayarlar.findUnique({
      where: { sahibkar_id_qrup_acar: { sahibkar_id: sahibkarId, qrup: "servis", acar: "freeze" } },
    });
    return row?.deyer === "true";
  });
}

/* =========================================================================
 * 9. ZEMANET EXPIRING SOON — 30 gün ərzində bitənlər
 * ======================================================================= */
export type ExpiringZemanetRow = {
  id: string;
  unikal_kod: string;
  musteri_ad: string | null;
  mehsul_ad: string | null;
  bitme_tarixi: Date;
  qalan_gun: number;
};

export async function getZemanetExpiringSoon(gunSayi = 30): Promise<ExpiringZemanetRow[]> {
  await requireServisPerm("zemanet.oxu");
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const now = new Date();
    const cutoff = new Date(now.getTime() + gunSayi * 24 * 60 * 60 * 1000);
    const rows = await prisma.zemanetler.findMany({
      where: {
        sahibkar_id: sahibkarId,
        status: "aktiv",
        bitme_tarixi: { gte: now, lte: cutoff },
      },
      orderBy: { bitme_tarixi: "asc" },
      take: 200,
      select: { id: true, unikal_kod: true, musteri_ad: true, mehsul_ad: true, bitme_tarixi: true },
    });
    return rows.map((r) => ({
      id: r.id,
      unikal_kod: r.unikal_kod,
      musteri_ad: r.musteri_ad,
      mehsul_ad: r.mehsul_ad,
      bitme_tarixi: r.bitme_tarixi,
      qalan_gun: Math.ceil((r.bitme_tarixi.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)),
    }));
  });
}

/* =========================================================================
 * 10. PUBLIC TOKEN GENERATION — müştəri linki üçün token yarat
 * ======================================================================= */
export async function generateCustomerLink(
  servisId: string,
): Promise<ActionResult<{ token: string; link: string }>> {
  const permCheck = await requireServisActionPerm(["servis.bildiris", "servis.idare"]);
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const owned = await prisma.servis_qeydleri.findFirst({
      where: { id: servisId, sahibkar_id: sahibkarId },
      select: { id: true },
    });
    if (!owned) return { ok: false, error: "Servis tapılmadı" };
    const token = await generateServisCustomerToken(servisId, sahibkarId);
    const link = `/servis-musteri/${servisId}?t=${token}`;
    return { ok: true, data: { token, link } };
  });
}

/* =========================================================================
 * 11. LOCK / UNLOCK SERVIS QUOTE — təklif kilidi (admin)
 * ======================================================================= */
export async function lockServisQuote(servisId: string): Promise<ActionResult> {
  const permCheck = await requireServisActionPerm(["servis.kilid", "servis.idare"]);
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    try {
      await prisma.ayarlar.upsert({
        where: { sahibkar_id_qrup_acar: { sahibkar_id: sahibkarId, qrup: "servis_kilid", acar: servisId } },
        update: { deyer: "true", yenilendi: new Date(), nov: "boolean" },
        create: {
          sahibkar_id: sahibkarId,
          qrup: "servis_kilid",
          acar: servisId,
          deyer: "true",
          nov: "boolean",
          tesvir: "Servis təklifi kilidi",
        },
      });
      try {
        await safeAuditLog({
          sahibkar_id: sahibkarId,
          istifadeci_id: istifadeciId,
          emeliyyat: "kilidle",
          resurs_nov: "servis",
          resurs_id: servisId,
          status: "ugur",
        });
      } catch { /* non-fatal */ }
      revalidatePath(`/servis/${servisId}`);
      bustServisCache();
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Xəta" };
    }
  });
}

export async function unlockServisQuote(servisId: string): Promise<ActionResult> {
  const permCheck = await requireServisActionPerm(["servis.kilid", "servis.idare"]);
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    try {
      await prisma.ayarlar.upsert({
        where: { sahibkar_id_qrup_acar: { sahibkar_id: sahibkarId, qrup: "servis_kilid", acar: servisId } },
        update: { deyer: "false", yenilendi: new Date(), nov: "boolean" },
        create: {
          sahibkar_id: sahibkarId,
          qrup: "servis_kilid",
          acar: servisId,
          deyer: "false",
          nov: "boolean",
          tesvir: "Servis təklifi kilidi",
        },
      });
      try {
        await safeAuditLog({
          sahibkar_id: sahibkarId,
          istifadeci_id: istifadeciId,
          emeliyyat: "kilid_ac",
          resurs_nov: "servis",
          resurs_id: servisId,
          status: "ugur",
        });
      } catch { /* non-fatal */ }
      revalidatePath(`/servis/${servisId}`);
      bustServisCache();
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Xəta" };
    }
  });
}
