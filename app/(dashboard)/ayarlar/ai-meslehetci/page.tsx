import type { Metadata } from "next";
import { ComingSoon } from "@/features/ayar/components/coming-soon";

export const metadata: Metadata = { title: "AI Sahibkar Məsləhətçisi" };

export default function Page() {
  return (
    <ComingSoon
      title="AI Sahibkar Məsləhətçisi"
      description="Gündəlik/həftəlik analiz, anomaliya aşkarlama və sual-cavab"
      features={[
        "Günlük xülasə: bu günün analizi və 5 əsas məsələ",
        "Həftəlik analiz: 7 günlük performance + trend",
        "Aylıq analiz: 30 gün — mənfəət, satış, top məhsul",
        "Sual-cavab chat: «Bu ay nə yaxşı gedir?», «Harada pul itiririk?»",
        "Quick questions: hazır şablon suallar",
        "AI insight bildirişləri: anomaliya, fürsət, risk",
        "Etibarlılıq tədbiri: AI yalan/şişirtmə qadağası",
        "Cavab dili (AZ/EN/RU/TR) və uzunluq tənzimi",
      ]}
    />
  );
}
