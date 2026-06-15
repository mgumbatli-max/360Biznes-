import type { Metadata } from "next";
import { Boxes, Package } from "lucide-react";
import { BackButton } from "@/components/ui/back-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { requirePlatformAdmin } from "@/lib/platform-admin/guard";
import { getAllModules } from "@/features/platform-admin/queries";
import { ModuleCatalogRow } from "@/features/platform-admin/components/module-catalog-row";

export const metadata: Metadata = { title: "Modul kataloqu & qiymət" };

export default async function ModulKataloquPage() {
  await requirePlatformAdmin();
  const modullar = await getAllModules();

  const aktivSayi = modullar.filter((m) => m.aktiv).length;

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <BackButton fallback="/platform-admin" className="mt-1" />
          <div>
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-primary-light" />
              <h1 className="text-2xl font-bold tracking-tight">Modul kataloqu &amp; qiymət</h1>
            </div>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Modulların aylıq/illik qiyməti, plan paketlərinə daxilliyi və satış statusu.
            </p>
          </div>
        </div>
        <Badge variant="outline">{aktivSayi} / {modullar.length} aktiv</Badge>
      </header>

      <Card className="glass">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Boxes className="h-4 w-4 text-primary-light" /> Modullar
          </CardTitle>
          <span className="text-xs text-muted-foreground">Plana daxil = qiymət avtomatik 0 (paketdə daxildir)</span>
        </CardHeader>
        <CardContent className="p-0">
          {modullar.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Modul yoxdur</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border/60 text-left text-[10.5px] uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">Modul</th>
                    <th className="px-3 py-2">Qrup</th>
                    <th className="px-3 py-2">Aylıq qiymət</th>
                    <th className="px-3 py-2">İllik</th>
                    <th className="px-3 py-2">Planlar</th>
                    <th className="px-3 py-2 text-center">Ayrıca alına bilər</th>
                    <th className="px-3 py-2 text-center">Aktiv</th>
                    <th className="px-3 py-2 text-right">Əməliyyat</th>
                  </tr>
                </thead>
                <tbody>
                  {modullar.map((m) => (
                    <ModuleCatalogRow key={m.kod} modul={m} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
