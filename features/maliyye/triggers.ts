"use server";

/**
 * Maliyyə-əsaslı xəbərdarlıq və tapşırıq triqqerləri.
 *
 * Bu helper bir neçə fərqli vəziyyəti yoxlayır və idempotent şəkildə
 * bildiriş yaradır:
 *  - Gecikmiş müştəri borcu (60+ gün)
 *  - Marketplace payout gecikmiş (gözlənən tarix keçib hələ ödənilməyib)
 *  - Kassa balansı mənfi və ya kritik (təhlükə zonasında)
 *  - Yaxınlaşan büdcə (xərc kateqoriyasında 80% istifadə)
 *
 * Çağırış: `runFinanceTriggersForTenant(sahibkarId)`. Cron-da hər səhər
 * və ya manual icra "Bildirişləri yenilə" düyməsi ilə.
 *
 * Idempotensiya: hər tip+resurs üçün son 24 saatda bildiriş yaradılıbsa
 * təkrar yaradılmır.
 */

import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { audit } from "@/lib/audit/log";

type TriggerStats = {
  late_debt: number;
  late_payout: number;
  negative_kassa: number;
  budget_warn: number;
  tasks_created: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** Owner+admin+muhasib istifadəçilərinin id-lərini qaytarır. */
async function getFinanceRecipients(sahibkarId: string): Promise<string[]> {
  const rows = await prisma.istifadeciler.findMany({
    where: {
      sahibkar_id: sahibkarId,
      aktiv: true,
      roles: {
        ad: { contains: "ahibkar" },
      },
    },
    select: { id: true },
  });
  if (rows.length > 0) return rows.map((r) => r.id);

  // Fallback — admin/muhasib
  const fallback = await prisma.istifadeciler.findMany({
    where: {
      sahibkar_id: sahibkarId,
      aktiv: true,
      OR: [
        { roles: { ad: { contains: "dmin", mode: "insensitive" } } },
        { roles: { ad: { contains: "uhasib", mode: "insensitive" } } },
        { roles: { ad: { contains: "irektor", mode: "insensitive" } } },
      ],
    },
    select: { id: true },
  });
  return fallback.map((r) => r.id);
}

/** Eyni resurs üçün son 24 saatda bildiriş varmı? */
async function alreadyNotified(
  sahibkarId: string,
  resursNov: string,
  resursId: string,
): Promise<boolean> {
  const since = new Date(Date.now() - DAY_MS);
  const row = await prisma.bildirisler.findFirst({
    where: {
      sahibkar_id: sahibkarId,
      resurs_nov: resursNov,
      resurs_id: resursId,
      yaradildi: { gte: since },
    },
    select: { id: true },
  });
  return !!row;
}

async function notify(
  sahibkarId: string,
  recipients: string[],
  data: {
    basliq: string;
    metn: string;
    nov: "info" | "warning" | "danger" | "success";
    link?: string;
    resurs_nov: string;
    resurs_id: string;
  },
): Promise<void> {
  if (recipients.length === 0) return;
  if (await alreadyNotified(sahibkarId, data.resurs_nov, data.resurs_id)) return;
  await prisma.bildirisler.createMany({
    data: recipients.map((uid) => ({
      sahibkar_id: sahibkarId,
      istifadeci_id: uid,
      basliq: data.basliq,
      metn: data.metn,
      nov: data.nov,
      link: data.link ?? null,
      resurs_nov: data.resurs_nov,
      resurs_id: data.resurs_id,
      oxundu: false,
    })),
    skipDuplicates: true,
  });
}

export async function runFinanceTriggers(): Promise<TriggerStats> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const stats: TriggerStats = { late_debt: 0, late_payout: 0, negative_kassa: 0, budget_warn: 0, tasks_created: 0 };
    const recipients = await getFinanceRecipients(sahibkarId);

    // 1) Gecikmiş müştəri borcu (60+ gün satış tarixindən)
    try {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 60);
      const lateSales = await prisma.satis_sifarisleri.findMany({
        where: {
          sahibkar_id: sahibkarId,
          status: { not: "legv" },
          qaralama: { not: true },
          odenis_nov: { in: ["nisye", "borc"] },
          tarix: { lte: cutoff },
        },
        select: {
          id: true,
          nomre: true,
          tarix: true,
          son_mebleg: true,
          odenilmis: true,
          kontragentler: { select: { id: true, ad: true } },
        },
        take: 200,
      });
      for (const s of lateSales) {
        const qaliq = Math.max(0, Number(s.son_mebleg ?? 0) - Number(s.odenilmis ?? 0));
        if (qaliq <= 0.01) continue;
        const gun = Math.floor((Date.now() - new Date(s.tarix).getTime()) / DAY_MS);
        const musteriAd = s.kontragentler?.ad ?? "Müştəri";
        await notify(sahibkarId, recipients, {
          basliq: `Gecikmiş borc: ${musteriAd} — ${qaliq.toFixed(2)} ₼`,
          metn: `Sənəd #${s.nomre}, ${gun} gün gecikib`,
          nov: gun >= 90 ? "danger" : "warning",
          link: `/maliyye/debitor`,
          resurs_nov: "gecikmis_borc",
          resurs_id: s.id,
        });
        stats.late_debt++;

        // 90+ gün gecikmədə avtomatik "borc yığma" tapşırığı yaradılır
        // (idempotent — eyni sənəd üçün son 7 günü daxilində açıq tapşırıq varsa təkrar yaranmır)
        if (gun >= 90 && s.kontragentler?.id) {
          try {
            const existing = await prisma.tapshiriq_obyektleri.findFirst({
              where: {
                sahibkar_id: sahibkarId,
                obyekt_nov: "satis_sifarisi",
                obyekt_id: s.id,
                tapshiriqlar: {
                  status: { in: ["yeni", "isleyir"] },
                  yaradildi: { gte: new Date(Date.now() - 7 * DAY_MS) },
                },
              },
              select: { id: true },
            });
            if (!existing && recipients[0]) {
              const tapshiriq = await prisma.tapshiriqlar.create({
                data: {
                  sahibkar_id: sahibkarId,
                  basliq: `Borc yığma: ${musteriAd} (${qaliq.toFixed(2)} ₼)`,
                  tesvir: `Sənəd #${s.nomre} — ${gun} gün gecikib. Müştəri ilə əlaqə saxlayın.`,
                  prioritet: gun >= 120 ? "yuxsek" : "normal",
                  status: "yeni",
                  tip: "borc_yigma",
                  deadline: new Date(Date.now() + 7 * DAY_MS),
                  yaradan_id: recipients[0],
                  mesul_id: recipients[0],
                },
                select: { id: true },
              });
              await prisma.tapshiriq_obyektleri.create({
                data: {
                  sahibkar_id: sahibkarId,
                  tapshiriq_id: tapshiriq.id,
                  obyekt_nov: "satis_sifarisi",
                  obyekt_id: s.id,
                  obyekt_basliq: s.nomre,
                },
              });
              stats.tasks_created++;
            }
          } catch (e) {
            console.warn("[runFinanceTriggers] task create:", e);
          }
        }
      }
    } catch (e) {
      console.warn("[runFinanceTriggers] late_debt:", e);
    }

    // 2) Marketplace payout gecikir (donem_bitme + 14 gün, hələ ödənilməyib)
    try {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 14);
      const latePayouts = await prisma.finance_marketplace_payments.findMany({
        where: {
          sahibkar_id: sahibkarId,
          status: { in: ["gozleyir"] },
          donem_bitme: { lte: cutoff },
        },
        select: { id: true, platforma: true, gozlenen_meblegh: true, donem_bitme: true },
        take: 100,
      });
      for (const p of latePayouts) {
        const gun = Math.floor((Date.now() - new Date(p.donem_bitme ?? new Date()).getTime()) / DAY_MS);
        await notify(sahibkarId, recipients, {
          basliq: `Marketplace payout gecikir: ${p.platforma}`,
          metn: `${gun} gün gecikib, gözlənən ${Number(p.gozlenen_meblegh ?? 0).toFixed(2)} ₼`,
          nov: "warning",
          link: `/maliyye/marketplace`,
          resurs_nov: "gecikmis_payout",
          resurs_id: String(p.id),
        });
        stats.late_payout++;
      }
    } catch (e) {
      console.warn("[runFinanceTriggers] late_payout:", e);
    }

    // 3) Kassa/bank balansı mənfi və ya kritik (0 altda)
    try {
      const hesablar = await prisma.maliye_hesablari.findMany({
        where: { sahibkar_id: sahibkarId, aktiv: true },
        select: { id: true, ad: true, nov: true, qaliq: true, valyuta: true },
      });
      for (const h of hesablar) {
        const balans = Number(h.qaliq ?? 0);
        if (balans < 0) {
          await notify(sahibkarId, recipients, {
            basliq: `Mənfi balans: ${h.ad}`,
            metn: `${balans.toFixed(2)} ${h.valyuta ?? "AZN"} — təcili yoxlama lazımdır`,
            nov: "danger",
            link: `/maliyye/hesab/${h.id}`,
            resurs_nov: "menfi_balans",
            resurs_id: h.id,
          });
          stats.negative_kassa++;
        }
      }
    } catch (e) {
      console.warn("[runFinanceTriggers] negative_kassa:", e);
    }

    // 4) Xərc büdcə xəbərdarlığı — kateqoriya istifadəsi 80%+ olarsa
    try {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const byCat = await prisma.xercl_r.groupBy({
        by: ["kateqoriya_id"],
        where: {
          sahibkar_id: sahibkarId,
          tarix: { gte: monthStart },
          legv_de: null,
          kateqoriya_id: { not: null },
        },
        _sum: { mebleg: true },
      });
      const cats = await prisma.xerc_kateqoriyalari.findMany({
        where: { sahibkar_id: sahibkarId, aktiv: true },
        select: { id: true, ad: true, ay_budce: true },
      });
      const budgetMap = new Map(
        cats.map((c) => [c.id, { ad: c.ad, budce: Number(c.ay_budce ?? 0) }]),
      );
      for (const b of byCat) {
        if (b.kateqoriya_id == null) continue;
        const cat = budgetMap.get(b.kateqoriya_id);
        if (!cat || cat.budce <= 0) continue;
        const istifade = Number(b._sum.mebleg ?? 0);
        const pct = (istifade / cat.budce) * 100;
        if (pct >= 80) {
          await notify(sahibkarId, recipients, {
            basliq: `Büdcə xəbərdarlığı: ${cat.ad}`,
            metn: `${pct.toFixed(0)}% istifadə olunub (${istifade.toFixed(2)}/${cat.budce.toFixed(2)} ₼)`,
            nov: pct >= 100 ? "danger" : "warning",
            link: `/maliyye/xercler`,
            resurs_nov: "budce_xeber",
            resurs_id: `${b.kateqoriya_id}-${monthStart.toISOString().slice(0, 7)}`,
          });
          stats.budget_warn++;
        }
      }
    } catch (e) {
      console.warn("[runFinanceTriggers] budget_warn:", e);
    }

    // Audit log — icra yekunu
    try {
      await audit("icra", "finance_triggers", null, {
        yeni_data: stats,
        sebeb: `Finance trigger run: ${stats.late_debt} borc, ${stats.late_payout} payout, ${stats.negative_kassa} mənfi, ${stats.budget_warn} büdcə`,
      });
    } catch { /* non-fatal */ }

    return stats;
  });
}

