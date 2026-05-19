import type { Metadata } from "next";
import { ComingSoon } from "@/features/ayar/components/coming-soon";

export const metadata: Metadata = { title: "Avtomatlaşdırma Mərkəzi" };

export default function Page() {
  return (
    <ComingSoon
      title="Avtomatlaşdırma Mərkəzi"
      description="Trigger → Action qaydalar: «əgər → onda» formada"
      features={[
        "Triggerlər: yeni satış, stok azalma, qaytarma, borc artması, gün sonu",
        "Action: bildiriş göndər, tapşırıq yarat, status dəyiş, email/SMS at",
        "Condition: filtir əlavə et (məs: yalnız 1000+ AZN satışlar)",
        "Schedule: cron əsaslı (hər gün 09:00, hər ayın 1-i)",
        "Test rejimi: action-ı icra etmədən log-a yaz",
        "Hər qayda üçün last-run və icra statistikası",
        "Qayda şablonları (preset): ən geniş işlədilən 10+ qayda",
        "Audit izi: hansı qayda nə vaxt nə etdi",
      ]}
    />
  );
}
