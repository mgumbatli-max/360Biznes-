import type { Metadata } from "next";
import { ComingSoon } from "@/features/ayar/components/coming-soon";

export const metadata: Metadata = { title: "Marketplace inteqrasiyalar" };

export default function Page() {
  return (
    <ComingSoon
      title="Marketplace inteqrasiyalar"
      description="Wolt, Tap.az, Birmarket, Lalafo və Manual/Custom — sifariş və stok sinxronizasiyası"
      features={[
        "Yeni qoşulma əlavə et: Wolt, Tap.az, Birmarket, Lalafo, Manual",
        "Qoşulma detalları: Store ID, API key, User ID, Region, Filial, Maliyyə hesabı",
        "Platforma komisyonu (%) tənzimi — kateqoriyaya görə fərqli",
        "Status göstəricisi: Aktiv, Gözləyir, Xəta — son sinxronizasiya vaxtı",
        "Auto-sinxronizasiya tezliyi (5/15/30 dəq) və manual sync düyməsi",
        "Konflikt həll qaydası (qiymət/stok platforma vs. ERP)",
        "Sifarişin avtomatik qəbulu və POS-a köçürülməsi",
        "Statistika: cəmi qoşulma, aktiv, gözləyir, xəta, platforma sayı",
      ]}
    />
  );
}
