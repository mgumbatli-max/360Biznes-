"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Building2, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { FilialDialog } from "./filial-dialog";

type Filial = {
  id: number;
  ad: string;
  seh_r: string | null;
  aktiv: boolean | null;
  izole: boolean;
  tip: string | null;
  _count: { anbarlar: number; istifadeci_filial: number; kassalar: number };
};

type CavabdehOpt = { id: string; ad_soyad: string; email: string };

export function FilialList({
  filiallar,
  selectedId,
  cavabdehOptions = [],
}: {
  filiallar: Filial[];
  selectedId: number | null;
  cavabdehOptions?: CavabdehOpt[];
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    if (!query.trim()) return filiallar;
    const q = query.toLowerCase();
    return filiallar.filter((f) => f.ad.toLowerCase().includes(q) || f.seh_r?.toLowerCase().includes(q));
  }, [filiallar, query]);

  const select = (id: number) => {
    const params = new URLSearchParams(sp.toString());
    params.set("selected", String(id));
    router.replace(`?${params.toString()}`, { scroll: false });
  };

  return (
    <aside className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">Filiallar</h2>
        <FilialDialog cavabdehOptions={cavabdehOptions} />
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Axtar..."
          className="pl-8 text-sm"
        />
      </div>

      <div className="space-y-1.5">
        {filtered.map((f) => {
          const active = f.id === selectedId;
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => select(f.id)}
              className={cn(
                "flex w-full items-start gap-2 rounded-lg border px-2.5 py-2 text-left transition",
                active
                  ? "border-primary/40 bg-primary/5"
                  : "border-border/40 hover:border-border hover:bg-secondary/40",
                !f.aktiv && "opacity-60"
              )}
            >
              <div
                className={cn(
                  "grid h-7 w-7 shrink-0 place-items-center rounded-md text-white",
                  active ? "bg-primary" : "bg-muted-foreground/60"
                )}
              >
                <Building2 className="h-3.5 w-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-sm font-semibold">{f.ad}</span>
                  {f.izole && <span className="text-[9px] font-semibold text-rose-500">izolə</span>}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {f.tip ?? "mağaza"} · {f.seh_r ?? "—"} · {f._count.istifadeci_filial} ist · {f._count.kassalar} kassa
                </div>
              </div>
            </button>
          );
        })}
        {filtered.length === 0 && (
          <div className="rounded-lg border border-dashed border-border py-8 text-center text-xs text-muted-foreground">
            {query ? "Tapılmadı" : "Filial yoxdur"}
          </div>
        )}
      </div>
    </aside>
  );
}
