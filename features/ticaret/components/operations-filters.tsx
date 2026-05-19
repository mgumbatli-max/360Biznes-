"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { ShoppingCart, Truck, Undo2, ArrowLeftRight, X, Search, Calendar } from "lucide-react";

type Option = { id: number | string; ad: string };

type Props = {
  anbarlar: Option[];
  musteriler: Option[];
  techizatcilar: Option[];
};

const NOV_OPTS = [
  { key: "satis",     label: "Satış",     Icon: ShoppingCart },
  { key: "alis",      label: "Alış",      Icon: Truck },
  { key: "qaytarma",  label: "Qaytarma",  Icon: Undo2 },
  { key: "transfer",  label: "Transfer",  Icon: ArrowLeftRight },
];

const STATUS_OPTS = [
  { key: "qaralama",         label: "Qaralama" },
  { key: "sifaris",          label: "Sifariş" },
  { key: "tesdiqlendi",      label: "Təsdiqlənmiş" },
  { key: "catdirilir",       label: "Çatdırılır" },
  { key: "catdirildi",       label: "Çatdırılıb" },
  { key: "qaime",            label: "Qaimə" },
  { key: "odendi",           label: "Ödənilib" },
  { key: "legv",             label: "Ləğv" },
];

export function OperationsFilters({ anbarlar, musteriler, techizatcilar }: Props) {
  const router = useRouter();
  const sp = useSearchParams();
  const pathname = usePathname();

  const novlar = (sp.get("nov") ?? "").split(",").filter(Boolean);
  const statuses = (sp.get("status") ?? "").split(",").filter(Boolean);
  const initQ = sp.get("q") ?? "";
  const from = sp.get("from") ?? "";
  const to = sp.get("to") ?? "";
  const anbar = sp.get("anbar") ?? "";
  const kontragent = sp.get("kontragent") ?? "";

  // Debounced search (kompakt UX — yazandan sonra 350ms gözləyir)
  const [q, setQ] = useState(initQ);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setQ(initQ);
  }, [initQ]);
  useEffect(() => {
    if (q === initQ) return;
    const t = window.setTimeout(() => update({ q }), 350);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  function update(patch: Record<string, string | string[] | undefined>) {
    const params = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (Array.isArray(v)) {
        if (v.length === 0) params.delete(k);
        else params.set(k, v.join(","));
      } else if (v === undefined || v === "") {
        params.delete(k);
      } else {
        params.set(k, v);
      }
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  function toggleNov(k: string) {
    const next = novlar.includes(k) ? novlar.filter((x) => x !== k) : [...novlar, k];
    update({ nov: next });
  }
  function toggleStatus(k: string) {
    const next = statuses.includes(k) ? statuses.filter((x) => x !== k) : [...statuses, k];
    update({ status: next });
  }

  const hasFilter = novlar.length > 0 || statuses.length > 0 || q || from || to || anbar || kontragent;

  return (
    <div className="space-y-2 rounded-xl border border-border bg-card/40 p-3">
      {/* Row 1: axtarış + tarix + anbar + kontragent */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            placeholder="Sənəd № və ya kontragent…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="h-9 w-full rounded-lg border border-border bg-background pl-8 pr-3 text-sm focus:border-primary focus:outline-none"
          />
        </div>

        <div className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-2 text-xs">
          <Calendar className="h-3 w-3 text-muted-foreground" />
          <input
            type="date"
            value={from}
            onChange={(e) => update({ from: e.target.value })}
            className="h-9 bg-transparent text-sm focus:outline-none"
            aria-label="Başlama tarixi"
          />
          <span className="text-muted-foreground">–</span>
          <input
            type="date"
            value={to}
            onChange={(e) => update({ to: e.target.value })}
            className="h-9 bg-transparent text-sm focus:outline-none"
            aria-label="Bitmə tarixi"
          />
        </div>

        <select
          value={anbar}
          onChange={(e) => update({ anbar: e.target.value })}
          className="h-9 rounded-lg border border-border bg-background px-2 text-sm"
        >
          <option value="">📦 Bütün anbarlar</option>
          {anbarlar.map((a) => (
            <option key={a.id} value={String(a.id)}>
              {a.ad}
            </option>
          ))}
        </select>

        {/* Kontragent: 2 qrupa bölünmüş — Müştərilər vs Təçhizatçılar */}
        <select
          value={kontragent}
          onChange={(e) => update({ kontragent: e.target.value })}
          className="h-9 max-w-[240px] rounded-lg border border-border bg-background px-2 text-sm"
        >
          <option value="">👥 Bütün kontragentlər</option>
          {musteriler.length > 0 && (
            <optgroup label="🟢 Müştərilər">
              {musteriler.map((k) => (
                <option key={`m-${k.id}`} value={String(k.id)}>
                  {k.ad}
                </option>
              ))}
            </optgroup>
          )}
          {techizatcilar.length > 0 && (
            <optgroup label="🟠 Təçhizatçılar">
              {techizatcilar.map((k) => (
                <option key={`t-${k.id}`} value={String(k.id)}>
                  {k.ad}
                </option>
              ))}
            </optgroup>
          )}
        </select>

        {hasFilter && (
          <button
            type="button"
            onClick={() => router.push(pathname)}
            className="inline-flex h-9 items-center gap-1 rounded-lg border border-border px-2 text-xs text-muted-foreground hover:bg-secondary"
          >
            <X className="h-3 w-3" /> Sıfırla
          </button>
        )}
      </div>

      {/* Row 2: Növ pill-ləri */}
      <div className="flex flex-wrap items-center gap-1">
        <span className="min-w-[60px] text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Növ
        </span>
        {NOV_OPTS.map((n) => {
          const on = novlar.includes(n.key);
          return (
            <button
              key={n.key}
              type="button"
              onClick={() => toggleNov(n.key)}
              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10.5px] font-medium transition ${
                on
                  ? "border-primary/40 bg-primary/15 text-primary"
                  : "border-border text-muted-foreground hover:bg-secondary"
              }`}
            >
              <n.Icon className="h-3 w-3" />
              {n.label}
            </button>
          );
        })}
      </div>

      {/* Row 3: Status pill-ləri */}
      <div className="flex flex-wrap items-center gap-1">
        <span className="min-w-[60px] text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Status
        </span>
        {STATUS_OPTS.map((s) => {
          const on = statuses.includes(s.key);
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => toggleStatus(s.key)}
              className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10.5px] font-medium transition ${
                on
                  ? "border-primary/40 bg-primary/15 text-primary"
                  : "border-border text-muted-foreground hover:bg-secondary"
              }`}
            >
              {s.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
