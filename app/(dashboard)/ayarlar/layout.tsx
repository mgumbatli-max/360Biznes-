import { SettingsTopNav } from "@/features/ayar/components/settings-top-nav";

/**
 * Ayarlar bölməsi üçün ümumi layout — bütün sub-səhifələrdə avtomatik
 * "← Tənzimləmələr" back link əlavə edir. Hub səhifəsi (/ayarlar) özü
 * SettingsTopNav-i daxili filterlə gizlədir, ona görə dublikat yaranmır.
 */
export default function AyarlarLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SettingsTopNav />
      {children}
    </>
  );
}
