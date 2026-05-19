"use client";

import { useState, useEffect } from "react";
import { Eye, Loader2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatMoney } from "@/lib/utils";

type Tiers = {
  alish_qiymeti: number;
  satis_qiymeti: number;
  endirimli_qiymet: number | null;
  min_satis_qiymeti: number;
  topdan_qiymeti: number;
  partnyor_qiymeti: number;
  vip_qiymeti: number;
};

export type AllowedTier =
  | "satis_qiymeti"
  | "endirimli_qiymet"
  | "topdan_qiymeti"
  | "partnyor_qiymeti"
  | "vip_qiymeti"
  | "min_satis_qiymeti";

/**
 * Klik açan kiçik "qiymət tipləri" popover-i — POS / Satış / Alış sətirlərində
 * əməkdaşın anında bütün qiymət səviyyələrini görməsi üçün.
 */
export function PriceTiersPopover({
  mehsulId,
  tiers,
  /** When pre-supplied (sale/purchase row), no fetch needed. */
  inline,
  title,
  /** When user picks a price, this fires with the value */
  onPickPrice,
  /** Filter — only show these tiers (POS uses role-based filter). When undefined, all are shown. */
  allowedTiers,
}: {
  mehsulId?: string;
  tiers?: Tiers;
  inline?: boolean;
  title?: string;
  onPickPrice?: (price: number, kind: keyof Tiers) => void;
  allowedTiers?: AllowedTier[];
}) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<Tiers | null>(tiers ?? null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || data || !mehsulId) return;
    setLoading(true);
    fetch(`/api/anbar/quick-view/${mehsulId}`)
      .then((r) => r.json())
      .then((d) => {
        setData({
          alish_qiymeti: Number(d.alish_qiymeti ?? 0),
          satis_qiymeti: Number(d.satis_qiymeti ?? 0),
          endirimli_qiymet: d.endirimli_qiymet ?? null,
          min_satis_qiymeti: Number(d.min_satis_qiymeti ?? 0),
          topdan_qiymeti: Number(d.topdan_qiymeti ?? 0),
          partnyor_qiymeti: Number(d.partnyor_qiymeti ?? 0),
          vip_qiymeti: Number(d.vip_qiymeti ?? 0),
        });
      })
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [open, data, mehsulId]);

  function marja(price: number, maya: number) {
    if (!maya || !price) return null;
    return ((price - maya) / maya) * 100;
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          title={title ?? "Qiymət tipləri"}
          aria-label="Qiymət tipləri"
          className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted-foreground transition hover:bg-primary/15 hover:text-primary-light"
        >
          <Eye className="h-3 w-3" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-2" align="start">
        <div className="mb-2 flex items-center justify-between border-b border-border/40 pb-1.5">
          <div className="text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground">
            Qiymət tipləri
          </div>
          {data && data.alish_qiymeti > 0 && (
            <div className="text-[10px] text-muted-foreground">
              maya: <span className="tabular-nums">{formatMoney(data.alish_qiymeti)}</span>
            </div>
          )}
        </div>
        {loading && (
          <div className="flex justify-center py-3">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        )}
        {!loading && data && (
          <div className="space-y-1">
            {(!allowedTiers || allowedTiers.includes("satis_qiymeti")) && (
              <PriceLine label="Pərakəndə" value={data.satis_qiymeti} maya={data.alish_qiymeti} onPick={onPickPrice ? () => onPickPrice(data.satis_qiymeti, "satis_qiymeti") : undefined} highlight />
            )}
            {(!allowedTiers || allowedTiers.includes("endirimli_qiymet")) && (
              <PriceLine label="Endirimli" value={data.endirimli_qiymet ?? 0} maya={data.alish_qiymeti} onPick={onPickPrice && data.endirimli_qiymet ? () => onPickPrice(data.endirimli_qiymet!, "endirimli_qiymet") : undefined} dim={!data.endirimli_qiymet} />
            )}
            {(!allowedTiers || allowedTiers.includes("topdan_qiymeti")) && (
              <PriceLine label="Topdan" value={data.topdan_qiymeti} maya={data.alish_qiymeti} onPick={onPickPrice && data.topdan_qiymeti ? () => onPickPrice(data.topdan_qiymeti, "topdan_qiymeti") : undefined} dim={!data.topdan_qiymeti} />
            )}
            {(!allowedTiers || allowedTiers.includes("partnyor_qiymeti")) && (
              <PriceLine label="Partnyor" value={data.partnyor_qiymeti} maya={data.alish_qiymeti} onPick={onPickPrice && data.partnyor_qiymeti ? () => onPickPrice(data.partnyor_qiymeti, "partnyor_qiymeti") : undefined} dim={!data.partnyor_qiymeti} />
            )}
            {(!allowedTiers || allowedTiers.includes("vip_qiymeti")) && (
              <PriceLine label="VIP" value={data.vip_qiymeti} maya={data.alish_qiymeti} onPick={onPickPrice && data.vip_qiymeti ? () => onPickPrice(data.vip_qiymeti, "vip_qiymeti") : undefined} dim={!data.vip_qiymeti} />
            )}
            {(!allowedTiers || allowedTiers.includes("min_satis_qiymeti")) && (
              <PriceLine label="Min satış" value={data.min_satis_qiymeti} maya={data.alish_qiymeti} dim={!data.min_satis_qiymeti} info="aşağı limit" />
            )}
          </div>
        )}
        {!loading && !data && (
          <div className="py-3 text-center text-xs text-muted-foreground">Məlumat yoxdur</div>
        )}
        {onPickPrice && data && (
          <div className="mt-2 border-t border-border/40 pt-1.5 text-[9.5px] text-muted-foreground">
            💡 Sətrə tətbiq etmək üçün qiymətə klikləyin
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

function PriceLine({
  label, value, maya, onPick, dim, highlight, info,
}: {
  label: string;
  value: number;
  maya: number;
  onPick?: () => void;
  dim?: boolean;
  highlight?: boolean;
  info?: string;
}) {
  const m = value && maya ? ((value - maya) / maya) * 100 : null;
  const mCls = m == null ? "text-muted-foreground" : m < 0 ? "text-danger" : m < 10 ? "text-warning" : "text-success";
  const Wrapper = onPick && !dim ? "button" : "div";
  return (
    <Wrapper
      type={onPick ? "button" : undefined}
      onClick={onPick}
      className={`flex w-full items-center justify-between gap-2 rounded px-2 py-1 text-xs ${
        onPick && !dim ? "cursor-pointer hover:bg-primary/10" : ""
      } ${dim ? "opacity-50" : ""} ${highlight ? "bg-secondary/40" : ""}`}
    >
      <span className="flex items-center gap-1">
        <span className="font-medium">{label}</span>
        {info && <span className="text-[9px] text-muted-foreground">({info})</span>}
      </span>
      <span className="inline-flex items-center gap-2">
        <span className="tabular-nums font-semibold">{value > 0 ? formatMoney(value) : "—"}</span>
        {m != null && value > 0 && (
          <span className={`text-[9.5px] ${mCls} tabular-nums`}>{m >= 0 ? "+" : ""}{m.toFixed(0)}%</span>
        )}
      </span>
    </Wrapper>
  );
}
