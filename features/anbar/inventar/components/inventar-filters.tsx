"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Combobox, type ComboOption } from "@/components/ui/combobox";

type Props = {
  anbarlar: Array<{ id: number; ad: string }>;
};

export function InventarFilters({ anbarlar }: Props) {
  const router = useRouter();
  const sp = useSearchParams();
  const [pending, startTransition] = useTransition();

  const [status, setStatus] = useState(sp.get("status") ?? "");
  const [anbar, setAnbar] = useState(sp.get("anbar") ?? "");
  const [from, setFrom] = useState(sp.get("from") ?? "");
  const [to, setTo] = useState(sp.get("to") ?? "");

  function apply(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (anbar) params.set("anbar", anbar);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    const qs = params.toString();
    startTransition(() => router.push(qs ? `/anbar/inventar?${qs}` : "/anbar/inventar"));
  }

  function reset() {
    setStatus(""); setAnbar(""); setFrom(""); setTo("");
    startTransition(() => router.push("/anbar/inventar"));
  }

  const hasFilters = !!(status || anbar || from || to);

  return (
    <form onSubmit={apply} className="grid grid-cols-1 gap-2 rounded-xl border border-border bg-card/40 p-3 md:grid-cols-[180px_220px_140px_140px_auto]">
      <div>
        <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Status</label>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          disabled={pending}
          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">Hamısı</option>
          <option value="aktiv">Davam edir</option>
          <option value="tamamlandi">Tamamlandı</option>
          <option value="legv">Ləğv</option>
        </select>
      </div>
      <div>
        <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Anbar</label>
        <Combobox
          options={anbarlar.map<ComboOption>((a) => ({ value: String(a.id), label: a.ad }))}
          value={anbar}
          onChange={setAnbar}
          placeholder="Hamısı"
          searchPlaceholder="🔍 Anbar axtar..."
          emptyText="Anbar tapılmadı"
          disabled={pending}
        />
      </div>
      <div>
        <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Başlanğıc</label>
        <input
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          disabled={pending}
          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
        />
      </div>
      <div>
        <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Son</label>
        <input
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          disabled={pending}
          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
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
