import type { Metadata } from "next";
import Link from "next/link";
import { Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { requireSahibkarSession } from "@/lib/sahibkar/guard";
import { getOwnerEmployees } from "@/features/sahibkar/owner-queries";
import { formatMoney } from "@/lib/utils";

export const metadata: Metadata = { title: "İşçi baxışı" };
export const dynamic = "force-dynamic";

export default async function SahibkarIsciPage() {
  await requireSahibkarSession();
  const rows = await getOwnerEmployees();

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">İşçilər (sahibkar baxışı)</h1>
        <p className="mt-1 text-sm text-muted-foreground">Yalnız oxumaq üçün — performans və əsas məlumat.</p>
      </header>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
          <Users className="mb-2 h-8 w-8 text-muted-foreground/50" />
          <h3 className="font-semibold">İşçi yoxdur</h3>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {rows.map((e) => (
            <Link key={e.id} href={`/iscilier/${e.id}`}>
              <Card className="glass transition hover:border-primary/30">
                <CardContent className="space-y-2 py-4">
                  <div className="flex items-center gap-3">
                    {e.profil_sekil ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={e.profil_sekil} alt="" className="h-10 w-10 rounded-full object-cover" />
                    ) : (
                      <div className="grid h-10 w-10 place-items-center rounded-full bg-secondary text-xs font-semibold">
                        {e.ad_soyad.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="truncate font-semibold">{e.ad_soyad}</div>
                      <div className="text-xs text-muted-foreground">{e.vezife ?? "—"}</div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Bu ay satış</span>
                    <span className="font-semibold tabular-nums">{formatMoney(e.month_sales)}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Sifariş sayı</span>
                    <Badge variant="outline" className="text-[10px]">{e.month_orders}</Badge>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Maaş</span>
                    <span className="tabular-nums">{formatMoney(e.aylik_maas)}</span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
