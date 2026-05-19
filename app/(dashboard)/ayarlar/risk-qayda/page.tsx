import type { Metadata } from "next";
import { ComingSoon } from "@/features/ayar/components/coming-soon";

export const metadata: Metadata = { title: "Risk qaydaları" };

export default function Page() {
  return (
    <ComingSoon
      title="Risk qaydaları"
      description="Avtomatik xəbərdarlıq və bloklama şərtləri"
      features={[
        "Maya altı satış: xəbərdarlıq vs qadağa",
        "Endirim limit (satıcı/menecer/admin) — keçildikdə təsdiq tələb",
        "Müştəri borc limit aşımı — alış bloklama vs xəbərdarlıq",
        "Anormal sayım fərqləri (inventarizasiya)",
        "Stok bitdi/azaldı — kritiklik dərəcəsinə görə kanal seçimi",
        "Qaytarma anomaliyaları (eyni müştəridən çox qaytarma)",
        "Satıcının şübhəli endirim sxemləri (AI əsaslı)",
        "Hər qayda üçün severity (info / orta / yüksək / kritik) və kanal",
      ]}
    />
  );
}
