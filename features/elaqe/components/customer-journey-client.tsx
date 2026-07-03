"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Filter, Search, FileDown, Printer, FileText as FileTextIcon,
  ShoppingBag, ArrowDownToLine, ArrowUpFromLine, RotateCcw, Wrench, MessageCircle,
  type LucideIcon, X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatMoney, formatDate } from "@/lib/utils";
import { TimelinePeekButton } from "./timeline-peek-drawer";

type JourneyKind = "lead" | "sale" | "return" | "servis" | "elaqe" | "payment_in" | "payment_out";

type JourneyMeta = {
  sened_nomresi?: string | null;
  qalig?: number | null;
  odenilmis?: number | null;
  odenis_nov?: string | null;
  products?: string[];
  hesab_ad?: string | null;
  bound_invoices?: string[];
  href?: string | null;
};

export type JourneyItem = {
  ts: string; // ISO (serializable)
  kind: JourneyKind;
  title: string;
  subtitle: string | null;
  amount: number | null;
  ref_id: string | null;
  meta?: JourneyMeta;
};

const KIND_META: Record<JourneyKind, { label: string; icon: LucideIcon; tone: string }> = {
  lead:        { label: "Lead",     icon: MessageCircle,     tone: "border-slate-500/40 bg-slate-50 text-slate-700" },
  sale:        { label: "Satış",    icon: ShoppingBag,       tone: "border-amber-500/40 bg-amber-50 text-amber-700" },
  return:      { label: "Qaytarma", icon: RotateCcw,         tone: "border-sky-500/40 bg-sky-50 text-sky-700" },
  servis:      { label: "Servis",   icon: Wrench,            tone: "border-violet-500/40 bg-violet-50 text-violet-700" },
  elaqe:       { label: "Əlaqə",    icon: MessageCircle,     tone: "border-slate-500/40 bg-slate-50 text-slate-700" },
  payment_in:  { label: "Ödəniş",   icon: ArrowDownToLine,   tone: "border-emerald-500/40 bg-emerald-50 text-emerald-700" },
  payment_out: { label: "Çıxış",    icon: ArrowUpFromLine,   tone: "border-rose-500/40 bg-rose-50 text-rose-700" },
};

const KIND_FILTERS: { value: JourneyKind | "all"; label: string }[] = [
  { value: "all",         label: "Hamısı" },
  { value: "sale",        label: "Satışlar" },
  { value: "payment_in",  label: "Ödənişlər" },
  { value: "payment_out", label: "Çıxışlar" },
  { value: "return",      label: "Qaytarmalar" },
  { value: "servis",      label: "Servis" },
];

