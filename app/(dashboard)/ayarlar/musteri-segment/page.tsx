import type { Metadata } from "next";
import { ComingSoon } from "@/features/ayar/components/coming-soon";

export const metadata: Metadata = { title: "Müştəri seqmentasiyası" };

export default function Page() {
  return (
    <ComingSoon
      title="Müştəri seqmentasiyası"
      description="Avto və custom seqmentlər — kampaniya hədəfləməsi üçün"
      features={[
        "Sistem seqmentləri (avto): VIP (10.000+ AZN), Topdan (1000+/əməliyyat), Tez-tez alan, Uzun almayan",
        "Risk seqmentləri: Borclu, Qaytarma çox, Servis çox, Passiv",
        "Davranış: Premium (yüksək marja), Endirim sevən, Kreditçi, Potensial topdan",
        "Custom seqment: filtir builder (alış sayı, məbləğ, tarix, kateqoriya)",
        "Hər seqment üçün müştəri siyahısı və export",
        "Avto-yenilənmə (real-time vs daily)",
        "Kampaniya hədəfləməsi: hansı seqmentə hansı mesaj",
        "Statistika: seqment ölçüsü, dəyişmə (trend), retention",
      ]}
    />
  );
}
