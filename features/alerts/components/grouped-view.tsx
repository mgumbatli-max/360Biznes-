import { AlertCard } from "./alert-card";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Flame } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AlertGroup } from "../queries";

export function GroupedView({ groups }: { groups: AlertGroup[] }) {
  if (groups.length === 0) {
    return (
      <Card className="glass">
        <CardContent className="py-16 text-center">
          <p className="text-sm text-muted-foreground">Bu filtrlərə uyğun xəbərdarlıq tapılmadı</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {groups.map((g) => (
        <section key={g.kateqoriya_kod} className="space-y-2">
          <header
            className={cn(
              "flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/40 px-3 py-2",
              g.kritik_count > 0 ? "bg-rose-500/5 border-rose-500/30" : "bg-card/40"
            )}
          >
            <div className="flex items-center gap-2">
              <span
                className="grid h-8 w-8 place-items-center rounded-lg text-lg"
                style={{ background: `${g.kateqoriya_reng ?? "hsl(228 32% 22%)"}25` }}
              >
                {g.kateqoriya_emoji ?? "🔔"}
              </span>
              <div>
                <h3 className="text-sm font-bold">{g.kateqoriya_ad}</h3>
                {g.qrup && <p className="text-[10px] text-muted-foreground">{g.qrup}</p>}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {g.kritik_count > 0 && (
                <Badge variant="outline" className="border-rose-500/40 bg-rose-500/10 text-[10px] text-rose-500">
                  <Flame className="mr-1 h-2.5 w-2.5" />
                  {g.kritik_count} kritik
                </Badge>
              )}
              <Badge variant="secondary" className="text-[10px]">
                {g.count} ədəd
              </Badge>
            </div>
          </header>
          <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
            {g.items.map((a) => (
              <AlertCard key={a.id} alert={a} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
