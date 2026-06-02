"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  Plus,
  X,
  ShoppingCart,
  Package,
  Users,
  CheckSquare,
  Wallet,
  MessageSquare,
  FileText,
  Wrench,
  Command,
  GraduationCap,
} from "lucide-react";
import { cn } from "@/lib/utils";

const ACTIONS = [
  { href: "/ticaret/satis-yeni", label: "Yeni satış", icon: ShoppingCart, color: "bg-emerald-500 hover:bg-emerald-600" },
  { href: "/anbar/mehsullar", label: "Yeni məhsul", icon: Package, color: "bg-indigo-500 hover:bg-indigo-600" },
  { href: "/elaqe?tab=musteri", label: "Yeni müştəri", icon: Users, color: "bg-sky-500 hover:bg-sky-600" },
  { href: "/tapshiriqlar", label: "Yeni tapşırıq", icon: CheckSquare, color: "bg-violet-500 hover:bg-violet-600" },
  { href: "/maliyye", label: "Maliyyə əməliyyatı", icon: Wallet, color: "bg-amber-500 hover:bg-amber-600" },
  { href: "/team", label: "Söhbət", icon: MessageSquare, color: "bg-rose-500 hover:bg-rose-600" },
  { href: "/satinalma", label: "Satınalma təklifi", icon: FileText, color: "bg-fuchsia-500 hover:bg-fuchsia-600" },
  { href: "/servis", label: "Servis sifarişi", icon: Wrench, color: "bg-teal-500 hover:bg-teal-600" },
];

export function QuickActionsFab() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  // Close on Escape / click outside
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    function onClick(e: MouseEvent) {
      if (!open) return;
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  return (
    <div ref={ref} className="fixed bottom-[calc(env(safe-area-inset-bottom)+4.5rem)] right-4 z-40 md:bottom-6 md:right-6 print:hidden">
      {open && (
        <div className="mb-3 flex flex-col items-end gap-2 animate-fade-up">
          {ACTIONS.map((a) => {
            const Icon = a.icon;
            return (
              <Link
                key={a.href}
                href={a.href}
                onClick={() => setOpen(false)}
                className="group flex items-center gap-2"
              >
                <span className="rounded-md bg-card/95 px-3 py-1.5 text-xs font-semibold shadow-md backdrop-blur transition group-hover:scale-105">
                  {a.label}
                </span>
                <span
                  className={cn(
                    "grid h-11 w-11 place-items-center rounded-full text-white shadow-lg transition group-hover:scale-110",
                    a.color
                  )}
                >
                  <Icon className="h-5 w-5" />
                </span>
              </Link>
            );
          })}
          <Link
            href="#"
            onClick={(e) => {
              e.preventDefault();
              setOpen(false);
              // Trigger command palette
              const ev = new KeyboardEvent("keydown", { key: "k", metaKey: true });
              document.dispatchEvent(ev);
            }}
            className="group flex items-center gap-2"
          >
            <span className="rounded-md bg-card/95 px-3 py-1.5 text-xs font-semibold shadow-md backdrop-blur">
              Komanda palet ⌘K
            </span>
            <span className="grid h-11 w-11 place-items-center rounded-full bg-gradient-to-br from-primary to-accent text-white shadow-lg transition group-hover:scale-110">
              <Command className="h-5 w-5" />
            </span>
          </Link>

          {/* Ayırıcı + ERP öyrətmə — özəl bölmə, separator ilə vurğulanır */}
          <div className="flex w-full items-center justify-end gap-2 py-1 pr-12">
            <span className="h-px flex-1 max-w-[120px] bg-gradient-to-r from-transparent to-border" />
            <span className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground/70">
              öyrən
            </span>
            <span className="h-px w-3 bg-border" />
          </div>

          <Link
            href="/komekci"
            onClick={() => setOpen(false)}
            className="group flex items-center gap-2"
          >
            <span className="rounded-md bg-card/95 px-3 py-1.5 text-xs font-semibold shadow-md backdrop-blur transition group-hover:scale-105">
              <span className="bg-gradient-to-r from-amber-500 to-orange-500 bg-clip-text text-transparent">
                ERP öyrətmə
              </span>
              <span className="ml-1 text-[10px] text-muted-foreground">— addım-addım bələdçi</span>
            </span>
            <span className="relative grid h-11 w-11 place-items-center rounded-full bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-lg transition group-hover:scale-110">
              <GraduationCap className="h-5 w-5" />
              <span className="absolute -right-0.5 -top-0.5 grid h-3.5 w-3.5 place-items-center rounded-full bg-emerald-500 text-[8px] font-bold text-white ring-2 ring-background">
                ?
              </span>
            </span>
          </Link>
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-label={open ? "Bağla" : "Sürətli əməliyyatlar"}
        className={cn(
          "grid h-14 w-14 place-items-center rounded-full text-white shadow-xl transition-all",
          open
            ? "bg-rose-500 rotate-45 hover:bg-rose-600"
            : "bg-gradient-to-br from-primary to-accent hover:scale-110"
        )}
        style={!open ? { boxShadow: "0 8px 24px -4px hsl(var(--primary) / 0.5)" } : undefined}
      >
        {open ? <X className="h-6 w-6" /> : <Plus className="h-6 w-6" />}
      </button>
    </div>
  );
}
