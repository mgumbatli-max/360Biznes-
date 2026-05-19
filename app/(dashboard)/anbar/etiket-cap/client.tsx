"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Printer,
  Search,
  X,
  Plus,
  Minus,
  Settings2,
  Sparkles,
  Tags,
  Eye,
  Trash2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Barcode } from "@/components/ui/barcode";
import { formatMoney } from "@/lib/utils";
import type { LabelProduct } from "./page";

/* ──────────────────────────────────────────────────────────────────────────
 * Hazır ölçü presetləri (termo printer + A4 grid)
 * ────────────────────────────────────────────────────────────────────────── */
type Preset = {
  id: string;
  label: string;
  desc: string;
  widthMm: number;
  heightMm: number;
  /** A4 grid layoutu (varsa) */
  grid?: { cols: number; rows: number };
};

const PRESETS: Preset[] = [
  { id: "40x30",   label: "40 × 30 mm",  desc: "Mini termo (rəf etiketi)", widthMm: 40,  heightMm: 30 },
  { id: "50x30",   label: "50 × 30 mm",  desc: "Standart termo",            widthMm: 50,  heightMm: 30 },
  { id: "58x40",   label: "58 × 40 mm",  desc: "Orta termo",                widthMm: 58,  heightMm: 40 },
  { id: "100x60",  label: "100 × 60 mm", desc: "Böyük termo",               widthMm: 100, heightMm: 60 },
  { id: "a4-3x8",  label: "A4 — 3×8",    desc: "24 etiket / A4",            widthMm: 68,  heightMm: 34, grid: { cols: 3, rows: 8 } },
  { id: "a4-4x10", label: "A4 — 4×10",   desc: "40 etiket / A4",            widthMm: 50,  heightMm: 27, grid: { cols: 4, rows: 10 } },
  { id: "custom",  label: "Custom",       desc: "Özün təyin et",            widthMm: 60,  heightMm: 40 },
];

/* ──────────────────────────────────────────────────────────────────────────
 * Content / Layout konfiqurasiyası
 * ────────────────────────────────────────────────────────────────────────── */
type FontSize = "xs" | "sm" | "md" | "lg";
type Align = "center" | "left" | "right";
type Layout = "name-barcode-price" | "barcode-name-price" | "price-name-barcode";

const FONT_SIZES: Record<FontSize, { name: string; price: string; meta: string; barCode: string }> = {
  xs: { name: "text-[7pt]",  price: "text-[8pt]",  meta: "text-[6pt]",  barCode: "text-[6pt]" },
  sm: { name: "text-[8pt]",  price: "text-[10pt]", meta: "text-[7pt]",  barCode: "text-[7pt]" },
  md: { name: "text-[10pt]", price: "text-[12pt]", meta: "text-[8pt]",  barCode: "text-[8pt]" },
  lg: { name: "text-[12pt]", price: "text-[14pt]", meta: "text-[9pt]",  barCode: "text-[9pt]" },
};

const ALIGN_CLS: Record<Align, string> = {
  center: "items-center text-center",
  left: "items-start text-left",
  right: "items-end text-right",
};

