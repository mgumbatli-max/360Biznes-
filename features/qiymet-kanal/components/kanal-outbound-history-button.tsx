"use client";

import { useState } from "react";
import { History, CheckCircle2, AlertTriangle, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatDate } from "@/lib/utils";
import type { OutboundStat } from "../outbound-stats";

function fmt(iso: string): string {
  return formatDate(iso, {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function KanalOutboundHistoryButton({
  kanal,
  stat,
}: {
  kanal: string;
  stat: OutboundStat;
}) {
  const [open, setOpen] = useState(false);
  const recent = stat.recent ?? [];

  if (stat.total_pushes === 0) return null;

  const successRate =
    stat.total_pushes > 0 ? Math.round((stat.total_success / stat.total_pushes) * 100) : 0;

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        onClick={() => setOpen(true)}
        title="Outbound push tarixçəsi"
      >
        <History className="h-3 w-3" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="h-4 w-4" />
              Outbound push tarixçə — <code>{kanal}</code>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div className="rounded-md border border-border/40 bg-card/40 p-2.5">
                <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground">
                  Cəm push
                </div>
                <div className="text-lg font-bold tabular-nums">{stat.total_pushes}</div>
              </div>
              <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 p-2.5">
                <div className="text-[10.5px] uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                  Uğurlu
                </div>
                <div className="text-lg font-bold tabular-nums text-emerald-600">
                  {stat.total_success}
                </div>
              </div>
              <div className="rounded-md border border-rose-500/30 bg-rose-500/5 p-2.5">
                <div className="text-[10.5px] uppercase tracking-wider text-rose-700 dark:text-rose-400">
                  Uğursuz
                </div>
                <div className="text-lg font-bold tabular-nums text-rose-600">{stat.total_fail}</div>
              </div>
              <div className="rounded-md border border-border/40 bg-card/40 p-2.5">
                <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground">
                  Uğur faizi
                </div>
                <div
                  className={`text-lg font-bold tabular-nums ${
                    successRate >= 95 ? "text-emerald-600" : successRate >= 80 ? "text-amber-600" : "text-rose-600"
                  }`}
                >
                  {successRate}%
                </div>
              </div>
            </div>

            <div className="max-h-96 overflow-auto rounded-md border border-border/40">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-secondary/40 text-[10.5px] uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-2 py-1.5 text-left font-medium">Tarix</th>
                    <th className="px-2 py-1.5 text-left font-medium">Status</th>
                    <th className="px-2 py-1.5 text-right font-medium">Göndərilən</th>
                    <th className="px-2 py-1.5 text-right font-medium">Müddət</th>
                    <th className="px-2 py-1.5 text-left font-medium">Xəta</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {recent.map((e, i) => {
                    const ok = e.status >= 200 && e.status < 300;
                    return (
                      <tr key={`${e.at}-${i}`} className="hover:bg-secondary/20">
                        <td className="px-2 py-1.5 tabular-nums">{fmt(e.at)}</td>
                        <td className="px-2 py-1.5">
                          <span
                            className={`inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                              ok
                                ? "bg-emerald-500/10 text-emerald-600"
                                : "bg-rose-500/10 text-rose-600"
                            }`}
                          >
                            {ok ? (
                              <CheckCircle2 className="h-2.5 w-2.5" />
                            ) : (
                              <AlertTriangle className="h-2.5 w-2.5" />
                            )}
                            {e.status || "ERR"}
                          </span>
                        </td>
                        <td className="px-2 py-1.5 text-right tabular-nums">{e.sent}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">
                          {e.ms}ms
                        </td>
                        <td className="px-2 py-1.5 text-[10.5px] text-rose-500">
                          {e.error ? (
                            <span title={e.error}>
                              {e.error.length > 50 ? e.error.slice(0, 50) + "..." : e.error}
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
