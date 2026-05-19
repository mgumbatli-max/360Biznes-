"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Store, RefreshCcw, Power, Loader2, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";
import { syncMarketplace, toggleMarketplace } from "../actions";
import type { MarketplaceListItem } from "../queries";

const STATUS: Record<string, { label: string; cls: string }> = {
  aktiv: { label: "Aktiv", cls: "border-success/30 bg-success/10 text-success" },
  gozleyir: { label: "Gözləyir", cls: "border-warning/30 bg-warning/10 text-warning" },
  xeta: { label: "Xəta", cls: "border-danger/30 bg-danger/10 text-danger" },
  legv: { label: "Ləğv", cls: "border-muted text-muted-foreground" },
};

export function AccountCard({ a }: { a: MarketplaceListItem }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const s = STATUS[a.status] ?? STATUS.gozleyir;

  function onSync() {
    startTransition(async () => {
      const res = await syncMarketplace(a.id);
      if (res.ok) {
        toast.success("Sinxron edildi");
        router.refresh();
      } else toast.error(res.error);
    });
  }

  function onToggle() {
    startTransition(async () => {
      const res = await toggleMarketplace(a.id, !a.aktiv);
      if (res.ok) {
        toast.success(a.aktiv ? "Söndürüldü" : "Aktivləşdirildi");
        router.refresh();
      } else toast.error(res.error);
    });
  }

  return (
    <Card className={`glass ${!a.aktiv && "opacity-60"}`}>
      <CardContent className="space-y-3 py-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Store className="h-4 w-4 text-primary-light" />
              <h3 className="font-semibold capitalize">{a.platform}</h3>
            </div>
            <div className="mt-0.5 truncate text-xs text-muted-foreground">
              {a.ad}
              {a.store_id && <span className="ml-1 font-mono text-[10px]">· {a.store_id}</span>}
            </div>
          </div>
          <Badge variant="outline" className={s.cls + " text-[10px]"}>{s.label}</Badge>
        </div>

        <div className="grid grid-cols-2 gap-x-3 gap-y-1 border-y border-border/40 py-2 text-xs">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Komisyon</div>
            <div className="font-semibold tabular-nums">{a.komisyon_faiz.toFixed(2)}%</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Son sync</div>
            <div className="text-foreground">
              {a.son_sync
                ? formatDate(a.son_sync, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
                : "—"}
            </div>
          </div>
        </div>

        {a.son_xeta && (
          <div className="text-[10.5px] text-danger">⚠ {a.son_xeta}</div>
        )}

        <div className="flex flex-wrap items-center gap-1">
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={onSync}
            className="h-7 text-xs"
          >
            {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCcw className="h-3 w-3" />}
            Sinxron
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={onToggle}
            className={`h-7 text-xs ${a.aktiv ? "" : "border-success/30 text-success"}`}
          >
            <Power className="h-3 w-3" />
            {a.aktiv ? "Söndür" : "Aktivləşdir"}
          </Button>
          {a.store_url && (
            <a
              href={a.store_url}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto inline-flex h-7 items-center gap-1 rounded-md border border-border px-2 text-xs text-muted-foreground hover:text-foreground"
            >
              <ExternalLink className="h-3 w-3" /> Aç
            </a>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
