import type { Metadata } from "next";
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
  Zap,
  Clock,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { KpiCard } from "@/features/dashboard/components/kpi-card";
import { getKanalKomissiyaList } from "@/features/qiymet-kanal/queries";
import { getAllKanalStats } from "@/features/qiymet-kanal/api-stats";
import { getAllKanalExtra } from "@/features/qiymet-kanal/kanal-extra";
import { getAllOutboundStats } from "@/features/qiymet-kanal/outbound-stats";
import { getAllRetryQueues } from "@/features/qiymet-kanal/outbound-retry";
import { getWebhookOrders } from "@/features/qiymet-kanal/webhook-orders-queries";
import { listWebhookSecretStatus } from "@/features/qiymet-kanal/webhook-actions";
import { listKanalApiKeyStatus } from "@/features/qiymet-kanal/api-key-actions";

export const metadata: Metadata = { title: "Sync sağlamlığı" };
export const dynamic = "force-dynamic";

function timeAgo(iso: string | null): string {
  if (!iso) return "—";
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "indicə";
  if (m < 60) return `${m} dəq`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} saat`;
  return `${Math.floor(h / 24)} gün`;
}

export default async function SyncHealthPage() {
  const [
    kanallar,
    apiStats,
    outboundStats,
    retryQueues,
    extras,
    webhookStatus,
    apiKeyStatus,
    webhookOrders,
  ] = await Promise.all([
    getKanalKomissiyaList(),
    getAllKanalStats(),
    getAllOutboundStats(),
    getAllRetryQueues(),
    getAllKanalExtra(),
    listWebhookSecretStatus(),
    listKanalApiKeyStatus(),
    getWebhookOrders({ limit: 200 }),
  ]);

  // Cəm KPI hesabla
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

  // Outbound uğur faizi
  const outTotal = Object.values(outboundStats).reduce((s, st) => s + st.total_pushes, 0);
  const outOk = Object.values(outboundStats).reduce((s, st) => s + st.total_success, 0);
  const outRate = outTotal > 0 ? Math.round((outOk / outTotal) * 100) : 100;

  // Per-kanal status
  const perChannel = kanallar.map((k) => {
    const inb = apiStats[k.kanal];
    const out = outboundStats[k.kanal];
    const ret = retryQueues[k.kanal];
    const ex = extras[k.kanal];
    const hasApi = !!apiKeyStatus[k.kanal];
    const hasWebhook = !!webhookStatus[k.kanal];
    const hasOutbound = !!ex?.outbound_url;
    const isAuto = !!ex?.auto_push_on_sale;

    const inbLast = inb?.last_call ?? null;
    const outLast = out?.last_push ?? null;
    const outFail = out?.total_fail ?? 0;
    const outAllTotal = out?.total_pushes ?? 0;
    const outRate = outAllTotal > 0 ? Math.round(((out!.total_success ?? 0) / outAllTotal) * 100) : null;
    const pendingCount = ret?.entries.length ?? 0;

    // Status — overall sağlamlıq
    let status: "ok" | "warning" | "error" | "idle" = "ok";
    let statusText = "Sağlam";
    if (pendingCount > 0) {
      status = "warning";
      statusText = `${pendingCount} retry gözləyir`;
    }
    if (outRate !== null && outRate < 80) {
      status = "error";
      statusText = `Uğur ${outRate}%`;
    }
    if (!hasApi && !hasWebhook && !hasOutbound) {
      status = "idle";
      statusText = "Konfiqurasiya yoxdur";
    }

    return {
      kanal: k.kanal,
      status,
      statusText,
      hasApi,
      hasWebhook,
      hasOutbound,
      isAuto,
      inbLast,
      outLast,
      outFail,
      outAllTotal,
      outRate,
      pendingCount,
    };
  });

  const healthOverall = (() => {
    if (perChannel.some((p) => p.status === "error")) return { tone: "danger" as const, label: "Diqqət lazım" };
    if (perChannel.some((p) => p.status === "warning")) return { tone: "warning" as const, label: "Az problem" };
    if (perChannel.every((p) => p.status === "idle")) return { tone: "neutral" as const, label: "Boş" };
    return { tone: "success" as const, label: "Hər şey sağlam" };
  })();

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Activity className="h-5 w-5 text-primary-light" />
            Sync sağlamlığı
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Bütün satış kanal-larında inbound / webhook / outbound sync vəziyyəti — real-time monitorinq.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className={`text-xs ${
              healthOverall.tone === "success"
                ? "border-emerald-500/40 text-emerald-600"
                : healthOverall.tone === "warning"
                  ? "border-amber-500/40 text-amber-600"
                  : healthOverall.tone === "danger"
                    ? "border-rose-500/40 text-rose-600"
                    : "border-border text-muted-foreground"
            }`}
          >
            {healthOverall.tone === "success" && <CheckCircle2 className="h-3 w-3" />}
            {healthOverall.tone === "danger" && <AlertTriangle className="h-3 w-3" />}
            {healthOverall.label}
          </Badge>
          <Button asChild size="sm" variant="outline">
            <Link href="/ayarlar/kanallar">
              Kanal idarə <ArrowRight className="h-3 w-3" />
            </Link>
          </Button>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          icon={Download}
          label="Inbound 24h"
          value={String(inbound24h)}
          subline="GET pull çağırışı"
          tone="info"
        />
        <KpiCard
          icon={Webhook}
          label="Webhook 24h"
          value={String(webhook24h)}
          subline="Gələn sifariş"
          tone="success"
        />
        <KpiCard
          icon={Upload}
          label="Outbound 24h"
          value={String(outbound24h)}
          subline={`Uğur ${outRate}%`}
          tone={outRate >= 95 ? "success" : outRate >= 80 ? "warning" : "danger"}
        />
        <KpiCard
          icon={RotateCw}
          label="Pending retry"
          value={String(pendingRetries)}
          subline={pendingRetries > 0 ? "cron 2 dəq-də işlədir" : "queue boş"}
          tone={pendingRetries > 0 ? "warning" : "success"}
        />
      </section>

      <Card className="glass">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Zap className="h-4 w-4 text-primary-light" />
            Kanal-üzrə vəziyyət
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {perChannel.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Hələ heç bir satış kanalı yoxdur.{" "}
              <Link href="/ayarlar/kanallar" className="text-primary hover:underline">
                Ayarlar → Satış kanalları
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-xs">
                <thead className="bg-secondary/30 text-[10.5px] uppercase tracking-wider text-muted-foreground">
                  <tr className="text-left">
                    <th className="px-3 py-2 font-medium">Kanal</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 text-center font-medium">Inbound</th>
                    <th className="px-3 py-2 text-center font-medium">Webhook</th>
                    <th className="px-3 py-2 text-center font-medium">Outbound</th>
                    <th className="px-3 py-2 text-center font-medium">Auto</th>
                    <th className="px-3 py-2 font-medium">Son inbound</th>
                    <th className="px-3 py-2 font-medium">Son outbound</th>
                    <th className="px-3 py-2 text-right font-medium">Out uğur %</th>
                    <th className="px-3 py-2 text-right font-medium">Pending</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {perChannel.map((p) => (
                    <tr key={p.kanal} className="hover:bg-secondary/20">
                      <td className="px-3 py-2.5">
                        <code className="rounded bg-secondary/60 px-1.5 py-0.5 text-[10.5px] font-mono">
                          {p.kanal}
                        </code>
                      </td>
                      <td className="px-3 py-2.5">
                        <Badge
                          variant="outline"
                          className={`text-[10px] ${
                            p.status === "ok"
                              ? "border-emerald-400/40 text-emerald-600"
                              : p.status === "warning"
                                ? "border-amber-400/40 text-amber-600"
                                : p.status === "error"
                                  ? "border-rose-400/40 text-rose-600"
                                  : "border-border text-muted-foreground"
                          }`}
                        >
                          {p.status === "ok" && <CheckCircle2 className="h-2.5 w-2.5" />}
                          {p.status === "warning" && <AlertTriangle className="h-2.5 w-2.5" />}
                          {p.status === "error" && <AlertTriangle className="h-2.5 w-2.5" />}
                          {p.statusText}
                        </Badge>
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        {p.hasApi ? <CheckCircle2 className="mx-auto h-3.5 w-3.5 text-emerald-500" /> : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        {p.hasWebhook ? <CheckCircle2 className="mx-auto h-3.5 w-3.5 text-emerald-500" /> : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        {p.hasOutbound ? <CheckCircle2 className="mx-auto h-3.5 w-3.5 text-emerald-500" /> : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        {p.isAuto ? (
                          <Badge variant="outline" className="border-violet-400/40 text-[9px] text-violet-600">
                            ⚡
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-muted-foreground">
                        <span title={p.inbLast ?? "—"}>
                          <Clock className="inline h-2.5 w-2.5" /> {timeAgo(p.inbLast)}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-muted-foreground">
                        <span title={p.outLast ?? "—"}>
                          <Clock className="inline h-2.5 w-2.5" /> {timeAgo(p.outLast)}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums">
                        {p.outRate === null ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          <span
                            className={
                              p.outRate >= 95
                                ? "text-emerald-600"
                                : p.outRate >= 80
                                  ? "text-amber-600"
                                  : "text-rose-600"
                            }
                          >
                            {p.outRate}%
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums">
                        {p.pendingCount > 0 ? (
                          <Badge variant="outline" className="border-amber-400/40 text-[10px] text-amber-600">
                            {p.pendingCount}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Problem siqnalları */}
      {(pendingRetries > 0 || perChannel.some((p) => p.outRate !== null && p.outRate < 95)) && (
        <Card className="glass border-amber-500/30 bg-amber-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base text-amber-700 dark:text-amber-400">
              <AlertTriangle className="h-4 w-4" />
              Diqqət tələb edən siqnallar
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            {pendingRetries > 0 && (
              <p>
                ⏳ <strong>{pendingRetries} retry queue-da gözləyir</strong> — Vercel cron hər 2 dəqiqədə
                avtomatik işlədir. Manual işlətmək üçün{" "}
                <Link href="/ayarlar/kanallar" className="text-primary hover:underline">
                  Ayarlar → Satış kanalları
                </Link>
                .
              </p>
            )}
            {perChannel
              .filter((p) => p.outRate !== null && p.outRate < 95)
              .map((p) => (
                <p key={p.kanal}>
                  ⚠ <strong>{p.kanal}</strong> outbound uğur faizi {p.outRate}% — son xətaları
                  yoxlamaq üçün kanal "History" düyməsini açın
                </p>
              ))}
          </CardContent>
        </Card>
      )}

      {/* Cron status */}
      <Card className="glass border-emerald-500/20">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Zap className="h-4 w-4 text-emerald-500" />
            Avtomatik proseslər
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-xs">
            <li className="flex items-center justify-between rounded-md border border-border/40 bg-card/40 p-2.5">
              <div>
                <div className="font-semibold">Stok dəyişikliyi avto-push</div>
                <div className="text-[10.5px] text-muted-foreground">
                  POS satış, alış, qaytarma, transfer, inventar → real-time kanal-lara delta
                </div>
              </div>
              <Badge variant="outline" className="border-emerald-400/40 text-[10px] text-emerald-600">
                aktiv
              </Badge>
            </li>
            <li className="flex items-center justify-between rounded-md border border-border/40 bg-card/40 p-2.5">
              <div>
                <div className="font-semibold">Retry cron</div>
                <div className="text-[10.5px] text-muted-foreground">
                  Hər 2 dəqiqədə pending retry-ləri exponential backoff ilə işlədir
                </div>
              </div>
              <Badge variant="outline" className="border-emerald-400/40 text-[10px] text-emerald-600">
                hər 2 dəq
              </Badge>
            </li>
            <li className="flex items-center justify-between rounded-md border border-border/40 bg-card/40 p-2.5">
              <div>
                <div className="font-semibold">Saatlıq tam sync</div>
                <div className="text-[10.5px] text-muted-foreground">
                  Auto-push kanal-larına bütün məhsulları tam push — reliability rezerv
                </div>
              </div>
              <Badge variant="outline" className="border-emerald-400/40 text-[10px] text-emerald-600">
                hər saat
              </Badge>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
