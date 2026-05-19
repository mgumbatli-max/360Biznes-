import type { Metadata } from "next";
import { ComingSoon } from "@/features/ayar/components/coming-soon";

export const metadata: Metadata = { title: "Webhook və API" };

export default function Page() {
  return (
    <ComingSoon
      title="Webhook və API"
      description="Sayt, marketplace, mağaza skripti və 3rd-party tətbiqlər üçün inteqrasiya"
      features={[
        "API açarları: 360Biznes-dən stok/məhsul/sifariş oxu/yaz",
        "Webhook (göndərmə): yeni sifariş, stok azaldı, qaytarma — real-time bildiriş",
        "Hər açar üçün icazə scope (read-only/full)",
        "Rate limiting və daily quota",
        "İstifadə statistikası: 24h API çağırış, webhook göndərmə sayı, son uğursuz",
        "Webhook retries (3x exp. backoff)",
        "Avtomatik açar rotasiyası və köhnəni revoke",
        "Sənədlər: endpoint sxemi, nümunələr, OpenAPI export",
      ]}
    />
  );
}
