import type { Metadata } from "next";
import { Receipt } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ViewToggle } from "@/components/ui/view-toggle";
import { getViewMode } from "@/components/ui/view-mode";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { XercKateqoriyaDialog } from "@/features/ayarlar/components/xerc-kateqoriya-dialog";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Xərc kateqoriyaları" };

type SearchParams = Promise<{ view?: string }>;

async function getExpenseCategories() {
  return withTenant(async () =>
    prisma.xerc_kateqoriyalari.findMany({
      orderBy: [{ qrup: "asc" }, { ad: "asc" }],
      include: { _count: { select: { xercl_r: true } } },
    })
  );
}

export default async function XercKateqoriyaPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const view = getViewMode(sp as Record<string, string | undefined>, "view", "card");

  const rows = await getExpenseCategories();

  const byQrup = new Map<string, typeof rows>();
  for (const r of rows) {
    const qrup = r.qrup ?? "ümumi";
    const arr = byQrup.get(qrup) ?? [];
    arr.push(r);
    byQrup.set(qrup, arr);
  }

  const allGroups = Array.from(byQrup.keys());

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-secondary text-primary">
            <Receipt className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Xərc kateqoriyaları</h1>
            <p className="text-sm text-muted-foreground">
              Xərc qrupları, ikonlar və rənglər · {rows.length} kateqoriya
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ViewToggle modes={["card", "list"]} />
          <XercKateqoriyaDialog groups={allGroups} />
        </div>
      </header>


      {rows.length === 0 ? (
        <Card className="glass border-dashed">
          <CardContent className="py-12 text-center">
            <Receipt className="mx-auto h-8 w-8 text-muted-foreground/50" />
            <p className="mt-2 text-sm text-muted-foreground">Xərc kateqoriyası yoxdur.</p>
          </CardContent>
        </Card>
      ) : view === "list" ? (
        <Card className="glass">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-[10.5px] uppercase tracking-wider text-muted-foreground">
                  <tr className="border-b border-border/40 text-left">
                    <th className="w-10 px-3 py-2"></th>
                    <th className="px-3 py-2">Ad</th>
                    <th className="px-3 py-2">Qrup</th>
                    <th className="px-3 py-2 text-right">Xərc sayı</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2 w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((k) => (
                    <tr key={k.id} className={cn("border-b border-border/20", !k.aktiv && "opacity-60")}>
                      <td className="px-3 py-2">
                        <div
                          className="grid h-7 w-7 place-items-center rounded-md text-base"
                          style={{ background: `${k.reng ?? "#64748b"}25`, color: k.reng ?? "#64748b" }}
                        >
                          {k.ikon ?? "💸"}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-sm font-semibold">{k.ad}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground capitalize">{k.qrup ?? "—"}</td>
                      <td className="px-3 py-2 text-right text-xs tabular-nums">{k._count.xercl_r}</td>
                      <td className="px-3 py-2">
                        {k.aktiv ? (
                          <Badge variant="outline" className="text-[10px] text-emerald-500 border-emerald-500/40">
                            aktiv
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px]">passiv</Badge>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <XercKateqoriyaDialog
                          row={{ id: k.id, ad: k.ad, qrup: k.qrup, ikon: k.ikon, reng: k.reng, aktiv: k.aktiv }}
                          groups={allGroups}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ) : (
        Array.from(byQrup.entries()).map(([qrup, kateqoriyalar]) => (
          <section key={qrup} className="space-y-2">
            <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">{qrup}</h2>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
              {kateqoriyalar.map((k) => (
                <Card key={k.id} className={cn("glass", !k.aktiv && "opacity-60")}>
                  <CardContent className="flex items-center gap-3 py-3">
                    <div
                      className="grid h-9 w-9 place-items-center rounded-md text-lg"
                      style={{ background: `${k.reng ?? "#64748b"}25`, color: k.reng ?? "#64748b" }}
                    >
                      {k.ikon ?? "💸"}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-semibold">{k.ad}</span>
                        {!k.aktiv && <Badge variant="outline" className="text-[10px]">passiv</Badge>}
                      </div>
                      <div className="text-[10.5px] text-muted-foreground">
                        {k._count.xercl_r} xərc qeyd olunub
                      </div>
                    </div>
                    <XercKateqoriyaDialog
                      row={{ id: k.id, ad: k.ad, qrup: k.qrup, ikon: k.ikon, reng: k.reng, aktiv: k.aktiv }}
                      groups={allGroups}
                    />
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
