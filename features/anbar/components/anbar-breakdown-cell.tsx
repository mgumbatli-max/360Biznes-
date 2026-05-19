"use client";

import { Package, MoreHorizontal } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatNumber } from "@/lib/utils";

type AnbarStok = {
  anbar_id: number;
  anbar_ad: string;
  miqdar: number;
};

type Props = {
  /** Anbar üzrə breakdown — yalnız >0 olan, sıralı (çoxdan aza). */
  items: AnbarStok[];
  /** Vahid (əd, kq, və s.) — boş gələrsə "əd". */
  vahid?: string | null;
  /** Cədvəl daxili kompakt görünüş — true. Hover badge üçün — false. */
  compact?: boolean;
};

/**
 * Anbar üzrə stok breakdown — kompakt göstərmə.
 *
 *   • İlk 2 anbar inline pill kimi göstərilir.
 *   • Daha çox olduqda 3-cü pill «+N» kimi olur, Popover-də qalan siyahı.
 *   • Boş gələrsə (stok yoxdur) — kiçik «—».
 */
export function AnbarBreakdownCell({ items, vahid, compact = true }: Props) {
  const unit = vahid ?? "əd";

  if (items.length === 0) {
    return <span className="text-xs text-muted-foreground/50">— stoku yoxdur</span>;
  }

  const visible = items.slice(0, compact ? 2 : items.length);
  const remaining = items.slice(compact ? 2 : items.length);

  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {visible.map((a) => (
        <span
          key={a.anbar_id}
          className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary/50 px-1.5 py-0.5 text-[10.5px]"
          title={`${a.anbar_ad}: ${formatNumber(a.miqdar, a.miqdar % 1 === 0 ? 0 : 2)} ${unit}`}
        >
          <Package className="h-2.5 w-2.5 text-muted-foreground" />
          <span className="max-w-[80px] truncate font-medium">{a.anbar_ad}</span>
          <span className="font-bold tabular-nums text-foreground">
            {formatNumber(a.miqdar, a.miqdar % 1 === 0 ? 0 : 2)}
          </span>
        </span>
      ))}
      {remaining.length > 0 && (
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-[10.5px] font-semibold text-primary hover:bg-primary/20"
              title={`${remaining.length} digər anbar`}
            >
              <MoreHorizontal className="h-2.5 w-2.5" />
              +{remaining.length}
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-64 p-2">
            <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Bütün anbarlar ({items.length})
            </div>
            <ul className="space-y-0">
              {items.map((a) => (
                <li
                  key={a.anbar_id}
                  className="flex items-center justify-between gap-2 border-b border-border/30 py-1 text-xs last:border-0"
                >
                  <span className="inline-flex items-center gap-1.5 truncate">
                    <Package className="h-3 w-3 shrink-0 text-muted-foreground" />
                    <span className="truncate">{a.anbar_ad}</span>
                  </span>
                  <span className="shrink-0 font-bold tabular-nums">
                    {formatNumber(a.miqdar, a.miqdar % 1 === 0 ? 0 : 2)} {unit}
                  </span>
                </li>
              ))}
            </ul>
          </PopoverContent>
        </Popover>
      )}
    </span>
  );
}

/**
 * Yığcam hover badge — adın yanına qoymaq üçün.
 * Yalnız ikon, hover/klik → Popover ilə tam siyahı.
 */
export function AnbarHoverBadge({ items, vahid }: { items: AnbarStok[]; vahid?: string | null }) {
  const unit = vahid ?? "əd";
  if (items.length === 0) return null;
  const total = items.reduce((s, a) => s + a.miqdar, 0);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-primary/15 hover:text-primary"
          title={`${items.length} anbar — toplam ${formatNumber(total, total % 1 === 0 ? 0 : 2)} ${unit}`}
        >
          <Package className="h-2.5 w-2.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-2">
        <div className="mb-1 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider">
          <span className="text-muted-foreground">Anbar bölgüsü</span>
          <span className="text-foreground">
            ∑ {formatNumber(total, total % 1 === 0 ? 0 : 2)} {unit}
          </span>
        </div>
        <ul className="space-y-0">
          {items.map((a) => (
            <li
              key={a.anbar_id}
              className="flex items-center justify-between gap-2 border-b border-border/30 py-1 text-xs last:border-0"
            >
              <span className="inline-flex items-center gap-1.5 truncate">
                <Package className="h-3 w-3 shrink-0 text-muted-foreground" />
                <span className="truncate">{a.anbar_ad}</span>
              </span>
              <span className="shrink-0 font-bold tabular-nums">
                {formatNumber(a.miqdar, a.miqdar % 1 === 0 ? 0 : 2)} {unit}
              </span>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
