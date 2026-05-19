import "server-only";
import { chatCompletion } from "@/lib/ai/anthropic";
import { formatMoney } from "@/lib/utils";
import type { AnalitikaData } from "./analitika-queries";

export async function generateInsight(
  data: AnalitikaData,
  stats: { total: number; aktiv: number; passiv: number; maas_cemi: number; mezuniyyetde: number; bu_ay_yeni: number; isden_cixanlar: number },
): Promise<{ text: string; is_mock: boolean }> {
  const summary = [
    `Aktiv işçi: ${stats.aktiv}, cəmi: ${stats.total}.`,
    `Bu ay yeni: ${stats.bu_ay_yeni}, son 3 ayda işdən çıxan: ${stats.isden_cixanlar}.`,
    `Turnover (12 ay): ${data.turnover_pct}%.`,
    `Aylıq maaş cəmi: ${formatMoney(stats.maas_cemi)}.`,
    `İllik treninq xərci: ${formatMoney(data.yearly_costs.treninq)}.`,
    `Top 3 vəzifə üzrə işçi sayı: ${data.by_vezife.slice(0, 3).map((v) => `${v.ad} (${v.say})`).join(", ")}.`,
  ].join(" ");

  const res = await chatCompletion(
    [
      {
        role: "user",
        content: `HR Analitika icmal: ${summary}\n\nQısa 2-3 cümlədə tövsiyə ver: turnover yüksəkdirmi? Hansı sahəyə diqqət lazımdır? Maaş, treninq, headcount problemləri varmı? Cavab Azərbaycan dilində, qısa və konkret.`,
      },
    ],
    { max_tokens: 250 },
  );
  return { text: res.text, is_mock: res.is_mock };
}
