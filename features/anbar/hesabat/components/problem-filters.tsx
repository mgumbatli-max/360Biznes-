"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Combobox, type ComboOption } from "@/components/ui/combobox";

type Props = {
  mod: string;
  categories: Array<{ id: number; ad: string }>;
  brands: Array<{ id: number; ad: string }>;
};

const SORT_OPTIONS: ComboOption[] = [
  { value: "ad",         label: "Ad A→Z" },
  { value: "stok_az",    label: "Stok (az)" },
  { value: "stok_cox",   label: "Stok (çox)" },
  { value: "maya_cox",   label: "Maya (çox)" },
];

export function ProblemFilters({ mod, categories, brands }: Props) {
  const router = useRouter();
  const sp = useSearchParams();
  const [pending, startTransition] = useTransition();

  const [q, setQ] = useState(sp.get("q") ?? "");
  const [kateq, setKateq] = useState(sp.get("kateq") ?? "");
  const [marka, setMarka] = useState(sp.get("marka") ?? "");
  const [sirala, setSirala] = useState(sp.get("sirala") ?? "");

  function apply(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    params.set("mod", mod);
    if (q.trim()) params.set("q", q.trim());
    if (kateq) params.set("kateq", kateq);
    if (marka) params.set("marka", marka);
    if (sirala) params.set("sirala", sirala);
    startTransition(() => router.push(`/anbar/hesabat?${params.toString()}`));
  }

  function reset() {
    setQ(""); setKateq(""); setMarka(""); setSirala("");
    startTransition(() => router.push(`/anbar/hesabat?mod=${mod}`));
  }

  const hasFilters = !!(q || kateq || marka || sirala);

  return (
    <form onSubmit={apply} className="grid grid-cols-1 gap-2 rounded-xl border border-border bg-card/40 p-3 md:grid-cols-[1.6fr_200px_200px_180px_auto]">
      <div>
        <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Axtarış</label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Ad, kod, barkod, marka, kateqoriya..."
            disabled={pending}
            className="h-9 w-full rounded-md border border-input bg-background pl-8 pr-3 text-sm"
          />
        </div>
      </div>
      <div>
        <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Kateqoriya</label>
        <Combobox
          options={categories.map<ComboOption>((c) => ({ value: String(c.id), label: c.ad }))}
          value={kateq}
          onChange={setKateq}
          placeholder="Hamısı"
          searchPlaceholder="🔍 Kateqoriya axtar..."
          emptyText="Tapılmadı"
          disabled={pending}
        />
      </div>
      <div>
        <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Marka</label>
        <Combobox
          options={brands.map<ComboOption>((b) => ({ value: String(b.id), label: b.ad }))}
          value={marka}
          onChange={setMarka}
          placeholder="Hamısı"
          searchPlaceholder="🔍 Marka axtar..."
          emptyText="Tapılmadı"
          disabled={pending}
        />
      </div>
      <div>
        <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Sıralama</label>
        <Combobox
          options={SORT_OPTIONS}
          value={sirala}
          onChange={setSirala}
          placeholder="Varsayılan"
          searchPlaceholder="🔍 Sıralama..."
          emptyText="Tapılmadı"
          disabled={pending}
        />
      </div>
      <div className="flex items-end gap-1">
        <Button type="submit" size="sm" disabled={pending} className="h-9 font-semibold">Tətbiq et</Button>
        {hasFilters && (
          <Button type="button" size="sm" variant="ghost" onClick={reset} disabled={pending} title="Sıfırla">
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </form>
  );
}
