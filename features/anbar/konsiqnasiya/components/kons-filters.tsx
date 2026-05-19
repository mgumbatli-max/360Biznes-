"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Combobox, type ComboOption } from "@/components/ui/combobox";

type Props = {
  kontragents: Array<{ id: string; ad: string }>;
};

export function KonsFilters({ kontragents }: Props) {
  const router = useRouter();
  const sp = useSearchParams();
  const [pending, startTransition] = useTransition();

  const [q, setQ] = useState(sp.get("q") ?? "");
  const [istiqamet, setIstiqamet] = useState(sp.get("istiqamet") ?? "");
  const [kontragent, setKontragent] = useState(sp.get("kontragent") ?? "");
  const [status, setStatus] = useState(sp.get("status") ?? "");

  function apply(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (istiqamet) params.set("istiqamet", istiqamet);
    if (kontragent) params.set("kontragent", kontragent);
    if (status) params.set("status", status);
    const qs = params.toString();
    startTransition(() => router.push(qs ? `/anbar/konsiqnasiya?${qs}` : "/anbar/konsiqnasiya"));
  }

  function reset() {
    setQ(""); setIstiqamet(""); setKontragent(""); setStatus("");
    startTransition(() => router.push("/anbar/konsiqnasiya"));
  }

  const hasFilters = !!(q || istiqamet || kontragent || status);

  return (
    <form onSubmit={apply} className="grid grid-cols-1 gap-2 rounded-xl border border-border bg-card/40 p-3 md:grid-cols-[1.6fr_160px_220px_160px_auto]">
      <div>
        <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Axtarış</label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Məhsul, kontragent..."
            disabled={pending}
            className="h-9 w-full rounded-md border border-input bg-background pl-8 pr-3 text-sm"
          />
        </div>
      </div>
      <div>
        <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">İstiqamət</label>
        <select
          value={istiqamet}
          onChange={(e) => setIstiqamet(e.target.value)}
          disabled={pending}
          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">Hamısı</option>
          <option value="verilen">Verilən</option>
          <option value="alinan">Alınan</option>
        </select>
      </div>
      <div>
        <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Kontragent</label>
        <Combobox
          options={kontragents.map<ComboOption>((k) => ({ value: k.id, label: k.ad }))}
          value={kontragent}
          onChange={setKontragent}
          placeholder="Hamısı"
          searchPlaceholder="🔍 Kontragent axtar..."
          emptyText="Tapılmadı"
          disabled={pending}
        />
      </div>
      <div>
        <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Status</label>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          disabled={pending}
          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">Hamısı</option>
          <option value="aciq">Açıq</option>
          <option value="baglanildi">Bağlanıldı</option>
          <option value="qaytarildi">Qaytarıldı</option>
        </select>
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
