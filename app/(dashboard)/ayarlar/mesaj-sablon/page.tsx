import type { Metadata } from "next";
import { ComingSoon } from "@/features/ayar/components/coming-soon";

export const metadata: Metadata = { title: "Mesaj şablonları" };

export default function Page() {
  return (
    <ComingSoon
      title="Mesaj şablonları"
      description="Email, SMS, WhatsApp və in-app bildiriş mətnləri"
      features={[
        "Hadisə əsaslı şablonlar: yeni satış, qaytarma, servis statusu, zəmanət",
        "Çoxdilli şablonlar (AZ/EN/RU/TR)",
        "Placeholder dəstəyi: {{musteri}}, {{mebleg}}, {{tarix}}, {{qaime_no}}",
        "Şablon redaktoru: WYSIWYG + raw mode",
        "Default sistem şablonlarını «Kopyala» düyməsi ilə özünüz üçün düzəldin",
        "Ön baxış: müxtəlif placeholder dəyərləri ilə test",
        "Versiya tarixçəsi və geri qaytarma",
        "Aktiv/passiv toggle hər şablon üçün",
      ]}
    />
  );
}
