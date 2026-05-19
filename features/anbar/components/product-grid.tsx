"use client";

import { useState } from "react";
import Link from "next/link";
import { Package, Edit, ExternalLink, ImageIcon as ImgIcon, Inspect, SlidersHorizontal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { QuickViewDialog } from "./quick-view-dialog";
import { ProductDialog } from "./product-dialog";
import { StockAdjustDialog } from "./stock-adjust-dialog";
import { AnbarHoverBadge } from "./anbar-breakdown-cell";
import { formatMoney, formatNumber } from "@/lib/utils";
import type { ProductListRow } from "../queries";

type Props = {
  items: ProductListRow[];
  categories: Array<{ id: number; ad: string }>;
  brands: Array<{ id: number; ad: string }>;
  units?: Array<{ id: number; ad: string; qisa_ad?: string | null }>;
  anbarlar?: Array<{ id: number; ad: string }>;
};

export function ProductGrid({ items, categories, brands, units = [], anbarlar = [] }: Props) {
  const [quickViewId, setQuickViewId] = useState<string | null>(null);

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
        <div className="mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-secondary">
          <Package className="h-5 w-5 text-muted-foreground" />
        </div>
        <h3 className="font-semibold">Məhsul tapılmadı</h3>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">
          Filtrlərə uyğun məhsul yoxdur.
        </p>
      </div>
    );
  }

  return (
    <>
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {items.map((p) => {
        const margin = p.alish_qiymeti > 0 ? ((p.satis_qiymeti - p.alish_qiymeti) / p.alish_qiymeti) * 100 : 0;
        const out = p.stok_miqdari <= 0;
        const low = p.kritik_stok != null && p.stok_miqdari > 0 && p.stok_miqdari <= p.kritik_stok;
        return (
          <div
            key={p.id}
            className={`group flex flex-col rounded-xl border border-border bg-card/40 transition hover:border-primary/30 hover:shadow-md ${!p.aktiv && "opacity-60"}`}
          >
            <div className="relative aspect-square overflow-hidden rounded-t-xl bg-secondary/40">
              {p.sekil_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={p.sekil_url}
                  alt={p.ad}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="grid h-full w-full place-items-center text-muted-foreground">
                  <ImgIcon className="h-8 w-8 opacity-40" />
                </div>
              )}
              {out && (
                <span className="absolute right-1.5 top-1.5 rounded bg-danger/90 px-1.5 py-0.5 text-[9px] font-bold text-white uppercase">
                  Bitib
                </span>
              )}
              {low && !out && (
                <span className="absolute right-1.5 top-1.5 rounded bg-warning/90 px-1.5 py-0.5 text-[9px] font-bold text-white uppercase">
                  Az
                </span>
              )}
              {!p.aktiv && (
                <span className="absolute left-1.5 top-1.5 rounded bg-muted/90 px-1.5 py-0.5 text-[9px] font-bold uppercase">
                  Passiv
                </span>
              )}
            </div>

            <div className="flex-1 space-y-1 p-2.5">
              <div className="flex items-start gap-1">
                <div className="line-clamp-2 flex-1 text-sm font-semibold leading-tight" title={p.ad}>
                  {p.ad}
                </div>
                <CopyButton value={p.ad} title="Adı kopya et" size="xs" />
                <button
                  type="button"
                  onClick={() => setQuickViewId(p.id)}
                  className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted-foreground transition hover:bg-primary/15 hover:text-primary-light"
                  title="Sürətli baxış"
                  aria-label="Sürətli baxış"
                >
                  <Inspect className="h-3 w-3" />
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-1 text-[10px] text-muted-foreground">
                {p.kateqoriya_ad && <span className="truncate">{p.kateqoriya_ad}</span>}
                {p.marka_ad && (
                  <>
                    <span>·</span>
                    <span className="truncate">{p.marka_ad}</span>
                  </>
                )}
              </div>
              {(p.kod || p.barkod) && (
                <div className="flex items-center gap-1 font-mono text-[10px] text-muted-foreground">
                  <span className="truncate flex-1">{p.kod ?? p.barkod}</span>
                  <CopyButton value={(p.kod ?? p.barkod) ?? ""} title="Kopya et" size="xs" />
                </div>
              )}

              <div className="flex items-end justify-between pt-1">
                <div>
                  <div className="text-base font-bold tabular-nums">{formatMoney(p.satis_qiymeti)}</div>
                  {p.alish_qiymeti > 0 && (
                    <div className={`text-[10px] tabular-nums ${margin < 0 ? "text-danger" : margin < 10 ? "text-warning" : "text-success"}`}>
                      Marja: {margin.toFixed(0)}%
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <Badge
                    variant="outline"
                    className={`text-[10px] ${out ? "border-danger/30 text-danger" : low ? "border-warning/30 text-warning" : "border-border"}`}
                  >
                    {formatNumber(p.stok_miqdari, 0)}
                  </Badge>
                  {p.anbar_breakdown.length > 0 && (
                    <AnbarHoverBadge items={p.anbar_breakdown} vahid={p.olcu_ad} />
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1 border-t border-border/40 p-1.5">
              <Link
                href={`/anbar/mehsullar/${p.id}`}
                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground"
                title="Tam karta keç"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </Link>
              <ProductDialog
                categories={categories}
                brands={brands}
                units={units}
                initial={{
                  id: p.id,
                  ad: p.ad,
                  kod: p.kod,
                  barkod: p.barkod,
                  kateqoriya_id: p.kateqoriya_id,
                  kateqoriya_ad: p.kateqoriya_ad,
                  marka_id: p.marka_id,
                  marka_ad: p.marka_ad,
                  olcu_id: p.olcu_id,
                  sekil_url: p.sekil_url,
                  aciqlamaq: p.aciqlamaq,
                  alish_qiymeti: p.alish_qiymeti,
                  satis_qiymeti: p.satis_qiymeti,
                  min_satis_qiymeti: p.min_satis_qiymeti,
                  topdan_qiymeti: p.topdan_qiymeti,
                  partnyor_qiymeti: p.partnyor_qiymeti,
                  vip_qiymeti: p.vip_qiymeti,
                  kritik_stok: p.kritik_stok,
                  aktiv: p.aktiv,
                }}
                trigger="edit"
              />
              <StockAdjustDialog
                mehsulId={p.id}
                mehsulAd={p.ad}
                anbarlar={anbarlar}
                currentStock={p.stok_miqdari}
                trigger={
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    title="Stok düzəlt (mədaxil / məxaric / inventar)"
                    className="text-primary-light hover:bg-primary/10"
                  >
                    <SlidersHorizontal className="h-3.5 w-3.5" />
                  </Button>
                }
              />
              <div className="flex-1" />
              <Button asChild size="sm" variant="ghost" className="h-7 text-[11px]">
                <Link href={`/anbar/mehsullar/${p.id}`}>
                  <Edit className="h-3 w-3" /> Aç
                </Link>
              </Button>
            </div>
          </div>
        );
      })}
    </div>

    {quickViewId && (
      <QuickViewDialog
        mehsulId={quickViewId}
        open={!!quickViewId}
        onOpenChange={(v) => { if (!v) setQuickViewId(null); }}
      />
    )}
    </>
  );
}
