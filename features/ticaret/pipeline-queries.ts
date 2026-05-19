import "server-only";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import {
  PIPELINE_LABELS,
  PIPELINE_ORDER,
  type PipelineColumn,
  type PipelineItem,
  type PipelineStage,
} from "./pipeline-types";

/**
 * Sales pipeline visualization — 7-stage kanban view of all in-flight orders.
 * Maps domain-specific sale statuses to a generic workflow:
 *
 *   teklif   -> Təklif
 *   yeni     -> Sifariş
 *   tesdiq   -> Sövdələşdə
 *   gonderildi -> Çatdırılır
 *   tamamlandi -> Çatdırılıb / Faktura (split by odenilmis)
 *   odenilib -> Ödənildi
 */

function mapStatusToStage(status: string, odenilmis: number, son_mebleg: number): PipelineStage {
  switch (status) {
    case "qaralama":
    case "teklif":
      return "teklif";
    case "yeni":
      return "sifaris";
    case "tesdiq":
    case "tesdiq_edildi":
    case "tesdiq_gozleyir":
      return "sovde";
    case "gonderildi":
      return "catdir";
    case "catdirildi":
      return "catib";
    case "tamamlandi":
      // Tamamlandı: tam ödənilibsə → odendi, qismən ödənilibsə → faktura,
      // heç ödənilməyibsə artıq çatdırılıb sayılır.
      if (son_mebleg > 0 && odenilmis >= son_mebleg - 0.001) return "odendi";
      if (odenilmis > 0) return "faktura";
      return "catib";
    default:
      return "sifaris";
  }
}

export async function getSalesByPipelineStage(limitPerStage = 30): Promise<PipelineColumn[]> {
  return withTenant(async () => {
    const sales = await prisma.satis_sifarisleri.findMany({
      where: {
        status: { notIn: ["legv"] },
      },
      orderBy: [{ tarix: "desc" }],
      take: 400,
      select: {
        id: true,
        nomre: true,
        tarix: true,
        status: true,
        son_mebleg: true,
        odenilmis: true,
        qaralama: true,
        kontragentler: { select: { ad: true } },
      },
    });

    const now = Date.now();
    const byStage = new Map<PipelineStage, PipelineItem[]>();
    for (const s of PIPELINE_ORDER) byStage.set(s, []);

    for (const r of sales) {
      const status = r.qaralama ? "qaralama" : r.status ?? "yeni";
      const sonMebleg = Number(r.son_mebleg ?? 0);
      const odenilmis = Number(r.odenilmis ?? 0);
      const stage = mapStatusToStage(status, odenilmis, sonMebleg);
      const tarix = r.tarix ?? new Date();
      const yasGun = Math.max(0, Math.floor((now - new Date(tarix).getTime()) / 86400000));
      byStage.get(stage)?.push({
        id: r.id,
        nomre: r.nomre,
        musteri_ad: r.kontragentler?.ad ?? null,
        son_mebleg: sonMebleg,
        odenilmis,
        yas_gun: yasGun,
        tarix,
        status_raw: status,
        stage,
      });
    }

    return PIPELINE_ORDER.map((stage) => {
      const items = byStage.get(stage) ?? [];
      return {
        stage,
        label: PIPELINE_LABELS[stage],
        count: items.length,
        total: items.reduce((s, i) => s + i.son_mebleg, 0),
        items: items.slice(0, limitPerStage),
      };
    });
  });
}
