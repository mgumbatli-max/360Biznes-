"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Search } from "lucide-react";

// cmdk + Dialog + 300+ satırlıq palet UI yalnız ⌘K basıldıqda yüklənir.
// Trigger özü kiçik qalır → topbar bundle 30-40 KB azalır.
const CommandPaletteBody = dynamic(() => import("./command-palette-body"), {
  ssr: false,
});

export function CommandPaletteTrigger({ hiddenModules, isSuperAdmin }: { hiddenModules?: string[]; isSuperAdmin?: boolean } = {}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setMounted(true);
        setOpen((o) => !o);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setMounted(true);
          setOpen(true);
        }}
        className="hidden h-9 min-w-[220px] items-center gap-2 rounded-md border border-border/60 bg-secondary/40 px-3 text-xs text-muted-foreground transition hover:bg-secondary md:inline-flex lg:min-w-[300px]"
        aria-label="Hər şey axtar"
      >
        <Search className="h-3.5 w-3.5" />
        <span className="flex-1 text-left">Hər şey axtar…</span>
        <kbd className="hidden rounded border border-border/60 bg-card/80 px-1.5 py-0.5 font-mono text-[10px] font-medium lg:inline">
          ⌘K
        </kbd>
      </button>

      <button
        type="button"
        onClick={() => {
          setMounted(true);
          setOpen(true);
        }}
        className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground md:hidden"
        aria-label="Axtarış"
      >
        <Search className="h-4 w-4" />
      </button>

      {mounted && (
        <CommandPaletteBody open={open} onOpenChange={setOpen} hiddenModules={hiddenModules} isSuperAdmin={isSuperAdmin} />
      )}
    </>
  );
}
