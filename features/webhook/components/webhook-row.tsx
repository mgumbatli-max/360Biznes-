"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plug, Power, Send, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";
import { toggleWebhook, testWebhook, deleteWebhook } from "../actions";
import type { WebhookListItem } from "../queries";

export function WebhookRow({ w }: { w: WebhookListItem }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onTest() {
    startTransition(async () => {
      const r = await testWebhook(w.id);
      if (r.ok) {
        toast.success("Test göndərildi");
        router.refresh();
      } else toast.error(r.error);
    });
  }
  function onToggle() {
    startTransition(async () => {
      const r = await toggleWebhook(w.id, !w.aktiv);
      if (r.ok) {
        toast.success(w.aktiv ? "Söndürüldü" : "Aktivləşdirildi");
        router.refresh();
      } else toast.error(r.error);
    });
  }
  function onDelete() {
    if (!confirm(`"${w.ad}" webhooku silinsin?`)) return;
    startTransition(async () => {
      const r = await deleteWebhook(w.id);
      if (r.ok) {
        toast.success("Silindi");
        router.refresh();
      } else toast.error(r.error);
    });
  }

  const successRate = w.cagiris_sayi > 0 ? Math.round((w.ugurlu_sayi / w.cagiris_sayi) * 100) : null;

  return (
    <Card className={`glass ${!w.aktiv && "opacity-60"}`}>
      <CardContent className="space-y-2 py-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <Plug className="h-4 w-4 text-primary-light" />
              <h3 className="truncate font-semibold">{w.ad}</h3>
              {w.son_status !== null && (
                <Badge
                  variant="outline"
                  className={`text-[10px] ${
                    w.son_status >= 200 && w.son_status < 300
                      ? "border-success/30 text-success"
                      : "border-danger/30 text-danger"
                  }`}
                >
                  {w.son_status}
                </Badge>
              )}
            </div>
            <div className="mt-1 truncate font-mono text-xs text-muted-foreground">{w.url}</div>
            {w.events.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1">
                {w.events.map((e) => (
                  <Badge key={e} variant="secondary" className="text-[10px]">{e}</Badge>
                ))}
              </div>
            )}
          </div>
          <Badge variant={w.aktiv ? "outline" : "secondary"} className={w.aktiv ? "border-success/30 text-success" : ""}>
            {w.aktiv ? "Aktiv" : "Passiv"}
          </Badge>
        </div>

        <div className="grid grid-cols-3 gap-2 border-t border-border/40 pt-2 text-[10.5px] text-muted-foreground">
          <div>
            <div className="uppercase tracking-wider">Çağırış</div>
            <div className="font-semibold tabular-nums text-foreground">{w.cagiris_sayi}</div>
          </div>
          <div>
            <div className="uppercase tracking-wider">Uğur</div>
            <div className="font-semibold tabular-nums text-foreground">
              {successRate !== null ? `${successRate}%` : "—"}
            </div>
          </div>
          <div>
            <div className="uppercase tracking-wider">Son trigger</div>
            <div className="text-foreground">
              {w.son_ugur
                ? formatDate(w.son_ugur, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
                : "—"}
            </div>
          </div>
        </div>

        {w.son_xeta && (
          <div className="rounded-md bg-danger/10 px-2 py-1 text-[10.5px] text-danger">{w.son_xeta}</div>
        )}

        <div className="flex items-center gap-1 pt-1">
          <Button size="sm" variant="outline" disabled={pending} onClick={onTest} className="h-7 text-xs">
            {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
            Test göndər
          </Button>
          <Button size="sm" variant="outline" disabled={pending} onClick={onToggle} className="h-7 text-xs">
            <Power className="h-3 w-3" /> {w.aktiv ? "Söndür" : "Aktivləşdir"}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={pending}
            onClick={onDelete}
            className="ml-auto h-7 text-xs text-danger hover:bg-danger/10"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
