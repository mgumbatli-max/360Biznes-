"use client";

/**
 * "Sürətli Qaytarma" — full-page scanner with **two tabs**.
 *
 * Visual target: /tmp/s3.png  (rose-red header banner, white body,
 * rose-50 sidebar on the right).
 *
 *   ┌──── Sürətli Qaytarma — Skan ──────────────────────── × Bağla ─┐  rose-600
 *   ├───────────────────────────────────┬─────────────────────────  │
 *   │  [ tab1 ]  [ tab2 (rose-700) ]    │   Sətir sayı: 0          │
 *   │                                   │   Tam ödəniş əvvəl: 0₼    │
 *   │  [ scan / sifariş ID input ]      │   Qaytarılacaq: 0₼ (big)  │
 *   │                                   │   Səbəb ▼                 │
 *   │  Placeholder / lines preview      │   Qaytarma növü ▼         │
 *   │                                   │   Qeyd                    │
 *   │                                   │   [ Boşalt ] [ Bağla ]    │
 *   │                                   │   [ QAYTAR (F9) ]         │
 *   ├─── F2 Mod dəyiş   F3 Kod sahə   Enter Tap   F9 Qaytar   Esc ──┘
 *
 * Tab 1: "Müştəri qaytarması (satış kodu)" — old barcode-of-line flow.
 *        Scanning a barcode → `scanLookup` finds the latest sale row that
 *        contains it, lets the cashier confirm miqdar/qiymet → `fastReturn`.
 *
 * Tab 2: "Birmarket / Marketplace" — order-code flow.
 *        Cashier types/scans an external order code → `findSaleByCode`
 *        resolves the full sale → all lines are pre-filled as "qaytar" →
 *        `returnFullSale` creates a single bulk qaytarma row & reverses
 *        marketplace komissiya finance op.
 */

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ScanBarcode,
  X,
  Eraser,
  RefreshCw,
  AlertTriangle,
  PackageCheck,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn, formatMoney } from "@/lib/utils";
import {
  scanLookup,
  fastReturn,
  findSaleByCodeAction,
  returnFullSale,
  type ScanLookupResult,
} from "../qaytarma-tez-actions";
import type { SaleByCodeResult } from "../sale-lookup";

type AnbarOption = { id: number; ad: string };

const REASONS = [
  "Defekt",
  "Səhv məhsul",
  "Müştəri istəmir",
  "Sifariş ləğv edildi",
  "Zədəli",
  "Tarixi keçib",
  "Digər",
];

const RETURN_TYPES = [
  { value: "pul", label: "Pul qaytarılır" },
  { value: "kredit", label: "Kreditə yaz" },
  { value: "deyisme", label: "Dəyişdirmə" },
];

type Mode = "musteri" | "marketplace";

