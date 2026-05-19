import { Badge } from "@/components/ui/badge";
import { SERVIS_STATUS_LABELS } from "../types";

export type TimelineEntry = {
  id: number;
  evvelki_status: string | null;
  yeni_status: string;
  qeyd: string | null;
  deyisen_ad?: string | null;
  yaradildi: Date | null;
};

export function StatusTimeline({ entries, dense = false }: { entries: TimelineEntry[]; dense?: boolean }) {
  if (entries.length === 0) {
    return <p className="text-sm text-muted-foreground">Hələ qeyd yoxdur.</p>;
  }
  return (
    <ol className={`relative space-y-3 ${dense ? "text-xs" : "text-sm"}`}>
      {entries.map((e) => {
        const prev = e.evvelki_status ? SERVIS_STATUS_LABELS[e.evvelki_status] : null;
        const next = SERVIS_STATUS_LABELS[e.yeni_status];
        const isStatusChange = !!next;
        return (
          <li key={e.id} className="rounded-md border border-border/40 bg-card/40 p-3">
            <div className="flex flex-wrap items-center gap-2">
              {isStatusChange ? (
                <>
                  {prev && <Badge variant="outline" className={prev.cls}>{prev.label}</Badge>}
                  {prev && <span className="text-xs text-muted-foreground">→</span>}
                  {next && <Badge variant="outline" className={next.cls}>{next.label}</Badge>}
                </>
              ) : (
                <Badge variant="outline">{e.yeni_status}</Badge>
              )}
              {e.yaradildi && (
                <span className="ml-auto text-xs text-muted-foreground">
                  {new Date(e.yaradildi).toLocaleString("az-AZ")}
                </span>
              )}
            </div>
            {e.qeyd && <p className="mt-1.5 whitespace-pre-wrap text-xs text-muted-foreground">{e.qeyd}</p>}
          </li>
        );
      })}
    </ol>
  );
}
