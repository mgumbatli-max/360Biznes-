import type { Metadata } from "next";
import Link from "next/link";
import { Building2, ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { requireSahibkarSession } from "@/lib/sahibkar/guard";
import { getOwnerBranches } from "@/features/sahibkar/owner-queries";
import { BranchDialog } from "@/features/sahibkar/components/branch-dialog";
import { formatMoney } from "@/lib/utils";

export const metadata: Metadata = { title: "Filiallar" };
export const dynamic = "force-dynamic";

export default async function SahibkarFiliallarPage() {
  await requireSahibkarSession();
  const rows = await getOwnerBranches();

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Filiallar</h1>
          <p className="mt-1 text-sm text-muted-foreground">Şəbəkəni idarə et və performansı izlə.</p>
        </div>
        <BranchDialog />
      </header>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
          <Building2 className="mb-2 h-8 w-8 text-muted-foreground/50" />
          <h3 className="font-semibold">Filial yoxdur</h3>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {rows.map((b) => (
            <Card key={b.id} className="glass">
              <CardContent className="space-y-2 py-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-semibold">{b.ad}</div>
                    <div className="text-xs text-muted-foreground">{b.seh_r ?? "—"} {b.unvan ? `· ${b.unvan}` : ""}</div>
                  </div>
                  <Badge variant="outline" className="text-[10px]">{b.tip ?? "magaza"}</Badge>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Bu ay satış</span>
                  <span className="font-semibold tabular-nums">{formatMoney(b.month_sales)}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">İşçi · sifariş</span>
                  <span className="tabular-nums">{b.isci_count} · {b.month_orders}</span>
                </div>
                <div className="flex items-center justify-between pt-1 text-xs">
                  <span className="text-muted-foreground">{b.cavabdeh_ad ?? "Cavabdeh yox"}</span>
                  <Link href={`/sahibkar/filiallar/${b.id}`} className="inline-flex items-center gap-1 text-primary-light">
                    Detal <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
