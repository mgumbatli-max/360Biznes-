import type { Metadata } from "next";
import { ComingSoon } from "@/features/ayar/components/coming-soon";

export const metadata: Metadata = { title: "Anbar / Məhsul ayarları" };

export default function Page() {
  return (
    <ComingSoon
      title="Anbar / Məhsul ayarları"
      description="Məhsul tipi, ölçü vahidi, barkod, etiket çap şablonu və custom field-lər"
      features={[
        "Məhsul tipi: fiziki, mücərrəd (xidmət), təhlükəli mal — stok/zəmanət/vergi davranışı",
        "Ölçü vahidləri: ədəd, kq, qr, litr, m, m² — çevirmə əmsalları",
        "Barkod tipləri: EAN-13, Code128, QR, custom — avto generasiya qaydası",
        "Etiket çap şablonları: A4, termo printer (50x30/40x30 mm) ölçüləri",
        "Custom field-lər: əlavə xüsusiyyət (məhsul üçün özünüz təyin edirsiniz)",
        "Default mənbə, default kateqoriya, default valyuta",
        "Min stok xəbərdarlığı və avto reorder qaydaları",
        "Hər tip üçün ayrı icazə paterni",
      ]}
    />
  );
}
