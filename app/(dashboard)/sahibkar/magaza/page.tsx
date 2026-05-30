import type { Metadata } from "next";
import { Building2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { requireSahibkarSession } from "@/lib/sahibkar/guard";
import { getBranchPerformance } from "@/features/sahibkar/queries";
import { SectionExplainer } from "@/features/sahibkar/components/section-explainer";
import { formatMoney, formatNumber } from "@/lib/utils";

export const metadata: Metadata = { title: "Mağaza müqayisəsi" };

export default async function MagazaPage() {
  await requireSahibkarSession();
  const rows = await getBranchPerformance();
  const total = rows.reduce((s, r) => s + Number(r.cemi ?? 0), 0);

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Mağaza müqayisəsi (bu ay)</h1>
        <p className="mt-1 text-sm text-muted-foreground">Filiallar üzrə satış və stok dəyəri.</p>
      </header>

      <SectionExplainer
        icon={Building2}
        tone="emerald"
        description="Bu ayın filial üzrə müqayisəsi — hər filial nə qədər satıb, hansı stok dəyəri var. Lider və geri qalanı bir baxışda tap. Daha detallı analiz üçün /sahibkar/filial-muqayise bölməsinə bax."
      />

      {rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
          <Building2 className="mb-2 h-8 w-8 text-muted-foreground/50" />
          <h3 className="font-semibold">Filial yoxdur</h3>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((r, i) => {
            const share = total > 0 ? (Number(r.cemi ?? 0) / total) * 100 : 0;
            return (
              <Card key={r.filial_id} className="glass">
                <CardContent className="space-y-2 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className="h-6 w-6 justify-center p-0">{i + 1}</Badge>
                      <div>
                        <div className="font-semibold">{r.ad}</div>
                        <div className="text-xs text-muted-foreground">
                          {Number(r.sifaris_say ?? 0)} sifariş · stok dəyər {formatMoney(r.stok_deyer)}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold tabular-nums">{formatMoney(r.cemi)}</div>
                      <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground">
                        {share.toFixed(1)}% pay
                      </div>
                    </div>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                    <div className="h-full" style={{ background: "var(--brand-gradient)", width: `${share}%` }} />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
