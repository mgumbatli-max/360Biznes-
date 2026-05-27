import { AlertTriangle, RefreshCw, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";

type Fail = {
  id: bigint | number;
  status: string | null;
  retry_count: number;
  error_message: string | null;
  yaradildi: Date | null;
  next_retry_at: Date | null;
};

type Props = {
  pending: number;
  abandoned: number;
  recentFails: Fail[];
};

/**
 * Audit log outbox widget — fail edən audit log-ların retry növbəsi.
 * Pending = ayda 1 dəq cron retry edir (Vercel cron). Abandoned = 5 cəhddən
 * sonra durub — manual müdaxilə tələb edir.
 */
export function AuditOutboxWidget({ pending, abandoned, recentFails }: Props) {
  if (pending === 0 && abandoned === 0) {
    return (
      <Card className="glass border-emerald-500/20 bg-emerald-500/5">
        <CardContent className="flex items-center gap-2 py-3 text-xs text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Audit log outbox boşdur — bütün loglar uğurla yazılıb.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`glass ${abandoned > 0 ? "border-rose-500/30" : "border-amber-500/30"}`}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <AlertTriangle className={`h-4 w-4 ${abandoned > 0 ? "text-rose-500" : "text-amber-500"}`} />
          Audit log outbox
        </CardTitle>
        <p className="text-[10.5px] text-muted-foreground">
          Fail olunan audit log-lar cron-da retry edilir. Abandoned status — 5 cəhddən sonra durub.
        </p>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2">
            <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-amber-600 dark:text-amber-400">
              <RefreshCw className="h-2.5 w-2.5" /> Retry növbəsi
            </div>
            <div className="mt-0.5 text-lg font-bold tabular-nums text-amber-700 dark:text-amber-400">{pending}</div>
          </div>
          <div className={`rounded-md border px-3 py-2 ${abandoned > 0 ? "border-rose-500/40 bg-rose-500/10" : "border-border bg-secondary/30"}`}>
            <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider">
              <AlertTriangle className="h-2.5 w-2.5" /> Buraxılıb (abandoned)
            </div>
            <div className={`mt-0.5 text-lg font-bold tabular-nums ${abandoned > 0 ? "text-rose-700 dark:text-rose-400" : "text-muted-foreground"}`}>{abandoned}</div>
          </div>
        </div>

        {recentFails.length > 0 && (
          <div className="space-y-1.5 border-t border-border/30 pt-2">
            <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground">Son fail-lar</div>
            {recentFails.map((f) => (
              <div key={String(f.id)} className="rounded-md border border-border/30 px-2 py-1.5 text-[10.5px]">
                <div className="flex items-center justify-between gap-2">
                  <Badge variant="outline" className={`text-[9px] ${f.status === "abandoned" ? "border-rose-500/40 text-rose-500" : "border-amber-500/40 text-amber-500"}`}>
                    {f.status} · retry {f.retry_count}/5
                  </Badge>
                  <span className="text-muted-foreground tabular-nums">
                    {f.next_retry_at && f.status === "pending"
                      ? `növbəti: ${formatDate(f.next_retry_at, { hour: "2-digit", minute: "2-digit" })}`
                      : (f.yaradildi ? formatDate(f.yaradildi, { day: "2-digit", month: "short" }) : "")}
                  </span>
                </div>
                {f.error_message && (
                  <p className="mt-0.5 line-clamp-1 font-mono text-[10px] text-muted-foreground" title={f.error_message}>
                    {f.error_message}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