export function LabelPrintClient({
  preselected,
  catalog,
}: {
  preselected: LabelProduct[];
  catalog: LabelProduct[];
}) {
  // ── Ölçü ────────────────────────────────
  const [presetId, setPresetId] = useState<string>("50x30");
  const [customW, setCustomW] = useState(60);
  const [customH, setCustomH] = useState(40);

  // ── Content toggles ────────────────────
  const [showName, setShowName]         = useState(true);
  const [showBarcode, setShowBarcode]   = useState(true);
  const [showBarcodeText, setShowBarText] = useState(true);
  const [showPrice, setShowPrice]       = useState(true);
  const [showDiscount, setShowDiscount] = useState(false);
  const [showCode, setShowCode]         = useState(false);
  const [showMarka, setShowMarka]       = useState(false);
  const [showKateqoriya, setShowKateqoriya] = useState(false);

  // ── Style ──────────────────────────────
  const [fontSize, setFontSize] = useState<FontSize>("sm");
  const [align, setAlign] = useState<Align>("center");
  const [layout, setLayout] = useState<Layout>("name-barcode-price");
  const [bordered, setBordered] = useState(true);

  // ── UI ─────────────────────────────────
  const [search, setSearch] = useState("");
  const [advanced, setAdvanced] = useState(false);

  // ── Items ──────────────────────────────
  const [items, setItems] = useState<Map<string, { p: LabelProduct; qty: number }>>(
    () => new Map(preselected.map((p) => [p.id, { p, qty: 1 }]))
  );

  const preset = PRESETS.find((p) => p.id === presetId) ?? PRESETS[1];
  const widthMm = presetId === "custom" ? customW : preset.widthMm;
  const heightMm = presetId === "custom" ? customH : preset.heightMm;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return catalog.slice(0, 30);
    return catalog
      .filter(
        (p) =>
          p.ad.toLowerCase().includes(q) ||
          (p.kod ?? "").toLowerCase().includes(q) ||
          (p.barkod ?? "").includes(q),
      )
      .slice(0, 30);
  }, [catalog, search]);

  function add(p: LabelProduct) {
    setItems((prev) => {
      const next = new Map(prev);
      const cur = next.get(p.id);
      next.set(p.id, { p, qty: cur ? cur.qty + 1 : 1 });
      return next;
    });
  }
  function remove(id: string) {
    setItems((prev) => {
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  }
  function setQty(id: string, qty: number) {
    setItems((prev) => {
      const next = new Map(prev);
      const cur = next.get(id);
      if (!cur) return prev;
      next.set(id, { ...cur, qty: Math.max(1, qty) });
      return next;
    });
  }
  function clearAll() {
    setItems(new Map());
  }

  // Flatten items × qty
  const labels = useMemo(() => {
    const out: LabelProduct[] = [];
    for (const { p, qty } of items.values()) for (let i = 0; i < qty; i++) out.push(p);
    return out;
  }, [items]);

  // ── Render ──────────────────────────────
  return (
    <>
      <style jsx global>{`
        @media print {
          html, body { margin: 0; padding: 0; background: #fff; color: #000; }
          .no-print { display: none !important; }
          .print-sheet { padding: 4mm; }
          @page { size: ${preset.grid ? "A4" : `${widthMm}mm ${heightMm}mm`}; margin: 0; }
        }
      `}</style>

      <div className="mx-auto max-w-7xl space-y-4">
        {/* Top bar */}
        <div className="no-print flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              href="/anbar/mehsullar"
              className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
                <Tags className="h-6 w-6 text-primary" /> Etiket çapı
              </h1>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Real Code128 barkod · özün ölçü təyin et · görmək istədiyini seç · A4 və ya termo printer
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {items.size > 0 && (
              <Button variant="ghost" size="sm" onClick={clearAll} className="text-muted-foreground hover:text-rose-500">
                <Trash2 className="h-3.5 w-3.5" /> Hamısını sil
              </Button>
            )}
            <Button
              onClick={() => window.print()}
              disabled={labels.length === 0}
              className="font-semibold text-white"
              style={{ background: "var(--brand-gradient)" }}
            >
              <Printer className="h-4 w-4" />
              Çap et ({labels.length})
            </Button>
          </div>
        </div>

        {/* Configurator */}
        <div className="no-print grid grid-cols-1 gap-4 lg:grid-cols-[320px_1fr]">
          {/* Left rail — controls */}
          <div className="space-y-3">
            <div className="rounded-xl border border-border bg-card p-3">
              <h3 className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                <Settings2 className="h-3 w-3" /> Etiket ölçüsü
              </h3>
              <div className="grid grid-cols-2 gap-1">
                {PRESETS.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setPresetId(s.id)}
                    className={`rounded-md border px-2 py-1.5 text-left text-[11px] transition ${
                      presetId === s.id
                        ? "border-primary bg-primary/10"
                        : "border-border hover:bg-secondary/40"
                    }`}
                  >
                    <div className="font-semibold">{s.label}</div>
                    <div className="text-[10px] text-muted-foreground">{s.desc}</div>
                  </button>
                ))}
              </div>

              {presetId === "custom" && (
                <div className="mt-2 grid grid-cols-2 gap-2 rounded-md bg-secondary/40 p-2">
                  <div>
                    <label className="text-[10px] font-semibold text-muted-foreground">En (mm)</label>
                    <Input
                      type="number"
                      min={20}
                      max={210}
                      value={customW}
                      onChange={(e) => setCustomW(Math.max(20, Math.min(210, Number(e.target.value))))}
                      className="h-7 text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-muted-foreground">Hündürlük (mm)</label>
                    <Input
                      type="number"
                      min={15}
                      max={297}
                      value={customH}
                      onChange={(e) => setCustomH(Math.max(15, Math.min(297, Number(e.target.value))))}
                      className="h-7 text-xs"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-xl border border-border bg-card p-3">
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Etiketdə göstər
              </h3>
              <div className="space-y-1 text-xs">
                <ToggleRow checked={showName} onChange={setShowName} label="Məhsul adı" />
                <ToggleRow checked={showBarcode} onChange={setShowBarcode} label="Barkod (vizual)" />
                <ToggleRow
                  checked={showBarcodeText}
                  onChange={setShowBarText}
                  label="Barkod mətni"
                  disabled={!showBarcode}
                />
                <ToggleRow checked={showPrice} onChange={setShowPrice} label="Qiymət" />
                <ToggleRow
                  checked={showDiscount}
                  onChange={setShowDiscount}
                  label="Endirim qiyməti (varsa)"
                  disabled={!showPrice}
                />
                <ToggleRow checked={showCode} onChange={setShowCode} label="SKU / kod" />
                <ToggleRow checked={showMarka} onChange={setShowMarka} label="Marka" />
                <ToggleRow checked={showKateqoriya} onChange={setShowKateqoriya} label="Kateqoriya" />
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-3">
              <button
                type="button"
                onClick={() => setAdvanced((v) => !v)}
                className="flex w-full items-center justify-between text-xs font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground"
              >
                <span className="flex items-center gap-1.5">
                  <Sparkles className="h-3 w-3" /> Dizayn ayarları
                </span>
                {advanced ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </button>

              {advanced && (
                <div className="mt-3 space-y-3 text-xs">
                  <div>
                    <label className="mb-1 block text-[10px] font-semibold text-muted-foreground">Şrift ölçüsü</label>
                    <div className="grid grid-cols-4 gap-1">
                      {(["xs", "sm", "md", "lg"] as FontSize[]).map((f) => (
                        <button
                          key={f}
                          type="button"
                          onClick={() => setFontSize(f)}
                          className={`rounded border px-2 py-1 text-[10px] uppercase ${
                            fontSize === f ? "border-primary bg-primary/10 text-primary" : "border-border"
                          }`}
                        >
                          {f}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="mb-1 block text-[10px] font-semibold text-muted-foreground">Düzlənmə</label>
                    <div className="grid grid-cols-3 gap-1">
                      {(["left", "center", "right"] as Align[]).map((a) => (
                        <button
                          key={a}
                          type="button"
                          onClick={() => setAlign(a)}
                          className={`rounded border px-2 py-1 text-[10px] ${
                            align === a ? "border-primary bg-primary/10 text-primary" : "border-border"
                          }`}
                        >
                          {a === "left" ? "Sol" : a === "center" ? "Mərkəz" : "Sağ"}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="mb-1 block text-[10px] font-semibold text-muted-foreground">Layout</label>
                    <div className="space-y-1">
                      <LayoutOpt id="name-barcode-price"   label="Ad → Barkod → Qiymət"  active={layout} onPick={setLayout} />
                      <LayoutOpt id="barcode-name-price"   label="Barkod → Ad → Qiymət"  active={layout} onPick={setLayout} />
                      <LayoutOpt id="price-name-barcode"   label="Qiymət → Ad → Barkod"  active={layout} onPick={setLayout} />
                    </div>
                  </div>

                  <ToggleRow checked={bordered} onChange={setBordered} label="Çərçivə göstər" />
                </div>
              )}
            </div>
          </div>

          {/* Right column — search + selected + preview */}
          <div className="space-y-3">
            <div className="rounded-xl border border-border bg-card p-3">
              <div className="relative mb-2">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Məhsul ad, kod, barkod ilə axtar..."
                  className="pl-8"
                />
              </div>

              {search && (
                <div className="mb-2 max-h-44 overflow-y-auto rounded-md border border-border/50">
                  {filtered.length === 0 ? (
                    <div className="p-3 text-center text-xs text-muted-foreground">Tapılmadı</div>
                  ) : (
                    filtered.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => add(p)}
                        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-secondary/40"
                      >
                        <div className="min-w-0">
                          <div className="truncate font-medium">{p.ad}</div>
                          <div className="text-[10px] text-muted-foreground">
                            {p.kod ?? "—"} · {p.barkod ?? "barkod yox"}
                          </div>
                        </div>
                        <Plus className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                    ))
                  )}
                </div>
              )}

              <h3 className="mb-1.5 flex items-center justify-between text-xs font-bold uppercase tracking-wider text-muted-foreground">
                <span>Seçilmiş ({items.size}, {labels.length} etiket)</span>
              </h3>
              {items.size === 0 ? (
                <div className="rounded-md border border-dashed border-border/50 p-4 text-center text-xs text-muted-foreground">
                  Hələ məhsul seçilməyib. Axtarış ilə əlavə edin.
                </div>
              ) : (
                <div className="max-h-72 overflow-y-auto rounded-md border border-border/50">
                  {Array.from(items.values()).map(({ p, qty }) => (
                    <div
                      key={p.id}
                      className="flex items-center gap-2 border-b border-border/30 px-3 py-1.5 last:border-0"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{p.ad}</div>
                        <div className="text-[10px] text-muted-foreground">
                          {p.kod ?? "—"} · {formatMoney(p.satis_qiymeti)}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setQty(p.id, qty - 1)}
                        className="inline-flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-secondary"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <Input
                        type="number"
                        min={1}
                        value={qty}
                        onChange={(e) => setQty(p.id, Number(e.target.value))}
                        className="h-7 w-12 text-center tabular-nums"
                      />
                      <button
                        type="button"
                        onClick={() => setQty(p.id, qty + 1)}
                        className="inline-flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-secondary"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => remove(p.id)}
                        className="inline-flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-rose-500/15 hover:text-rose-500"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Preview ekran — yalnız 1 ədəd kompakt göstərici */}
            <div className="rounded-xl border border-border bg-card p-3">
              <h3 className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                <Eye className="h-3 w-3" /> Önbax (real ölçü {widthMm} × {heightMm} mm)
              </h3>
              {items.size > 0 ? (
                <div className="flex items-center justify-center rounded-md bg-secondary/40 py-4">
                  <div
                    style={{
                      width: `${widthMm}mm`,
                      height: `${heightMm}mm`,
                      transform: "scale(1.5)",
                      transformOrigin: "center",
                    }}
                  >
                    <LabelCard
                      product={Array.from(items.values())[0].p}
                      widthMm={widthMm}
                      heightMm={heightMm}
                      showName={showName}
                      showBarcode={showBarcode}
                      showBarcodeText={showBarcodeText}
                      showPrice={showPrice}
                      showDiscount={showDiscount}
                      showCode={showCode}
                      showMarka={showMarka}
                      showKateqoriya={showKateqoriya}
                      fontSize={fontSize}
                      align={align}
                      layout={layout}
                      bordered={bordered}
                    />
                  </div>
                </div>
              ) : (
                <div className="rounded-md border border-dashed border-border/40 p-6 text-center text-xs text-muted-foreground">
                  Önizləmə üçün məhsul seçin
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Print sheet */}
        <div className="print-sheet">
          {labels.length > 0 && (
            <div
              className={
                preset.grid
                  ? `grid gap-1`
                  : "flex flex-wrap gap-1"
              }
              style={
                preset.grid
                  ? { gridTemplateColumns: `repeat(${preset.grid.cols}, minmax(0, 1fr))` }
                  : undefined
              }
            >
              {labels.map((p, i) => (
                <LabelCard
                  key={`${p.id}-${i}`}
                  product={p}
                  widthMm={widthMm}
                  heightMm={heightMm}
                  showName={showName}
                  showBarcode={showBarcode}
                  showBarcodeText={showBarcodeText}
                  showPrice={showPrice}
                  showDiscount={showDiscount}
                  showCode={showCode}
                  showMarka={showMarka}
                  showKateqoriya={showKateqoriya}
                  fontSize={fontSize}
                  align={align}
                  layout={layout}
                  bordered={bordered}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * Tək etiket renderingi — bütün ayarlara reaksiya verir
 * ────────────────────────────────────────────────────────────────────────── */
function LabelCard({
  product: p,
  widthMm,
  heightMm,
  showName,
  showBarcode,
  showBarcodeText,
  showPrice,
  showDiscount,
  showCode,
  showMarka,
  showKateqoriya,
  fontSize,
  align,
  layout,
  bordered,
}: {
  product: LabelProduct;
  widthMm: number;
  heightMm: number;
  showName: boolean;
  showBarcode: boolean;
  showBarcodeText: boolean;
  showPrice: boolean;
  showDiscount: boolean;
  showCode: boolean;
  showMarka: boolean;
  showKateqoriya: boolean;
  fontSize: FontSize;
  align: Align;
  layout: Layout;
  bordered: boolean;
}) {
  const fonts = FONT_SIZES[fontSize];
  const alignCls = ALIGN_CLS[align];
  const barcodeValue = p.barkod ?? p.kod ?? p.id.slice(0, 12);

  // Section render helpers
  const NameSection = showName ? (
    <div className={`line-clamp-2 w-full font-semibold leading-tight ${fonts.name}`}>{p.ad}</div>
  ) : null;

  const BarcodeSection = showBarcode ? (
    <div className="w-full">
      <div className="flex justify-center">
        <Barcode
          value={barcodeValue}
          scale={Math.min(2, (widthMm / 50) * 1.5)}
          height={Math.max(20, heightMm * 0.8)}
        />
      </div>
      {showBarcodeText && (
        <div className={`mt-0.5 font-mono tracking-wider ${fonts.barCode}`}>{barcodeValue}</div>
      )}
    </div>
  ) : null;

  const PriceSection = showPrice ? (
    <div className="w-full">
      {showDiscount && p.endirimli_qiymet && p.endirimli_qiymet < p.satis_qiymeti ? (
        <>
          <span className={`mr-1 line-through text-black/40 ${fonts.meta}`}>{formatMoney(p.satis_qiymeti)}</span>
          <span className={`font-bold tabular-nums ${fonts.price}`}>{formatMoney(p.endirimli_qiymet)}</span>
        </>
      ) : (
        <span className={`font-bold tabular-nums ${fonts.price}`}>{formatMoney(p.satis_qiymeti)}</span>
      )}
    </div>
  ) : null;

  const sections =
    layout === "barcode-name-price"
      ? [BarcodeSection, NameSection, PriceSection]
      : layout === "price-name-barcode"
      ? [PriceSection, NameSection, BarcodeSection]
      : [NameSection, BarcodeSection, PriceSection];

  return (
    <div
      className={`flex flex-col justify-between bg-white p-1 text-black ${alignCls} ${bordered ? "border border-black/30" : ""}`}
      style={{ width: `${widthMm}mm`, height: `${heightMm}mm` }}
    >
      {/* Top meta (marka / kateqoriya) */}
      {(showMarka || showKateqoriya || showCode) && (
        <div className={`w-full text-black/60 ${fonts.meta}`}>
          {[showMarka && p.marka_ad, showKateqoriya && p.kateqoriya_ad, showCode && p.kod]
            .filter(Boolean)
            .join(" · ")}
        </div>
      )}

      {/* Main sections */}
      <div className={`flex flex-1 flex-col justify-around ${alignCls} w-full gap-0.5`}>
        {sections.map((s, i) => (s ? <div key={i} className="w-full">{s}</div> : null))}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * Helper komponentlər
 * ────────────────────────────────────────────────────────────────────────── */
function ToggleRow({
  checked, onChange, label, disabled,
}: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <label
      className={`flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-xs transition hover:bg-secondary/30 ${
        disabled ? "cursor-not-allowed opacity-50" : ""
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        className="h-3.5 w-3.5 accent-primary"
      />
      <span>{label}</span>
    </label>
  );
}

function LayoutOpt({
  id, label, active, onPick,
}: { id: Layout; label: string; active: Layout; onPick: (v: Layout) => void }) {
  return (
    <button
      type="button"
      onClick={() => onPick(id)}
      className={`flex w-full items-center gap-2 rounded border px-2 py-1.5 text-[10.5px] text-left transition ${
        active === id ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-secondary/40"
      }`}
    >
      <span className="grid h-3 w-3 place-items-center rounded-full border border-current">
        {active === id && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      </span>
      {label}
    </button>
  );
}
