"use client";

import { useState } from "react";
import { History, CheckCircle2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { KanalStat } from "../api-stats";

function fmt(iso: string): string {
  return new Date(iso).toLocaleString("az-AZ", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function KanalAuditButton({ kanal, stat }: { kanal: string; stat: KanalStat }) {
  const [open, setOpen] = useState(false);
  const recent = stat.recent ?? [];

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        onClick={() => setOpen(true)}
        title="Son API çağırışları"
        disabled={recent.length === 0}
      >
        <History className="h-3 w-3" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-4 w-4" />
              Son API çağırışları — <code>{kanal}</code>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              <span>Cəm: <strong className="text-foreground">{stat.total_count}</strong></span>
              <span>·</span>
              <span>Bu gün: <strong className="text-foreground">{stat.today_count}</strong></span>
              <span>·</span>
              <span>Saxlanılan log: <strong className="text-foreground">{recent.length}</strong> son</span>
            </div>

            {recent.length === 0 ? (
              <p className="py-8 text-center text-xs text-muted-foreground">
                Hələ çağırış yoxdur.
              </p>
            ) : (
              <div className="max-h-96 overflow-auto rounded-md border border-border/40">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-secondary/40 text-[10.5px] uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="px-2 py-1.5 text-left font-medium">Tarix</th>
                      <th className="px-2 py-1.5 text-left font-medium">Status</th>
                      <th className="px-2 py-1.5 text-right font-medium">Məhsul</th>
                      <th className="px-2 py-1.5 text-left font-medium">IP</th>
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
                              className={`inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-semibold ${ok ? "bg-emerald-500/10 text-emerald-600" : "bg-rose-500/10 text-rose-600"}`}
                            >
                              {ok ? <CheckCircle2 className="h-2.5 w-2.5" /> : <AlertTriangle className="h-2.5 w-2.5" />}
                              {e.status}
                            </span>
                          </td>
                          <td className="px-2 py-1.5 text-right tabular-nums">{e.count}</td>
                          <td className="px-2 py-1.5 font-mono text-[10.5px] text-muted-foreground">
                            {e.ip ?? "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
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
