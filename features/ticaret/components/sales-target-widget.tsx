import Link from "next/link";
import { Target, Settings2 } from "lucide-react";
import { formatMoney, formatNumber } from "@/lib/utils";
import type { SalesTargetProgress } from "../satis-hedef";

export function SalesTargetWidget({ data }: { data: SalesTargetProgress }) {
  if (data.hedef_ay <= 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card/30 p-4">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Target className="h-4 w-4 text-muted-foreground" />
          Satış hədəfi
        </div>
        <p className="mt-1.5 text-xs text-muted-foreground">
          Aylık hədəf təyin edilməyib.
        </p>
        <Link
          href="/ayarlar/satis-hedef"
          className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
        >
          <Settings2 className="h-3 w-3" /> Hədəf təyin et
        </Link>
      </div>
    );
  }

  const onTrack = data.proportional_faiz >= 100;

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h4 className="flex items-center gap-1.5 text-sm font-semibold tracking-tight">
          <Target className="h-4 w-4 text-primary" />
          Aylık hədəf
        </h4>
        <Link
          href="/ayarlar/satis-hedef"
          className="text-[10px] text-muted-foreground hover:text-foreground"
        >
          dəyiş
        </Link>
      </div>

      <div className="space-y-2">
        <div className="flex items-baseline justify-between text-sm">
          <span className="text-muted-foreground">İcra olunub</span>
          <span className="text-lg font-bold tabular-nums">{formatMoney(data.satis_ay)}</span>
        </div>
        <div className="flex items-baseline justify-between text-xs text-muted-foreground">
          <span>Hədəf: {formatMoney(data.hedef_ay)}</span>
          <span>
            Gün {data.bugun_gun}/{data.ay_gun_say}
          </span>
        </div>

        <div className="relative mt-1 h-3 overflow-hidden rounded-full bg-secondary">
          <div
            className={`h-full rounded-full ${onTrack ? "bg-success" : "bg-warning"} transition-all`}
            style={{ width: `${Math.min(100, data.faiz)}%` }}
          />
          {data.bugune_kimi_hedef > 0 && data.bugune_kimi_hedef < data.hedef_ay && (
            <div
              className="absolute top-0 h-full w-px bg-foreground/50"
              style={{
                left: `${(data.bugune_kimi_hedef / data.hedef_ay) * 100}%`,
              }}
              title="Bu günə qədər gözlənən"
            />
          )}
        </div>

        <div className="flex items-center justify-between text-xs">
          <span>
            <strong className="text-foreground">{formatNumber(data.faiz)}%</strong>{" "}
            <span className="text-muted-foreground">hədəf</span>
          </span>
          <span>
            <strong className={onTrack ? "text-success" : "text-warning"}>
              {formatNumber(data.proportional_faiz)}%
            </strong>{" "}
            <span className="text-muted-foreground">qrafik</span>
          </span>
        </div>
      </div>
    </div>
  );
}
