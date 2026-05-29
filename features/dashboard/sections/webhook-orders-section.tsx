import Link from "next/link";
import { Webhook, ArrowRight, AlertTriangle, TrendingUp, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getWebhookOrders } from "@/features/qiymet-kanal/webhook-orders-queries";
import { formatMoney } from "@/lib/utils";

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "indicə";
  if (m < 60) return `${m} dəq`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} saat`;
  return `${Math.floor(h / 24)} gün`;
}

/** Dashboard widget — son 24 saatda gələn webhook sifarişlər. */
export async function WebhookOrdersSection() {
  const { items, total } = await getWebhookOrders({ limit: 100 });
  if (total === 0) return null;

  const since = Date.now() - 24 * 60 * 60 * 1000;
  const last24 = items.filter((i) => new Date(i.at).getTime() >= since);
  const revenue24 = last24.reduce((s, i) => s + i.cem_mebleg, 0);
  const stokAlerts = last24.filter((i) => i.short_count > 0).length;

  const byKanal = new Map<string, { count: number; revenue: number }>();
  for (const it of last24) {
    const prev = byKanal.get(it.kanal) ?? { count: 0, revenue: 0 };
    byKanal.set(it.kanal, { count: prev.count + 1, revenue: prev.revenue + it.cem_mebleg });
  }
  const sortedKanal = Array.from(byKanal.entries()).sort((a, b) => b[1].revenue - a[1].revenue);

  const top5 = items.slice(0, 5);

  return (
    <Card className="glass border-violet-500/20">
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2 pb-3">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <Webhook className="h-4 w-4 text-violet-500" />
            Marketplace webhook sifarişləri
          </CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            Son 24 saat: <strong className="text-foreground">{last24.length}</strong> sifariş ·{" "}
            <strong className="text-emerald-600">{formatMoney(revenue24)}</strong> dövriyyə
            {stokAlerts > 0 && (
              <>
                {" "}·{" "}
                <span className="text-rose-600">
                  <AlertTriangle className="inline h-3 w-3" /> {stokAlerts} stok qıtlığı
                </span>
              </>
            )}
          </p>
        </div>
        <Link
          href="/marketplace/webhook-orders"
          className="inline-flex items-center gap-1 text-xs text-primary-light hover:underline"
        >
          Hamısı <ArrowRight className="h-3 w-3" />
        </Link>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Kanal breakdown */}
        {sortedKanal.length > 0 && (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {sortedKanal.slice(0, 4).map(([k, s]) => (
              <div
                key={k}
                className="rounded-md border border-border/40 bg-card/40 p-2.5"
              >
                <div className="flex items-center justify-between">
                  <code className="rounded bg-secondary/60 px-1.5 py-0.5 text-[10.5px] font-mono">
                    {k}
                  </code>
                  <TrendingUp className="h-3 w-3 text-emerald-500" />
                </div>
                <div className="mt-1.5 text-base font-bold tabular-nums">
                  {formatMoney(s.revenue)}
                </div>
                <div className="text-[10.5px] text-muted-foreground">
                  {s.count} sifariş
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Son 5 sifariş */}
        <div>
          <h3 className="mb-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
            Son {Math.min(5, top5.length)} sifariş
          </h3>
          <ul className="space-y-1.5">
            {top5.map((o) => {
              const ok = o.short_count === 0;
              return (
                <li
                  key={String(o.audit_id)}
                  className="flex items-center gap-2.5 rounded-md border border-border/30 bg-card/30 px-2.5 py-1.5"
                >
                  <div
                    className={`grid h-7 w-7 shrink-0 place-items-center rounded-md ${
                      ok ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <code className="text-[10.5px] font-mono text-muted-foreground">{o.kanal}</code>
                      <span className="truncate text-xs font-medium">
                        {o.musteri_ad ?? "Naməlum müştəri"}
                      </span>
                      <span className="ml-auto shrink-0 text-xs font-bold tabular-nums">
                        {formatMoney(o.cem_mebleg)}
                      </span>
                    </div>
                    <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                      <span>{timeAgo(o.at)} əvvəl</span>
                      <span>·</span>
                      <span>{o.items.length} item</span>
                      {!ok && (
                        <>
                          <span>·</span>
                          <Badge variant="outline" className="border-rose-400/40 text-[9px] text-rose-500">
                            {o.short_count} stok yetmir
                          </Badge>
                        </>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