export function QuickReturnScanner({ anbarlar }: { anbarlar: AnbarOption[] }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const [mode, setMode] = useState<Mode>("musteri");
  const [scan, setScan] = useState("");
  const [busy, setBusy] = useState(false);

  /* Tab 1 — single-line barcode flow ---------------------------------- */
  const [lineResult, setLineResult] = useState<ScanLookupResult | null>(null);
  const [miqdar, setMiqdar] = useState("1");
  const [vahidQiymet, setVahidQiymet] = useState("0");
  const [anbarId, setAnbarId] = useState<string>("");

  /* Tab 2 — marketplace sale-by-code flow ----------------------------- */
  const [saleResult, setSaleResult] = useState<SaleByCodeResult | null>(null);

  /* Shared sidebar state --------------------------------------------- */
  const [sebeb, setSebeb] = useState(REASONS[0]);
  const [returnType, setReturnType] = useState(RETURN_TYPES[0].value);
  const [qeyd, setQeyd] = useState("");
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const [, startTransition] = useTransition();

  /* Auto-focus the input on mount & whenever mode flips. */
  useEffect(() => {
    inputRef.current?.focus();
  }, [mode]);

  /* Stats for the right-sidebar. */
  let satirSayi = 0;
  let tamMebleg = 0;
  let qaytarilacaq = 0;
  if (mode === "musteri" && lineResult?.ok) {
    satirSayi = 1;
    const m = Number(miqdar) || 0;
    const q = Number(vahidQiymet) || 0;
    tamMebleg = m * q;
    qaytarilacaq = m * q;
  } else if (mode === "marketplace" && saleResult) {
    satirSayi = saleResult.lines.length;
    tamMebleg = saleResult.son_mebleg;
    qaytarilacaq = saleResult.lines.reduce((s, l) => s + l.cem, 0);
  }

  function reset() {
    setScan("");
    setLineResult(null);
    setSaleResult(null);
    setMiqdar("1");
    setVahidQiymet("0");
    setAnbarId("");
    setSebeb(REASONS[0]);
    setReturnType(RETURN_TYPES[0].value);
    setQeyd("");
    setMsg(null);
    inputRef.current?.focus();
  }

  function closeAndReturn() {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push("/ticaret/qaytarma");
    }
  }

  /* ── Lookup handlers ─────────────────────────────────────────────── */
  async function doLookup() {
    const value = scan.trim();
    if (!value) return;
    setBusy(true);
    setMsg(null);
    try {
      if (mode === "musteri") {
        const r = await scanLookup(value);
        setLineResult(r);
        if (r.ok) {
          setVahidQiymet(
            String(r.recent_sale?.vahid_qiymet ?? r.mehsul.satis_qiymeti),
          );
          setAnbarId(r.recent_sale?.anbar_id ? String(r.recent_sale.anbar_id) : "");
        }
      } else {
        const r = await findSaleByCodeAction(value);
        if (!r) {
          setSaleResult(null);
          setMsg({ kind: "err", text: "Bu kod üzrə satış tapılmadı" });
        } else {
          setSaleResult(r);
          setMsg(null);
        }
      }
    } finally {
      setBusy(false);
    }
  }

  /* ── Submit (QAYTAR) ─────────────────────────────────────────────── */
  const submit = useCallback(async () => {
    setMsg(null);
    if (mode === "musteri") {
      if (!lineResult?.ok) {
        setMsg({ kind: "err", text: "Əvvəl barkod skan et" });
        return;
      }
      const m = Number(miqdar);
      const q = Number(vahidQiymet);
      if (!Number.isFinite(m) || m <= 0) {
        setMsg({ kind: "err", text: "Miqdar düzgün deyil" });
        return;
      }
      setBusy(true);
      const qeydParts = [qeyd, `[QAYTARMA-NOV:${returnType}]`].filter(Boolean);
      const r = await fastReturn({
        mehsul_id: lineResult.mehsul.id,
        miqdar: m,
        vahid_qiymet: q,
        anbar_id: anbarId ? Number(anbarId) : null,
        original_sale_id: lineResult.recent_sale?.id ?? null,
        musteri_id: null,
        sebeb,
        qeyd: qeydParts.join("\n") || undefined,
      });
      setBusy(false);
      if (!r.ok) {
        setMsg({ kind: "err", text: r.error });
      } else {
        setMsg({ kind: "ok", text: `Qaytarma yaradıldı: ${r.nomre}` });
        startTransition(() => router.refresh());
        window.setTimeout(reset, 1200);
      }
    } else {
      if (!saleResult) {
        setMsg({ kind: "err", text: "Əvvəl sifariş kodunu tap" });
        return;
      }
      setBusy(true);
      const qeydParts = [qeyd, `[QAYTARMA-NOV:${returnType}]`].filter(Boolean);
      const r = await returnFullSale({
        satis_id: saleResult.id,
        sebeb,
        qeyd: qeydParts.join("\n") || undefined,
      });
      setBusy(false);
      if (!r.ok) {
        setMsg({ kind: "err", text: r.error });
      } else {
        setMsg({
          kind: "ok",
          text: `Qaytarma: ${r.nomre}${r.reversed_finance ? " (komissiya geri)" : ""}`,
        });
        startTransition(() => router.refresh());
        window.setTimeout(reset, 1500);
      }
    }
  }, [mode, lineResult, saleResult, miqdar, vahidQiymet, anbarId, sebeb, qeyd, returnType, router]);

  /* ── Keyboard shortcuts ─────────────────────────────────────────── */
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "F2") {
        e.preventDefault();
        setMode((m) => (m === "musteri" ? "marketplace" : "musteri"));
      } else if (e.key === "F3") {
        e.preventDefault();
        inputRef.current?.focus();
      } else if (e.key === "F9") {
        e.preventDefault();
        submit();
      } else if (e.key === "Escape") {
        // Esc clears the scan input first; second Esc closes.
        if (scan) setScan("");
        else closeAndReturn();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submit, scan]);

  return (
    <div className="-mx-2 -mt-2 overflow-hidden rounded-xl border border-border bg-card">
      {/* ── Rose header ───────────────────────────────────────────── */}
      <div className="flex h-12 items-center justify-between bg-rose-600 px-4 text-white">
        <h2 className="flex items-center gap-2 text-sm font-semibold tracking-tight">
          <ScanBarcode className="h-4 w-4" />
          Sürətli Qaytarma — Skan
        </h2>
        <button
          type="button"
          onClick={closeAndReturn}
          className="inline-flex items-center gap-1 rounded-md bg-white/10 px-2 py-1 text-xs hover:bg-white/20"
        >
          <X className="h-3.5 w-3.5" />
          Bağla
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px]">
        {/* ── Left: tabs + body ─────────────────────────────────── */}
        <div className="border-b border-border lg:border-b-0 lg:border-r">
          {/* Tab bar */}
          <div className="grid grid-cols-2 border-b border-border">
            <TabBtn
              active={mode === "musteri"}
              onClick={() => setMode("musteri")}
              label="Müştəri qaytarması (satış kodu)"
            />
            <TabBtn
              active={mode === "marketplace"}
              onClick={() => setMode("marketplace")}
              label="Birmarket / Marketplace"
            />
          </div>

          {/* Scan input */}
          <div className="p-4">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                doLookup();
              }}
              className="flex items-center gap-2 rounded-lg border-2 border-rose-500/60 bg-background px-3 py-2 focus-within:border-rose-500"
            >
              <Search className="h-4 w-4 text-rose-500" />
              <input
                ref={inputRef}
                value={scan}
                onChange={(e) => setScan(e.target.value)}
                placeholder={
                  mode === "musteri"
                    ? "Barkod, kod və ya məhsul adı…"
                    : "Birmarket sifariş ID-sini yaz…"
                }
                className="flex-1 bg-transparent text-sm outline-none"
              />
              {scan && (
                <button
                  type="button"
                  onClick={() => setScan("")}
                  className="text-muted-foreground hover:text-foreground"
                  title="Təmizlə"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
              <Button
                type="submit"
                size="sm"
                disabled={busy || !scan.trim()}
                className="h-7 bg-rose-500 text-white hover:bg-rose-600"
              >
                {busy ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : "Tap"}
              </Button>
            </form>

            {msg?.kind === "err" && !lineResult?.ok && !saleResult && (
              <div className="mt-3 flex items-start gap-2 rounded-lg border border-danger/30 bg-danger/10 p-3 text-sm text-danger">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{msg.text}</span>
              </div>
            )}

            {/* Body — empty placeholder OR result */}
            <div className="mt-6 min-h-[260px]">
              {mode === "musteri" && lineResult?.ok && (
                <CustomerLineResult
                  result={lineResult}
                  anbarlar={anbarlar}
                  miqdar={miqdar}
                  setMiqdar={setMiqdar}
                  vahidQiymet={vahidQiymet}
                  setVahidQiymet={setVahidQiymet}
                  anbarId={anbarId}
                  setAnbarId={setAnbarId}
                />
              )}
              {mode === "marketplace" && saleResult && (
                <MarketplaceSaleResult result={saleResult} />
              )}
              {((mode === "musteri" && !lineResult) ||
                (mode === "marketplace" && !saleResult)) && (
                <div className="grid place-items-center py-8 text-center text-xs text-muted-foreground">
                  <ScanBarcode className="mb-3 h-8 w-8 text-rose-200" />
                  <div className="font-medium text-foreground/70">
                    {mode === "musteri"
                      ? "Barkod scan et və ya yaz"
                      : "Satış kodu scan et və ya yaz"}
                  </div>
                  <div className="mt-1">
                    {mode === "musteri"
                      ? "Sistem son satışı tapacaq və qaytarma sətirini avto dolduracaq"
                      : "Sistem orijinal satışı tapacaq və qaytarma sətirlərini avto dolduracaq"}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Right: stats + reason / type / qeyd + actions ─────── */}
        <aside className="bg-rose-50/40 p-4">
          <Stat label="Sətir sayı" value={String(satirSayi)} />
          <Stat label="Tam ödəniş əvvəl" value={formatMoney(tamMebleg)} />
          <div className="mt-3 rounded-lg border border-rose-200 bg-white/70 p-3">
            <div className="text-[10px] uppercase tracking-wider text-rose-600">
              Qaytarılacaq
            </div>
            <div className="mt-0.5 text-2xl font-bold tabular-nums text-rose-700">
              {formatMoney(qaytarilacaq)}
            </div>
          </div>

          <div className="mt-4 space-y-2">
            <div>
              <Label1>Səbəb *</Label1>
              <select
                value={sebeb}
                onChange={(e) => setSebeb(e.target.value)}
                className="block h-8 w-full rounded-md border border-border bg-background px-2 text-xs"
              >
                {REASONS.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
            <div>
              <Label1>Qaytarma növü</Label1>
              <select
                value={returnType}
                onChange={(e) => setReturnType(e.target.value)}
                className="block h-8 w-full rounded-md border border-border bg-background px-2 text-xs"
              >
                {RETURN_TYPES.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>
            <div>
              <Label1>Qeyd</Label1>
              <textarea
                value={qeyd}
                onChange={(e) => setQeyd(e.target.value)}
                rows={2}
                placeholder="opsional"
                className="block w-full rounded-md border border-border bg-background px-2 py-1 text-xs"
              />
            </div>
          </div>

          {msg?.kind === "ok" && (
            <div className="mt-3 rounded-md border border-success/30 bg-success/10 p-2 text-xs text-success">
              <PackageCheck className="mr-1 inline h-3.5 w-3.5" />
              {msg.text}
            </div>
          )}
          {msg?.kind === "err" && (lineResult?.ok || saleResult) && (
            <div className="mt-3 rounded-md border border-danger/30 bg-danger/10 p-2 text-xs text-danger">
              {msg.text}
            </div>
          )}

          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={reset}
              className="h-9"
            >
              <Eraser className="h-3.5 w-3.5" />
              Boşalt
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={closeAndReturn}
              className="h-9"
            >
              Bağla
            </Button>
          </div>
          <Button
            type="button"
            onClick={submit}
            disabled={
              busy ||
              (mode === "musteri" ? !lineResult?.ok : !saleResult)
            }
            className="mt-2 h-10 w-full bg-rose-600 text-sm font-semibold text-white hover:bg-rose-700"
          >
            {busy ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              "QAYTAR (F9)"
            )}
          </Button>
        </aside>
      </div>

      {/* Footer hints */}
      <div className="border-t border-border bg-secondary/40 px-4 py-1.5 text-[10px] text-muted-foreground">
        <span className="mr-3"><K>F2</K> Mod dəyiş</span>
        <span className="mr-3"><K>F3</K> Kod sahə</span>
        <span className="mr-3"><K>Enter</K> Tap</span>
        <span className="mr-3"><K>F9</K> Qaytar</span>
        <span className="mr-3"><K>Esc</K> Bağla</span>
      </div>
    </div>
  );
}

/* ── Tab button ─────────────────────────────────────────────────── */
function TabBtn({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "px-4 py-3 text-sm font-medium transition",
        active
          ? "bg-rose-700 text-white"
          : "bg-background text-foreground hover:bg-secondary",
      )}
    >
      {label}
    </button>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-rose-200/50 py-1.5 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular-nums font-medium">{value}</span>
    </div>
  );
}

