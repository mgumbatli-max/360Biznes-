"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2, Loader2 } from "lucide-react";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { KanalFormDialog } from "./kanal-form-dialog";
import { KanalApiKeyButton } from "./kanal-api-key-button";
import { KanalApiTestButton } from "./kanal-api-test-button";
import { KanalAuditButton } from "./kanal-audit-button";
import { BulkApplyToAllProductsButton } from "./bulk-apply-button";
import { KanalWebhookButton } from "./kanal-webhook-button";
import { KanalWebhookTestButton } from "./kanal-webhook-test-button";
import { KanalOutboundPushButton } from "./kanal-outbound-push-button";
import { KanalOutboundHistoryButton } from "./kanal-outbound-history-button";
import { KanalRetryButton } from "./kanal-retry-button";
import type { KanalExtra } from "../kanal-extra";
import { deleteKanalKomissiya } from "../actions";
import type { KanalKomissiya } from "../queries";
import type { KanalStat } from "../api-stats";
import type { OutboundStat } from "../outbound-stats";
import type { RetryQueue } from "../outbound-retry";

function timeAgo(iso: string | null): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "indicə";
  if (m < 60) return `${m} dəq əvvəl`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} saat əvvəl`;
  const d = Math.floor(h / 24);
  return `${d} gün əvvəl`;
}

export function KanalListTable({
  items,
  apiKeyStatus,
  stats,
  extras,
  webhookStatus,
  outboundStats,
  retryQueues,
}: {
  items: KanalKomissiya[];
  apiKeyStatus: Record<string, { created: string }>;
  stats: Record<string, KanalStat>;
  extras: Record<string, KanalExtra>;
  webhookStatus: Record<string, { created: string }>;
  outboundStats: Record<string, OutboundStat>;
  retryQueues: Record<string, RetryQueue>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onDelete(k: KanalKomissiya) {
    if (
      !confirm(
        `"${k.kanal}" kanalı silinsin? Bu kanala bağlı bütün məhsul qiymət override-ları da silinəcək.`,
      )
    )
      return;
    startTransition(async () => {
      const res = await deleteKanalKomissiya(k.id);
      if (res.ok) {
        toast.success("Kanal silindi");
        router.refresh();
      } else toast.error(res.error);
    });
  }

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card/30 p-10 text-center">
        <p className="text-sm text-muted-foreground">
          Hələ heç bir satış kanalı yoxdur. Sağ üstdəki "Yeni kanal" düyməsi ilə əlavə edin.
        </p>
        <p className="mt-2 text-[10.5px] text-muted-foreground">
          Tövsiyə: <code>magaza</code> (0%), <code>birmarket</code> (10%), <code>wolt</code> (25%), <code>tap_az</code> (0%), <code>say</code> (8%), <code>bolt</code> (28%).
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border/40">
      <table className="w-full min-w-[900px] text-sm">
        <thead className="bg-secondary/30">
          <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
            <th className="px-3 py-2 font-medium">Kanal</th>
            <th className="px-3 py-2 text-right font-medium">Komissiya %</th>
            <th className="px-3 py-2 text-right font-medium">Sabit ₼</th>
            <th className="px-3 py-2 text-right font-medium">Çatdırılma ₼</th>
            <th className="px-3 py-2 text-right font-medium">Bank ₼</th>
            <th className="px-3 py-2 text-right font-medium">Reklam %</th>
            <th className="px-3 py-2 text-right font-medium">Qaytarma %</th>
            <th className="px-3 py-2 text-right font-medium">API açar</th>
            <th className="px-3 py-2 text-right font-medium">Son istifadə</th>
            <th className="px-3 py-2 text-right font-medium">Əməliyyat</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/30">
          {items.map((k) => (
            <tr key={k.id} className="hover:bg-secondary/20">
              <td className="px-3 py-2.5">
                <code className="rounded bg-secondary/60 px-1.5 py-0.5 text-xs font-mono">
                  {k.kanal}
                </code>
                {k.komissiya_faiz === 0 && k.sabit_komissiya === 0 ? (
                  <Badge variant="outline" className="ml-2 text-[10px]">
                    pulsuz
                  </Badge>
                ) : null}
                {extras[k.kanal]?.stok_buffer ? (
                  <Badge variant="outline" className="ml-1 border-amber-400/40 text-[9.5px] text-amber-600" title="Stok bufferi">
                    −{extras[k.kanal].stok_buffer}
                  </Badge>
                ) : null}
                {extras[k.kanal]?.rate_limit_per_min ? (
                  <Badge variant="outline" className="ml-1 border-sky-400/40 text-[9.5px] text-sky-600" title="Rate limit (dəqiqədə)">
                    {extras[k.kanal].rate_limit_per_min}/dəq
                  </Badge>
                ) : null}
                {extras[k.kanal]?.auto_push_on_sale ? (
                  <Badge variant="outline" className="ml-1 border-emerald-400/40 text-[9.5px] text-emerald-600" title="POS satışdan sonra avtomatik push">
                    ⚡ auto
                  </Badge>
                ) : null}
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums">
                {k.komissiya_faiz > 0 ? `${k.komissiya_faiz}%` : "—"}
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                {k.sabit_komissiya > 0 ? k.sabit_komissiya.toFixed(2) : "—"}
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                {k.catdirilma > 0 ? k.catdirilma.toFixed(2) : "—"}
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                {k.bank_xerc > 0 ? k.bank_xerc.toFixed(2) : "—"}
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                {k.reklam_faiz > 0 ? `${k.reklam_faiz}%` : "—"}
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                {k.qaytarma_risk > 0 ? `${k.qaytarma_risk}%` : "—"}
              </td>
              <td className="px-3 py-2.5 text-right">
                <div className="inline-flex items-center gap-1">
                  <KanalApiKeyButton
                    kanal={k.kanal}
                    hasKey={!!apiKeyStatus[k.kanal]}
                    created={apiKeyStatus[k.kanal]?.created}
                  />
                  {apiKeyStatus[k.kanal] && <KanalApiTestButton kanal={k.kanal} />}
                  {stats[k.kanal] && stats[k.kanal].total_count > 0 && (
                    <KanalAuditButton kanal={k.kanal} stat={stats[k.kanal]} />
                  )}
                  <KanalWebhookButton kanal={k.kanal} hasSecret={!!webhookStatus[k.kanal]} />
                  {webhookStatus[k.kanal] && <KanalWebhookTestButton kanal={k.kanal} />}
                  <KanalOutboundPushButton kanal={k.kanal} hasOutboundUrl={!!extras[k.kanal]?.outbound_url} />
                  {outboundStats[k.kanal] && outboundStats[k.kanal].total_pushes > 0 && (
                    <KanalOutboundHistoryButton kanal={k.kanal} stat={outboundStats[k.kanal]} />
                  )}
                  {retryQueues[k.kanal] && retryQueues[k.kanal].entries.length > 0 && (
                    <KanalRetryButton kanal={k.kanal} queue={retryQueues[k.kanal]} />
                  )}
                </div>
              </td>
              <td className="px-3 py-2.5 text-right text-[10.5px] text-muted-foreground">
                {stats[k.kanal]?.last_call ? (
                  <>
                    <div>{timeAgo(stats[k.kanal].last_call)}</div>
                    <div className="text-emerald-600">
                      bu gün: {stats[k.kanal].today_count} · cəm: {stats[k.kanal].total_count}
                    </div>
                  </>
                ) : (
                  "—"
                )}
              </td>
              <td className="px-3 py-2.5 text-right">
                <div className="inline-flex gap-1">
                  <BulkApplyToAllProductsButton kanal={k.kanal} />
                  <KanalFormDialog
                    initial={k}
                    initialExtra={extras[k.kanal]}
                    trigger={
                      <Button variant="outline" size="sm">
                        <Pencil className="h-3 w-3" />
                      </Button>
                    }
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onDelete(k)}
                    disabled={pending}
                    className="text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                  >
                    {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
