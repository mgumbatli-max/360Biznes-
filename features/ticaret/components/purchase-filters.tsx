"use client";

import { useCallback, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { cn } from "@/lib/utils";

const STATUS_OPTIONS = [
  { value: "gozlemede", label: "Gözləmədə" },
  { value: "qebul_edildi", label: "Qəbul edildi" },
  { value: "legv", label: "Ləğv" },
];

type Supplier = { id: string; ad: string };
type Anbar = { id: number; ad: string };

/**
 * Filter bar for /ticaret/alislar — search, supplier select, warehouse
 * select, status pills and date range. State is held in the URL via
 * search params so links and refreshes preserve the view.
 */
export function PurchaseFilters({ suppliers, anbarlar }: { suppliers: Supplier[]; anbarlar: Anbar[] }) {
  const router = useRouter();
  const sp = useSearchParams();
  const [pending, startTransition] = useTransition();

  const search = sp.get("q") ?? "";
  const status = sp.getAll("status");
  const techizatci = sp.get("techizatci") ?? "";
  const anbar = sp.get("anbar") ?? "";
  const from = sp.get("from") ?? "";
  const to = sp.get("to") ?? "";
  const borc = sp.get("borc") ?? "";

  const update = useCallback(
    (mutate: (p: URLSearchParams) => void) => {
      const params = new URLSearchParams(sp.toString());
      mutate(params);
      startTransition(() => router.push(`/ticaret/alislar?${params.toString()}`));
    },
    [sp, router],
  );

  function togglePill(name: string, value: string) {
    update((p) => {
      const list = p.getAll(name);
      p.delete(name);
      const next = list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
      next.forEach((v) => p.append(name, v));
    });
  }

  function onSearch(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const q = String(new FormData(e.currentTarget).get("q") ?? "").trim();
    update((p) => {
      if (q) p.set("q", q);
      else p.delete("q");
    });
  }

  const hasFilters = !!(search || status.length || techizatci || anbar || from || to || borc);

  function set(name: string, value: string) {
    update((p) => {
      if (value) p.set(name, value);
      else p.delete(name);
    });
  }

  return (
    <div className="space-y-3 rounded-xl border border-border bg-card/40 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <form onSubmit={onSearch} className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            name="q"
            defaultValue={search}
            placeholder="Nömrə, təchizatçı axtar..."
            className="h-9 pl-8"
            disabled={pending}
          />
        </form>
        <div className="min-w-[200px]">
          <Combobox
            options={[{ value: "", label: "Bütün təchizatçılar" }, ...suppliers.map((s) => ({ value: s.id, label: s.ad }))]}
            value={techizatci}
            onChange={(v) => set("techizatci", v)}
            placeholder="Təchizatçı"
            disabled={pending}
          />
        </div>
        <div className="min-w-[160px]">
          <Combobox
            options={[{ value: "", label: "Bütün anbarlar" }, ...anbarlar.map((a) => ({ value: String(a.id), label: a.ad }))]}
            value={anbar}
            onChange={(v) => set("anbar", v)}
            placeholder="Anbar"
            disabled={pending}
          />
        </div>
        {hasFilters && (
          <Button size="sm" variant="ghost" onClick={() => router.push("/ticaret/alislar")} disabled={pending} className="ml-auto">
            <X className="h-3.5 w-3.5" /> Sıfırla
          </Button>
        )}
      </div>

      <Row label="Status">
        {STATUS_OPTIONS.map((s) => (
          <Pill key={s.value} active={status.includes(s.value)} onClick={() => togglePill("status", s.value)} disabled={pending}>
            {s.label}
          </Pill>
        ))}
      </Row>

      <Row label="Borc">
        {[
          { v: "", l: "Hamısı" },
          { v: "var", l: "Bizim borc var" },
          { v: "yox", l: "Bağlı" },
        ].map((o) => (
          <Pill
            key={o.v || "any"}
            active={(borc || "") === o.v}
            onClick={() => set("borc", o.v)}
            disabled={pending}
          >
            {o.l}
          </Pill>
        ))}
      </Row>

      <Row label="Tarix">
        <input
          type="date"
          value={from}
          onChange={(e) => set("from", e.target.value)}
          disabled={pending}
          className="h-8 rounded-md border border-border bg-background px-2 text-xs"
        />
        <span className="text-xs text-muted-foreground">—</span>
        <input
          type="date"
          value={to}
          onChange={(e) => set("to", e.target.value)}
          disabled={pending}
          className="h-8 rounded-md border border-border bg-background px-2 text-xs"
        />
      </Row>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

function Pill({
  active,
  onClick,
  disabled,
  children,
}: {
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex h-7 items-center rounded-full px-2.5 text-xs font-semibold transition-all duration-200 ease-out hover:-translate-y-px active:translate-y-0 active:scale-95",
        active
          ? "bg-gradient-to-b from-primary/25 to-primary/10 text-primary ring-1 ring-inset ring-primary/30 shadow-sm shadow-primary/15"
          : "bg-card/60 backdrop-blur-sm text-muted-foreground ring-1 ring-inset ring-border/50 hover:bg-secondary/60 hover:text-foreground hover:ring-border",
      )}
    >
      {children}
    </button>
  );
}
