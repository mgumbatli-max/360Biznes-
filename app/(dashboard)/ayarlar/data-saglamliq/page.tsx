import type { Metadata } from "next";
import { ComingSoon } from "@/features/ayar/components/coming-soon";

export const metadata: Metadata = { title: "Data sağlamlığı" };

export default function Page() {
  return (
    <ComingSoon
      title="Data sağlamlığı"
      description="Dublikat, natamam, anomaliyalı və köhnəlmiş datalar üzrə hesabat"
      features={[
        "Dublikat müştəri (eyni telefon/email)",
        "Adsız/barkodsuz/şəkilsiz məhsullar",
        "Qiyməti 0-a bərabər və ya negativ məhsullar",
        "60+ gündür hərəkəti olmayan məhsullar (ölü stok)",
        "Bağlı olmayan satışlar (kassa orderi yoxdur)",
        "Maya qiyməti yox və ya 0 olan məhsullar",
        "İnvalid VÖEN, telefon, email formatı",
        "Auto-fix təklifləri və toplu düzəliş ekranı",
      ]}
    />
  );
}
