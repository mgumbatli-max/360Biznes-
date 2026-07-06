import type { Metadata } from "next";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { getProductsWithRecipe, getRecipe, type Recept } from "@/features/anbar/istehsal";
import { IstehsalManager } from "@/features/anbar/components/istehsal-manager";
import { AnbarSubNav } from "@/components/anbar-subnav";
import { Factory } from "lucide-react";

export const metadata: Metadata = { title: "İstehsal (resept)" };

async function getAnbarlar() {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    return prisma.anbarlar.findMany({ where: { sahibkar_id: sahibkarId, aktiv: true }, select: { id: true, ad: true }, orderBy: { id: "asc" } });
  });
}

export default async function IstehsalPage() {
  const { requireAnbarPerm } = await import("@/features/anbar/access-guard");
  await requireAnbarPerm("anbar.idare");

  const [recipeIds, anbarlar] = await Promise.all([getProductsWithRecipe(), getAnbarlar()]);
  const recipes = (await Promise.all(recipeIds.map((id) => getRecipe(id)))).filter(Boolean) as Recept[];

  return (
    <div className="mx-auto max-w-4xl space-y-5 p-1">
      <AnbarSubNav active="/anbar/istehsal" />
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight"><Factory className="h-6 w-6 text-primary" /> İstehsal / resept</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Hazır məhsul üçün resept təyin edin (komponent + miqdar). İstehsal edəndə komponentlər anbardan
          çıxır, istehsal-maya avtomatik hesablanır, hazır məhsul stoka əlavə olunur.
        </p>
      </header>
      <IstehsalManager recipes={recipes} anbarlar={anbarlar} />
    </div>
  );
}
