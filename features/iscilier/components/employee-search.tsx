"use client";

import { useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { FilialOpt, RoleOpt } from "../types";

type Props = {
  basePath?: string;
  roles?: RoleOpt[];
  filiallar?: FilialOpt[];
  vezifeler?: string[];
};

const STATUS_OPTIONS = [
  { value: "aktiv", label: "Aktiv", tone: undefined as Tone },
  { value: "passiv", label: "Passiv", tone: "warning" as Tone },
  { value: "mezuniyyetde", label: "Məzuniyyətdə", tone: "info" as Tone },
  { value: "cixib", label: "İşdən çıxıb", tone: "danger" as Tone },
];

type Tone = "warning" | "danger" | "info" | undefined;

export function EmployeeSearch({
  basePath = "/iscilier",
  roles = [],
  filiallar = [],
  vezifeler = [],
}: Props) {
  const router = useRouter();
  const sp = useSearchParams();
  const [pending, startTransition] = useTransition();

  const search = sp.get("q") ?? "";
  const status = sp.get("status") ?? "";
  const vezife = sp.get("vezife") ?? "";
  const rol = sp.get("rol") ?? "";
  const filial = sp.get("filial") ?? "";
  const maasMin = sp.get("maas_min") ?? "";
  const maasMax = sp.get("maas_max") ?? "";
  const iseMin = sp.get("ise_min") ?? "";
  const iseMax = sp.get("ise_max") ?? "";

  const update = (mutate: (p: URLSearchParams) => void) => {
    const p = new URLSearchParams(sp.toString());
    mutate(p);
    startTransition(() => router.push(`${basePath}?${p.toString()}`));
  };

  function setParam(key: string, value: string) {
    update((p) => {
      if (value) p.set(key, value);
      else p.delete(key);
    });
  }

  function onSearch(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const q = String(fd.get("q") ?? "").trim();
    const mn = String(fd.get("maas_min") ?? "").trim();
    const mx = String(fd.get("maas_max") ?? "").trim();
    update((p) => {
      if (q) p.set("q", q); else p.delete("q");
      if (mn) p.set("maas_min", mn); else p.delete("maas_min");
      if (mx) p.set("maas_max", mx); else p.delete("maas_max");
    });
  }

  const hasFilter = !!(
    search || status || vezife || rol || filial ||
    maasMin || maasMax || iseMin || iseMax
  );

  return (
    <form
      onSubmit={onSearch}
      className="space-y-3 rounded-xl border border-border bg-card/40 p-3"
    >
      {/* Axtarış + sıfırla */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-md">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            name="q"
            defaultValue={search}
            placeholder="Ad, email, telefon, vəzifə, FİN, işçi kodu..."
            className="h-9 pl-8"
            disabled={pending}
          />
        </div>

        {hasFilter && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => router.push(basePath)}
            disabled={pending}
            className="ml-auto"
          >
            <X className="h-3.5 w-3.5" /> Sıfırla
          </Button>
        )}
      </div>

      {/* Status pill-ləri */}
      <Section label="Status">
        <Pill
          label="Hamısı"
          active={!status}
          pending={pending}
          onClick={() => setParam("status", "")}
        />
        {STATUS_OPTIONS.map((o) => (
          <Pill
            key={o.value}
            label={o.label}
            tone={o.tone}
            active={status === o.value}
            pending={pending}
            onClick={() => setParam("status", status === o.value ? "" : o.value)}
          />
        ))}
      </Section>

      {/* Şöbə (filial) / Vəzifə / Rol */}
      <Section label="Şöbə / Vəzifə / Rol">
        {filiallar.length > 0 && (
          <select
            value={filial}
            disabled={pending}
            onChange={(e) => setParam("filial", e.target.value)}
            className="h-7 rounded-full border border-border bg-card px-2 text-xs text-muted-foreground"
          >
            <option value="">Bütün şöbələr</option>
            {filiallar.map((f) => (
              <option key={f.id} value={String(f.id)}>{f.ad}</option>
            ))}
          </select>
        )}

        {vezifeler.length > 0 && (
          <select
            value={vezife}
            disabled={pending}
            onChange={(e) => setParam("vezife", e.target.value)}
            className="h-7 rounded-full border border-border bg-card px-2 text-xs text-muted-foreground"
          >
            <option value="">Bütün vəzifələr</option>
            {vezifeler.map((v) => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
        )}

        {roles.length > 0 && (
          <select
            value={rol}
            disabled={pending}
            onChange={(e) => setParam("rol", e.target.value)}
            className="h-7 rounded-full border border-border bg-card px-2 text-xs text-muted-foreground"
          >
            <option value="">Bütün rollar</option>
            {roles.map((r) => (
              <option key={r.id} value={String(r.id)}>{r.ad}</option>
            ))}
          </select>
        )}
      </Section>

      {/* Maaş aralığı + İşə qəbul tarixi */}
      <Section label="Maaş aralığı (₼) / İşə qəbul">
        <Input
          name="maas_min"
          type="number"
          min={0}
          step="0.01"
          defaultValue={maasMin}
          placeholder="maaş min"
          className="h-7 w-28 rounded-full text-xs"
          disabled={pending}
        />
        <Input
          name="maas_max"
          type="number"
          min={0}
          step="0.01"
          defaultValue={maasMax}
          placeholder="maaş max"
          className="h-7 w-28 rounded-full text-xs"
          disabled={pending}
        />
        <Sep />
        <label className="text-[10px] text-muted-foreground">başlama</label>
        <Input
          type="date"
          value={iseMin}
          onChange={(e) => setParam("ise_min", e.target.value)}
          className="h-7 w-36 rounded-full text-xs"
          disabled={pending}
          aria-label="İşə qəbul (başlanğıc)"
        />
        <label className="text-[10px] text-muted-foreground">bitmə</label>
        <Input
          type="date"
          value={iseMax}
          onChange={(e) => setParam("ise_max", e.target.value)}
          className="h-7 w-36 rounded-full text-xs"
          disabled={pending}
          aria-label="İşə qəbul (son)"
        />
        <Button type="submit" size="sm" variant="outline" className="h-7" disabled={pending}>
          Tətbiq et
        </Button>
      </Section>
    </form>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="flex flex-wrap items-center gap-1.5">{children}</div>
    </div>
  );
}

function Sep() {
  return <span className="mx-1 h-4 w-px bg-border" />;
}

function Pill({
  label, active, pending, onClick, tone,
}: {
  label: string;
  active: boolean;
  pending: boolean;
  onClick: () => void;
  tone?: Tone;
}) {
  const activeClass = tone === "warning"
    ? "border-warning/40 bg-warning/15 text-warning"
    : tone === "danger"
    ? "border-danger/40 bg-danger/15 text-danger"
    : tone === "info"
    ? "border-info/40 bg-info/15 text-info"
    : "border-primary/40 bg-primary/15 text-primary-light";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className={cn(
        "inline-flex h-7 items-center rounded-full border px-2.5 text-xs font-medium transition",
        active ? activeClass : "border-border bg-card text-muted-foreground hover:text-foreground"
      )}
    >
      {label}
    </button>
  );
}
