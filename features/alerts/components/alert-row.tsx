"use client";

import { useTransition } from "react";
import { Check, Clock4, MoreHorizontal, Eye, UserPlus, ArrowUpRight } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { az } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { acknowledgeAlert, resolveAlert, snoozeAlert, assignAlertToMe, escalateAlert } from "../actions";
import { SeverityBadge, StatusBadge } from "./severity-badge";
import type { AlertListItem } from "../queries";

export function AlertRow({ alert }: { alert: AlertListItem }) {
  const [pending, startTransition] = useTransition();

  function run(label: string, action: () => Promise<{ ok: boolean }>) {
    startTransition(async () => {
      try {
        await action();
        toast.success(label);
      } catch (e) {
        console.error(e);
        toast.error("Əməliyyat alınmadı");
      }
    });
  }
  function runEscalate() {
    startTransition(async () => {
      try {
        const res = await escalateAlert(alert.id);
        if ("ok" in res && res.ok) toast.success(`Eskaalasiya: səviyyə → ${(res as { severity: string }).severity}`);
        else toast.error("Eskaalasiya alınmadı");
      } catch (e) {
        console.error(e);
        toast.error("Eskaalasiya alınmadı");
      }
    });
  }

  const isOpen = alert.status === "yeni" || alert.status === "baxilir";
  const age = alert.first_seen_at
    ? formatDistanceToNow(alert.first_seen_at, { addSuffix: true, locale: az })
    : "—";

  return (
    <div className="group grid grid-cols-[auto_1fr_auto] gap-3 border-b border-border/40 px-2 py-3 transition hover:bg-secondary/40">
      <div className="flex flex-col items-center gap-1">
        <div
          className="grid h-9 w-9 place-items-center rounded-lg text-lg"
          style={{ background: `${alert.kateqoriya_reng ?? "hsl(228 32% 22%)"}25` }}
        >
          {alert.kateqoriya_emoji ?? "🔔"}
        </div>
      </div>

      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <SeverityBadge value={alert.seviyye} />
          <StatusBadge value={alert.status} />
          <Badge variant="outline" className="text-[10px]">
            {alert.kateqoriya_ad}
          </Badge>
          {alert.risk_bali != null && (
            <Badge variant="secondary" className="text-[10px]">
              Risk: {alert.risk_bali}
            </Badge>
          )}
        </div>
        <div className="font-medium text-foreground">{alert.basliq}</div>
        {alert.tesvir && (
          <div className="line-clamp-2 text-xs text-muted-foreground">{alert.tesvir}</div>
        )}
        <div className="flex flex-wrap items-center gap-3 pt-0.5 text-[11px] text-muted-foreground">
          <span>{age}</span>
          {alert.assigned_to_ad && (
            <>
              <span>·</span>
              <span>Atanıb: <span className="text-foreground">{alert.assigned_to_ad}</span></span>
            </>
          )}
          {alert.obyekt_basliq && (
            <>
              <span>·</span>
              <span className="truncate">{alert.obyekt_basliq}</span>
            </>
          )}
        </div>
      </div>

      <div className="flex items-start gap-1 opacity-0 transition group-hover:opacity-100">
        {isOpen && (
          <Button
            size="icon-sm"
            variant="ghost"
            disabled={pending}
            onClick={() => run("Sizə təyin edildi", () => assignAlertToMe(alert.id))}
            title="Mənə təyin et"
          >
            <UserPlus className="h-3.5 w-3.5" />
          </Button>
        )}
        {isOpen && (
          <Button
            size="icon-sm"
            variant="ghost"
            disabled={pending}
            onClick={runEscalate}
            title="Eskaalasiya et"
            className="text-warning hover:bg-warning/10"
          >
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Button>
        )}
        {isOpen && alert.status === "yeni" && (
          <Button
            size="icon-sm"
            variant="ghost"
            disabled={pending}
            onClick={() => run("Baxılır olaraq qeyd edildi", () => acknowledgeAlert(alert.id))}
            title="Baxılır olaraq qeyd et"
          >
            <Eye className="h-3.5 w-3.5" />
          </Button>
        )}
        {isOpen && (
          <Button
            size="icon-sm"
            variant="ghost"
            disabled={pending}
            onClick={() => run("Həll olundu", () => resolveAlert(alert.id))}
            title="Həll olundu"
          >
            <Check className="h-3.5 w-3.5" />
          </Button>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon-sm" variant="ghost" disabled={pending}>
              <MoreHorizontal className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              disabled={!isOpen}
              onSelect={() => {
                const until = new Date();
                until.setHours(until.getHours() + 4);
                run("4 saat sonraya təxirə salındı", () => snoozeAlert(alert.id, until.toISOString()));
              }}
            >
              <Clock4 className="h-4 w-4" />
              4 saat sonra
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={!isOpen}
              onSelect={() => {
                const until = new Date();
                until.setDate(until.getDate() + 1);
                until.setHours(8, 0, 0, 0);
                run("Sabah səhərə təxirə salındı", () => snoozeAlert(alert.id, until.toISOString()));
              }}
            >
              <Clock4 className="h-4 w-4" />
              Sabah səhər
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
