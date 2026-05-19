"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ThumbsUp, ThumbsDown, Minus, ClipboardList } from "lucide-react";
import { cn } from "@/lib/utils";

type Resp = { score: number; ts: number };

export function SandboxNps() {
  const [responses, setResponses] = useState<Resp[]>(() => {
    const now = Date.now();
    return [
      { score: 9, ts: now - 86400000 * 5 },
      { score: 10, ts: now - 86400000 * 4 },
      { score: 7, ts: now - 86400000 * 3 },
      { score: 9, ts: now - 86400000 * 2 },
      { score: 6, ts: now - 86400000 },
    ];
  });
  const [selected, setSelected] = useState<number | null>(null);

  const submit = () => {
    if (selected == null) return;
    const ts = Date.now();
    setResponses([...responses, { score: selected, ts }]);
    setSelected(null);
  };

  const stats = useMemo(() => {
    const total = responses.length;
    if (total === 0) return { nps: 0, promoter: 0, passive: 0, detractor: 0, promoterPct: 0, passivePct: 0, detractorPct: 0 };
    let p = 0, pa = 0, d = 0;
    for (const r of responses) {
      if (r.score >= 9) p++;
      else if (r.score >= 7) pa++;
      else d++;
    }
    const promoterPct = (p / total) * 100;
    const passivePct = (pa / total) * 100;
    const detractorPct = (d / total) * 100;
    return { nps: promoterPct - detractorPct, promoter: p, passive: pa, detractor: d, promoterPct, passivePct, detractorPct };
  }, [responses]);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card className="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ClipboardList className="h-4 w-4 text-primary" />
            Sorğu — bizi necə dəyərləndirirsiniz?
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">0 — heç tövsiyə etməzdim, 10 — mütləq tövsiyə edərdim</p>
          <div className="grid grid-cols-11 gap-1">
            {Array.from({ length: 11 }, (_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setSelected(i)}
                className={cn(
                  "h-10 rounded-md border text-sm font-bold transition",
                  selected === i
                    ? i >= 9
                      ? "border-emerald-500 bg-emerald-500 text-white"
                      : i >= 7
                      ? "border-amber-500 bg-amber-500 text-white"
                      : "border-rose-500 bg-rose-500 text-white"
                    : "border-border bg-card text-muted-foreground hover:border-primary hover:text-foreground"
                )}
              >
                {i}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={submit}
            disabled={selected == null}
            className="h-10 w-full rounded-md bg-foreground text-sm font-bold text-background hover:bg-foreground/90 disabled:opacity-40"
          >
            Cavabı göndər ({selected ?? "—"})
          </button>
        </CardContent>
      </Card>

      <Card className="glass">
        <CardHeader>
          <CardTitle className="text-base">NPS — Net Promoter Score</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-xl border border-border bg-gradient-to-br from-primary/5 via-transparent to-emerald-500/5 p-5 text-center">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">NPS</div>
            <div className={cn("mt-1 text-5xl font-black tabular-nums", stats.nps >= 50 ? "text-emerald-500" : stats.nps >= 0 ? "text-primary" : "text-rose-500")}>
              {stats.nps.toFixed(0)}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">{responses.length} cavabdan</div>
          </div>

          {/* Stacked bar */}
          <div className="flex h-8 overflow-hidden rounded-lg">
            <div className="grid place-items-center bg-emerald-500 text-[10px] font-bold text-white" style={{ width: `${stats.promoterPct}%` }}>
              {stats.promoterPct >= 12 && `${stats.promoterPct.toFixed(0)}%`}
            </div>
            <div className="grid place-items-center bg-amber-500 text-[10px] font-bold text-white" style={{ width: `${stats.passivePct}%` }}>
              {stats.passivePct >= 12 && `${stats.passivePct.toFixed(0)}%`}
            </div>
            <div className="grid place-items-center bg-rose-500 text-[10px] font-bold text-white" style={{ width: `${stats.detractorPct}%` }}>
              {stats.detractorPct >= 12 && `${stats.detractorPct.toFixed(0)}%`}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 text-xs">
            <Box icon={ThumbsUp} label="Promoter (9-10)" value={stats.promoter} tone="success" />
            <Box icon={Minus} label="Passive (7-8)" value={stats.passive} tone="warning" />
            <Box icon={ThumbsDown} label="Detractor (0-6)" value={stats.detractor} tone="danger" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Box({ icon: Icon, label, value, tone }: { icon: React.ComponentType<{ className?: string }>; label: string; value: number; tone: "success" | "warning" | "danger" }) {
  const cls = tone === "success" ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-500" : tone === "warning" ? "border-amber-500/30 bg-amber-500/5 text-amber-500" : "border-rose-500/30 bg-rose-500/5 text-rose-500";
  return (
    <div className={`rounded-md border p-2 ${cls}`}>
      <div className="flex items-center gap-1 text-[9px] uppercase tracking-wider opacity-75">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <div className="mt-0.5 text-xl font-bold tabular-nums">{value}</div>
    </div>
  );
}
