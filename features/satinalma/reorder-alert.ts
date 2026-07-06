import "server-only";
import { prismaUnscoped } from "@/lib/db/prisma";

/**
 * QA-roadmap #5 (proaktivlik): sürət-əsaslı KRİTİK reorder məhsulları üçün xülasə alert.
 * checkAndCreateStockAlert yalnız min-stok altını tutur; bu isə tez bitəcək (min üstündə olsa da)
 * məhsulları da bildiriş mərkəzinə çıxarır. İDEMPOTENT: tenant başına bir açıq alert — mövcud
 * olsa yenilənir; kritik məhsul qalmasa mövcud alert auto-həll edilir. Cron + manual recompute-dan çağırılır.
 * prismaUnscoped işlədir ki, cron kontekstində (tenant-loop) düzgün işləsin.
 */
export async function upsertReorderAlert(sahibkarId: string, kritikMehsulIds: string[]): Promise<void> {
  try {
    // QA-audit: findUnique+create paralel ilk yaratmada P2002 verirdi → upsert (kod @unique) ilə race-safe.
    const cat = await prismaUnscoped.alert_categories.upsert({
      where: { kod: "reorder_kritik" },
      update: {},
      create: { kod: "reorder_kritik", ad: "Sifariş kritik", emoji: "🛒", qrup: "anbar" },
      select: { id: true, kod: true },
    });
    const existing = await prismaUnscoped.alerts.findFirst({
      // QA-audit: 'snoozed' də daxil — təxirə salınmış alert dedup-dan kənarda qalıb dublikat yaratmasın.
      where: { sahibkar_id: sahibkarId, kateqoriya_kod: "reorder_kritik", status: { in: ["yeni", "baxilir", "snoozed"] } },
      select: { id: true },
    });

    if (kritikMehsulIds.length === 0) {
      if (existing) {
        await prismaUnscoped.alerts.update({ where: { id: existing.id }, data: { status: "hell_olundu", resolved_at: new Date(), yenilendi: new Date() } });
      }
      return;
    }

    const names = await prismaUnscoped.mehsullar.findMany({
      where: { id: { in: kritikMehsulIds.slice(0, 5) } },
      select: { ad: true },
    });
    const basliq = `${kritikMehsulIds.length} məhsul tez bitəcək — sifariş lazımdır`;
    const tesvir = `Sürətlə satılan və tezliklə bitəcək məhsullar: ${names.map((n) => n.ad).join(", ")}${kritikMehsulIds.length > 5 ? " və s." : ""}. Anbar → Satınalma → Tövsiyələr bölməsindən sifariş yaradın.`;

    if (existing) {
      await prismaUnscoped.alerts.update({
        where: { id: existing.id },
        data: { seviyye: "kritik", basliq, tesvir, last_seen_at: new Date(), yenilendi: new Date() },
      });
    } else {
      await prismaUnscoped.alerts.create({
        data: {
          sahibkar_id: sahibkarId,
          kateqoriya_id: cat.id,
          kateqoriya_kod: cat.kod,
          seviyye: "kritik",
          status: "yeni",
          basliq,
          tesvir,
          obyekt_nov: "reorder_summary",
          obyekt_basliq: "Satınalma tövsiyələri",
        },
      });
    }
  } catch (e) {
    console.warn("[upsertReorderAlert] skipped:", e);
  }
}
