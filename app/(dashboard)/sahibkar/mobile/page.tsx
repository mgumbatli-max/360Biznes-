import type { Metadata } from "next";
import { Smartphone } from "lucide-react";
import { requireSahibkarSession } from "@/lib/sahibkar/guard";
import { getOwnerHubSnapshot } from "@/features/sahibkar/owner-queries";
import { MobilePanel } from "@/features/sahibkar/components/mobile-panel";
import { SectionExplainer } from "@/features/sahibkar/components/section-explainer";

export const metadata: Metadata = { title: "Sahibkar (mobil)" };
export const dynamic = "force-dynamic";

export default async function MobileOwnerPage() {
  await requireSahibkarSession();
  const hub = await getOwnerHubSnapshot();

  return (
    <div className="mx-auto max-w-md space-y-3">
      <SectionExplainer
        icon={Smartphone}
        title="Mobil panel — özünə uyğunlaşdır"
        tone="sky"
        description={`"Düzəlt" düyməsi ilə hansı widget-lərin görünməsini seç. Seçim brauzerdə saxlanır (localStorage) — fərqli cihazlarda fərqli görünüşə icazə verir.`}
      />
      <MobilePanel hub={hub} />
    </div>
  );
}
