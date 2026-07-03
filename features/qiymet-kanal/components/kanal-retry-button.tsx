"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RotateCw, Loader2, Clock, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/lib/toast";
import { formatDate } from "@/lib/utils";
import { processRetryQueue } from "../outbound-actions";
import type { RetryQueue } from "../outbound-retry";

function fmt(iso: string): string {
  return formatDate(iso, {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function inSeconds(iso: string): number {
  return Math.max(0, Math.floor((new Date(iso).getTime() - Date.now()) / 1000));
}

export function KanalRetryButton({
  kanal,
  queue,
}: {
  kanal: string;
  queue: RetryQueue;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  if (queue.entries.length === 0) return null;

  const now = Date.now();
  const ready = queue.entries.filter((e) => new Date(e.next_retry_at).getTime() <= now).length;
  const waiting = queue.entries.length - ready;

  function process() {
    startTransition(async () => {
      const res = await processRetryQueue({ kanal });
      if (res.ok) {
        const d = res.data ?? { processed: 0, ok_count: 0, fail_count: 0, skipped: 0 };
        toast.success(
          `${d.processed} işləndi · ✓ ${d.ok_count} ✗ ${d.fail_count}${d.skipped > 0 ? ` · ${d.skipped} skip` : ""}`,
        );
        router.refresh();
      } else toast.error(res.error);
    });
  }

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        onClick={() => setOpen(true)}
        className="text-amber-600 hover:bg-amber-50"
        title={`${queue.entries.length} pending retry`}
      >
        <RotateCw className="h-3 w-3" />
        <Badge variant="outline" className="ml-0.5 border-amber-400/40 text-[9px] text-amber-600">
          {queue.entries.length}
        </Badge>
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RotateCw className="h-4 w-4" />
              Retry queue — <code>{kanal}</code>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <div className="rounded-md border border-border/40 bg-card/40 p-2.5">
                <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground">Cəm</div>
                <div className="text-lg font-bold tabular-nums">{queue.entries.length}</div>
              </div>
              <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 p-2.5">
                <div className="text-[10.5px] uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                  İndi hazır
                </div>
                <div className="text-lg font-bold tabular-nums text-emerald-600">{ready}</div>
              </div>
              <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-2.5">
                <div className="text-[10.5px] uppercase tracking-wider text-amber-700 dark:text-amber-400">
                  Backoff gözləyir
                </div>
                <div className="text-lg font-bold tabular-nums text-amber-600">{waiting}</div>
              </div>
            </div>

            <Button onClick={process} disabled={pending || ready === 0} size="sm">
              {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCw className="h-3.5 w-3.5" />}
              İndi yenidən cəhd et ({ready} hazır)
            </Button>

            <div className="max-h-96 overflow-auto rounded-md border border-border/40">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-secondary/40 text-[10.5px] uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-2 py-1.5 text-left font-medium">Yarandı</th>
                    <th className="px-2 py-1.5 text-center font-medium">Cəhd</th>
                    <th className="px-2 py-1.5 text-right font-medium">Item</th>
                    <th className="px-2 py-1.5 text-left font-medium">Növbəti retry</th>
                    <th className="px-2 py-1.5 text-left font-medium">Son xəta</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {queue.entries.map((e) => {
                    const wait = inSeconds(e.next_retry_at);
                    const isReady = wait === 0;
                    return (
                      <tr key={e.id} className="hover:bg-secondary/20">
                        <td className="px-2 py-1.5 tabular-nums">{fmt(e.enqueued_at)}</td>
                        <td className="px-2 py-1.5 text-center">
                          <Badge
                            variant="outline"
                            className={`text-[10px] ${
                              e.attempts >= 2 ? "border-rose-400/40 text-rose-500" : "border-amber-400/40 text-amber-600"
                            }`}
                          >
                            {e.attempts}/3
                          </Badge>
                        </td>
                        <td className="px-2 py-1.5 text-right tabular-nums">{e.item_count}</td>
                        <td className="px-2 py-1.5">
                          {isReady ? (
                            <span className="inline-flex items-center gap-0.5 text-emerald-600">
                              <Clock className="h-3 w-3" /> İndi
                            </span>
                          ) : (
                            <span className="text-muted-foreground">{wait}s sonra</span>
                          )}
                        </td>
                        <td className="px-2 py-1.5 text-rose-500">
                          {e.last_error ? (
                            <span title={e.last_error}>
                              {e.last_error.length > 50 ? e.last_error.slice(0, 50) + "..." : e.last_error}
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <p className="text-[10.5px] text-muted-foreground">
              <AlertTriangle className="inline h-3 w-3" /> Exponential backoff: cəhd 1 sonra 2s, cəhd 2 sonra 4s.
              Maks 3 cəhddən sonra entry queue-dan silinir (stats-da qalır).
            </p>
            <p className="text-[10.5px] text-emerald-700 dark:text-emerald-400 border-t border-emerald-500/20 pt-2">
              ⚡ <strong>Vercel cron</strong> bu queue-nu hər 2 dəqiqədə avtomatik işlədir
              (production-da). Manual cəhd əsasən debug üçündür.
            </p>
          </div>
          <DialogFooter>
            <Button size="sm" variant="outline" onClick={() => setOpen(false)}>
              Bağla
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
