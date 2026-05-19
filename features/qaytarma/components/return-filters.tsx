"use client";

import { useCallback, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Opt = { id: number | string; ad: string };

const NOV_OPTIONS = [
  { value: "", label: "Hamısı" },
  { value: "satis_qaytarma", label: "Satış qaytarması" },
  { value: "alis_qaytarma", label: "Alış qaytarması" },
];

const STATUS_OPTIONS = [
  { value: "", label: "Hamısı" },
  { value: "tesdiqlenmemis", label: "Gözləyir" },
  { value: "tamamlandi", label: "Tamamlandı" },
  { value: "legv", label: "Ləğv" },
];

export function ReturnFilters({
  anbarlar,
  musteriler,
}: {
  anbarlar: Opt[];
  musteriler: Opt[];
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const [pending, startTransition] = useTransition();

  const search = sp.get("q") ?? "";
  const nov = sp.get("nov") ?? "";
  const status = sp.get("status") ?? "";
  const kontragent = sp.get("kontragent") ?? "";
  const anbar = sp.get("anbar") ?? "";
  const from = sp.get("from") ?? "";
  const to = sp.get("to") ?? "";

  const update = useCallback(
    (mutate: (p: URLSearchParams) => void) => {
      const params = new URLSearchParams(sp.toString());
      mutate(params);
      const qs = params.toString();
      startTransition(() => router.push(`/ticaret/qaytarma${qs ? `?${qs}` : ""}`));
    },
    [sp, router],
  );

  function setParam(name: string, value: string) {
    update((p) => {
      if (value) p.set(name, value);
      else p.delete(name);
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

  const hasFilters = !!(search || nov || status || kontragent || anbar || from || to);

  return (
    <div className="space-y-3 rounded-xl border border-border bg-card/40 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <form onSubmit={onSearch} className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            name="q"
            defaultValue={search}
            placeholder="Nömrə, kontragent, səbəb..."
            className="h-9 pl-8"
            disabled={pending}
          />
        </form>
        {hasFilters && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => router.push("/ticaret/qaytarma")}
            disabled={pending}
            className="ml-auto"
          >
            <X className="h-3.5 w-3.5" /> Sıfırla
          </Button>
        )}
      </div>

      <Row label="Növ">
        {NOV_OPTIONS.map((o) => (
          <Pill key={o.value || "all"} active={nov === o.value} onClick={() => setParam("nov", o.value)} disabled={pending}>
            {o.label}
          </Pill>
        ))}
      </Row>

      <Row label="Status">
        {STATUS_OPTIONS.map((o) => (
          <Pill key={o.value || "all"} active={status === o.value} onClick={() => setParam("status", o.value)} disabled={pending}>
            {o.label}
          </Pill>
        ))}
      </Row>

      <div className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Kontragent</span>
          <select
            value={kontragent}
            onChange={(e) => setParam("kontragent", e.target.value)}
            disabled={pending}
            className="h-8 min-w-[180px] rounded-md border border-border bg-background px-2 text-xs"
          >
            <option value="">Hamısı</option>
            {musteriler.map((m) => (
              <option key={m.id} value={String(m.id)}>{m.ad}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Anbar</span>
          <select
            value={anbar}
            onChange={(e) => setParam("anbar", e.target.value)}
            disabled={pending}
            className="h-8 min-w-[140px] rounded-md border border-border bg-background px-2 text-xs"
          >
            <option value="">Hamısı</option>
            {anbarlar.map((a) => (
              <option key={a.id} value={String(a.id)}>{a.ad}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Başlanğıc</span>
          <input
            type="date"
            value={from}
            onChange={(e) => setParam("from", e.target.value)}
            disabled={pending}
            className="h-8 rounded-md border border-border bg-background px-2 text-xs"
          />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Son</span>
          <input
            type="date"
            value={to}
            onChange={(e) => setParam("to", e.target.value)}
            disabled={pending}
            className="h-8 rounded-md border border-border bg-background px-2 text-xs"
          />
        </div>
      </div>
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
        "inline-flex h-7 items-center rounded-full border px-2.5 text-xs font-medium transition",
        active
          ? "border-primary/40 bg-primary/15 text-primary-light"
          : "border-border bg-card text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
