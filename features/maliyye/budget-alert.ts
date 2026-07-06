import "server-only";
import { prismaUnscoped } from "@/lib/db/prisma";
import { XERC_BUDCE_QRUP, XERC_BUDCE_ACAR_PREFIX } from "./xerc-budce";

/**
 * Roadmap (proaktivlik): xərc kateqoriyası aylıq büdcəni aşanda bildiriş mərkəzinə alert.
 * saveExpense sonra çağırılır (best-effort). İDEMPOTENT: kateqoriya başına bir açıq alert —
 * mövcud olsa yenilənir; büdcə altına düşsə (yeni ay / xərc silinsə) auto-həll edilir.
 * prismaUnscoped işlədir; sahibkar_id açıq ötürülür.
 */
export async function checkExpenseBudgetAlert(sahibkarId: string, kateqoriyaId: number | null | undefined): Promise<void> {
  if (!kateqoriyaId) return;
  try {
    // Büdcə oxu
    const acar = XERC_BUDCE_ACAR_PREFIX + kateqoriyaId;
    const budgetRow = await prismaUnscoped.ayarlar.findFirst({
      where: { sahibkar_id: sahibkarId, qrup: XERC_BUDCE_QRUP, acar },
      select: { deyer: true },
    });
    const budce = Number(budgetRow?.deyer ?? 0);

    // reorder-kritik ilə eyni obyekt-açar sxemi: obyekt_nov="budce_asim", obyekt_id=kateqoriya_id
    const obyektId = String(kateqoriyaId);
    const existing = await prismaUnscoped.alerts.findFirst({
      where: { sahibkar_id: sahibkarId, kateqoriya_kod: "budce_asim", obyekt_nov: "budce_asim", obyekt_id: obyektId, status: { in: ["yeni", "baxilir"] } },
      select: { id: true },
    });

    if (budce <= 0) { // büdcə yoxdursa alert də olmamalı
      if (existing) await prismaUnscoped.alerts.update({ where: { id: existing.id }, data: { status: "hell_olundu", resolved_at: new Date(), yenilendi: new Date() } });
      return;
    }

    // Bu ay faktiki
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const agg = await prismaUnscoped.xercl_r.aggregate({
      where: { sahibkar_id: sahibkarId, kateqoriya_id: kateqoriyaId, tarix: { gte: monthStart }, legv_de: null },
      _sum: { mebleg: true },
    });
    const faktiki = Number(agg._sum.mebleg ?? 0);

    if (faktiki <= budce) { // büdcə altında → varsa alert-i həll et
      if (existing) await prismaUnscoped.alerts.update({ where: { id: existing.id }, data: { status: "hell_olundu", resolved_at: new Date(), yenilendi: new Date() } });
      return;
    }

    // Aşıb → alert yarat/yenilə
    let cat = await prismaUnscoped.alert_categories.findUnique({ where: { kod: "budce_asim" }, select: { id: true, kod: true } });
    if (!cat) {
      cat = await prismaUnscoped.alert_categories.create({
        data: { kod: "budce_asim", ad: "Büdcə aşımı", emoji: "💸", qrup: "maliyye" },
        select: { id: true, kod: true },
      });
    }
    const katName = (await prismaUnscoped.xerc_kateqoriyalari.findUnique({ where: { id: kateqoriyaId }, select: { ad: true } }))?.ad ?? "Xərc kateqoriyası";
    const asim = Math.round((faktiki - budce) * 100) / 100;
    const basliq = `Büdcə aşıldı: ${katName}`;
    const tesvir = `«${katName}» kateqoriyası bu ay büdcəni aşıb: faktiki ${faktiki.toFixed(2)} ₼ / büdcə ${budce.toFixed(2)} ₼ (aşım ${asim.toFixed(2)} ₼). Maliyyə → Xərc büdcəsi bölməsində yoxlayın.`;

    if (existing) {
      await prismaUnscoped.alerts.update({ where: { id: existing.id }, data: { seviyye: "risk", basliq, tesvir, last_seen_at: new Date(), yenilendi: new Date() } });
    } else {
      await prismaUnscoped.alerts.create({
        data: {
          sahibkar_id: sahibkarId,
          kateqoriya_id: cat.id,
          kateqoriya_kod: cat.kod,
          seviyye: "risk",
          status: "yeni",
          basliq,
          tesvir,
          obyekt_nov: "budce_asim",
          obyekt_id: obyektId,
          obyekt_basliq: katName,
        },
      });
    }
  } catch (e) {
    console.warn("[checkExpenseBudgetAlert] skipped:", e);
  }
}
