"use server";

import { chatCompletion, isMockMode } from "@/lib/ai/anthropic";
import { getTaskPerformanceAnalytics, type UserTaskPerformance } from "./queries";

export type AiAnalysisResult = {
  ok: true;
  text: string;
  is_mock: boolean;
  rows: UserTaskPerformance[];
} | { ok: false; error: string };

export async function aiAnalyzePerformance(): Promise<AiAnalysisResult> {
  try {
    const rows = await getTaskPerformanceAnalytics();
    if (rows.length === 0) {
      return { ok: true, text: "Hələ analiz üçün kifayət qədər tapşırıq qeydi yoxdur.", is_mock: true, rows: [] };
    }

    const summary = rows
      .map((r, i) =>
        `${i + 1}. ${r.ad_soyad}${r.vezife ? ` (${r.vezife})` : ""} — cəmi ${r.cemi}, tamamlandı ${r.tamamlandi} (${r.tamamlanma_faiz}%), gecikmiş ${r.gecikmis}, orta bitmə ${r.orta_bitme_gun} gün, son 30 gün ${r.son_30_gun}`
      )
      .join("\n");

    if (isMockMode()) {
      const top = rows[0];
      const worst = rows[rows.length - 1];
      const lines: string[] = [
        `**Komandanın ümumi tapşırıq performansı analizi**`,
        "",
        `Ən məhsuldar işçi — **${top.ad_soyad}** (tamamlanma faizi ${top.tamamlanma_faiz}%, orta bitmə ${top.orta_bitme_gun} gün). Bu işçinin iş axını şablon kimi öyrənilə bilər.`,
        "",
      ];
      if (worst.tamamlanma_faiz < 60) {
        lines.push(
          `Diqqət — **${worst.ad_soyad}** son dövrdə yavaşlayır (tamamlanma ${worst.tamamlanma_faiz}%, gecikmiş ${worst.gecikmis} ədəd). Səbəb ola bilər: çox tapşırıq yığılması, prioritet qarışıqlığı və ya kömək tələbi.`
        );
        lines.push("");
      }
      const ortFaiz = Math.round(rows.reduce((s, r) => s + r.tamamlanma_faiz, 0) / rows.length);
      lines.push(`Komanda ortalama tamamlanma faizi: **${ortFaiz}%**.`);
      lines.push("");
      lines.push("Tövsiyə: aşağı performanslı işçilər üçün həftəlik 15 dəqlik 1-on-1 görüş + tapşırıq miqdarını balanslaşdırma.");
      lines.push("");
      lines.push("*Qeyd: hazırda mock-mode aktivdir. Real Claude AI cavablar üçün ANTHROPIC_API_KEY əlavə edin.*");
      return { ok: true, text: lines.join("\n"), is_mock: true, rows };
    }

    const prompt = [
      "Aşağıda 360Biznes ERP sistemində işçilərin tapşırıq performans göstəriciləri verilib.",
      "Sənin işin:",
      "1) Hər işçinin perspektivliyini qiymətləndir,",
      "2) Komandanın güclü/zəif tərəflərini sadala,",
      "3) Konkret tövsiyə ver (kim üçün hansı addım).",
      "Qısa, anlaşıqlı Azərbaycan dilində cavab ver, JSON yox.",
      "",
      "Məlumat:",
      summary,
    ].join("\n");

    const ai = await chatCompletion(
      [{ role: "user", content: prompt }],
      { max_tokens: 700 }
    );
    return { ok: true, text: ai.text, is_mock: ai.is_mock, rows };
  } catch (e) {
    console.error("[aiAnalyzePerformance]", e);
    return { ok: false, error: "AI analiz alınmadı" };
  }
}
