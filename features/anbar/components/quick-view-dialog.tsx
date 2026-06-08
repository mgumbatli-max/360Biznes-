"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Package,
  Eye,
  ArrowRight,
  Loader2,
  ImageIcon,
  ZoomIn,
  Wrench,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatMoney, formatNumber } from "@/lib/utils";
import { ImageEditPopover } from "./image-edit-popover";
import { BarcodeFix } from "./quick-fix-cells";
import { CopyButton } from "@/components/ui/copy-button";
import { MiniBarcode } from "@/components/ui/barcode";
import { BarcodeScanDialog } from "@/components/ui/barcode-scan-dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Pencil } from "lucide-react";
import type { QuickViewData } from "../quick-view-queries";
import { ProductImageGallery } from "./product-image-gallery";
import { primarySekilUrl, parseSekilUrls } from "@/lib/mehsul/sekil-urls";

export function QuickViewTrigger({
  mehsulId,
  children,
}: {
  mehsulId: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="text-left hover:text-primary transition w-full">
        {children}
      </button>
      <QuickViewDialog mehsulId={mehsulId} open={open} onOpenChange={setOpen} />
    </>
  );
}

export function QuickViewDialog({
  mehsulId,
  open,
  onOpenChange,
}: {
  mehsulId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [data, setData] = useState<QuickViewData | null>(null);
  const [loading, setLoading] = useState(false);
  const [imgOpen, setImgOpen] = useState(false);

  function reload() {
    setLoading(true);
    fetch(`/api/anbar/quick-view/${mehsulId}`)
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (!open) return;
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mehsulId]);

  const menfeet = data ? data.satis_qiymeti - data.alish_qiymeti : 0;
  const menfeetPct = data && data.alish_qiymeti > 0 ? (menfeet / data.alish_qiymeti) * 100 : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="md:max-w-lg p-4">
        <DialogHeader className="space-y-0 pb-2">
          <DialogTitle className="flex items-center gap-2 text-sm">
            <Eye className="h-3.5 w-3.5 text-primary" />
            <span>Tez baxış</span>
          </DialogTitle>
        </DialogHeader>

        {loading && (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {!loading && data && (
          <div className="space-y-3">
            {/* Top: image + identity (compact) */}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => data.sekil_url && setImgOpen(true)}
                className="relative block h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-border bg-secondary/40"
                title={data.sekil_url ? "Şəkli böyüt" : "Şəkil yoxdur"}
              >
                {(() => {
                  const primary = primarySekilUrl(data.sekil_url);
                  const count = parseSekilUrls(data.sekil_url).length;
                  if (!primary) {
                    return (
                      <div className="grid h-full w-full place-items-center text-muted-foreground">
                        <ImageIcon className="h-6 w-6 opacity-40" />
                      </div>
                    );
                  }
                  return (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img loading="lazy" decoding="async" src={primary} alt={data.ad} className="h-full w-full object-cover" />
                      <div className="absolute inset-0 grid place-items-center bg-black/0 opacity-0 transition hover:bg-black/30 hover:opacity-100">
                        <ZoomIn className="h-4 w-4 text-white" />
                      </div>
                      {count > 1 && (
                        <div className="absolute right-1 top-1 rounded-full bg-black/70 px-1.5 py-0.5 text-[9px] font-bold text-white">
                          +{count - 1}
                        </div>
                      )}
                    </>
                  );
                })()}
              </button>

              <div className="min-w-0 flex-1">
                <div className="flex items-start gap-1.5">
                  <h3 className="line-clamp-2 text-sm font-bold tracking-tight" title={data.ad}>{data.ad}</h3>
                  {!data.aktiv && (
                    <Badge variant="outline" className="shrink-0 text-[9px]">passiv</Badge>
                  )}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10.5px] text-muted-foreground">
                  {data.kod && (
                    <span className="inline-flex items-center gap-0.5">
                      <span className="text-foreground font-mono">{data.kod}</span>
                      <CopyButton value={data.kod} title="Kod kopya" size="xs" />
                    </span>
                  )}
                  {data.barkod && (
                    <span className="inline-flex items-center gap-1">
                      <MiniBarcode value={data.barkod} className="opacity-80" />
                      <span className="text-foreground font-mono">{data.barkod}</span>
                      <CopyButton value={data.barkod} title="Barkod kopya" size="xs" />
                      <BarcodeScanDialog value={data.barkod} productName={data.ad} />
                      <Popover>
                        <PopoverTrigger asChild>
                          <button type="button" title="Barkodu dəyiş" className="rounded p-0.5 hover:bg-primary/15 hover:text-primary">
                            <Pencil className="h-2.5 w-2.5" />
                          </button>
                        </PopoverTrigger>
                        <PopoverContent align="start" className="w-72 p-3">
                          <BarcodeFix id={data.id} current={data.barkod} onSuccess={reload} />
                        </PopoverContent>
                      </Popover>
                    </span>
                  )}
                  {data.kateqoriya_ad && <span>· {data.kateqoriya_ad}</span>}
                  {data.marka_ad && <span>· {data.marka_ad}</span>}
                </div>
                <div className="mt-1.5">
                  <ImageEditPopover
                    mehsulId={data.id}
                    currentUrl={data.sekil_url}
                    productName={data.ad}
                    label={data.sekil_url ? "Şəkli dəyiş" : "+ Şəkil"}
                    onSuccess={reload}
                  />
                </div>
              </div>
            </div>

            {/* 3 key metrics — Stok, Satış, Maya */}
            <div className="grid grid-cols-3 gap-2">
              <StatCard
                label="Stok"
                value={`${formatNumber(data.cem_stok, 0)} ${data.vahid ?? "əd"}`}
                tone={data.cem_stok > 0 ? "success" : "danger"}
              />
              <StatCard
                label="Satış"
                value={formatMoney(data.satis_qiymeti)}
                tone="primary"
              />
              <StatCard
                label="Maya"
                value={formatMoney(data.alish_qiymeti)}
                sub={data.alish_qiymeti > 0 ? `marja ${menfeetPct.toFixed(0)}%` : undefined}
              />
            </div>

            {/* Price tiers — compact inline pills */}
            <div className="flex flex-wrap gap-1.5 rounded-lg border border-border/40 bg-secondary/20 p-2">
              <PricePill label="Topdan" value={data.topdan_qiymeti} maya={data.alish_qiymeti} />
              <PricePill label="VIP" value={data.vip_qiymeti} maya={data.alish_qiymeti} />
              <PricePill label="Partnyor" value={data.partnyor_qiymeti} maya={data.alish_qiymeti} />
              <PricePill label="Endirim" value={data.endirimli_qiymet ?? 0} maya={data.alish_qiymeti} />
            </div>

            {/* Anbar bölgüsü — kompakt inline siyahı */}
            {data.anbarlar.length > 0 && (
              <div className="rounded-lg border border-border/40 bg-card/30 px-2.5 py-2">
                <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Anbar üzrə ({data.anbarlar.length})
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
                  {data.anbarlar.map((a) => (
                    <span key={a.anbar_id} className="inline-flex items-center gap-1">
                      <Package className="h-2.5 w-2.5 text-muted-foreground" />
                      <span>{a.anbar_ad}</span>
                      <span className={`tabular-nums font-semibold ${a.miqdar > 0 ? "" : "text-muted-foreground"}`}>
                        {formatNumber(a.miqdar, a.miqdar % 1 === 0 ? 0 : 2)}
                      </span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Son satış / Son alış — kompakt 2 sətir */}
            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              <RecentRow
                label="Son satış"
                tarix={data.son_satis?.tarix}
                kontragent={data.son_satis?.musteri ?? null}
                qiymet={data.son_satis?.qiymet ?? null}
                miqdar={data.son_satis?.miqdar ?? null}
                nomre={data.son_satis?.nomre ?? null}
              />
              <RecentRow
                label="Son alış"
                tarix={data.son_alis?.tarix}
                kontragent={data.son_alis?.techizatci ?? null}
                qiymet={data.son_alis?.qiymet ?? null}
                miqdar={data.son_alis?.miqdar ?? null}
                nomre={data.son_alis?.nomre ?? null}
              />
            </div>

            {/* Servis — yalnız xəbər var və ya aktiv olduqda; kompakt link forması */}
            {data.servis_sayi > 0 && (
              <div className="flex items-center gap-2 rounded-lg border border-border/40 bg-card/30 px-2.5 py-2 text-xs">
                <Wrench className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="font-semibold">Servis qeydi:</span>
                <span className="text-muted-foreground">
                  Cəm <strong className="text-foreground">{data.servis_sayi}</strong>
                  {data.servis_aktiv > 0 && (
                    <>
                      , aktiv <strong className="text-warning">{data.servis_aktiv}</strong>
                    </>
                  )}
                </span>
                <Link
                  href={`/servis?q=${encodeURIComponent(data.ad)}`}
                  className="ml-auto text-primary hover:underline"
                >
                  Bax →
                </Link>
              </div>
            )}
          </div>
        )}

        {!loading && !data && (
          <div className="py-8 text-center text-sm text-muted-foreground">Məhsul tapılmadı</div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Bağla</Button>
          <Link href={`/anbar/mehsullar/${mehsulId}`}>
            <Button className="font-semibold text-white" style={{ background: "var(--brand-gradient)" }}>
              Tam karta keç <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </DialogFooter>
      </DialogContent>

      {/* Image gallery dialog — multi-image lightbox */}
      {data?.sekil_url && (
        <Dialog open={imgOpen} onOpenChange={setImgOpen}>
          <DialogContent className="md:max-w-3xl">
            <DialogTitle className="sr-only">{data.ad}</DialogTitle>
            <ProductImageGallery sekilUrl={data.sekil_url} ad={data.ad} />
          </DialogContent>
        </Dialog>
      )}
    </Dialog>
  );
}

function StatCard({
  label, value, sub, tone,
}: { label: string; value: string; sub?: string; tone?: "success" | "danger" | "warning" | "primary" }) {
  const cls =
    tone === "success" ? "text-success" :
    tone === "danger"  ? "text-danger" :
    tone === "warning" ? "text-warning" :
    tone === "primary" ? "text-primary" : "";
  return (
    <div className="rounded-lg border border-border bg-secondary/30 px-3 py-2">
      <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`mt-1 text-lg font-bold tabular-nums ${cls}`}>{value}</div>
      {sub && <div className={`text-[10px] ${cls}`}>{sub}</div>}
    </div>
  );
}

/** Kompakt qiymət rozetka — qiymət + marja faiz */
function PricePill({ label, value, maya }: { label: string; value: number; maya: number }) {
  const m = value && maya ? ((value - maya) / maya) * 100 : null;
  const mCls = m == null ? "text-muted-foreground/60" : m < 0 ? "text-danger" : m < 10 ? "text-warning" : "text-success";
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-background px-2 py-0.5 text-[10.5px]">
      <span className="font-medium text-muted-foreground">{label}:</span>
      <span className="font-bold tabular-nums">{value > 0 ? formatMoney(value) : "—"}</span>
      {m != null && value > 0 && <span className={`tabular-nums ${mCls}`}>{m >= 0 ? "+" : ""}{m.toFixed(0)}%</span>}
    </span>
  );
}

function RecentRow({
  label, tarix, kontragent, qiymet, miqdar, nomre,
}: { label: string; tarix?: Date; kontragent: string | null; qiymet: number | null; miqdar: number | null; nomre: string | null }) {
  return (
    <div className="rounded-lg border border-border/40 bg-card/30 px-2.5 py-1.5">
      <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</div>
      {tarix ? (
        <>
          <div className="mt-0.5 text-xs">
            {formatDate(tarix)}
            {nomre && <span className="ml-1 font-mono text-[10px] text-muted-foreground">{nomre}</span>}
          </div>
          <div className="truncate text-xs font-medium" title={kontragent ?? ""}>{kontragent ?? "—"}</div>
          <div className="text-[10.5px] text-muted-foreground">
            {miqdar ?? "—"} əd × {qiymet != null ? formatMoney(qiymet) : "—"}
          </div>
        </>
      ) : (
        <div className="mt-0.5 text-[11px] italic text-muted-foreground">Heç vaxt</div>
      )}
    </div>
  );
}
