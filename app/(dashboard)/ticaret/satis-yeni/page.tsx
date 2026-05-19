import type { Metadata } from "next";
import { ShoppingBag } from "lucide-react";
import { auth } from "@/auth";
import { TicaretSubNav } from "@/components/ticaret-subnav";
import { SatisYeniClient } from "@/features/ticaret/components/satis-yeni-client";
import { getSalespersonOptions } from "@/features/pos/sale-queries";
import {
  getAnbarOptions,
  getSablonlar,
  getQaralamalar,
} from "@/features/ticaret/satis-yeni-queries";

export const metadata: Metadata = { title: "Yeni satış (Sifariş)" };
export const dynamic = "force-dynamic";

export default async function SatisYeniPage() {
  const session = await auth();
  if (!session?.user) return null;

  const [anbarlar, saticilar, sablonlar, qaralamalar] = await Promise.all([
    getAnbarOptions(),
    getSalespersonOptions(),
    getSablonlar(),
    getQaralamalar(20),
  ]);

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <header className="flex items-start gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-md bg-secondary text-muted-foreground">
          <ShoppingBag className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Yeni satış (sifariş)</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Tam formalı satış sənədi — B2B sifarişlər, formal təkliflər, qaralamalar.
          </p>
        </div>
      </header>

      <TicaretSubNav active="/ticaret/satis-yeni" />

      <SatisYeniClient
        anbarlar={anbarlar}
        saticilar={saticilar}
        defaultSalespersonId={session.user.id}
        sablonlar={sablonlar.map((s) => ({ id: s.id, ad: s.ad, payload: s.payload }))}
        qaralamalar={qaralamalar}
      />
    </div>
  );
}
