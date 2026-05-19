import { Users, MessageSquare, ClipboardList } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import { az } from "date-fns/locale";
import type { CrmActivityRow } from "../dashboard-queries";

const KIND_META = {
  lead: { Icon: Users, cls: "bg-info/15 text-info" },
  inbox: { Icon: MessageSquare, cls: "bg-success/15 text-success" },
  task: { Icon: ClipboardList, cls: "bg-warning/15 text-warning" },
} as const;

export function CrmRecentActivity({ items }: { items: CrmActivityRow[] }) {
  if (!items.length) {
    return <div className="py-10 text-center text-sm text-muted-foreground">Hələ aktivlik yoxdur</div>;
  }
  return (
    <div className="space-y-2">
      {items.map((a) => {
        const m = KIND_META[a.kind];
        return (
          <div key={a.id} className="flex items-start gap-2 rounded-lg border border-border/30 bg-card/40 p-2.5">
            <div className={`grid h-7 w-7 shrink-0 place-items-center rounded-md ${m.cls}`}>
              <m.Icon className="h-3.5 w-3.5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <div className="truncate text-xs font-medium">{a.title}</div>
                {a.status && (
                  <Badge variant="outline" className="text-[10px] shrink-0">
                    {a.status}
                  </Badge>
                )}
              </div>
              {a.subtitle && <div className="mt-0.5 line-clamp-1 text-[11px] text-muted-foreground">{a.subtitle}</div>}
              {a.ts && (
                <div className="mt-0.5 text-[10px] text-muted-foreground">
                  {formatDistanceToNow(a.ts, { addSuffix: true, locale: az })}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
