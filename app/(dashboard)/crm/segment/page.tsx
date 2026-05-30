import type { Metadata } from "next";
import { Layers, Phone, Mail, Megaphone, Download } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CrmSubNav } from "@/components/crm-subnav";
import { getBuiltInSegments, getSegmentCustomers, getCustomSegments } from "@/features/crm/segment-queries";
import { AiSegmentBuilder } from "@/features/crm/components/ai-segment-builder";
import { formatMoney, formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Müştəri Seqmentasiya" };

type SearchParams = Promise<{ seq?: string }>;

export default async function SegmentPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const selected = sp.seq ?? null;
  const [builtIn, customs, customers] = await Promise.all([
    getBuiltInSegments(),
    getCustomSegments(),
    selected ? getSegmentCustomers(selected) : Promise.resolve([]),
  ]);

  const all = [
    ...builtIn,
    ...customs.map((c) => ({ kod: `custom_${c.id}`, ad: c.ad, tesvir: c.tesvir ?? "", reng: c.reng, count: 0 })),
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <CrmSubNav active="/crm/segment" />

      <header>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Layers className="h-5 w-5" /> Müştəri Seqmentasiya
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Müştəriləri davranışa görə qruplaşdırın və hədəfli kampaniya göndərin.
        </p>
      </header>

      <AiSegmentBuilder selectedSegmentKod={selected} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {all.map((s) => {
          const href = `/crm/segment?seq=${s.kod}`;
          const isActive = selected === s.kod;
          return (
            <a
              key={s.kod}
              href={href}
              className={`block rounded-xl border bg-card/40 p-4 transition hover:-translate-y-0.5 hover:shadow-md ${
                isActive ? "border-primary ring-2 ring-primary/20" : "border-border"
              }`}
              style={{ borderLeft: `4px solid ${s.reng}` }}
            >
              <h3 className="font-semibold text-sm">{s.ad}</h3>
              <p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">{s.tesvir}</p>
              <div className="mt-3 text-3xl font-bold tabular-nums" style={{ color: s.reng }}>
                {s.count}
              </div>
            </a>
          );
        })}
      </div>

      {selected && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold uppercase tracking-wider text-muted-foreground">
              Müştərilər ({customers.length})
            </h2>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" asChild>
                <a href={`/crm/broadcast?seq=${selected}`}>
                  <Megaphone className="h-3.5 w-3.5" /> Broadcast göndər
                </a>
              </Button>
              <Button size="sm" variant="outline" disabled>
                <Download className="h-3.5 w-3.5" /> CSV ixrac
              </Button>
            </div>
          </div>

          {customers.length === 0 ? (
            <Card className="glass">
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                Bu seqmentdə müştəri yoxdur
              </CardContent>
            </Card>
          ) : (
            <div className="rounded-xl border border-border overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-secondary/40">
                  <tr className="text-left text-[10.5px] uppercase tracking-wider text-muted-foreground">
                    <th className="px-3 py-2">Ad</th>
                    <th className="px-3 py-2">Əlaqə</th>
                    <th className="px-3 py-2 text-right">Borc</th>
                    <th className="px-3 py-2">Son təmas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {customers.map((c) => (
                    <tr key={c.id} className="hover:bg-secondary/30">
                      <td className="px-3 py-2 font-medium">{c.ad}</td>
                      <td className="px-3 py-2">
                        {c.telefon && (
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <Phone className="h-2.5 w-2.5" /> {c.telefon}
                          </div>
                        )}
                        {c.email && (
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <Mail className="h-2.5 w-2.5" /> {c.email}
                          </div>
                        )}
                      </td>
                      <td className={`px-3 py-2 text-right tabular-nums ${c.borc > 0 ? "text-warning font-semibold" : "text-muted-foreground"}`}>
                        {c.borc !== 0 ? formatMoney(c.borc) : "—"}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">{c.son_alish ? formatDate(c.son_alish) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
