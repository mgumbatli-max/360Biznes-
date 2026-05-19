"use client";

/**
 * "Yeni satış" — compact, native (non-iframe) modal.
 *
 * Visual target: /tmp/s1.png + /tmp/s2.png.
 *
 *   ┌─ Yeni satış ─────────────────────────────── ✕ ┐
 *   │  [ Barkod skan et və ya yaz … ]    Skener ↵   │
 *   │  Müştəri   |  Satıcı (kim satır)  |  Anbar    │
 *   │  Tarix     |  Ödəniş növü         |  Sifariş# │
 *   │  ⇣ MARKETPLACE SATIŞI (BOLT / ADI SATIŞ) ⇣    │
 *   │  Platforma | Mağaza                            │
 *   │  ── Məhsullar ───────────────────────────────  │
 *   │  [ search ] [miqdar] [qiymet] [endirim%] +    │
 *   │  Ümumi  |  Endirim  |  YEKUN                   │
 *   │  Müştəri verir (₼)  |  Qaytarılacaq            │
 *   │  Qeyd …                                        │
 *   │  ☐ Vergi kassasına vur  ☐ Zəmanət talonu       │
 *   └─ footer hints   Ləğv | Tamamla-F9 | … +çap-F10 ┘
 *
 * Only essential fields — full feature set still lives at /ticaret/satis-yeni.
 */

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2,
  Plus,
  Trash2,
  ScanBarcode,
  Printer,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import { Combobox, type ComboOption } from "@/components/ui/combobox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatMoney } from "@/lib/utils";
import { searchCustomersAction, searchProductsAction } from "@/features/pos/search-actions";
import type { CustomerRow, ProductRow, SalespersonOption } from "@/features/pos/sale-queries";
import { createOrUpdateSatisYeni } from "../satis-yeni-actions";
import { OperationModalShell, Kbd } from "./operation-modal-shell";

export type AnbarOpt = { id: number; ad: string };

type Line = {
  mehsul_id: string;
  ad: string;
  kod: string | null;
  miqdar: number;
  qiymet: number;
  endirim_faiz: number;
  anbar_id: number;
};

const PLATFORM_OPTIONS = [
  { value: "", label: "— Yoxdur (adi satış) —" },
  { value: "birmarket", label: "Birmarket" },
  { value: "bolt_food", label: "Bolt Food" },
  { value: "wolt", label: "Wolt" },
  { value: "yango_deli", label: "Yango Deli" },
  { value: "tap_az", label: "Tap.az" },
  { value: "progo", label: "ProGo" },
  { value: "diger", label: "Digər" },
] as const;

const PAY_OPTIONS = [
  { value: "negd", label: "Nəğd" },
  { value: "kart", label: "Kart" },
  { value: "kocurme", label: "Köçürmə" },
  { value: "kredit", label: "Kreditə" },
] as const;

