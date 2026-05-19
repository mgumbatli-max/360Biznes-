"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Plus, AlertTriangle, TrendingDown, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { addSuggestedLine } from "../proposal-actions";

type Suggestion = {
  mehsul_id: string;
  ad: string;
  kod: string | null;
  stok: number;
  dailySales: number;
  daysOfStock: number;
  alish_qiymeti: number;
  son_alish_de: Date | null;
  priority: number;
  reason: string;
  suggestedQty: number;
};

export function AiSuggestionsPanel({
  teklifId,
  suggestions,
}: {
  teklifId: number;
  suggestions: Suggestion[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [qtyOverride, setQtyOverride] = useState<Record<string, number>>({});

  function addSuggestion(s: Suggestion) {
    setPendingId(s.mehsul_id);
    const fd = new FormData();
    fd.set("teklif_id", String(teklifId));
    fd.set("mehsul_id", s.mehsul_id);
    fd.set("miqdar", String(qtyOverride[s.mehsul_id] ?? s.suggestedQty));
    startTransition(async () => {
      const res = await addSuggestedLine(fd);
      setPendingId(null);
      if (!res.ok) toast.error(res.error);
      else {
        toast.success(`«${s.ad}» təklifə əlavə olundu`);
        router.refresh();
      }
    });
  }

  return (
    <Card className="glass border-amber-500/30">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-4 w-4 text-amber-500" />
          AI tövsiyələri ({suggestions.length})
          <span className="text-[10px] font-normal text-muted-foreground">
            Stok azalan və satılan məhsullar
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="max-h-96 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr className="sticky top-0 z-10 border-b border-border/40 bg-card text-left">
                <th className="px-2 py-2">Prioritet</th>
                <th className="px-2 py-2">Məhsul</th>
                <th className="px-2 py-2 text-right">Stok</th>
                <th className="px-2 py-2 text-right">Gündəlik satış</th>
                <th className="px-2 py-2 text-right">Gün qalan</th>
                <th className="px-2 py-2">Səbəb</th>
                <th className="px-2 py-2 w-32">Sifariş miqdar</th>
                <th className="px-2 py-2 w-24"></th>
              </tr>
            </thead>
            <tbody>
              {suggestions.map((s) => {
                const tone = s.priority >= 85 ? "rose" : s.priority >= 60 ? "amber" : "muted";
                return (
                  <tr key={s.mehsul_id} className="border-b border-border/20 hover:bg-secondary/30">
                    <td className="px-2 py-2">
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px] gap-1",
                          tone === "rose" && "border-rose-500/40 text-rose-500 bg-rose-500/5",
                          tone === "amber" && "border-amber-500/40 text-amber-500 bg-amber-500/5"
                        )}
                      >
                        {s.priority >= 85 ? <AlertTriangle className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                        {s.priority}
                      </Badge>
                    </td>
                    <td className="px-2 py-2">
                      <div className="font-semibold">{s.ad}</div>
                      {s.kod && <div className="font-mono text-[10.5px] text-muted-foreground">{s.kod}</div>}
                    </td>
                    <td className="px-2 py-2 text-right text-xs tabular-nums">
                      <span className={s.stok === 0 ? "font-bold text-rose-500" : ""}>{s.stok}</span>
                    </td>
                    <td className="px-2 py-2 text-right text-xs tabular-nums text-muted-foreground">
                      {s.dailySales.toFixed(1)}
                    </td>
                    <td className="px-2 py-2 text-right text-xs tabular-nums">
                      {s.daysOfStock < 999 ? Math.round(s.daysOfStock) : "∞"}
                    </td>
                    <td className="px-2 py-2 text-xs text-muted-foreground max-w-xs">{s.reason}</td>
                    <td className="px-2 py-2">
                      <Input
                        type="number"
                        min={1}
                        defaultValue={s.suggestedQty}
                        onBlur={(e) => {
                          const v = Number(e.target.value);
                          if (v > 0) setQtyOverride({ ...qtyOverride, [s.mehsul_id]: v });
                        }}
                        className="h-7 w-24 text-right text-xs"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <button
                        type="button"
                        onClick={() => addSuggestion(s)}
                        disabled={pending}
                        className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-1 text-[10.5px] font-semibold text-primary hover:bg-primary/15 disabled:opacity-50"
                      >
                        {pendingId === s.mehsul_id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Plus className="h-3 w-3" />
                        )}
                        Əlavə et
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
