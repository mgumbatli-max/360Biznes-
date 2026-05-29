import type { Metadata } from "next";
import Link from "next/link";
import { Webhook, AlertTriangle, CheckCircle2, ArrowRight, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KpiCard } from "@/features/dashboard/components/kpi-card";
import { getWebhookOrders } from "@/features/qiymet-kanal/webhook-orders-queries";
import { formatMoney } from "@/lib/utils";

export const metadata: Metadata = { title: "Webhook sifarişləri" };
export const dynamic = "force-dynamic";

type SearchParams = {
  kanal?: string;
  page?: string;
};

const PAGE_SIZE = 50;

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString("az-AZ", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function WebhookOrdersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const { items, total } = await getWebhookOrders({
    kanal: sp.kanal ?? null,
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  });

  // KPI hesabla
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayItems = items.filter((i) => new Date(i.at) >= todayStart);
  const todayRev = todayItems.reduce((s, i) => s + i.cem_mebleg, 0);
  const shortCount = items.filter((i) => i.short_count > 0).length;

  // Kanal üzrə qruplaşdır
  const byKanal = new Map<string, number>();
  for (const it of items) {
    byKanal.set(it.kanal, (byKanal.get(it.kanal) ?? 0) + 1);
  }

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Webhook className="h-5 w-5 text-primary-light" />
            Webhook sifarişləri
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Platformalardan webhook ilə qəbul olunan sifarişlər — stok avtomatik azaldılır,
            audit-də izlənir.
          </p>
        </div>
        <Button asChild size="sm" variant="outline">
          <Link href="/ayarlar/kanallar">
            Kanalları idarə et
            <ArrowRight className="h-3 w-3" />
          </Link>
        </Button>
      </header>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          icon={Webhook}
          label="Cəm webhook"
          value={String(total)}
          subline="Audit log-da"
        />
        <KpiCard
          icon={CheckCircle2}
          label="Bu gün"
          value={String(todayItems.length)}
          subline={formatMoney(todayRev)}
          tone="success"
        />
        <KpiCard
          icon={AlertTriangle}
          label="Stok yetmir"
          value={String(shortCount)}
          subline="Qismən qəbul"
          tone={shortCount > 0 ? "warning" : "neutral"}
        />
        <KpiCard
          icon={ExternalLink}
          label="Aktiv kanal"
          value={String(byKanal.size)}
          subline={Array.from(byKanal.keys()).join(", ") || "—"}
        />
      </section>

      {byKanal.size > 0 && (
        <div className="flex flex-wrap gap-2">
          <Link
            href="/marketplace/webhook-orders"
            className={`rounded-md border px-3 py-1 text-xs transition ${
              !sp.kanal
                ? "border-primary bg-primary/10 text-primary-light"
                : "border-border bg-card hover:bg-secondary"
            }`}
          >
            Hamısı ({total})
          </Link>
          {Array.from(byKanal.entries()).map(([k, n]) => (
            <Link
              key={k}
              href={`/marketplace/webhook-orders?kanal=${k}`}
              className={`rounded-md border px-3 py-1 text-xs transition ${
                sp.kanal === k
                  ? "border-primary bg-primary/10 text-primary-light"
                  : "border-border bg-card hover:bg-secondary"
              }`}
            >
              {k} ({n})
            </Link>
          ))}
        </div>
      )}

      <Card className="glass">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            Sifarişlər
            {sp.kanal && <span className="ml-2 text-xs font-normal text-muted-foreground">— {sp.kanal}</span>}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {items.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Hələ heç bir webhook sifariş qəbul olunmayıb.
              <br />
              <Link
                href="/ayarlar/kanallar"
                className="mt-2 inline-block text-primary hover:underline"
              >
                Ayarlar → Satış kanallarında webhook qurun
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-secondary/30 text-[10.5px] uppercase tracking-wider text-muted-foreground">
                  <tr className="text-left">
                    <th className="px-3 py-2 font-medium">Tarix</th>
                    <th className="px-3 py-2 font-medium">Kanal</th>
                    <th className="px-3 py-2 font-medium">External ID</th>
                    <th className="px-3 py-2 font-medium">Müştəri</th>
                    <th className="px-3 py-2 text-right font-medium">Item</th>
                    <th className="px-3 py-2 text-right font-medium">Məbləğ</th>
                    <th className="px-3 py-2 text-center font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {items.map((o) => (
                    <tr key={String(o.audit_id)} className="hover:bg-secondary/20">
                      <td className="px-3 py-2.5 text-xs tabular-nums text-muted-foreground">
                        {fmtDate(o.at)}
                      </td>
                      <td className="px-3 py-2.5">
                        <code className="rounded bg-secondary/60 px-1.5 py-0.5 text-[10.5px] font-mono">
                          {o.kanal}
                        </code>
                      </td>
                      <td className="px-3 py-2.5 font-mono text-[11px]">{o.external_id}</td>
                      <td className="px-3 py-2.5">
                        <div className="font-medium">{o.musteri_ad ?? "—"}</div>
                        {o.musteri_telefon && (
                          <div className="text-[10.5px] text-muted-foreground">{o.musteri_telefon}</div>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <details className="cursor-pointer">
                          <summary className="text-xs tabular-nums hover:text-primary">
                            {o.items.length}
                            {o.short_count > 0 && (
                              <span className="ml-1 text-rose-500">⚠</span>
                            )}
                          </summary>
                          <ul className="mt-1 space-y-0.5 text-left text-[10.5px] text-muted-foreground">
                            {o.items.map((it, idx) => (
                              <li key={idx} className={it.stok_catismir ? "text-rose-500" : ""}>
                                {it.sku ?? "(SKU yox)"} × {it.miqdar}
                                {it.azaldilan < it.miqdar && (
                                  <span className="ml-1 font-bold">
                                    (yalnız {it.azaldilan} azaldı)
                                  </span>
                                )}
                              </li>
                            ))}
                          </ul>
                        </details>
                      </td>
                      <td className="px-3 py-2.5 text-right font-semibold tabular-nums">
                        {formatMoney(o.cem_mebleg)} {o.valyuta !== "AZN" && o.valyuta}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <Badge
                          variant="outline"
                          className={`text-[10px] ${
                            o.short_count > 0
                              ? "border-amber-400/40 text-amber-600"
                              : "border-emerald-400/40 text-emerald-600"
                          }`}
                        >
                          {o.short_count > 0 ? "qismən" : o.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {total > PAGE_SIZE && (
        <div className="flex justify-center gap-2">
          {page > 1 && (
            <Button asChild size="sm" variant="outline">
              <Link
                href={`/marketplace/webhook-orders?${new URLSearchParams({
                  ...(sp.kanal ? { kanal: sp.kanal } : {}),
                  page: String(page - 1),
                }).toString()}`}
              >
                ← Əvvəlki
              </Link>
            </Button>
          )}
          <span className="text-xs text-muted-foreground self-center">
            Səhifə {page} / {Math.ceil(total / PAGE_SIZE)}
          </span>
          {page * PAGE_SIZE < total && (
            <Button asChild size="sm" variant="outline">
              <Link
                href={`/marketplace/webhook-orders?${new URLSearchParams({
                  ...(sp.kanal ? { kanal: sp.kanal } : {}),
                  page: String(page + 1),
                }).toString()}`}
              >
                Növbəti →
              </Link>
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
