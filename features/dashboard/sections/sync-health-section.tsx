import Link from "next/link";
import {
  Activity,
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  Webhook,
  Upload,
  Download,
  RotateCw,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getAllKanalStats } from "@/features/qiymet-kanal/api-stats";
import { getAllOutboundStats } from "@/features/qiymet-kanal/outbound-stats";
import { getAllRetryQueues } from "@/features/qiymet-kanal/outbound-retry";
import { getWebhookOrders } from "@/features/qiymet-kanal/webhook-orders-queries";

/** Dashboard compact widget — sync vəziyyəti. */
export async function SyncHealthSection() {
  const [apiStats, outboundStats, retryQueues, webhookOrders] = await Promise.all([
    getAllKanalStats(),
    getAllOutboundStats(),
    getAllRetryQueues(),
    getWebhookOrders({ limit: 100 }),
  ]);

  // Heç bir kanal sync etmirsə widget göstərmə
  const anyActivity =
    Object.keys(apiStats).length > 0 ||
    Object.keys(outboundStats).length > 0 ||
    webhookOrders.total > 0;
  if (!anyActivity) return null;

  const since24h = Date.now() - 24 * 60 * 60 * 1000;
  const inbound24h = Object.values(apiStats).reduce((s, st) => {
    return s + st.recent.filter((e) => new Date(e.at).getTime() >= since24h && e.status === 200).length;
  }, 0);
  const outbound24h = Object.values(outboundStats).reduce((s, st) => {
    return (
      s +
      st.recent.filter((e) => new Date(e.at).getTime() >= since24h && e.status >= 200 && e.status < 300).length
    );
  }, 0);
  const webhook24h = webhookOrders.items.filter((o) => new Date(o.at).getTime() >= since24h).length;
  const pendingRetries = Object.values(retryQueues).reduce((s, q) => s + q.entries.length, 0);

  const outTotal = Object.values(outboundStats).reduce((s, st) => s + st.total_pushes, 0);
  const outOk = Object.values(outboundStats).reduce((s, st) => s + st.total_success, 0);
  const outRate = outTotal > 0 ? Math.round((outOk / outTotal) * 100) : 100;

  const hasProblem = pendingRetries > 0 || outRate < 95;

  return (
    <Card className={`glass ${hasProblem ? "border-amber-500/30" : "border-emerald-500/20"}`}>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2 pb-3">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className={`h-4 w-4 ${hasProblem ? "text-amber-500" : "text-emerald-500"}`} />
            Marketplace sync sağlamlığı
          </CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            Son 24 saat: {inbound24h + webhook24h + outbound24h} əməliyyat
          </p>
        </div>
        <div className="flex items-center gap-2">
          {hasProblem ? (
            <Badge variant="outline" className="border-amber-500/40 text-[10px] text-amber-600">
              <AlertTriangle className="h-3 w-3" /> Az problem
            </Badge>
          ) : (
            <Badge variant="outline" className="border-emerald-500/40 text-[10px] text-emerald-600">
              <CheckCircle2 className="h-3 w-3" /> Sağlam
            </Badge>
          )}
          <Link
            href="/marketplace/sync-health"
            className="inline-flex items-center gap-1 text-xs text-primary-light hover:underline"
          >
            Detal <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          <div className="rounded-md border border-border/40 bg-card/40 p-2.5">
            <div className="flex items-center gap-1.5 text-[10.5px] uppercase tracking-wider text-muted-foreground">
              <Download className="h-3 w-3" /> Inbound
            </div>
            <div className="mt-0.5 text-lg font-bold tabular-nums">{inbound24h}</div>
            <div className="text-[10px] text-muted-foreground">platform oxudu</div>
          </div>
          <div className="rounded-md border border-emerald-500/20 bg-emerald-500/5 p-2.5">
            <div className="flex items-center gap-1.5 text-[10.5px] uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
              <Webhook className="h-3 w-3" /> Webhook
            </div>
            <div className="mt-0.5 text-lg font-bold tabular-nums text-emerald-600">{webhook24h}</div>
            <div className="text-[10px] text-muted-foreground">gələn sifariş</div>
          </div>
          <div
            className={`rounded-md border p-2.5 ${
              outRate >= 95 ? "border-border/40 bg-card/40" : "border-amber-500/30 bg-amber-500/5"
            }`}
          >
            <div className="flex items-center gap-1.5 text-[10.5px] uppercase tracking-wider text-muted-foreground">
              <Upload className="h-3 w-3" /> Outbound
            </div>
            <div
              className={`mt-0.5 text-lg font-bold tabular-nums ${
                outRate >= 95 ? "" : outRate >= 80 ? "text-amber-600" : "text-rose-600"
              }`}
            >
              {outbound24h}
            </div>
            <div className="text-[10px] text-muted-foreground">uğur {outRate}%</div>
          </div>
          <div
            className={`rounded-md border p-2.5 ${
              pendingRetries > 0 ? "border-amber-500/30 bg-amber-500/5" : "border-border/40 bg-card/40"
            }`}
          >
            <div className="flex items-center gap-1.5 text-[10.5px] uppercase tracking-wider text-muted-foreground">
              <RotateCw className="h-3 w-3" /> Retry
            </div>
            <div
              className={`mt-0.5 text-lg font-bold tabular-nums ${
                pendingRetries > 0 ? "text-amber-600" : ""
              }`}
            >
              {pendingRetries}
            </div>
            <div className="text-[10px] text-muted-foreground">
              {pendingRetries > 0 ? "cron işlədir" : "queue boş"}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
