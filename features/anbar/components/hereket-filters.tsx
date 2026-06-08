"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Combobox, type ComboOption } from "@/components/ui/combobox";
import { cn } from "@/lib/utils";

export const HEREKET_NOV_OPTIONS: ComboOption[] = [
  { value: "medaxil",         label: "Mədaxil" },
  { value: "mexaric",         label: "Məxaric" },
  { value: "transfer_giris",  label: "Transfer giriş" },
  { value: "transfer_cixis",  label: "Transfer çıxış" },
  { value: "inventar",        label: "İnventar" },
  { value: "qaytarma_giris",  label: "Qaytarma giriş" },
  { value: "qaytarma_cixis",  label: "Qaytarma çıxış" },
];

export function HereketFilters({ anbarlar }: { anbarlar: Array<{ id: number; ad: string }> }) {
  const router = useRouter();
  const sp = useSearchParams();
  const [pending, startTransition] = useTransition();

  const [q, setQ] = useState(sp.get("q") ?? "");
  const [nov, setNov] = useState(sp.get("nov") ?? "");
  const [anbar, setAnbar] = useState(sp.get("anbar") ?? "");
  const [from, setFrom] = useState(sp.get("from") ?? "");
  const [to, setTo] = useState(sp.get("to") ?? "");

  function apply(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (nov) params.set("nov", nov);
    if (anbar) params.set("anbar", anbar);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    startTransition(() => router.push(`/anbar/hereketler?${params.toString()}`));
  }

  function reset() {
    setQ(""); setNov(""); setAnbar(""); setFrom(""); setTo("");
    startTransition(() => router.push("/anbar/hereketler"));
  }

  function isoDate(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${dd}`;
  }

  function applyRange(range: "today" | "yesterday" | "week" | "month") {
    const now = new Date();
    let f = now;
    const t = now;
    if (range === "today") {
      f = now;
    } else if (range === "yesterday") {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      f = y;
    } else if (range === "week") {
      const w = new Date(now);
      w.setDate(w.getDate() - 6);
      f = w;
    } else if (range === "month") {
      f = new Date(now.getFullYear(), now.getMonth(), 1);
    }
    const fromStr = isoDate(f);
    const toStr = isoDate(range === "yesterday" ? f : t);
    setFrom(fromStr);
    setTo(toStr);
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (nov) params.set("nov", nov);
    if (anbar) params.set("anbar", anbar);
    params.set("from", fromStr);
    params.set("to", toStr);
    startTransition(() => router.push(`/anbar/hereketler?${params.toString()}`));
  }

  function activeRange(): "today" | "yesterday" | "week" | "month" | null {
    if (!from || !to) return null;
    const now = new Date();
    const today = isoDate(now);
    const y = new Date(now); y.setDate(y.getDate() - 1);
    const w = new Date(now); w.setDate(w.getDate() - 6);
    const mStart = isoDate(new Date(now.getFullYear(), now.getMonth(), 1));
    if (from === today && to === today) return "today";
    if (from === isoDate(y) && to === isoDate(y)) return "yesterday";
    if (from === isoDate(w) && to === today) return "week";
    if (from === mStart && to === today) return "month";
    return null;
  }

  const range = activeRange();
  const hasFilters = !!(q || nov || anbar || from || to);

  return (
    <div className="space-y-2 rounded-xl border border-border bg-card/40 p-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Tez seçim</span>
        {[
          { v: "today" as const, l: "Bu gün" },
          { v: "yesterday" as const, l: "Dünən" },
          { v: "week" as const, l: "Son 7 gün" },
          { v: "month" as const, l: "Bu ay" },
        ].map((r) => (
          <button
            key={r.v}
            type="button"
            onClick={() => applyRange(r.v)}
            disabled={pending}
            className={cn(
              "inline-flex h-7 items-center rounded-full border px-2.5 text-xs font-medium transition",
              range === r.v
                ? "border-primary/40 bg-primary/15 text-primary-light"
                : "border-border bg-card text-muted-foreground hover:text-foreground",
            )}
          >
            {r.l}
          </button>
        ))}
      </div>
      <form onSubmit={apply} className="grid grid-cols-1 gap-2 md:grid-cols-[1.6fr_180px_180px_140px_140px_auto]">
      <div>
        <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Məhsul</label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Ad, kod, barkod, marka..."
            disabled={pending}
            className="h-9 w-full rounded-md border border-input bg-background pl-8 pr-3 text-sm"
          />
        </div>
      </div>
      <div>
        <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Növ</label>
        <Combobox
          options={HEREKET_NOV_OPTIONS}
          value={nov}
          onChange={setNov}
          placeholder="Hamısı"
          searchPlaceholder="🔍 Növ axtar..."
          emptyText="Növ tapılmadı"
          disabled={pending}
        />
      </div>
      <div>
        <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Anbar</label>
        <Combobox
          options={anbarlar.map<ComboOption>((a) => ({ value: String(a.id), label: a.ad }))}
          value={anbar}
          onChange={setAnbar}
          placeholder="Bütün"
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
        <Button type="submit" size="sm" disabled={pending} className="h-9 font-semibold">Filtrə</Button>
        {hasFilters && (
          <Button type="button" size="sm" variant="ghost" onClick={reset} disabled={pending} title="Sıfırla">
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
      </form>
    </div>
  );
}
