import type { Metadata } from "next";
import { CreditCard } from "lucide-react";
import { BackButton } from "@/components/ui/back-button";
import { TicaretSubNav } from "@/components/ticaret-subnav";
import { KreditYeniClient } from "@/features/ticaret/components/kredit-yeni-client";
import { getAnbarOptions } from "@/features/ticaret/satis-yeni-queries";

export const metadata: Metadata = { title: "Kreditlə satış (yeni)" };

export default async function KreditYeniPage() {
  const anbarlar = await getAnbarOptions();
  const defaultAnbarId = anbarlar[0]?.id ?? 0;

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <BackButton fallback="/ticaret/kredit" label="Kreditlər siyahısı" />

      <header className="flex items-start gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-md bg-secondary text-muted-foreground">
          <CreditCard className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Yeni kreditlə satış</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Bank-maliyyəli taksitli satış. PMT, amortizasiya, bank müqayisəsi, sənəd checklist.
          </p>
        </div>
      </header>

      <TicaretSubNav active="/ticaret/kredit-yeni" />

      <KreditYeniClient anbarlar={anbarlar} defaultAnbarId={defaultAnbarId} />
    </div>
  );
}
