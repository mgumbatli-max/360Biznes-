import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, UserPlus } from "lucide-react";
import { OnboardingWizard } from "@/features/iscilier/components/onboarding-wizard";
import { getRoleOptions, getFilialOptions } from "@/features/iscilier/queries";

export const metadata: Metadata = { title: "Onboarding — Yeni işçi" };
export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const [roles, filiallar] = await Promise.all([getRoleOptions(), getFilialOptions()]);

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <header className="flex items-start gap-3">
        <Link
          href="/iscilier"
          className="mt-1 inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
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
