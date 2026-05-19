import Link from "next/link";
import { AlertTriangle, ShoppingCart, Package, ClipboardCheck } from "lucide-react";
import { formatNumber } from "@/lib/utils";
import type { AttentionProduct } from "../attention-queries";

/**
 * Shared compact widget — "Diqqət lazımdır" / "Aşağı stok".
 * Behaviour driven by `mode`:
 *   - "ticaret" : shows ⚠ icon + "Satınalma sifariş yarat" CTA → /satinalma
 *   - "anbar"   : shows 📦 icon + "Sayım yarat" CTA → /anbar/inventar
 */
export function AttentionWidget({
  items,
  mode,
}: {
  items: AttentionProduct[];
  mode: "ticaret" | "anbar";
}) {
  const titleText = mode === "ticaret" ? "Diqqət lazımdır" : "Aşağı stok";
  const subText =
    mode === "ticaret"
      ? "Bugün satışı oldu, stoku azalır — satınalma yaratmaq vaxtıdır"
      : "Cari stok minimum altında düşüb — sayım və ya satınalma";
  const Icon = mode === "ticaret" ? AlertTriangle : Package;
  const tone = mode === "ticaret" ? "text-warning" : "text-danger";
  const ctaHref = mode === "ticaret" ? "/anbar/satinalma" : "/anbar/inventar";
  const ctaLabel = mode === "ticaret" ? "Satınalma yarat" : "Sayım yarat";
  const CtaIcon = mode === "ticaret" ? ShoppingCart : ClipboardCheck;

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h4 className="flex items-center gap-1.5 text-sm font-semibold tracking-tight">
            <Icon className={`h-3.5 w-3.5 ${tone}`} />
            {titleText}
          </h4>
          <p className="mt-0.5 text-[11px] text-muted-foreground">{subText}</p>
        </div>
        <span className={`text-xl font-semibold tabular-nums ${tone}`}>{items.length}</span>
      </div>
      {items.length === 0 ? (
        <div className="rounded-md border border-dashed border-border/40 py-4 text-center text-[11px] text-muted-foreground">
          Hər şey qaydasındadır.
        </div>
      ) : (
        <ul className="space-y-0">
          {items.map((p) => {
            const def = p.min_stok - p.current_stok;
            return (
              <li
                key={p.mehsul_id}
                className="flex items-center justify-between gap-2 border-b border-border/40 py-2 last:border-0"
              >
                <Link
                  href={`/anbar/mehsullar/${p.mehsul_id}`}
                  className="min-w-0 flex-1 truncate text-sm font-medium hover:text-primary-light"
                  title={p.ad}
                >
                  {p.ad}
                  {p.kod && (
                    <small className="ml-1 text-muted-foreground font-mono text-[10px]">
                      {p.kod}
                    </small>
                  )}
                  <small className="ml-2 text-[10.5px] text-muted-foreground">
                    {formatNumber(p.current_stok, 1)} / min {formatNumber(p.min_stok, 1)}
                    {mode === "ticaret" && p.son_satis_say > 0 && (
                      <> · bugün {p.son_satis_say} satış</>
                    )}
                  </small>
                </Link>
                <span className="text-xs font-semibold tabular-nums text-warning">
                  −{formatNumber(def, 1)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
      <Link
        href={ctaHref}
        className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
      >
        <CtaIcon className="h-3.5 w-3.5" /> {ctaLabel}
      </Link>
    </div>
  );
}
