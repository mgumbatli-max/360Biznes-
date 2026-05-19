"use client";

import Link from "next/link";
import { Tag, Package, ExternalLink } from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";
import { CopyButton } from "@/components/ui/copy-button";
import { BrandDialog } from "./brand-dialog";

type Brand = {
  id: number;
  ad: string;
  qeyd: string | null;
  aktiv: boolean;
  logo_url: string | null;
  mehsul_sayi: number;
};

export function BrandList({ brands }: { brands: Brand[] }) {
  // Qeyd sütununu yalnız ən azı bir markada qeyd olduqda göstər
  const hasAnyQeyd = brands.some((b) => b.qeyd && b.qeyd.trim().length > 0);
  return (
    <div className="rounded-xl border border-border bg-card/40 overflow-hidden">
      <div className="overflow-x-auto" data-table-scroll>
        <table className="w-full text-sm" data-sticky-head>
          <thead className="border-b border-border/40 text-left text-[10px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Marka</th>
              {hasAnyQeyd && <th className="px-3 py-2">Qeyd</th>}
              <th className="px-3 py-2 text-right">Məhsul</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2 text-right w-24">Əməl</th>
            </tr>
          </thead>
          <tbody>
            {brands.map((b) => (
              <tr key={b.id} className={`border-b border-border/20 hover:bg-secondary/30 ${!b.aktiv && "opacity-60"}`}>
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    {b.logo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={b.logo_url} alt={b.ad} className="h-8 w-8 rounded-lg object-cover" />
                    ) : (
                      <div className="grid h-8 w-8 place-items-center rounded-lg bg-secondary text-muted-foreground">
                        <Tag className="h-3.5 w-3.5" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="flex items-center gap-1">
                        <span className="truncate font-semibold">{b.ad}</span>
                        <CopyButton value={b.ad} title="Adı kopya et" size="xs" />
                      </div>
                    </div>
                  </div>
                </td>
                {hasAnyQeyd && (
                  <td className="px-3 py-2.5 text-xs text-muted-foreground">
                    <div className="line-clamp-1 max-w-md">{b.qeyd ?? "—"}</div>
                  </td>
                )}
                <td className="px-3 py-2.5 text-right">
                  <Link
                    href={`/anbar/mehsullar?marka=${b.id}`}
                    className={`inline-flex items-center gap-1 text-xs hover:text-primary ${b.mehsul_sayi === 0 ? "text-muted-foreground/60" : ""}`}
                    title={b.mehsul_sayi === 0 ? "Hələ məhsul yoxdur" : "Bu markanın məhsullarını gör"}
                  >
                    <Package className="h-3 w-3" />
                    <span className="tabular-nums font-semibold">{b.mehsul_sayi}</span>
                  </Link>
                </td>
                <td className="px-3 py-2.5">
                  <StatusBadge tone={b.aktiv ? "success" : "neutral"} size="sm" variant="dot">
                    {b.aktiv ? "Aktiv" : "Passiv"}
                  </StatusBadge>
                </td>
                <td className="px-3 py-2.5 text-right">
                  <div className="inline-flex items-center gap-0.5">
                    <Link
                      href={`/anbar/mehsullar?marka=${b.id}`}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground"
                      title="Məhsulları gör"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Link>
                    <BrandDialog
                      initial={{ id: b.id, ad: b.ad, qeyd: b.qeyd ?? null, aktiv: b.aktiv, logo_url: b.logo_url }}
                      trigger="edit"
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