/**
 * Bütün aktiv sahibkarlar üçün triqqerləri çalışdır.
 * Cron job tərəfindən çağırılır.
 */
export async function runFinanceTriggersForAllTenants(): Promise<{
  tenants: number;
  total: TriggerStats;
}> {
  // NOTE: bu funksiya tenant context-dən kənar çağırılır (cron).
  // Sahibkar-by-sahibkar dövr edirik, hər biri üçün ayrıca tenant context bind.
  const { runWithTenant } = await import("@/lib/db/tenant-context");
  const tenants = await prisma.sahibkarlar.findMany({
    where: { status: "aktiv" },
    select: { id: true },
  });
  const total: TriggerStats = { late_debt: 0, late_payout: 0, negative_kassa: 0, budget_warn: 0, tasks_created: 0 };
  for (const t of tenants) {
    try {
      const stats = await runWithTenant(
        { sahibkarId: t.id, istifadeciId: "00000000-0000-0000-0000-000000000000", rolId: 0, rolAd: "system", icazeler: [] },
        () => runFinanceTriggers(),
      );
      total.late_debt += stats.late_debt;
      total.late_payout += stats.late_payout;
      total.negative_kassa += stats.negative_kassa;
      total.budget_warn += stats.budget_warn;
      total.tasks_created += stats.tasks_created;
    } catch (e) {
      console.warn(`[runFinanceTriggers] tenant ${t.id}:`, e);
    }
  }
  return { tenants: tenants.length, total };
}
