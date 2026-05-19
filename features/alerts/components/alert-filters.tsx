"use client";

import { useCallback, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Category = { kod: string; ad: string; emoji: string | null };

type Props = {
  categories: Category[];
};

const SEVERITY_OPTIONS = [
  { value: "kritik", label: "Kritik" },
  { value: "risk", label: "Risk" },
  { value: "xeber", label: "Xəbər" },
  { value: "info", label: "Məlumat" },
];

const STATUS_OPTIONS = [
  { value: "yeni", label: "Yeni" },
  { value: "baxilir", label: "Baxılır" },
  { value: "snoozed", label: "Təxirə salınıb" },
  { value: "hell_olundu", label: "Həll" },
];

export function AlertFilters({ categories }: Props) {
  const router = useRouter();
  const sp = useSearchParams();
  const [pending, startTransition] = useTransition();

  const seviyye = sp.getAll("seviyye");
  const status = sp.getAll("status");
  const kateqoriya = sp.getAll("kateq");
  const search = sp.get("q") ?? "";

  const update = useCallback(
    (mutate: (params: URLSearchParams) => void) => {
      const params = new URLSearchParams(sp.toString());
      mutate(params);
      startTransition(() => {
        router.push(`/xeberdarliqlar?${params.toString()}`);
      });
    },
    [sp, router]
  );

  function toggleListParam(name: string, value: string) {
    update((p) => {
      const list = p.getAll(name);
      p.delete(name);
      if (list.includes(value)) {
        list.filter((v) => v !== value).forEach((v) => p.append(name, v));
      } else {
        [...list, value].forEach((v) => p.append(name, v));
      }
    });
  }

  function onSearchSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const q = String(formData.get("q") ?? "").trim();
    update((p) => {
      if (q) p.set("q", q);
      else p.delete("q");
    });
  }

  const hasFilters = seviyye.length || status.length || kateqoriya.length || search;

  return (
    <div className="space-y-3 rounded-xl border border-border bg-card/40 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <form onSubmit={onSearchSubmit} className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            name="q"
            defaultValue={search}
            placeholder="Başlıq / təsvir axtar..."
            className="h-9 pl-8"
            disabled={pending}
          />
        </form>

        {hasFilters && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => router.push("/xeberdarliqlar")}
            disabled={pending}
            className="ml-auto"
          >
            <X className="h-3.5 w-3.5" />
            Filtri sıfırla
          </Button>
        )}
      </div>

      <FilterRow label="Səviyyə">
        {SEVERITY_OPTIONS.map((opt) => (
          <Pill
            key={opt.value}
            active={seviyye.includes(opt.value)}
            onClick={() => toggleListParam("seviyye", opt.value)}
            disabled={pending}
          >
            {opt.label}
          </Pill>
        ))}
      </FilterRow>

      <FilterRow label="Status">
        {STATUS_OPTIONS.map((opt) => (
          <Pill
            key={opt.value}
            active={status.includes(opt.value)}
            onClick={() => toggleListParam("status", opt.value)}
            disabled={pending}
          >
            {opt.label}
          </Pill>
        ))}
      </FilterRow>

      <FilterRow label="Kateqoriya">
        {categories.map((c) => (
          <Pill
            key={c.kod}
            active={kateqoriya.includes(c.kod)}
            onClick={() => toggleListParam("kateq", c.kod)}
            disabled={pending}
          >
            <span className="mr-1">{c.emoji}</span>
            {c.ad}
          </Pill>
        ))}
      </FilterRow>
    </div>
  );
}

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
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
          : "border-border bg-card text-muted-foreground hover:border-border hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}
