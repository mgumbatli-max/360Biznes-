import Link from "next/link";
import { ArrowRight, PackageX, ShoppingBasket } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LowStockRow } from "../queries";

type Props = {
  rows: LowStockRow[];
};

export function LowStockPanel({ rows }: Props) {
  if (rows.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center py-10 text-center text-sm">
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-500/10">
          <PackageX className="h-5 w-5 text-emerald-500" />
        </div>
        <p className="mt-3 font-medium text-foreground">Az stok yoxdur</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Bütün məhsullar kritik səviyyədən yuxarıdır.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {rows.map((r) => {
        const ratio = r.kritik_stok ? Math.max(0, Math.min(1, r.miqdar / r.kritik_stok)) : 0;
        const isCritical = r.miqdar <= 0 || ratio <= 0.3;
        // Vizual bar: doluluq qədər kritik səviyyəyə yaxındır (kritikdə 0%)
        const barFill = Math.max(2, ratio * 100); // ən az 2% görünsün
        return (
          <div
            key={`${r.mehsul_id}-${r.anbar_ad}`}
            className={cn(
              "group relative overflow-hidden rounded-lg border px-3 py-2.5 transition-all hover:-translate-y-0.5 hover:shadow-md",
              isCritical
                ? "border-rose-500/30 bg-rose-500/5"
                : "border-amber-500/30 bg-amber-500/5",
            )}
          >
            <div className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className={cn(
                    "inline-flex h-1.5 w-1.5 rounded-full",
                    isCritical ? "bg-rose-500" : "bg-amber-500",
                  )} />
                  <span className="truncate text-sm font-medium">{r.ad}</span>
                </div>
                <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                  {r.kod && <span className="font-mono">{r.kod}</span>}
                  {r.kod && <span className="text-muted-foreground/40">·</span>}
                  <span>{r.anbar_ad}</span>
                </div>
              </div>
              <div className="text-right">
                <div className="flex items-baseline gap-1">
                  <span className={cn(
                    "text-base font-bold tabular-nums",
                    isCritical ? "text-rose-500" : "text-amber-600 dark:text-amber-400",
                  )}>
                    {r.miqdar}
                  </span>
                  <span className="text-[11px] text-muted-foreground">/ {r.kritik_stok}</span>
                </div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {r.miqdar <= 0 ? "bitib" : `${Math.round(ratio * 100)}%`}
                </div>
              </div>
            </div>

            {/* Visual fill bar — kritik səviyyəyə uzaqlıq */}
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-foreground/5">
              <div
                className={cn(
                  "h-full rounded-full transition-[width] duration-700 ease-out",
                  isCritical
                    ? "bg-gradient-to-r from-rose-500 to-rose-400"
                    : "bg-gradient-to-r from-amber-500 to-amber-400",
                )}
                style={{ width: `${barFill}%` }}
              />
            </div>
          </div>
        );
      })}

      <div className="flex items-center justify-between pt-2">
        <Link
          href="/anbar/satinalma"
          className="inline-flex items-center gap-1.5 rounded-md bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary-light transition hover:bg-primary/20"
        >
          <ShoppingBasket className="h-3 w-3" /> Alış sifarişi
        </Link>
        <Link
          href="/anbar/mehsullar?stok_status=az"
          className="inline-flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground transition hover:text-primary-light"
        >
          Hamısı <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </div>
  );
}
