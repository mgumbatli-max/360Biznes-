"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import {
  Package, AlertTriangle, Lock, ShoppingBag, ShoppingCart,
  Tag, Calendar, Warehouse,
} from "lucide-react";
import { getProductContext, type ProductContext } from "../product-context-action";
import { formatMoney, formatDate } from "@/lib/utils";

/**
 * Universal məhsul kontekst paneli — istifadəçi məhsul seçdikdə dərhal
 * stok, qiymət, son alış/satış məlumatlarını göstərir.
 *
 * Yeni Satış, Yeni Alış, Transfer, Qaytarma, Servis formalarında istifadə olunur.
 *
 * Compact rejim: 1 sətirdə yığcam badge silsiləsi.
 * Full rejim: KPI grid + anbar paylaması + son hadisələr.
 */
export function ProductContextPanel({
  mehsulId,
  anbarId,
  compact = false,
  showCostHint = true,
}: {
  mehsulId: string;
  anbarId?: number;
  compact?: boolean;
  showCostHint?: boolean;
}) {
  const [data, setData] = useState<ProductContext | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!mehsulId) {
      setData(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    getProductContext({ mehsul_id: mehsulId, anbar_id: anbarId })
      .then((d) => { if (!cancelled) setData(d); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [mehsulId, anbarId]);

  if (!mehsulId) return null;
  if (loading && !data) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-card/40 p-2 text-center text-[11px] text-muted-foreground">
        Məhsul kontekstı yüklənir...
      </div>
    );
  }
  if (!data) return null;

  const isLowStock = data.toplam_stok <= data.kritik_stok;
  const isOutOfStock = data.satilabilen <= 0;

  if (compact) {
    const sel = data.selected_anbar;
    return (
      <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-border bg-card/40 p-2 text-[10.5px]">
        <span className="inline-flex items-center gap-1 font-mono text-muted-foreground">
          <Package className="h-2.5 w-2.5" />
          {data.kod ?? "—"}
        </span>
        {sel && (
          <span className={`inline-flex items-center gap-0.5 rounded-md border px-1.5 py-0.5 font-semibold ${
            sel.miqdar > data.kritik_stok ? "border-emerald-300 bg-emerald-50 text-emerald-700"
              : sel.miqdar > 0 ? "border-amber-300 bg-amber-50 text-amber-700"
              : "border-rose-300 bg-rose-50 text-rose-700"
          }`}>
            <Warehouse className="h-2.5 w-2.5" /> {sel.ad}: {sel.miqdar} {data.olcu_ad ?? ""}
          </span>
        )}
        <span className={`inline-flex items-center gap-0.5 rounded-md border px-1.5 py-0.5 font-semibold ${
          isOutOfStock ? "border-rose-300 bg-rose-50 text-rose-700"
            : isLowStock ? "border-amber-300 bg-amber-50 text-amber-700"
            : "border-emerald-300 bg-emerald-50 text-emerald-700"
        }`}>
          Cəmi: {data.toplam_stok}
        </span>
        {data.rezerv_miqdar > 0 && (
          <span className="inline-flex items-center gap-0.5 rounded-md border border-violet-300 bg-violet-50 px-1.5 py-0.5 text-violet-700">
            Rezerv: {data.rezerv_miqdar}
          </span>
        )}
        <span className="inline-flex items-center gap-0.5 rounded-md border border-sky-300 bg-sky-50 px-1.5 py-0.5 text-sky-700">
          Satıla bilər: <strong>{data.satilabilen}</strong>
        </span>
        <span className="ml-auto inline-flex items-center gap-0.5 rounded-md border border-border bg-background px-1.5 py-0.5 font-semibold tabular-nums">
          {formatMoney(data.satis_qiymeti)}
        </span>
      </div>
    );
  }

  // Full mode
  return (
    <div className="rounded-xl border border-border bg-card/40 p-3 space-y-2">
      {/* Header */}
      <div className="flex items-start gap-3">
        {data.sekil_url ? (
          <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-border bg-secondary">
            <Image src={data.sekil_url} alt={data.ad} fill sizes="56px" className="object-cover" unoptimized />
          </div>
        ) : (
          <div className="grid h-14 w-14 shrink-0 place-items-center rounded-lg bg-secondary text-muted-foreground">
            <Package className="h-6 w-6" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-sm truncate">{data.ad}</div>
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10.5px] text-muted-foreground">
            {data.kod && (
              <span className="inline-flex items-center gap-0.5 font-mono">
                <Tag className="h-2.5 w-2.5" /> {data.kod}
              </span>
            )}
            {data.barkod && <span className="font-mono">📊 {data.barkod}</span>}
            {data.marka_ad && <span>· {data.marka_ad}</span>}
            {data.kateqoriya_ad && <span>· {data.kateqoriya_ad}</span>}
            {data.olcu_ad && <span>· {data.olcu_ad}</span>}
            {!data.aktiv && (
              <span className="rounded-md border border-rose-300 bg-rose-50 px-1.5 py-0 text-rose-700">Qeyri-aktiv</span>
            )}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Satış qiyməti</div>
          <div className="text-lg font-bold tabular-nums">{formatMoney(data.satis_qiymeti)}</div>
        </div>
      </div>

      {/* Stok KPI */}
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
        {data.selected_anbar ? (
          <Stat
            icon={Warehouse}
            label={data.selected_anbar.ad}
            value={`${data.selected_anbar.miqdar} ${data.olcu_ad ?? ""}`}
            tone={data.selected_anbar.miqdar > data.kritik_stok ? "success" : data.selected_anbar.miqdar > 0 ? "warning" : "danger"}
          />
        ) : (
          <Stat icon={Warehouse} label="Cəmi stok" value={String(data.toplam_stok)} tone={isLowStock ? "warning" : "success"} />
        )}
        <Stat
          icon={Package}
          label="Bütün anbarlar"
          value={String(data.toplam_stok)}
          tone={isLowStock ? "warning" : "neutral"}
        />
        {data.rezerv_miqdar > 0 ? (
          <Stat icon={Lock} label="Rezervdə" value={String(data.rezerv_miqdar)} tone="violet" />
        ) : (
          <Stat icon={Lock} label="Rezerv" value="—" tone="neutral" />
        )}
        <Stat
          icon={ShoppingBag}
          label="Satıla bilər"
          value={String(data.satilabilen)}
          tone={isOutOfStock ? "danger" : isLowStock ? "warning" : "success"}
        />
      </div>

      {/* Qiymət strukturu */}
      <div className="flex flex-wrap items-center gap-1 text-[10.5px]">
        <span className="rounded-md border border-border bg-background/60 px-1.5 py-0.5">
          Satış: <strong className="tabular-nums">{formatMoney(data.satis_qiymeti)}</strong>
        </span>
        {data.endirimli_qiymet != null && data.endirimli_qiymet > 0 && data.endirimli_qiymet < data.satis_qiymeti && (
          <span className="rounded-md border border-emerald-300 bg-emerald-50 px-1.5 py-0.5 text-emerald-700">
            Endirimli: <strong className="tabular-nums">{formatMoney(data.endirimli_qiymet)}</strong>
          </span>
        )}
        {data.topdan_qiymet != null && data.topdan_qiymet > 0 && (
          <span className="rounded-md border border-sky-300 bg-sky-50 px-1.5 py-0.5 text-sky-700">
            Topdan: <strong className="tabular-nums">{formatMoney(data.topdan_qiymet)}</strong>
          </span>
        )}
        {data.can_view_cost && data.alish_qiymeti != null ? (
          <span className="rounded-md border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-amber-700">
            Maya: <strong className="tabular-nums">{formatMoney(data.alish_qiymeti)}</strong>
          </span>
        ) : showCostHint && !data.can_view_cost ? (
          <span className="rounded-md border border-border bg-background/60 px-1.5 py-0.5 text-muted-foreground">
            Maya: <Lock className="inline h-2.5 w-2.5" /> icazə yoxdur
          </span>
        ) : null}
        {data.zemanet_ay > 0 && (
          <span className="rounded-md border border-violet-300 bg-violet-50 px-1.5 py-0.5 text-violet-700">
            Zəmanət: {data.zemanet_ay} ay
          </span>
        )}
      </div>

      {/* Anbar paylaması (yalnız çoxlu anbar varsa) */}
      {data.anbarlar.length > 1 && (
        <div className="text-[10.5px]">
          <div className="mb-1 text-muted-foreground">Anbar paylaması:</div>
          <div className="flex flex-wrap gap-1">
            {data.anbarlar.map((a) => (
              <span
                key={a.anbar_id}
                className={`inline-flex items-center gap-0.5 rounded-md border px-1.5 py-0.5 ${
                  a.miqdar > 0
                    ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                    : "border-border bg-background/60 text-muted-foreground"
                }`}
              >
                <Warehouse className="h-2.5 w-2.5" />
                {a.anbar_ad}: <strong>{a.miqdar}</strong>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Son hadisələr */}
      <div className="grid grid-cols-1 gap-1 text-[10.5px] sm:grid-cols-2">
        {data.son_satis && (
          <div className="flex items-center justify-between rounded-md border border-border bg-background/60 px-2 py-1">
            <span className="inline-flex items-center gap-1 text-muted-foreground">
              <ShoppingBag className="h-3 w-3" /> Son satış
              <Calendar className="h-2.5 w-2.5 ml-1" /> {formatDate(data.son_satis.tarix)}
            </span>
            <span className="font-semibold tabular-nums">{formatMoney(data.son_satis.qiymet)}</span>
          </div>
        )}
        {data.son_alish && (
          <div className="flex items-center justify-between rounded-md border border-border bg-background/60 px-2 py-1">
            <span className="inline-flex items-center gap-1 text-muted-foreground">
              <ShoppingCart className="h-3 w-3" /> Son alış
              <Calendar className="h-2.5 w-2.5 ml-1" /> {formatDate(data.son_alish.tarix)}
            </span>
            <span className="font-semibold tabular-nums">{formatMoney(data.son_alish.qiymet)}</span>
          </div>
        )}
      </div>

      {/* Warnings */}
      {(isLowStock || isOutOfStock) && (
        <div className={`flex items-center gap-1.5 rounded-md border px-2 py-1 text-[10.5px] ${
          isOutOfStock
            ? "border-rose-300 bg-rose-50 text-rose-700"
            : "border-amber-300 bg-amber-50 text-amber-700"
        }`}>
          <AlertTriangle className="h-3 w-3" />
          {isOutOfStock ? "Stok bitib — satışa əlavə edilə bilməz" : `Kritik stok altındadır (limit: ${data.kritik_stok})`}
        </div>
      )}
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  tone?: "neutral" | "success" | "danger" | "warning" | "violet";
}) {
  const cls =
    tone === "success" ? "text-emerald-700" :
    tone === "danger" ? "text-rose-700" :
    tone === "warning" ? "text-amber-700" :
    tone === "violet" ? "text-violet-700" :
    "text-foreground";
  return (
    <div className="rounded-md border border-border bg-background/40 px-2 py-1.5">
      <div className="flex items-center gap-1 text-[9.5px] uppercase tracking-wider text-muted-foreground">
        <Icon className="h-2.5 w-2.5" />
        {label}
      </div>
      <div className={`mt-0.5 text-sm font-bold tabular-nums ${cls}`}>{value}</div>
    </div>
  );
}

