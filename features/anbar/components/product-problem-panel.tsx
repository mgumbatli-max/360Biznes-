"use client";

import Link from "next/link";
import {
  Package, PackageX, AlertTriangle, AlertCircle, Bookmark,
  Image as ImageIcon, DollarSign, Barcode, FolderX, Copy, Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ProductProblemStats } from "../problem-stats-queries";

/**
 * Məhsul siyahısının yuxarısında "Sürətli stok/problem filterləri".
 * Hər kart bir filter — klik etdikdə URL parametrini dəyişərək siyahını filtrə salır.
 */

type Props = {
  stats: ProductProblemStats;
  baseUrl?: string; // default "/anbar/mehsullar"
};

type Card = {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  tone: "neutral" | "success" | "warning" | "danger" | "info";
  highlightWhenZero?: boolean;
};

const TONE: Record<Card["tone"], string> = {
  neutral: "border-border/60 hover:border-border bg-card/40 text-foreground",
  success: "border-emerald-500/30 hover:border-emerald-500/50 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400",
  warning: "border-amber-500/30 hover:border-amber-500/50 bg-amber-500/5 text-amber-700 dark:text-amber-400",
  danger:  "border-rose-500/30 hover:border-rose-500/50 bg-rose-500/5 text-rose-700 dark:text-rose-400",
  info:    "border-sky-500/30 hover:border-sky-500/50 bg-sky-500/5 text-sky-700 dark:text-sky-400",
};

export function ProductProblemPanel({ stats, baseUrl = "/anbar/mehsullar" }: Props) {
  const cards: Card[] = [
    { label: "Stokda var",        value: stats.stokda_var,    icon: Package,       href: `${baseUrl}?stok_status=var`,     tone: "success", highlightWhenZero: false },
    { label: "Stoksuz",           value: stats.stoksuz,       icon: PackageX,      href: `${baseUrl}?stok_status=yox`,     tone: "danger" },
    { label: "Az qalıb",          value: stats.az_qalib,      icon: AlertTriangle, href: `${baseUrl}?stok_status=az`,      tone: "warning" },
    { label: "Kritik altı",       value: stats.kritik,        icon: AlertCircle,   href: `${baseUrl}?stok_status=az&stok_status=yox`, tone: "danger" },
    { label: "Rezervdə",          value: stats.rezervde,      icon: Bookmark,      href: `${baseUrl}?stok_status=var&rezerv=1`, tone: "info" },
    { label: "Şəkilsiz",          value: stats.sekilsiz,      icon: ImageIcon,     href: `${baseUrl}?sekil=false`,         tone: "warning" },
    { label: "Qiymətsiz",         value: stats.qiymetsiz,     icon: DollarSign,    href: `${baseUrl}?qmax=0`,              tone: "warning" },
    { label: "Barkodsuz",         value: stats.barkodsuz,     icon: Barcode,       href: `${baseUrl}?barkod=false`,        tone: "warning" },
    { label: "Kateqoriyasız",     value: stats.kateqoriyasiz, icon: FolderX,       href: "/anbar/hesabat/problem?tip=kateqoriyasiz", tone: "neutral" },
    { label: "Dublikat barkod",   value: stats.dublikat_barkod, icon: Copy,        href: "/anbar/hesabat/problem?tip=dublikat_barkod", tone: "danger" },
    { label: "Yatmış 90+ gün",    value: stats.yatmis_90,     icon: Clock,         href: "/anbar/hesabat/problem?tip=satilmayan_60", tone: "warning" },
  ];

  // Chip-stilli kompakt sıra — yorucu olmasın deyə.
  // Yalnız dəyəri 0-dan böyük chip-lər vurğulanır; 0 olan-lar silinmir, lakin
  // soluq görünür ki, problem listi natamam görünməsin.
  return (
    <div className="rounded-xl border border-border bg-card/30 p-2.5">
      <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        <span>Sürətli filter</span>
        <span className="text-muted-foreground/60">·</span>
        <span className="text-muted-foreground/60">Klik et</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {cards.map((c) => {
          const Icon = c.icon;
          const isDimmed = c.value === 0 && c.highlightWhenZero !== false;
          return (
            <Link
              key={c.label}
              href={c.href}
              className={cn(
                "group inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 transition-all",
                "hover:scale-105 hover:shadow-sm",
                TONE[c.tone],
                isDimmed && "opacity-40 hover:opacity-90",
              )}
            >
              <Icon className="h-3 w-3 shrink-0" />
              <span className="text-[10.5px] font-medium">{c.label}</span>
              <span
                className={cn(
                  "ml-0.5 rounded-full px-1.5 py-0 text-[10px] font-bold tabular-nums",
                  c.value > 0 ? "bg-current/10" : "",
                )}
              >
                {c.value}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
