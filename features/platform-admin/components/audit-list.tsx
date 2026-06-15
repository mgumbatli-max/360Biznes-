import { Badge } from "@/components/ui/badge";
import { cn, formatDate } from "@/lib/utils";
import { OP_META, RESOURCE_LABEL } from "@/features/audit-log/labels";
import type { AuditRow } from "@/features/platform-admin/queries";

// tone → Badge rəng class-ları (audit-feed-list ilə eyni palitra)
const TONE_BADGE: Record<string, string> = {
  success: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700",
  info: "border-sky-500/40 bg-sky-500/10 text-sky-700",
  danger: "border-rose-500/40 bg-rose-500/10 text-rose-700",
  warning: "border-amber-500/40 bg-amber-500/10 text-amber-700",
  primary: "border-violet-500/40 bg-violet-500/10 text-violet-700",
  neutral: "border-border/50 bg-secondary/40 text-muted-foreground",
};

export function AuditList({
  rows,
  showUser = true,
  emptyText = "Hələ heç bir fəaliyyət qeydə alınmayıb.",
}: {
  rows: AuditRow[];
  showUser?: boolean;
  emptyText?: string;
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-secondary/20 px-4 py-8 text-center text-xs text-muted-foreground">
        {emptyText}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border bg-secondary/30 text-left text-muted-foreground">
            <th className="px-3 py-2 font-medium whitespace-nowrap">Tarix</th>
            {showUser ? <th className="px-3 py-2 font-medium whitespace-nowrap">İstifadəçi</th> : null}
            <th className="px-3 py-2 font-medium whitespace-nowrap">Əməliyyat</th>
            <th className="px-3 py-2 font-medium whitespace-nowrap">Resurs</th>
            <th className="px-3 py-2 font-medium whitespace-nowrap">Status</th>
            <th className="px-3 py-2 font-medium whitespace-nowrap">IP</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const meta = OP_META[r.emeliyyat] ?? { label: r.emeliyyat, tone: "neutral" as const, verb: r.emeliyyat };
            const resourceLabel = RESOURCE_LABEL[r.resurs_nov] ?? r.resurs_nov;
            const ok = r.status === "ugur";
            return (
              <tr key={r.id} className="border-b border-border/60 last:border-0 hover:bg-secondary/20">
                <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                  {r.yaradildi ? formatDate(r.yaradildi, { hour: "2-digit", minute: "2-digit" }) : "—"}
                </td>
                {showUser ? (
                  <td className="px-3 py-2 whitespace-nowrap">{r.istifadeci_ad ?? "—"}</td>
                ) : null}
                <td className="px-3 py-2">
                  <Badge variant="outline" className={cn("text-[10px]", TONE_BADGE[meta.tone])}>
                    {meta.label}
                  </Badge>
                </td>
                <td className="px-3 py-2 whitespace-nowrap">{resourceLabel}</td>
                <td className="px-3 py-2">
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[10px]",
                      ok ? TONE_BADGE.success : TONE_BADGE.danger,
                    )}
                  >
                    {ok ? "Uğurlu" : "Uğursuz"}
                  </Badge>
                </td>
                <td className="px-3 py-2 whitespace-nowrap font-mono text-muted-foreground">
                  {r.ip ?? "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
