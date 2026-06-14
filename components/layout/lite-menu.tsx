"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import {
  LayoutDashboard,
  ScanLine,
  Sparkles,
  ShoppingCart,
  Package,
  Wallet,
  Users,
  Wrench,
  UserCog,
  ListTodo,
  Megaphone,
  BarChart3,
  ShieldAlert,
  Settings,
  MessagesSquare,
  Contact2,
  Store,
  FlaskConical,
  Crown,
  ShieldCheck,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useLiteMenu } from "@/stores/lite-menu";

/**
 * Lite mobil menyu — yan drawer ƏVƏZİNƏ tam-ekran sadə modul grid-i.
 * Böyük toxunuş kartları (2 sütun), AI ən yuxarıda qabarıq. Yalnız mobil.
 */

type Tile = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  tone?: string; // tailwind bg
  external?: boolean;
};

const TILES: Tile[] = [
  { href: "/dashboard", label: "Əsas səhifə", icon: LayoutDashboard, tone: "bg-blue-500/12 text-blue-600" },
  { href: "/pos", label: "POS Satış", icon: ScanLine, tone: "bg-rose-500/12 text-rose-600", external: true },
  { href: "/ticaret", label: "Ticarət", icon: ShoppingCart, tone: "bg-emerald-500/12 text-emerald-600" },
  { href: "/anbar", label: "Anbar", icon: Package, tone: "bg-amber-500/12 text-amber-600" },
  { href: "/maliyye", label: "Maliyyə", icon: Wallet, tone: "bg-violet-500/12 text-violet-600" },
  { href: "/elaqe", label: "Əlaqələr", icon: Users, tone: "bg-cyan-500/12 text-cyan-600" },
  { href: "/servis", label: "Servis", icon: Wrench, tone: "bg-orange-500/12 text-orange-600" },
  { href: "/iscilier", label: "Əməkdaşlar", icon: UserCog, tone: "bg-teal-500/12 text-teal-600" },
  { href: "/tapshiriqlar", label: "Tapşırıqlar", icon: ListTodo, tone: "bg-indigo-500/12 text-indigo-600" },
  { href: "/team", label: "Team / Söhbət", icon: MessagesSquare, tone: "bg-indigo-500/12 text-indigo-600" },
  { href: "/crm", label: "CRM / Mesaj", icon: Contact2, tone: "bg-sky-500/12 text-sky-600" },
  { href: "/kampaniyalar", label: "Kampaniyalar", icon: Megaphone, tone: "bg-pink-500/12 text-pink-600" },
  { href: "/marketplace", label: "Marketplace", icon: Store, tone: "bg-slate-500/12 text-slate-600" },
  { href: "/360-lab", label: "360 LAB", icon: FlaskConical, tone: "bg-fuchsia-500/12 text-fuchsia-600" },
  { href: "/hesabatlar", label: "Hesabatlar", icon: BarChart3, tone: "bg-sky-500/12 text-sky-600" },
  { href: "/nezaret-merkezi", label: "Nəzarət Mərkəzi", icon: ShieldAlert, tone: "bg-red-500/12 text-red-600" },
  { href: "/sahibkar", label: "Sahibkar", icon: Crown, tone: "bg-amber-500/12 text-amber-600" },
  { href: "/ayarlar", label: "Ayarlar", icon: Settings, tone: "bg-slate-500/12 text-slate-600" },
];

/** Yalnız super-admin görür — bütün platformanın baza admini. */
const PLATFORM_TILE: Tile = {
  href: "/platform-admin",
  label: "Platform Admin",
  icon: ShieldCheck,
  tone: "bg-primary/12 text-primary",
};

export function LiteMenu({ isSuperAdmin = false }: { isSuperAdmin?: boolean }) {
  const open = useLiteMenu((s) => s.open);
  const setOpen = useLiteMenu((s) => s.setOpen);
  const hiddenModules = useLiteMenu((s) => s.hiddenModules);
  const pathname = usePathname();
  const tiles = isSuperAdmin ? [...TILES, PLATFORM_TILE] : TILES;

  // Naviqasiya baş verəndə bağla
  useEffect(() => {
    setOpen(false);
  }, [pathname, setOpen]);

  // Açıq olanda arxa plan scroll-unu dondur
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-background md:hidden animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-label="Modullar menyusu"
    >
      {/* Başlıq */}
      <div className="flex items-center justify-between border-b border-border/60 px-4 pt-safe">
        <h2 className="py-4 text-lg font-bold tracking-tight">Modullar</h2>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Bağla"
          className="grid h-11 w-11 place-items-center rounded-full text-muted-foreground active:bg-secondary"
        >
          <X className="h-6 w-6" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 pb-safe-16">
        {/* AI — ən üstdə, tam en, qabarıq */}
        <Link
          href="/komekci?tab=biznes"
          onClick={() => setOpen(false)}
          className="mb-4 flex items-center gap-3 rounded-2xl p-4 text-white shadow-lg active:scale-[0.98] transition-transform"
          style={{ background: "var(--brand-gradient)" }}
        >
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-white/20">
            <Sparkles className="h-6 w-6" />
          </span>
          <span className="min-w-0">
            <span className="block text-base font-bold leading-tight">Süni İntellekt</span>
            <span className="block text-xs text-white/85">
              Soruş, hesabat al, satış yarat — hər şey burada
            </span>
          </span>
        </Link>

        {/* Modul grid — 2 sütun, böyük kartlar (Lite-da gizli modullar çıxarılır) */}
        <div className="grid grid-cols-2 gap-3">
          {tiles.filter((t) => !hiddenModules.includes(t.href.split("/")[1] ?? "")).map((t) => {
            const Icon = t.icon;
            return (
              <Link
                key={t.href}
                href={t.href}
                target={t.external ? "_blank" : undefined}
                rel={t.external ? "noopener" : undefined}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex min-h-[92px] flex-col items-start justify-between rounded-2xl border border-border/50 bg-card p-3.5",
                  "shadow-sm active:scale-[0.97] transition-transform",
                )}
              >
                <span className={cn("grid h-10 w-10 place-items-center rounded-xl", t.tone)}>
                  <Icon className="h-5 w-5" />
                </span>
                <span className="text-[13px] font-semibold leading-tight">{t.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
