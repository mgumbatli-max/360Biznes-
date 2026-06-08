"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, X, SlidersHorizontal, ChevronDown, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Combobox, type ComboOption } from "@/components/ui/combobox";
import { cn } from "@/lib/utils";

type Props = {
  categories: Array<{ id: number; ad: string }>;
  brands: Array<{ id: number; ad: string }>;
  anbarlar?: Array<{ id: number; ad: string }>;
};

const STOK_OPTIONS = [
  { value: "var", label: "Stokda" },
  { value: "az", label: "Az qalıb" },
  { value: "yox", label: "Stoku bitib" },
];

const SORT_OPTIONS = [
  { value: "ad",            label: "Ad A→Z" },
  { value: "ad_desc",       label: "Ad Z→A" },
  { value: "qiymet_artan",  label: "Qiymət (az)" },
  { value: "qiymet_azalan", label: "Qiymət (çox)" },
  { value: "stok_artan",    label: "Stok (az)" },
  { value: "stok_azalan",   label: "Stok (çox)" },
  { value: "yeni",          label: "Ən yenilər" },
  { value: "son_satis",     label: "Son satış (yox)" },
  { value: "marja",         label: "Marja (çox)" },
];

export function ProductFilters({ categories, brands, anbarlar = [] }: Props) {
  const router = useRouter();
  const sp = useSearchParams();
  const [pending, startTransition] = useTransition();

  const search   = sp.get("q") ?? "";
  const stokStatus = sp.getAll("stok_status");
  const kateqIds = sp.getAll("kateq").map(Number).filter(Number.isFinite);
  const markaIds = sp.getAll("marka").map(Number).filter(Number.isFinite);
  const aktiv    = sp.get("aktiv") ?? "aktiv";
  const sekil    = sp.get("sekil") ?? "";
  const barkod   = sp.get("barkod") ?? "";
  const qmin     = sp.get("qmin") ?? "";
  const qmax     = sp.get("qmax") ?? "";
  const sirala   = sp.get("sirala") ?? "ad";
  const anbar    = sp.get("anbar") ?? "";
  const servis   = sp.get("servis") === "1";
  const rezerv   = sp.get("rezerv") === "1";
  // Single-select dropdown values (first URL value taken):
  const kateqVal = kateqIds[0] ? String(kateqIds[0]) : "";
  const markaVal = markaIds[0] ? String(markaIds[0]) : "";

  function setSingleMulti(name: string, value: string) {
    update((p) => {
      p.delete(name);
      if (value) p.append(name, value);
    });
  }

  const update = useCallback(
    (mutate: (p: URLSearchParams) => void) => {
      const params = new URLSearchParams(sp.toString());
      mutate(params);
      params.delete("page");
      startTransition(() => router.push(`/anbar/mehsullar?${params.toString()}`));
    },
    [sp, router]
  );

  function setParam(name: string, value: string) {
    update((p) => {
      if (value) p.set(name, value);
      else p.delete(name);
    });
  }

  function onApplyAll(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    update((p) => {
      const q = String(fd.get("q") ?? "").trim();
      const qn = String(fd.get("qmin") ?? "").trim();
      const qx = String(fd.get("qmax") ?? "").trim();
      if (q) p.set("q", q); else p.delete("q");
      if (qn) p.set("qmin", qn); else p.delete("qmin");
      if (qx) p.set("qmax", qx); else p.delete("qmax");
    });
  }

  function togglePill(name: string, value: string) {
    update((p) => {
      const list = p.getAll(name);
      p.delete(name);
      const next = list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
      next.forEach((v) => p.append(name, v));
    });
  }

  function reset() {
    startTransition(() => router.push("/anbar/mehsullar"));
  }

  const hasFilters = !!(
    search || stokStatus.length || kateqIds.length || markaIds.length ||
    sekil || barkod || qmin || qmax || anbar || servis || rezerv ||
    aktiv !== "aktiv" || sirala !== "ad"
  );

  // Sürətli filterlərdə olmayan, açılan paneldə olanları say
  const advancedCount = [
    markaIds.length > 0,
    !!anbar,
    !!sekil,
    !!barkod,
    !!qmin,
    !!qmax,
    sirala !== "ad",
  ].filter(Boolean).length;

  // Açılan paneldə hər hansı bir aktiv filter varsa, default olaraq açıq saxla
  const [expanded, setExpanded] = useState(advancedCount > 0);

  return (
    <div className="space-y-3 rounded-xl border border-border bg-card/40 p-3">
      <form onSubmit={onApplyAll} className="space-y-2">
        {/* SÜRƏTLİ SIRA — həmişə görünür */}
        <div className="grid grid-cols-1 gap-2 md:grid-cols-12">
          {/* Axtarış — real-time (debounced 250ms) */}
          <div className="md:col-span-5">
            <LiveSearchInput
              defaultValue={search}
              onSearchChange={(v) => setParam("q", v)}
              pending={pending}
            />
          </div>

          {/* Kateqoriya */}
          <div className="md:col-span-3">
            <Combobox
              options={categories.map<ComboOption>((c) => ({ value: String(c.id), label: c.ad }))}
              value={kateqVal}
              onChange={(v) => setSingleMulti("kateq", v)}
              placeholder="Kateqoriya"
              searchPlaceholder="Kateqoriya axtar..."
              emptyText="Tapılmadı"
              disabled={pending}
            />
          </div>

          {/* Vəziyyət */}
          <div className="md:col-span-2">
            <select
              value={aktiv}
              onChange={(e) => setParam("aktiv", e.target.value === "aktiv" ? "" : e.target.value)}
              disabled={pending}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="aktiv">Aktiv</option>
              <option value="deaktiv">Deaktiv</option>
              <option value="hamisi">Hamısı</option>
            </select>
          </div>

          {/* Filtrlər toggle + Sıfırla — Tətbiq düyməsi YOXDUR (real-time işləyir) */}
          <div className="md:col-span-2 flex items-center gap-1">
            <Button
              type="button"
              size="sm"
              variant={expanded ? "default" : "outline"}
              onClick={() => setExpanded((v) => !v)}
              disabled={pending}
              className="h-9 gap-1 whitespace-nowrap"
              title={expanded ? "Filtrləri gizlət" : "Daha çox filtr"}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              {advancedCount > 0 && (
                <span className="ml-0.5 grid h-4 min-w-[16px] place-items-center rounded-full bg-primary/30 px-1 text-[10px] font-bold">
                  {advancedCount}
                </span>
              )}
              <ChevronDown className={cn("h-3 w-3 transition", expanded && "rotate-180")} />
            </Button>
            {hasFilters && (
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                onClick={reset}
                disabled={pending}
                title="Bütün filtrləri sıfırla"
                className="h-9 w-9 shrink-0"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* GENİŞLƏNDİRİLMİŞ FİLTRLƏR — açıldıqda görünür */}
        {expanded && (
          <div className="grid grid-cols-1 gap-2 border-t border-border/40 pt-2 md:grid-cols-12">
            {/* Marka */}
            <div className="md:col-span-3">
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Marka</label>
              <Combobox
                options={brands.map<ComboOption>((b) => ({ value: String(b.id), label: b.ad }))}
                value={markaVal}
                onChange={(v) => setSingleMulti("marka", v)}
                placeholder="Hamısı"
                searchPlaceholder="Marka axtar..."
                emptyText="Tapılmadı"
                disabled={pending}
              />
            </div>

            {/* Anbar */}
            {anbarlar.length > 0 && (
              <div className="md:col-span-3">
                <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Anbar</label>
                <Combobox
                  options={anbarlar.map<ComboOption>((a) => ({ value: String(a.id), label: a.ad }))}
                  value={anbar}
                  onChange={(v) => setParam("anbar", v)}
                  placeholder="Bütün anbarlar"
                  searchPlaceholder="Anbar axtar..."
                  emptyText="Tapılmadı"
                  disabled={pending}
                />
              </div>
            )}

            {/* Şəkil */}
            <div className="md:col-span-2">
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Şəkil</label>
              <select
                value={sekil}
                onChange={(e) => setParam("sekil", e.target.value)}
                disabled={pending}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Hamısı</option>
                <option value="true">Şəkilli</option>
                <option value="false">Şəkilsiz</option>
              </select>
            </div>

            {/* Barkod */}
            <div className="md:col-span-2">
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Barkod</label>
              <select
                value={barkod}
                onChange={(e) => setParam("barkod", e.target.value)}
                disabled={pending}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Hamısı</option>
                <option value="true">Barkodlu</option>
                <option value="false">Barkodsuz</option>
              </select>
            </div>

            {/* Sıralama */}
            <div className="md:col-span-2">
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Sıralama</label>
              <select
                value={sirala}
                onChange={(e) => setParam("sirala", e.target.value === "ad" ? "" : e.target.value)}
                disabled={pending}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {SORT_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>

            {/* Qiymət aralığı */}
            <div className="md:col-span-4">
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Qiymət aralığı (₼)</label>
              <div className="flex gap-1">
                <Input name="qmin" type="number" min={0} step="0.01" defaultValue={qmin} placeholder="min" className="h-9" disabled={pending} />
                <Input name="qmax" type="number" min={0} step="0.01" defaultValue={qmax} placeholder="max" className="h-9" disabled={pending} />
              </div>
            </div>
          </div>
        )}
      </form>

      {/* Stok pill sırası + servis — həmişə görünür (kiçik və vacib) */}
      <FilterRow label="Stok">
        {STOK_OPTIONS.map((s) => (
          <Pill key={s.value} active={stokStatus.includes(s.value)} onClick={() => togglePill("stok_status", s.value)} disabled={pending}>
            {s.label}
          </Pill>
        ))}
        <span className="ml-2 h-4 w-px bg-border" />
        <Pill
          active={servis}
          onClick={() => setParam("servis", servis ? "" : "1")}
          disabled={pending}
        >
          🔧 Servisdə olmuş
        </Pill>
        <Pill
          active={rezerv}
          onClick={() => setParam("rezerv", rezerv ? "" : "1")}
          disabled={pending}
        >
          🔖 Rezervdə
        </Pill>
      </FilterRow>
    </div>
  );
}

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground min-w-[68px]">{label}</span>
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
          : "bg-card/60 backdrop-blur-sm text-muted-foreground ring-1 ring-inset ring-border/50 hover:bg-secondary/60 hover:text-foreground hover:ring-border"
      )}
    >
      {children}
    </button>
  );
}

/**
 * Real-time debounced search — istifadəçi yazdıqca avtomatik URL parametri yenilənir.
 * 250ms debounce — sürətli yazışdan yarımsı sorğunu boğmur.
 */
function LiveSearchInput({
  defaultValue,
  onSearchChange,
  pending,
}: {
  defaultValue: string;
  onSearchChange: (v: string) => void;
  pending: boolean;
}) {
  const [val, setVal] = useState(defaultValue);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstRender = useRef(true);

  useEffect(() => {
    // URL-dən dəyişiklik gəldikdə (məs. "Sıfırla") yerli state-i sinxron et
    setVal(defaultValue);
  }, [defaultValue]);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      onSearchChange(val.trim());
    }, 250);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [val]);

  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
      <Input
        name="q"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        placeholder="🔍 Ad, kod, barkod, marka, kateqoriya..."
        className="h-9 pl-8 pr-8"
        autoComplete="off"
      />
      {pending && (
        <Loader2 className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-muted-foreground" />
      )}
      {!pending && val && (
        <button
          type="button"
          onClick={() => setVal("")}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
          aria-label="Təmizlə"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}
