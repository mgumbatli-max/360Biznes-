"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Combobox, type ComboOption } from "@/components/ui/combobox";

const STATUS_OPTIONS: ComboOption[] = [
  { value: "az", label: "Yalnız az stok" },
  { value: "ok", label: "Normal qalıq" },
];

export function StokFilters({ anbarlar }: { anbarlar: Array<{ id: number; ad: string }> }) {
  const router = useRouter();
  const sp = useSearchParams();
  const [pending, startTransition] = useTransition();

  const [q, setQ] = useState(sp.get("q") ?? "");
  const [anbar, setAnbar] = useState(sp.get("anbar") ?? "");
  const [status, setStatus] = useState(sp.get("status") ?? "");

  function apply(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (anbar) params.set("anbar", anbar);
    if (status) params.set("status", status);
    startTransition(() => router.push(`/anbar/stok?${params.toString()}`));
  }

  return (
    <form onSubmit={apply} className="grid grid-cols-1 gap-3 border-b border-border/40 p-4 md:grid-cols-[2fr_1fr_1fr_auto]">
      <div>
        <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Axtarış</label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Məhsul, kod, barkod, marka..."
            disabled={pending}
            className="h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm"
          />
        </div>
      </div>
      <div>
        <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Anbar</label>
        <Combobox
          options={anbarlar.map<ComboOption>((a) => ({ value: String(a.id), label: a.ad }))}
          value={anbar}
          onChange={setAnbar}
          placeholder="Bütün anbarlar"
          searchPlaceholder="🔍 Anbar axtar..."
          emptyText="Anbar tapılmadı"
          disabled={pending}
        />
      </div>
      <div>
        <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Vəziyyət</label>
        <Combobox
          options={STATUS_OPTIONS}
          value={status}
          onChange={setStatus}
          placeholder="Hamısı"
          searchPlaceholder="🔍 Vəziyyət..."
          emptyText="Tapılmadı"
          disabled={pending}
        />
      </div>
      <div className="flex items-end">
        <Button type="submit" disabled={pending} className="h-9 px-4 font-semibold">
          Filtrə
        </Button>
      </div>
    </form>
  );
}
