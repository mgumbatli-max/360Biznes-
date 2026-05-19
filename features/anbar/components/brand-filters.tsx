"use client";

import { useCallback, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function BrandFilters() {
  const router = useRouter();
  const sp = useSearchParams();
  const [pending, startTransition] = useTransition();

  const search = sp.get("q") ?? "";
  const aktiv = sp.get("aktiv") ?? "aktiv";
  const logo = sp.get("logo") ?? "";
  const has = sp.get("has") ?? "";
  const sirala = sp.get("sirala") ?? "ad";

  const update = useCallback(
    (mutate: (p: URLSearchParams) => void) => {
      const params = new URLSearchParams(sp.toString());
      mutate(params);
      startTransition(() => router.push(`/anbar/markalar?${params.toString()}`));
    },
    [sp, router]
  );

  function setP(name: string, value: string, defaultVal?: string) {
    update((p) => {
      if (value && value !== defaultVal) p.set(name, value);
      else p.delete(name);
    });
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    update((p) => {
      const q = String(fd.get("q") ?? "").trim();
      if (q) p.set("q", q); else p.delete("q");
    });
  }

  function reset() {
    startTransition(() => router.push("/anbar/markalar"));
  }

  const hasFilters = !!(search || aktiv !== "aktiv" || logo || has || sirala !== "ad");

  return (
    <form onSubmit={onSubmit} className="grid grid-cols-1 gap-2 rounded-xl border border-border bg-card/40 p-3 md:grid-cols-[1fr_130px_130px_140px_160px_auto]">
      <div>
        <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Axtarış</label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input name="q" defaultValue={search} placeholder="Marka adı..." className="h-9 pl-8" disabled={pending} />
        </div>
      </div>
      <div>
        <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Vəziyyət</label>
        <select value={aktiv} onChange={(e) => setP("aktiv", e.target.value, "aktiv")} disabled={pending} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
          <option value="aktiv">Aktiv</option>
          <option value="deaktiv">Deaktiv</option>
          <option value="hamisi">Hamısı</option>
        </select>
      </div>
      <div>
        <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Logo</label>
        <select value={logo} onChange={(e) => setP("logo", e.target.value)} disabled={pending} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
          <option value="">Hamısı</option>
          <option value="true">Logo var</option>
          <option value="false">Logo yox</option>
        </select>
      </div>
      <div>
        <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Məhsul</label>
        <select value={has} onChange={(e) => setP("has", e.target.value)} disabled={pending} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
          <option value="">Hamısı</option>
          <option value="true">Məhsulu var</option>
          <option value="false">Boşdur</option>
        </select>
      </div>
      <div>
        <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Sıralama</label>
        <select value={sirala} onChange={(e) => setP("sirala", e.target.value, "ad")} disabled={pending} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
          <option value="ad">Ad A→Z</option>
          <option value="ad_desc">Ad Z→A</option>
        </select>
      </div>
      <div className="flex items-end gap-1">
        <Button type="submit" size="sm" disabled={pending} className="h-9 font-semibold">Tətbiq</Button>
        {hasFilters && (
          <Button type="button" size="sm" variant="ghost" onClick={reset} disabled={pending}>
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </form>
  );
}
