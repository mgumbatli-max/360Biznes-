import Link from "next/link";
import { AlertTriangle, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getCriticalAlertsForDash } from "@/features/dashboard/queries";

export async function CriticalAlertsSection() {
  const critical = await getCriticalAlertsForDash(5);
  if (critical.length === 0) return null;
  return (
    <Card className="relative overflow-hidden border-rose-500/30 bg-gradient-to-br from-rose-500/[0.06] via-rose-500/[0.02] to-transparent shadow-md shadow-rose-500/5">
      {/* Animasiyalı sol kenar accent */}
      <div aria-hidden className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-rose-500 via-rose-500 to-rose-500/0" />
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <span className="relative grid h-7 w-7 place-items-center rounded-lg bg-rose-500/15 text-rose-500">
            <AlertTriangle className="h-4 w-4" />
            <span className="absolute -right-0.5 -top-0.5 grid h-3.5 w-3.5 place-items-center rounded-full bg-rose-500 text-[9px] font-bold text-white">
              {critical.length > 9 ? "9+" : critical.length}
            </span>
          </span>
          Diqqət lazımdır
        </CardTitle>
        <Link href="/xeberdarliqlar" className="inline-flex items-center gap-1 text-xs font-medium text-rose-500 hover:underline">
          Hamısı <ArrowRight className="h-3 w-3" />
        </Link>
      </CardHeader>
      <CardContent className="space-y-1.5 pt-1">
        {critical.map((a) => (
          <Link
            key={a.id}
            href={`/xeberdarliqlar/${a.id}`}
            className="group flex items-center justify-between gap-3 rounded-md border border-rose-500/15 bg-background/60 px-3 py-2 text-sm shadow-sm transition-all hover:-translate-x-0.5 hover:border-rose-500/40 hover:bg-rose-500/5"
          >
            <div className="flex min-w-0 items-center gap-2.5">
              <span className={cn(
                "inline-flex h-1.5 w-1.5 flex-shrink-0 rounded-full",
                a.seviyye === "kritik" ? "bg-rose-500 ring-2 ring-rose-500/30" : "bg-amber-500",
              )} />
              <div className="min-w-0">
                <div className="truncate font-medium">{a.basliq}</div>
                <div className="text-[11px] text-muted-foreground">{a.kateqoriya_ad}</div>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <Badge variant={a.seviyye === "kritik" ? "destructive" : "secondary"} className="h-5 text-[10px] capitalize">
                {a.seviyye}
              </Badge>
              <ArrowRight className="h-3 w-3 text-muted-foreground/60 transition group-hover:translate-x-0.5 group-hover:text-rose-500" />
            </div>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}