function Label1({ children }: { children: React.ReactNode }) {
  return (
    <label className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
      {children}
    </label>
  );
}

function K({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded border border-border bg-background px-1 py-px text-[10px] font-medium text-foreground">
      {children}
    </kbd>
  );
}

/* ── Result panels ──────────────────────────────────────────────── */
function CustomerLineResult({
  result,
  anbarlar,
  miqdar,
  setMiqdar,
  vahidQiymet,
  setVahidQiymet,
  anbarId,
  setAnbarId,
}: {
  result: Extract<ScanLookupResult, { ok: true }>;
  anbarlar: AnbarOption[];
  miqdar: string;
  setMiqdar: (v: string) => void;
  vahidQiymet: string;
  setVahidQiymet: (v: string) => void;
  anbarId: string;
  setAnbarId: (v: string) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-border bg-background p-3">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold truncate">{result.mehsul.ad}</div>
            <div className="mt-0.5 text-[11px] text-muted-foreground">
              {result.mehsul.kod && <span>Kod: {result.mehsul.kod}</span>}
              {result.mehsul.barkod && <span> · BC: {result.mehsul.barkod}</span>}
            </div>
            {result.recent_sale && (
              <div className="mt-1 text-[10.5px] text-muted-foreground">
                Son satış:{" "}
                <span className="font-mono">{result.recent_sale.nomre}</span>{" "}
                · {result.recent_sale.musteri_ad ?? "müştəri yox"}{" "}
                · {new Date(result.recent_sale.tarix).toLocaleDateString("az-AZ")}
              </div>
            )}
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Cari qiymət
            </div>
            <div className="text-sm font-semibold tabular-nums">
              {formatMoney(result.mehsul.satis_qiymeti)}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div>
          <Label1>Miqdar</Label1>
          <Input
            type="number"
            min="0.001"
            step="0.01"
            value={miqdar}
            onChange={(e) => setMiqdar(e.target.value)}
            className="h-8 text-xs tabular-nums"
          />
        </div>
        <div>
          <Label1>Vahid qiyməti</Label1>
          <Input
            type="number"
            min="0"
            step="0.01"
            value={vahidQiymet}
            onChange={(e) => setVahidQiymet(e.target.value)}
            className="h-8 text-xs tabular-nums"
          />
        </div>
        <div>
          <Label1>Anbar</Label1>
          <select
            value={anbarId}
            onChange={(e) => setAnbarId(e.target.value)}
            className="block h-8 w-full rounded-md border border-border bg-background px-2 text-xs"
          >
            <option value="">— ilk anbar —</option>
            {anbarlar.map((a) => (
              <option key={a.id} value={String(a.id)}>{a.ad}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}

function MarketplaceSaleResult({ result }: { result: SaleByCodeResult }) {
  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-border bg-background p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="font-mono text-sm font-semibold">{result.nomre}</div>
            <div className="mt-0.5 text-[11px] text-muted-foreground">
              {result.musteri_ad ?? "—"} · {result.anbar_ad ?? "—"} ·{" "}
              {new Date(result.tarix).toLocaleDateString("az-AZ")}
            </div>
            {result.marketplace_platform && (
              <div className="mt-0.5 inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-medium text-rose-700">
                {result.marketplace_platform}
                {result.sifaris_kodu && <span> · #{result.sifaris_kodu}</span>}
              </div>
            )}
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Yekun
            </div>
            <div className="text-base font-semibold tabular-nums">
              {formatMoney(result.son_mebleg)}
            </div>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-border">
        <table className="w-full text-xs">
          <thead className="bg-card/40 text-left text-[10px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-2 py-1.5">Məhsul</th>
              <th className="px-2 py-1.5 text-right w-14">Miqdar</th>
              <th className="px-2 py-1.5 text-right w-20">Qiymət</th>
              <th className="px-2 py-1.5 text-right w-20">Cəmi</th>
            </tr>
          </thead>
          <tbody>
            {result.lines.map((l) => (
              <tr key={l.id} className="border-t border-border/40">
                <td className="px-2 py-1.5 truncate">
                  {l.mehsul_ad}
                  {l.mehsul_kod && (
                    <small className="ml-1 text-muted-foreground">({l.mehsul_kod})</small>
                  )}
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums">{l.miqdar}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{formatMoney(l.vahid_qiymet)}</td>
                <td className="px-2 py-1.5 text-right tabular-nums font-medium">{formatMoney(l.cem)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
