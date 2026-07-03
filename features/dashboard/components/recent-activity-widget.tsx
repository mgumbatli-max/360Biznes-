import Link from "next/link";
import {
  Activity,
  ShoppingCart,
  Truck,
  ArrowDownCircle,
  ArrowUpCircle,
  UserPlus,
  CheckCircle2,
  RotateCcw,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatMoney, formatDate } from "@/lib/utils";
import type { ActivityItem, ActivityKind } from "@/features/dashboard/recent-activity-queries";

const KIND_META: Record<
  ActivityKind,
  { icon: typeof Activity; color: string; bg: string }
> = {
  satis: { icon: ShoppingCart, color: "text-emerald-600", bg: "bg-emerald-100" },
  alis: { icon: Truck, color: "text-sky-600", bg: "bg-sky-100" },
  odenis_daxil: { icon: ArrowDownCircle, color: "text-emerald-600", bg: "bg-emerald-100" },
  odenis_xaric: { icon: ArrowUpCircle, color: "text-rose-600", bg: "bg-rose-100" },
  musteri_yeni: { icon: UserPlus, color: "text-violet-600", bg: "bg-violet-100" },
  tapshiriq_tamamlandi: { icon: CheckCircle2, color: "text-amber-600", bg: "bg-amber-100" },
  qaytarma: { icon: RotateCcw, color: "text-rose-600", bg: "bg-rose-100" },
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "indicə";
  if (m < 60) return `${m} dəq əvvəl`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} saat əvvəl`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d} gün əvvəl`;
  const w = Math.floor(d / 7);
  if (w < 4) return `${w} həftə əvvəl`;
  return formatDate(iso);
}

export function RecentActivityWidget({
  items,
  limit = 12,
}: {
  items: ActivityItem[];
  limit?: number;
}) {
  const list = items.slice(0, limit);
  return (
    <Card className="glass">
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-base">
          <Activity className="h-4 w-4 text-primary" />
          Son fəaliyyət
        </CardTitle>
        <Badge variant="outline" className="text-[10px]">
          {items.length} qeyd
        </Badge>
      </CardHeader>
      <CardContent>
        {list.length === 0 ? (
          <div className="py-8 text-center text-xs text-muted-foreground">
            Hələ fəaliyyət yoxdur.
          </div>
        ) : (
          <ul className="space-y-1.5">
            {list.map((it) => {
              const meta = KIND_META[it.kind];
              const Icon = meta.icon;
              const body = (
                <div className="flex items-start gap-2.5 rounded-md px-2 py-1.5 transition hover:bg-secondary/40">
                  <div className={`grid h-7 w-7 shrink-0 place-items-center rounded-md ${meta.bg} ${meta.color}`}>
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="truncate text-xs font-medium text-foreground">
                        {it.title}
                      </span>
                      {it.amount !== null && it.amount > 0 && (
                        <span className={`ml-auto shrink-0 text-xs font-bold tabular-nums ${meta.color}`}>
                          {formatMoney(it.amount)}
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 flex items-center gap-1.5 text-[10.5px] text-muted-foreground">
                      <span>{timeAgo(it.at)}</span>
                      {it.user && (
                        <>
                          <span>·</span>
                          <span>{it.user}</span>
                        </>
                      )}
                      {it.subtitle && (
                        <>
                          <span>·</span>
                          <span className="truncate">{it.subtitle}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
              return (
                <li key={it.id}>
                  {it.href ? <Link href={it.href}>{body}</Link> : body}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