export function YeniSatisModal({
  open,
  onOpenChange,
  anbarlar,
  saticilar,
  defaultSalespersonId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  anbarlar: AnbarOpt[];
  saticilar: SalespersonOption[];
  defaultSalespersonId: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  /* ── Header fields ───────────────────────────────── */
  const [barcode, setBarcode] = useState("");
  const [musteri, setMusteri] = useState<CustomerRow | null>(null);
  const [musteriQ, setMusteriQ] = useState("");
  const [musteriResults, setMusteriResults] = useState<CustomerRow[]>([]);
  const [saticiId, setSaticiId] = useState<string>(defaultSalespersonId ?? "");
  const [anbarId, setAnbarId] = useState<number>(anbarlar[0]?.id ?? 0);

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [tarix, setTarix] = useState<string>(today);
  const [odenisNov, setOdenisNov] = useState<string>("negd");
  const [sifarisKodu, setSifarisKodu] = useState<string>("");

  /* ── Marketplace block (visible when sifaris kodu or platform set) ── */
  const [platform, setPlatform] = useState<string>("");
  const [magaza, setMagaza] = useState<string>("Default");
  const marketplaceVisible = !!(sifarisKodu.trim() || platform);

  /* ── Lines ───────────────────────────────────────── */
  const [lines, setLines] = useState<Line[]>([]);
  const [searchQ, setSearchQ] = useState("");
  const [searchResults, setSearchResults] = useState<ProductRow[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);

  /* ── Discount, payment, notes ────────────────────── */
  const [endirimMebleg, setEndirimMebleg] = useState<number>(0);
  const [endirimMode, setEndirimMode] = useState<"manat" | "percent">("manat");
  const [musteriVerir, setMusteriVerir] = useState<number>(0);
  const [qeyd, setQeyd] = useState("");
  const [vergiKassa, setVergiKassa] = useState(false);
  const [zemanetTalon, setZemanetTalon] = useState(false);

  /* ── Reset on close ──────────────────────────────── */
  useEffect(() => {
    if (!open) return;
    // Keep header defaults but clear cart-specific state when re-opened.
    setBarcode("");
    setLines([]);
    setSearchQ("");
    setSearchResults([]);
    setEndirimMebleg(0);
    setEndirimMode("manat");
    setMusteriVerir(0);
    setQeyd("");
    setVergiKassa(false);
    setZemanetTalon(false);
    setSifarisKodu("");
    setPlatform("");
  }, [open]);

  /* ── Customer search ─────────────────────────────── */
  useEffect(() => {
    if (musteriQ.trim().length < 2) {
      setMusteriResults([]);
      return;
    }
    let alive = true;
    searchCustomersAction(musteriQ).then((r) => {
      if (alive) setMusteriResults(r);
    });
    return () => {
      alive = false;
    };
  }, [musteriQ]);

  /* ── Product search ──────────────────────────────── */
  useEffect(() => {
    if (searchQ.trim().length < 2) {
      setSearchResults([]);
      setSearchOpen(false);
      return;
    }
    let alive = true;
    searchProductsAction(searchQ, anbarId || undefined).then((r) => {
      if (alive) {
        setSearchResults(r);
        setSearchOpen(true);
      }
    });
    return () => {
      alive = false;
    };
  }, [searchQ, anbarId]);

  /* ── Totals ──────────────────────────────────────── */
  const umumi = useMemo(
    () =>
      lines.reduce(
        (s, l) =>
          s + l.miqdar * l.qiymet * (1 - (l.endirim_faiz || 0) / 100),
        0,
      ),
    [lines],
  );
  const endirimAzn = useMemo(() => {
    if (endirimMode === "percent") {
      return Math.max(0, umumi * (endirimMebleg / 100));
    }
    return Math.max(0, endirimMebleg);
  }, [endirimMebleg, endirimMode, umumi]);
  const yekun = Math.max(0, umumi - endirimAzn);
  const qaytarilacaq = Math.max(0, musteriVerir - yekun);

  /* ── Handlers ────────────────────────────────────── */
  function addProduct(p: ProductRow) {
    if (!anbarId) {
      toast.error("Əvvəl anbar seç");
      return;
    }
    setLines((prev) => {
      const existing = prev.find((l) => l.mehsul_id === p.id);
      if (existing) {
        return prev.map((l) =>
          l.mehsul_id === p.id ? { ...l, miqdar: l.miqdar + 1 } : l,
        );
      }
      return [
        ...prev,
        {
          mehsul_id: p.id,
          ad: p.ad,
          kod: p.kod,
          miqdar: 1,
          qiymet: p.satis_qiymeti,
          endirim_faiz: 0,
          anbar_id: anbarId,
        },
      ];
    });
    setSearchQ("");
    setSearchResults([]);
    setSearchOpen(false);
  }

  function updateLine(idx: number, patch: Partial<Line>) {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  }
  function removeLine(idx: number) {
    setLines((prev) => prev.filter((_, i) => i !== idx));
  }

  function buildPayload(qaralama: boolean) {
    const orderTag = sifarisKodu.trim()
      ? `[ORDER:${platform || "manual"}:${sifarisKodu.trim()}]`
      : null;
    const checks = [
      vergiKassa ? "[VERGI-KASSA]" : null,
      zemanetTalon ? "[ZEMANET-TALON]" : null,
      platform ? `[PLATFORM:${platform}]` : null,
      magaza && magaza !== "Default" ? `[MAGAZA:${magaza}]` : null,
      orderTag,
    ]
      .filter(Boolean)
      .join(" ");
    const daxili = [qeyd, checks].filter(Boolean).join("\n");

    return {
      musteri_id: musteri?.id ?? null,
      tarix,
      endirim_mebleg: endirimAzn,
      catdirma_xerc: 0,
      vat_faiz: 0,
      daxili_qeyd: daxili || null,
      musteri_qeyd: null,
      qaralama,
      reserve_stock: false,
      satis_meneceri_id: saticiId || null,
      odenis_nov: ((odenisNov === "kart" || odenisNov === "kecirme" || odenisNov === "nisye")
        ? odenisNov
        : "negd") as "negd" | "kart" | "kecirme" | "nisye",
      lines: lines.map((l) => ({
        mehsul_id: l.mehsul_id,
        anbar_id: l.anbar_id || anbarId,
        miqdar: l.miqdar,
        qiymet: l.qiymet,
        endirim_faiz: l.endirim_faiz || 0,
      })),
    };
  }

  function validate(): string | null {
    if (lines.length === 0) return "Ən az 1 məhsul əlavə et";
    if (!anbarId) return "Anbar seç";
    if (odenisNov === "kredit" && !musteri) return "Kreditə satış üçün müştəri seç";
    return null;
  }

  async function onSave(printAfter: boolean) {
    const err = validate();
    if (err) {
      toast.error(err);
      return;
    }
    startTransition(async () => {
      const res = await createOrUpdateSatisYeni(buildPayload(false));
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`Satış yaradıldı: ${res.nomre}`);
      onOpenChange(false);
      router.refresh();
      if (printAfter) {
        // Open print view in new tab
        window.open(`/ticaret/satislar/${res.satis_id}?print=1`, "_blank");
      }
    });
  }

  /* ── Keyboard shortcuts ──────────────────────────── */
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "F9") {
        e.preventDefault();
        onSave(false);
      } else if (e.key === "F10") {
        e.preventDefault();
        onSave(true);
      } else if (e.key === "Escape") {
        onOpenChange(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, lines, endirimMebleg, endirimMode, musteri, anbarId, tarix, odenisNov, qeyd]);

  /* ── Render ──────────────────────────────────────── */
  return (
    <OperationModalShell
      open={open}
      onOpenChange={onOpenChange}
      title="Yeni satış"
      size="2xl"
      footerHints={
        <>
          <span><Kbd>F2</Kbd> Müştəri</span>
          <span><Kbd>F3</Kbd> Barkod</span>
          <span><Kbd>F6</Kbd> Endirim</span>
          <span><Kbd>F9</Kbd> Saxla</span>
          <span><Kbd>F10</Kbd> Tamamla + çap</span>
          <span><Kbd>Esc</Kbd> Bağla</span>
        </>
      }
      actions={
        <>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            Ləğv
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onSave(false)}
            disabled={pending}
          >
            {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Tamamla — F9
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => onSave(true)}
            disabled={pending}
            className="bg-rose-500 text-white hover:bg-rose-600"
          >
            <Printer className="h-3.5 w-3.5" />
            Tamamla və çap et — F10
          </Button>
        </>
      }
    >
      {/* Barcode */}
      <div className="relative mb-3">
        <ScanBarcode className="pointer-events-none absolute top-2.5 left-3 h-4 w-4 text-muted-foreground" />
        <Input
          autoFocus
          value={barcode}
          onChange={(e) => setBarcode(e.target.value)}
          onKeyDown={async (e) => {
            if (e.key !== "Enter") return;
            e.preventDefault();
            const code = barcode.trim();
            if (!code) return;
            const r = await searchProductsAction(code, anbarId || undefined);
            if (r.length === 0) {
              toast.error("Tapılmadı");
            } else {
              addProduct(r[0]);
            }
            setBarcode("");
          }}
          placeholder="Barkod skan et və ya yaz, sonra Enter…"
          className="h-9 pl-9 text-xs"
        />
        <span className="absolute top-2.5 right-3 text-[10px] text-muted-foreground">
          Skener avtomatik ↵ Enter
        </span>
      </div>

      {/* Row 1: Müştəri / Satıcı / Anbar */}
      <div className="mb-3 grid grid-cols-3 gap-2">
        <div>
          <Label1>Müştəri</Label1>
          <div className="relative">
            <Input
              value={musteri ? musteri.ad : musteriQ}
              onChange={(e) => {
                setMusteri(null);
                setMusteriQ(e.target.value);
              }}
              placeholder="Ad, telefon… Boş = nağdı"
              className="h-8 text-xs"
            />
            {musteriResults.length > 0 && !musteri && (
              <ul className="absolute top-full left-0 right-0 z-10 mt-0.5 max-h-44 overflow-y-auto rounded-md border border-border bg-popover shadow">
                {musteriResults.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setMusteri(c);
                        setMusteriQ("");
                        setMusteriResults([]);
                      }}
                      className="block w-full px-2 py-1.5 text-left text-xs hover:bg-secondary"
                    >
                      <span className="font-medium">{c.ad}</span>
                      {c.telefon && (
                        <span className="ml-1 text-muted-foreground">· {c.telefon}</span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <p className="mt-0.5 text-[10px] text-muted-foreground">
            Default: <span className="text-rose-500">Adi alıcı</span>
          </p>
        </div>
        <div>
          <Label1>Satıcı (kim satır)</Label1>
          <Combobox
            options={saticilar.map<ComboOption>((s) => ({ value: s.id, label: s.ad_soyad }))}
            value={saticiId}
            onChange={setSaticiId}
            placeholder="— Seçin —"
            className="h-8 text-xs"
          />
        </div>
        <div>
          <Label1>Anbar *</Label1>
          <Combobox
            options={anbarlar.map<ComboOption>((a) => ({ value: String(a.id), label: a.ad }))}
            value={anbarId ? String(anbarId) : ""}
            onChange={(v) => setAnbarId(Number(v) || 0)}
            placeholder="— Seçin —"
            className="h-8 text-xs"
          />
        </div>
      </div>

      {/* Row 2: Tarix / Ödəniş / Sifariş kodu */}
      <div className="mb-3 grid grid-cols-3 gap-2">
        <div>
          <Label1>Tarix</Label1>
          <Input
            type="date"
            value={tarix}
            onChange={(e) => setTarix(e.target.value)}
            className="h-8 text-xs"
          />
        </div>
        <div>
          <Label1>Ödəniş növü</Label1>
          <Combobox
            options={PAY_OPTIONS.map<ComboOption>((o) => ({ value: o.value, label: o.label }))}
            value={odenisNov}
            onChange={setOdenisNov}
            className="h-8 text-xs"
          />
        </div>
        <div>
          <Label1>Sifariş / Qaimə kodu</Label1>
          <Input
            value={sifarisKodu}
            onChange={(e) => setSifarisKodu(e.target.value)}
            placeholder="Boş buraxsan avto verilir"
            className="h-8 text-xs"
          />
        </div>
      </div>

      {/* Marketplace section (conditional) */}
      {marketplaceVisible && (
        <div className="mb-3 rounded-lg border border-rose-200 bg-rose-50/50 p-2.5">
          <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-rose-700">
            Marketplace satışı (Bolt / adi satış)
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label1>Platforma</Label1>
              <select
                value={platform}
                onChange={(e) => setPlatform(e.target.value)}
                className="block h-8 w-full rounded-md border border-border bg-background px-2 text-xs"
              >
                {PLATFORM_OPTIONS.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>
            <div>
              <Label1>Mağaza (multi-birmarket)</Label1>
              <Input
                value={magaza}
                onChange={(e) => setMagaza(e.target.value)}
                placeholder="Default"
                className="h-8 text-xs"
              />
              <p className="mt-0.5 text-[10px] text-muted-foreground">
                Default komissiyon{" "}
                <span className="font-semibold text-rose-600">
                  <a className="underline" href="#" onClick={(e) => e.preventDefault()}>
                    %25
                  </a>
                </span>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Məhsullar */}
      <div className="mb-3">
        <Label1>Məhsullar</Label1>
        <div className="relative">
          <div className="flex items-center gap-1.5 rounded-md border border-border bg-background px-2 py-1">
            <Search className="h-3.5 w-3.5 text-muted-foreground" />
            <input
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              placeholder="Məhsul axtar (ad, kod, barkod)…"
              className="h-7 flex-1 bg-transparent text-xs outline-none"
            />
          </div>
          {searchOpen && searchResults.length > 0 && (
            <ul className="absolute top-full left-0 right-0 z-20 mt-0.5 max-h-52 overflow-y-auto rounded-md border border-border bg-popover shadow">
              {searchResults.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => addProduct(p)}
                    className="flex w-full items-center justify-between gap-2 px-2 py-1.5 text-left text-xs hover:bg-secondary"
                  >
                    <span>
                      <span className="font-medium">{p.ad}</span>
                      {p.kod && (
                        <span className="ml-1 text-muted-foreground">({p.kod})</span>
                      )}
                    </span>
                    <span className="tabular-nums text-muted-foreground">
                      {formatMoney(p.satis_qiymeti)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {lines.length > 0 && (
          <div className="mt-2 overflow-hidden rounded-md border border-border">
            <table className="w-full text-xs">
              <thead className="border-b border-border bg-card/40 text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-2 py-1.5">Məhsul</th>
                  <th className="px-2 py-1.5 text-right w-16">Miqdar</th>
                  <th className="px-2 py-1.5 text-right w-20">Qiymət</th>
                  <th className="px-2 py-1.5 text-right w-14">End. %</th>
                  <th className="px-2 py-1.5 text-right w-24">Cəmi</th>
                  <th className="px-2 py-1.5 w-7"></th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l, idx) => (
                  <tr key={`${l.mehsul_id}-${idx}`} className="border-b border-border/30">
                    <td className="px-2 py-1.5 truncate">{l.ad}</td>
                    <td className="px-2 py-1.5 text-right">
                      <input
                        type="number"
                        min={0.001}
                        step="0.01"
                        value={l.miqdar}
                        onChange={(e) => updateLine(idx, { miqdar: Number(e.target.value) || 0 })}
                        className="h-6 w-14 rounded border border-border bg-background px-1 text-right text-xs tabular-nums"
                      />
                    </td>
                    <td className="px-2 py-1.5 text-right">
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={l.qiymet}
                        onChange={(e) => updateLine(idx, { qiymet: Number(e.target.value) || 0 })}
                        className="h-6 w-16 rounded border border-border bg-background px-1 text-right text-xs tabular-nums"
                      />
                    </td>
                    <td className="px-2 py-1.5 text-right">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step="0.1"
                        value={l.endirim_faiz}
                        onChange={(e) => updateLine(idx, { endirim_faiz: Number(e.target.value) || 0 })}
                        className="h-6 w-12 rounded border border-border bg-background px-1 text-right text-xs tabular-nums"
                      />
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums font-medium">
                      {formatMoney(l.miqdar * l.qiymet * (1 - (l.endirim_faiz || 0) / 100))}
                    </td>
                    <td className="px-2 py-1.5">
                      <button
                        type="button"
                        onClick={() => removeLine(idx)}
                        className="text-muted-foreground hover:text-danger"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <button
          type="button"
          onClick={() => {
            const inp = document.querySelector<HTMLInputElement>(
              "input[placeholder^='Məhsul axtar']",
            );
            inp?.focus();
          }}
          className="mt-1.5 inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
        >
          <Plus className="h-3 w-3" /> Məhsul əlavə et
        </button>
      </div>

      {/* Totals row */}
      <div className="mb-3 grid grid-cols-3 gap-3 rounded-lg border border-border bg-card/40 px-3 py-2">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Ümumi</div>
          <div className="mt-0.5 text-lg font-semibold tabular-nums">{formatMoney(umumi)}</div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Endirim</div>
          <div className="mt-0.5 flex items-center gap-1">
            <input
              type="number"
              min={0}
              step={endirimMode === "percent" ? "0.1" : "0.01"}
              value={endirimMebleg}
              onChange={(e) => setEndirimMebleg(Number(e.target.value) || 0)}
              className="h-7 w-16 rounded border border-border bg-background px-1 text-right text-xs tabular-nums"
            />
            <div className="flex overflow-hidden rounded border border-border">
              <button
                type="button"
                onClick={() => setEndirimMode("manat")}
                className={`px-1.5 py-0.5 text-[10px] ${
                  endirimMode === "manat"
                    ? "bg-foreground text-background"
                    : "bg-background text-muted-foreground"
                }`}
              >
                ₼
              </button>
              <button
                type="button"
                onClick={() => setEndirimMode("percent")}
                className={`px-1.5 py-0.5 text-[10px] ${
                  endirimMode === "percent"
                    ? "bg-rose-500 text-white"
                    : "bg-background text-muted-foreground"
                }`}
              >
                %
              </button>
            </div>
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Yekun</div>
          <div className="mt-0.5 text-xl font-bold tabular-nums text-rose-600">
            {formatMoney(yekun)}
          </div>
        </div>
      </div>

      {/* Customer pays / change */}
      <div className="mb-3 grid grid-cols-2 gap-2">
        <div>
          <Label1>Müştəri verir (₼)</Label1>
          <Input
            type="number"
            min={0}
            step="0.01"
            value={musteriVerir}
            onChange={(e) => setMusteriVerir(Number(e.target.value) || 0)}
            className="h-8 text-xs tabular-nums"
          />
        </div>
        <div>
          <Label1>Qaytarılacaq</Label1>
          <div className="flex h-8 items-center text-sm font-semibold tabular-nums">
            {formatMoney(qaytarilacaq)}
          </div>
        </div>
      </div>

      {/* Qeyd */}
      <div className="mb-3">
        <Label1>Qeyd</Label1>
        <textarea
          value={qeyd}
          onChange={(e) => setQeyd(e.target.value)}
          rows={3}
          placeholder="Əlavə qeyd…"
          className="block w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs"
        />
      </div>

      {/* Checkboxes */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <label className="inline-flex items-center gap-2">
          <input
            type="checkbox"
            checked={vergiKassa}
            onChange={(e) => setVergiKassa(e.target.checked)}
            className="h-3.5 w-3.5 accent-rose-500"
          />
          Vergi kassasına vur
        </label>
        <label className="inline-flex items-center gap-2">
          <input
            type="checkbox"
            checked={zemanetTalon}
            onChange={(e) => setZemanetTalon(e.target.checked)}
            className="h-3.5 w-3.5 accent-rose-500"
          />
          Zəmanət talonu çap et
        </label>
      </div>
    </OperationModalShell>
  );
}

function Label1({ children }: { children: React.ReactNode }) {
  return (
    <label className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
      {children}
    </label>
  );
}