export function CustomerJourneyClient({
  customerName,
  items,
}: {
  customerName: string;
  items: JourneyItem[];
}) {
  const [kindFilter, setKindFilter] = useState<JourneyKind | "all">("all");
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const fromTs = from ? new Date(from).getTime() : 0;
    const toTs = to ? new Date(to + "T23:59:59").getTime() : Infinity;
    return items.filter((e) => {
      if (kindFilter !== "all" && e.kind !== kindFilter) return false;
      const ts = new Date(e.ts).getTime();
      if (ts < fromTs || ts > toTs) return false;
      if (q) {
        const hay = [
          e.title,
          e.subtitle ?? "",
          e.meta?.sened_nomresi ?? "",
          ...(e.meta?.products ?? []),
          ...(e.meta?.bound_invoices ?? []),
          e.meta?.hesab_ad ?? "",
          e.amount != null ? String(e.amount) : "",
        ].join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [items, kindFilter, search, from, to]);

  const summary = useMemo(() => {
    let inSum = 0;
    let outSum = 0;
    let saleCount = 0;
    let paymentCount = 0;
    for (const e of filtered) {
      if (e.amount != null) {
        if (e.kind === "payment_in") { inSum += e.amount; paymentCount++; }
        if (e.kind === "payment_out") { outSum += e.amount; }
        if (e.kind === "sale") { saleCount++; }
      }
    }
    return { inSum, outSum, saleCount, paymentCount, count: filtered.length };
  }, [filtered]);

  function csvCell(v: unknown): string {
    if (v == null) return "";
    const s = String(v);
    if (/[",\n;]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  }

  function exportCSV() {
    const header = "Tarix,Növ,Sənəd №,Başlıq,Təsviri,Məhsullar,Bağlandığı qaimələr,Hesab,Məbləğ,Qalıq";
    const lines = [header];
    for (const e of filtered) {
      lines.push(
        [
          csvCell(new Date(e.ts).toISOString().slice(0, 10)),
          csvCell(KIND_META[e.kind].label),
          csvCell(e.meta?.sened_nomresi ?? ""),
          csvCell(e.title),
          csvCell(e.subtitle ?? ""),
          csvCell((e.meta?.products ?? []).join("; ")),
          csvCell((e.meta?.bound_invoices ?? []).join("; ")),
          csvCell(e.meta?.hesab_ad ?? ""),
          csvCell(e.amount?.toFixed(2) ?? ""),
          csvCell(e.meta?.qalig?.toFixed(2) ?? ""),
        ].join(","),
      );
    }
    lines.push("");
    lines.push(`Cəmi əməliyyat,${summary.count},,,,,,,,`);
    lines.push(`Cəmi gəlir,,,,,,,,${summary.inSum.toFixed(2)},`);
    lines.push(`Cəmi xərc,,,,,,,,${summary.outSum.toFixed(2)},`);
    const csv = lines.join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${customerName.replace(/[^a-zA-Z0-9_-]/g, "_")}-sefer-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportPrint() {
    // Yeni pəncərədə qaimə-vəri çap formatı
    const w = window.open("", "_blank", "width=900,height=700");
    if (!w) return;
    const rows = filtered.map((e) => {
      const meta = KIND_META[e.kind];
      const productsLine = (e.meta?.products ?? []).join(", ");
      const boundLine = (e.meta?.bound_invoices ?? []).join(", ");
      return `
        <tr>
          <td>${formatDate(e.ts)}</td>
          <td><span style="display:inline-block;padding:2px 6px;border-radius:4px;font-size:10px;border:1px solid #ccc">${meta.label}</span></td>
          <td>${e.meta?.sened_nomresi ?? ""}</td>
          <td>${e.title}${e.subtitle ? `<br/><small style="color:#666">${e.subtitle}</small>` : ""}${productsLine ? `<br/><small>📦 ${productsLine}</small>` : ""}${boundLine ? `<br/><small style="color:#059669">→ ${boundLine}</small>` : ""}</td>
          <td>${e.meta?.hesab_ad ?? ""}</td>
          <td style="text-align:right;font-weight:600">${e.amount != null ? formatMoney(e.amount) : ""}</td>
          <td style="text-align:right;color:#dc2626">${e.meta?.qalig != null && e.meta.qalig > 0 ? formatMoney(e.meta.qalig) : ""}</td>
        </tr>
      `;
    }).join("");
    const html = `<!doctype html><html><head><meta charset="utf-8"/><title>${customerName} — Səfər</title>
      <style>
        body{font-family:system-ui,-apple-system,sans-serif;padding:20px;color:#111;}
        h1{margin:0 0 4px 0;font-size:20px;}
        .meta{color:#666;font-size:12px;margin-bottom:16px;}
        .summary{display:flex;gap:16px;border:1px solid #eee;padding:10px;border-radius:8px;margin-bottom:16px;font-size:12px;}
        .summary div{flex:1}
        .summary .lab{color:#666;font-size:10px;text-transform:uppercase}
        .summary .val{font-weight:700;font-size:14px;tabular-nums}
        table{width:100%;border-collapse:collapse;font-size:11px;}
        th,td{border-bottom:1px solid #eee;padding:6px 8px;text-align:left;vertical-align:top;}
        th{background:#f8fafc;font-weight:600;text-transform:uppercase;font-size:10px;}
        small{font-size:10px}
        @media print {
          .no-print{display:none}
          body{padding:10px}
        }
      </style></head><body>
      <h1>${customerName} — Səfər tarixçəsi</h1>
      <div class="meta">Çap tarixi: ${formatDate(new Date(), { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" })} · ${filtered.length} əməliyyat${from || to ? ` · Dövr: ${from || "başlanğıc"} → ${to || "indi"}` : ""}</div>
      <div class="summary">
        <div><div class="lab">Əməliyyat</div><div class="val">${summary.count}</div></div>
        <div><div class="lab">Cəmi gəlir</div><div class="val" style="color:#059669">+${formatMoney(summary.inSum)}</div></div>
        <div><div class="lab">Cəmi xərc</div><div class="val" style="color:#dc2626">-${formatMoney(summary.outSum)}</div></div>
        <div><div class="lab">Net</div><div class="val">${formatMoney(summary.inSum - summary.outSum)}</div></div>
      </div>
      <table>
        <thead><tr><th>Tarix</th><th>Növ</th><th>Sənəd №</th><th>Təsviri</th><th>Hesab</th><th style="text-align:right">Məbləğ</th><th style="text-align:right">Qalıq</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="no-print" style="margin-top:20px;text-align:center;">
        <button onclick="window.print()" style="padding:8px 16px;font-size:13px;cursor:pointer;border:1px solid #ccc;border-radius:6px;background:#fff;">🖨 Çap et / PDF saxla</button>
      </div>
      </body></html>`;
    w.document.write(html);
    w.document.close();
  }

  const hasFilters = kindFilter !== "all" || search !== "" || from !== "" || to !== "";

  return (
    <div className="space-y-3">
      {/* Filter bar */}
      <div className="space-y-2 rounded-xl border border-border bg-card/40 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="🔍 Real-time axtarış — sənəd, məhsul, qaimə, məbləğ..."
              className="h-9 w-full rounded-md border border-input bg-background pl-8 pr-3 text-sm"
            />
          </div>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-2 text-xs"
          />
          <span className="text-xs text-muted-foreground">—</span>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-2 text-xs"
          />
          {hasFilters && (
            <button
              type="button"
              onClick={() => { setKindFilter("all"); setSearch(""); setFrom(""); setTo(""); }}
              className="inline-flex h-9 items-center gap-1 rounded-md border border-border bg-background px-2 text-xs hover:bg-secondary"
            >
              <X className="h-3 w-3" /> Sıfırla
            </button>
          )}
        </div>

        {/* Kind pills + export */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-1">
            <Filter className="mr-1 mt-1 h-3 w-3 text-muted-foreground" />
            {KIND_FILTERS.map((k) => (
              <button
                key={k.value}
                type="button"
                onClick={() => setKindFilter(k.value)}
                className={`inline-flex h-7 items-center rounded-full border px-2.5 text-[11px] font-medium transition ${
                  kindFilter === k.value
                    ? "border-primary/40 bg-primary/15 text-primary-light"
                    : "border-border bg-card text-muted-foreground hover:text-foreground"
                }`}
              >
                {k.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={exportCSV}
              disabled={filtered.length === 0}
              className="inline-flex items-center gap-1.5 rounded-md border border-emerald-300 bg-emerald-50 px-2.5 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
            >
              <FileDown className="h-3.5 w-3.5" /> Excel (CSV)
            </button>
            <button
              type="button"
              onClick={exportPrint}
              disabled={filtered.length === 0}
              className="inline-flex items-center gap-1.5 rounded-md border border-sky-300 bg-sky-50 px-2.5 py-1.5 text-xs font-medium text-sky-700 hover:bg-sky-100 disabled:opacity-50"
            >
              <Printer className="h-3.5 w-3.5" /> PDF / Çap
            </button>
          </div>
        </div>

        {/* Summary */}
        {filtered.length > 0 && (
          <div className="flex flex-wrap items-center gap-3 rounded-md border border-border bg-background/40 px-3 py-2 text-xs">
            <span><strong>{summary.count}</strong> əməliyyat</span>
            <span className="text-emerald-600">+{formatMoney(summary.inSum)} gəlir</span>
            <span className="text-rose-600">-{formatMoney(summary.outSum)} çıxış</span>
            <span className="ml-auto font-semibold">Net: {formatMoney(summary.inSum - summary.outSum)}</span>
          </div>
        )}
      </div>

      {/* Timeline */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-background/40 py-10 text-center text-sm text-muted-foreground">
          Bu filtrə uyğun əməliyyat yoxdur
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card/40">
          <div className="relative px-4 py-3">
            <div className="absolute left-[26px] top-3 bottom-3 w-px bg-border/40" />
            <ul className="space-y-3">
              {filtered.map((e, i) => {
                const meta = KIND_META[e.kind];
                const Icon = meta.icon;
                const m = e.meta;
                const href = m?.href ?? (e.kind === "sale" && e.ref_id ? `/ticaret/satislar/${e.ref_id}` : null);
                const isPayment = e.kind === "payment_in" || e.kind === "payment_out";
                const isSale = e.kind === "sale";
                const peekable = ["sale", "payment_in", "payment_out", "return", "servis"].includes(e.kind);
                return (
                  <li key={`${e.kind}-${e.ref_id ?? i}-${i}`} className="relative flex items-start gap-3 pl-1">
                    <div className={`grid h-7 w-7 flex-shrink-0 place-items-center rounded-full border ${meta.tone}`}>
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0 flex-1 pt-0.5">
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        {href ? (
                          <Link href={href} className="font-medium hover:text-primary-light">{e.title}</Link>
                        ) : (
                          <span className="font-medium">{e.title}</span>
                        )}
                        <Badge variant="outline" className={`text-[10px] ${meta.tone}`}>{meta.label}</Badge>
                        {isSale && m && m.qalig != null && m.qalig > 0.01 && (
                          <Badge variant="outline" className="text-[10px] border-rose-500/40 bg-rose-500/10 text-rose-700">
                            Qalıq: {formatMoney(m.qalig)}
                          </Badge>
                        )}
                        {isSale && m && m.qalig != null && m.qalig <= 0.01 && Number(m.odenilmis ?? 0) > 0 && (
                          <Badge variant="outline" className="text-[10px] border-emerald-500/40 bg-emerald-500/10 text-emerald-700">
                            Tam ödənilib
                          </Badge>
                        )}
                      </div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {formatDate(e.ts)}{e.subtitle ? ` · ${e.subtitle}` : ""}
                      </div>
                      {isSale && m?.products && m.products.length > 0 && (
                        <div className="mt-0.5 text-[11px] text-muted-foreground line-clamp-1">
                          📦 {m.products.slice(0, 3).join(", ")}
                        </div>
                      )}
                      {isPayment && m?.bound_invoices && m.bound_invoices.length > 0 && (
                        <div className="mt-0.5 flex flex-wrap items-center gap-1 text-[10px]">
                          <span className="text-muted-foreground">Bağlandı:</span>
                          {m.bound_invoices.slice(0, 3).map((nomre, j) => (
                            <span key={j} className="rounded border border-emerald-300 bg-emerald-50 px-1 py-0.5 font-mono font-medium text-emerald-700">
                              {nomre}
                            </span>
                          ))}
                          {m.bound_invoices.length > 3 && (
                            <span className="text-muted-foreground">+{m.bound_invoices.length - 3}</span>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {e.amount !== null && (
                        <div className={`text-right text-sm font-semibold tabular-nums ${
                          isPayment
                            ? (e.kind === "payment_in" ? "text-emerald-600" : "text-rose-600")
                            : isSale && m?.qalig != null && m.qalig > 0.01
                              ? "text-rose-600"
                              : "text-foreground"
                        }`}>
                          {isPayment && e.kind === "payment_in" ? "+" : ""}
                          {isPayment && e.kind === "payment_out" ? "-" : ""}
                          {formatMoney(e.amount)}
                        </div>
                      )}
                      {peekable && e.ref_id ? (
                        <TimelinePeekButton
                          kind={e.kind as "sale" | "payment_in" | "payment_out" | "return" | "servis"}
                          refId={e.ref_id}
                          fullPageHref={href ?? null}
                        />
                      ) : href ? (
                        <Link
                          href={href}
                          className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-1.5 py-0.5 text-[10px] hover:bg-secondary"
                        >
                          Bax
                        </Link>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

void FileTextIcon; // import-i istifadə olunan saxla
