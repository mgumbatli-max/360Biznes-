"use client";

import { useEffect, useState } from "react";
import { Clock, Coins } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CloseSessionDialog } from "./close-session-dialog";
import type { ActiveKassa } from "../session-queries";
import { formatMoney } from "@/lib/utils";

function useElapsed(from: Date) {
  const [elapsed, setElapsed] = useState("");
  useEffect(() => {
    function tick() {
      const ms = Date.now() - new Date(from).getTime();
      const h = Math.floor(ms / 3_600_000);
      const m = Math.floor((ms % 3_600_000) / 60_000);
      setElapsed(`${h}:${String(m).padStart(2, "0")}`);
    }
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, [from]);
  return elapsed;
}

export function SessionBar({ kassa }: { kassa: ActiveKassa }) {
  const elapsed = useElapsed(kassa.acilis_tarixi);
  const [closing, setClosing] = useState(false);

  return (
    <div className="glass flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/60 px-4 py-2.5">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div
            className="grid h-8 w-8 place-items-center rounded-md"
            style={{ background: "var(--brand-gradient)" }}
          >
            <Coins className="h-4 w-4 text-white" />
          </div>
          <div>
            <div className="text-sm font-semibold leading-tight">{kassa.ad}</div>
            <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground">
              {kassa.filial_ad ?? "—"} · {kassa.acan_ad}
            </div>
          </div>
        </div>

        <Badge variant="secondary" className="gap-1.5">
          <Clock className="h-3 w-3" />
          {elapsed}
        </Badge>
      </div>

      <div className="flex items-center gap-4 text-xs">
        <Stat label="Satış" value={String(kassa.emeliyyatlar_say)} />
        <Stat label="Cəmi" value={formatMoney(kassa.cemi_satis)} highlight />
        <Stat label="Nağd" value={formatMoney(kassa.cari_negd)} />
        <Stat label="Kart" value={formatMoney(kassa.cari_kart)} />
      </div>

      <Button size="sm" variant="outline" onClick={() => setClosing(true)}>
        Sessiyanı bağla
      </Button>

      <CloseSessionDialog
        kassa={kassa}
        open={closing}
        onOpenChange={setClosing}
      />
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="text-right">
      <div className="text-[9.5px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`tabular-nums font-semibold ${highlight ? "text-primary-light" : ""}`}>
        {value}
      </div>
    </div>
  );
}
