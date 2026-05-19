import type { Metadata } from "next";
import Link from "next/link";
import { CreditCard, ArrowLeft } from "lucide-react";
import { TicaretSubNav } from "@/components/ticaret-subnav";
import { KreditYeniClient } from "@/features/ticaret/components/kredit-yeni-client";
import { getAnbarOptions } from "@/features/ticaret/satis-yeni-queries";

export const metadata: Metadata = { title: "Kreditlə satış (yeni)" };
export const dynamic = "force-dynamic";

export default async function KreditYeniPage() {
  const anbarlar = await getAnbarOptions();
  const defaultAnbarId = anbarlar[0]?.id ?? 0;

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <Link
        href="/ticaret/kredit"
        className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground transition hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Kreditlər siyahısı
      </Link>

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
