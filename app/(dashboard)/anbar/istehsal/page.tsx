import type { Metadata } from "next";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { getProductsWithRecipe, getRecipe, getProductionHistory, type Recept } from "@/features/anbar/istehsal";
import { IstehsalManager } from "@/features/anbar/components/istehsal-manager";
import { AnbarSubNav } from "@/components/anbar-subnav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoney, formatNumber } from "@/lib/utils";
import { Factory, History, Package, Coins } from "lucide-react";

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

  const [recipeIds, anbarlar, history] = await Promise.all([getProductsWithRecipe(), getAnbarlar(), getProductionHistory(50)]);
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

      {/* Bu ay xülasəsi */}
      <div className="grid grid-cols-3 gap-3">
        <Card><CardContent className="p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><Factory className="h-4 w-4" /> Bu ay istehsal</div>
          <div className="mt-1 text-xl font-bold tabular-nums">{formatNumber(history.bu_ay_say)}</div>
          <div className="text-[11px] text-muted-foreground">əməliyyat</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><Package className="h-4 w-4" /> İstehsal miqdarı</div>
          <div className="mt-1 text-xl font-bold tabular-nums">{formatNumber(history.bu_ay_miqdar)}</div>
          <div className="text-[11px] text-muted-foreground">ədəd/vahid</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><Coins className="h-4 w-4" /> İstehsal-maya</div>
          <div className="mt-1 text-xl font-bold tabular-nums">{formatMoney(history.bu_ay_maya)}</div>
          <div className="text-[11px] text-muted-foreground">bu ay cəmi</div>
        </CardContent></Card>
      </div>

      <IstehsalManager recipes={recipes} anbarlar={anbarlar} />

      {/* Tarixçə */}
      {history.tarixce.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><History className="h-4 w-4" /> İstehsal tarixçəsi</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
                <tr>
                  <th className="p-3 text-left font-medium">Tarix</th>
                  <th className="p-3 text-left font-medium">Məhsul</th>
                  <th className="p-3 text-right font-medium">Miqdar</th>
                  <th className="p-3 text-right font-medium">Vahid maya</th>
                  <th className="p-3 text-right font-medium">Cəmi maya</th>
                  <th className="p-3 text-left font-medium">Anbar</th>
                </tr>
              </thead>
              <tbody>
                {history.tarixce.map((h) => (
                  <tr key={h.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="p-3 text-muted-foreground">{h.tarix ? new Date(h.tarix).toLocaleDateString("az") : "—"}</td>
                    <td className="p-3 font-medium">{h.mehsul_ad}</td>
                    <td className="p-3 text-right tabular-nums">{formatNumber(h.miqdar)}</td>
                    <td className="p-3 text-right tabular-nums">{formatMoney(h.vahid_maya)}</td>
                    <td className="p-3 text-right tabular-nums font-semibold">{formatMoney(h.toplam_maya)}</td>
                    <td className="p-3 text-muted-foreground">{h.anbar_ad ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
