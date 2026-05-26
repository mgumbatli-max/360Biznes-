import type { Metadata } from "next";
import { Smartphone } from "lucide-react";
import { requireSahibkarSession } from "@/lib/sahibkar/guard";
import { getOwnerHubSnapshot } from "@/features/sahibkar/owner-queries";
import { MobilePanel } from "@/features/sahibkar/components/mobile-panel";
import { SectionExplainer } from "@/features/sahibkar/components/section-explainer";
import { getMobileWidgets } from "@/features/sahibkar/mobile-widget-actions";

export const metadata: Metadata = { title: "Sahibkar (mobil)" };
export const dynamic = "force-dynamic";

export default async function MobileOwnerPage() {
  await requireSahibkarSession();
  const [hub, savedWidgets] = await Promise.all([
    getOwnerHubSnapshot(),
    getMobileWidgets(),
  ]);

  return (
    <div className="mx-auto max-w-md space-y-3">
      <SectionExplainer
        icon={Smartphone}
        title="Mobil panel — özünə uyğunlaşdır"
        tone="sky"
        description={`"Düzəlt" düyməsi ilə hansı widget-lərin görünməsini seç. Seçim cihazlar arası sinxron — DB-də saxlanır.`}
      />
      <MobilePanel hub={hub} initialActive={savedWidgets ?? undefined} />
    </div>
  );
}
