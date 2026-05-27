import type { Metadata } from "next";
import { UserPlus } from "lucide-react";
import { BackButton } from "@/components/ui/back-button";
import { OnboardingWizard } from "@/features/iscilier/components/onboarding-wizard";
import { getRoleOptions, getFilialOptions } from "@/features/iscilier/queries";

export const metadata: Metadata = { title: "Onboarding — Yeni işçi" };
export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const [roles, filiallar] = await Promise.all([getRoleOptions(), getFilialOptions()]);

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <header className="flex items-start gap-3">
        <BackButton fallback="/iscilier" className="mt-1" />
        <div>
          <h1 className="inline-flex items-center gap-2 text-2xl font-bold tracking-tight">
            <UserPlus className="h-5 w-5" /> Onboarding
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Yeni işçi qəbulu — 5 addım wizard. Tamamlandıqda onboarding checklist tapşırıqları
            avtomatik yaradılır.
          </p>
        </div>
      </header>

      <OnboardingWizard roles={roles} filiallar={filiallar} />
    </div>
  );
}
