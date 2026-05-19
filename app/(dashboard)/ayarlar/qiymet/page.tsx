import type { Metadata } from "next";
import { Tags, Settings2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { getQiymetQaydalari } from "@/features/ayarlar/qiymet-qayda-actions";
import {
  QiymetQaydaDialog,
  QiymetQaydaEditButton,
  QiymetQaydaDeleteButton,
  QiymetBulkApplyButton,
} from "@/features/ayarlar/components/qiymet-qayda-dialog";

export const metadata: Metadata = { title: "Qiymət siyasəti" };
export const dynamic = "force-dynamic";

async function getPriceTypes() {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    return prisma.qiymet_novleri.findMany({
      where: { OR: [{ sahibkar_id: sahibkarId }, { sahibkar_id: null }] },
      orderBy: { id: "asc" },
    });
  });
}

export default async function QiymetPage() {
  const [rows, { rules, categories }] = await Promise.all([getPriceTypes(), getQiymetQaydalari()]);

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Qiymət siyasəti</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Qiymət növləri (pərakəndə/topdan/VIP) və avtomatik markup qaydaları.
        </p>
      </header>

      {/* PRICE TYPES */}
      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <Tags className="h-4 w-4 text-primary-light" /> Qiymət növləri
        </h2>
        {rows.length === 0 ? (
          <Card className="glass border-dashed">
            <CardContent className="py-12 text-center">
              <Tags className="mx-auto h-8 w-8 text-muted-foreground/50" />
              <p className="mt-2 text-sm text-muted-foreground">
                Qiymət növü tapılmadı. Sistem 5 standart növü yaradır.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {rows.map((p) => (
              <Card key={p.id} className={`glass ${!p.aktiv && "opacity-60"}`}>
                <CardContent className="space-y-2 py-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{p.emoji ?? "🏷️"}</span>
                      <div>
                        <h3 className="font-semibold">{p.ad}</h3>
                        <div className="text-[10.5px] text-muted-foreground font-mono">{p.kod}</div>
                      </div>
                    </div>
                    {!p.aktiv && <Badge variant="outline" className="text-[10px]">passiv</Badge>}
                  </div>
                  <div className="grid grid-cols-2 gap-2 border-t border-border/40 pt-2 text-xs">
                    <div>
                      <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground">Default marja</div>
                      <div className="tabular-nums font-semibold">
                        {p.default_marja ? `${Number(p.default_marja).toFixed(1)}%` : "—"}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground">Min marja</div>
                      <div className="tabular-nums font-semibold">
                        {p.min_marja ? `${Number(p.min_marja).toFixed(1)}%` : "—"}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* PRICING RULES */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <Settings2 className="h-4 w-4 text-primary-light" /> Avtomatik markup qaydaları
          </h2>
          <div className="flex items-center gap-2">
            <QiymetBulkApplyButton />
            <QiymetQaydaDialog categories={categories} />
          </div>
        </div>

        {rules.length === 0 ? (
          <Card className="glass border-dashed">
            <CardContent className="py-10 text-center">
              <Settings2 className="mx-auto h-8 w-8 text-muted-foreground/50" />
              <p className="mt-2 text-sm text-muted-foreground">
                Hələ qayda yoxdur. &quot;Yeni qayda&quot; ilə kateqoriya əsaslı markup tənzimləyin.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="rounded-xl border border-border bg-card/40 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border/60 text-left text-[10.5px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-3 py-2.5">Ad</th>
                  <th className="px-3 py-2.5">Kateqoriya</th>
                  <th className="px-3 py-2.5 text-right">Markup</th>
                  <th className="px-3 py-2.5">Yuvarlaq</th>
                  <th className="px-3 py-2.5">Status</th>
                  <th className="px-3 py-2.5 text-right w-24">Əməl</th>
                </tr>
              </thead>
              <tbody>
                {rules.map((r) => {
                  const cat = r.kateqoriya_id ? categories.find((c) => c.id === r.kateqoriya_id) : null;
                  return (
                    <tr key={r.id} className="border-b border-border/30 hover:bg-secondary/40">
                      <td className="px-3 py-2.5 font-medium">{r.ad}</td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground">
                        {cat?.ad ?? <span className="italic">Hamısı</span>}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums font-semibold">
                        {r.markup.toFixed(1)}%
                      </td>
                      <td className="px-3 py-2.5 text-xs">
                        <Badge variant="outline" className="text-[10px] tabular-nums">.{r.round_to.split(".")[1]}</Badge>
                      </td>
                      <td className="px-3 py-2.5">
                        {r.aktiv ? (
                          <Badge variant="outline" className="text-[10px] border-success/30 text-success">aktiv</Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px]">passiv</Badge>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center justify-end gap-0.5">
                          <QiymetQaydaEditButton rule={r} categories={categories} />
                          <QiymetQaydaDeleteButton id={r.id} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
