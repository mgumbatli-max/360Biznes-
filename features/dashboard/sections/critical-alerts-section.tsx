import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getCriticalAlertsForDash } from "@/features/dashboard/queries";

export async function CriticalAlertsSection() {
  const critical = await getCriticalAlertsForDash(5);
  if (critical.length === 0) return null;
  return (
    <Card className="glass border-rose-500/30 bg-rose-500/[0.04]">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <AlertTriangle className="h-4 w-4 text-rose-500" />
          Diqqət lazımdır
          <Badge variant="destructive" className="h-5">{critical.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1.5 pt-1">
        {critical.map((a) => (
          <Link key={a.id} href={`/xeberdarliqlar/${a.id}`}
            className="flex items-center justify-between rounded-md border border-rose-500/15 bg-background/40 px-3 py-2 text-sm transition hover:border-rose-500/40">
            <div className="min-w-0">
              <div className="truncate font-medium">{a.basliq}</div>
              <div className="text-xs text-muted-foreground">{a.kateqoriya_ad}</div>
            </div>
            <Badge variant={a.seviyye === "kritik" ? "destructive" : "secondary"} className="h-5 text-[10px]">
              {a.seviyye}
            </Badge>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}
