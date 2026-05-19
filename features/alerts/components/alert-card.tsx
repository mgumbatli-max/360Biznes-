"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Check, Clock4, ListTodo, ShieldCheck, MessageCirclePlus, UserPlus, ArrowUpRight, ChevronRight, Loader2,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { az } from "date-fns/locale";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  resolveAlert, snoozeAlert, assignAlertToMe, escalateAlert,
  addAlertComment, createTaskFromAlert, sendAlertToApproval,
} from "../actions";
import { SeverityBadge, StatusBadge } from "./severity-badge";
import type { AlertListItem } from "../queries";

const SEVERITY_BORDER: Record<string, string> = {
  kritik: "border-l-rose-500",
  yuksek: "border-l-rose-500",
  risk: "border-l-amber-500",
  xeber: "border-l-amber-500",
  info: "border-l-sky-500",
};

export function AlertCard({ alert }: { alert: AlertListItem }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [showNote, setShowNote] = useState(false);
  const [note, setNote] = useState("");

  const isOpen = alert.status === "yeni" || alert.status === "baxilir";
  const age = alert.first_seen_at
    ? formatDistanceToNow(alert.first_seen_at, { addSuffix: true, locale: az })
    : "—";

  const run = (label: string, action: () => Promise<{ ok: boolean | true | false; error?: string }>) => {
    startTransition(async () => {
      const res = await action();
      if (res.ok) {
        toast.success(label);
        router.refresh();
      } else {
        toast.error("error" in res && res.error ? res.error : "Xəta");
      }
    });
  };

  return (
    <>
      <article className={cn(
        "rounded-xl border border-l-4 border-border/60 bg-card/60 p-3 transition hover:border-primary/30 hover:shadow-md",
        SEVERITY_BORDER[alert.seviyye] ?? "border-l-border"
      )}>
        {/* Header */}
        <header className="flex items-start gap-3">
          <div
            className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-xl"
            style={{ background: `${alert.kateqoriya_reng ?? "hsl(228 32% 22%)"}25` }}
          >
            {alert.kateqoriya_emoji ?? "🔔"}
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <SeverityBadge value={alert.seviyye} />
              <StatusBadge value={alert.status} />
              <Badge variant="outline" className="text-[10px]">{alert.kateqoriya_ad}</Badge>
              {alert.risk_bali != null && (
                <Badge variant="secondary" className="text-[10px]">Risk: {alert.risk_bali}</Badge>
              )}
            </div>
            <Link href={`/xeberdarliqlar/${alert.id}`} className="block font-semibold hover:underline">
              {alert.basliq}
            </Link>
          </div>
        </header>

        {/* Body */}
        {alert.tesvir && (
          <p className="mt-2 line-clamp-2 text-[12px] leading-relaxed text-muted-foreground">
            {alert.tesvir}
          </p>
        )}

        {/* Meta */}
        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10.5px] text-muted-foreground">
          <span>{age}</span>
          {alert.assigned_to_ad && (
            <>
              <span>·</span>
              <span>Atanıb: <strong className="text-foreground">{alert.assigned_to_ad}</strong></span>
            </>
          )}
          {alert.obyekt_basliq && (
            <>
              <span>·</span>
              <span className="truncate">{alert.obyekt_basliq}</span>
            </>
          )}
        </div>

        {/* Action bar — full row of explicit buttons */}
        {isOpen && (
          <footer className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-border/30 pt-2">
            <Link
              href={`/xeberdarliqlar/${alert.id}`}
              className="inline-flex h-7 items-center gap-1 rounded-md border border-border bg-card px-2 text-[11px] font-medium hover:border-primary/40 hover:bg-secondary/40"
            >
              <ChevronRight className="h-3 w-3" />
              Detal
            </Link>

            <Button size="sm" variant="outline" className="h-7 gap-1 px-2 text-[11px]" disabled={pending}
              onClick={() => run("Tapşırıq yaradıldı", () => createTaskFromAlert(alert.id))}>
              <ListTodo className="h-3 w-3" />
              Tapşırıq
            </Button>

            <Button size="sm" variant="outline" className="h-7 gap-1 border-emerald-500/30 px-2 text-[11px] text-emerald-600 hover:bg-emerald-500/10 dark:text-emerald-400" disabled={pending}
              onClick={() => run("Təsdiqə göndərildi", () => sendAlertToApproval(alert.id))}>
              <ShieldCheck className="h-3 w-3" />
              Təsdiq
            </Button>

            {alert.status === "yeni" && (
              <Button size="sm" variant="outline" className="h-7 gap-1 px-2 text-[11px]" disabled={pending}
                onClick={() => run("Sizə təyin edildi", () => assignAlertToMe(alert.id))}>
                <UserPlus className="h-3 w-3" />
                Mənə
              </Button>
            )}

            <Button size="sm" variant="outline" className="h-7 gap-1 px-2 text-[11px]" disabled={pending}
              onClick={() => setShowNote(true)}>
              <MessageCirclePlus className="h-3 w-3" />
              Qeyd
            </Button>

            <Button size="sm" variant="outline" className="h-7 gap-1 px-2 text-[11px]" disabled={pending}
              onClick={() => {
                const until = new Date();
                until.setHours(until.getHours() + 4);
                run("4 saat təxirə salındı", () => snoozeAlert(alert.id, until.toISOString()));
              }}>
              <Clock4 className="h-3 w-3" />
              4 saat
            </Button>

            <Button size="sm" variant="outline" className="ml-auto h-7 gap-1 border-amber-500/30 px-2 text-[11px] text-amber-600 hover:bg-amber-500/10 dark:text-amber-400" disabled={pending}
              onClick={() => {
                startTransition(async () => {
                  const res = await escalateAlert(alert.id);
                  if (res.ok) {
                    toast.success(`Eskalasiya → ${res.severity}`);
                    router.refresh();
                  } else toast.error("Eskalasiya alınmadı");
                });
              }}>
              <ArrowUpRight className="h-3 w-3" />
              Eskalə
            </Button>

            <Button size="sm" className="h-7 gap-1 bg-emerald-600 px-2 text-[11px] text-white hover:bg-emerald-700" disabled={pending}
              onClick={() => run("Həll olundu", () => resolveAlert(alert.id))}>
              <Check className="h-3 w-3" />
              Həll
            </Button>
          </footer>
        )}

        {!isOpen && (
          <footer className="mt-3 flex items-center justify-between gap-1.5 border-t border-border/30 pt-2 text-[10.5px] text-muted-foreground">
            <span>{alert.status === "hell_olundu" ? "Həll olundu" : alert.status === "snoozed" ? "Təxirdə" : "Bağlandı"}</span>
            <Link href={`/xeberdarliqlar/${alert.id}`} className="inline-flex items-center gap-1 text-primary hover:underline">
              Detal <ChevronRight className="h-3 w-3" />
            </Link>
          </footer>
        )}
      </article>

      {/* Note dialog */}
      <Dialog open={showNote} onOpenChange={setShowNote}>
        <DialogContent className="md:max-w-md">
          <DialogHeader>
            <DialogTitle>Qeyd əlavə et</DialogTitle>
          </DialogHeader>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={4}
            autoFocus
            placeholder="Bu xəbərdarlıq haqqında qeyd..."
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowNote(false)} disabled={pending}>İmtina</Button>
            <Button
              disabled={pending || !note.trim()}
              onClick={() => {
                startTransition(async () => {
                  const res = await addAlertComment(alert.id, note);
                  if (res.ok) {
                    toast.success("Qeyd əlavə olundu");
                    setShowNote(false);
                    setNote("");
                    router.refresh();
                  } else toast.error(res.error);
                });
              }}
            >
              {pending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              Əlavə et
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
