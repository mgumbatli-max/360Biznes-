"use client";

/**
 * "Yeni alış qaiməsi" — compact, native (non-iframe) modal.
 *
 * Visual target: /tmp/s4.png + /tmp/s5.png.
 *
 *   ┌─ Yeni alış qaiməsi ─────────────────────── ✕ ┐
 *   │  [ Barkod skan et və ya yaz, sonra Enter… ]   │
 *   │  Təchizatçı  |  Məsul menecer  |  Anbar       │
 *   │  Tarix       |  Sənəd / Qaimə №               │
 *   │  Məhsullar — search / miqdar / qiymet / +     │
 *   │ ┌─ ƏLAVƏ XƏRCLƏR (SƏMƏRƏLİ KAĞIZ) ─────────┐  │
 *   │ │ Cəmi xərc (₼)  |  Xərclər izahı           │  │
 *   │ │ ⓘ proporsional bölünür                    │  │
 *   │ └────────────────────────────────────────────┘  │
 *   │  Məhsul məbləği | + Əlavə xərc | Real maya     │
 *   │  Qeyd …                                        │
 *   └─ footer hints      Ləğv | Sifariş yarat — F9 ─┘
 */

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Trash2, ScanBarcode, Search, FileText, PackagePlus } from "lucide-react";
import { toast } from "sonner";
import dynamic from "next/dynamic";
import { ContactContextPanel } from "@/features/elaqe/components/contact-context-panel";
import { QuickCreateSupplierDialog } from "@/features/elaqe/components/quick-create-supplier-dialog";
import { Combobox, type ComboOption } from "@/components/ui/combobox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatMoney } from "@/lib/utils";
import { searchProductsForPurchaseAction as searchProductsAction } from "@/features/pos/search-actions";
import type { ProductRow, SalespersonOption } from "@/features/pos/sale-queries";
import { createPurchase } from "../alis-actions";
import { OperationModalShell, Kbd } from "./operation-modal-shell";

const QuickCreateProductModal = dynamic(
  () =>
    import("@/features/anbar/components/quick-create-product-modal").then(
      (m) => m.QuickCreateProductModal,
    ),
  { ssr: false },
);

export type AnbarOpt = { id: number; ad: string };
export type SupplierOpt = {
  id: string;
  ad: string;
  telefon?: string | null;
  /** Bizim təchizatçıya cari borcumuz. */
  borc?: number;
};
export type KassaOpt = { id: string; ad: string };
export type HesabOpt = { id: string; ad: string; nov: string; bank_adi: string | null };

type Line = {
  mehsul_id: string;
  ad: string;
  kod: string | null;
  miqdar: number;
  qiymet: number;
};

export function YeniAlisModal({
  open,
  onOpenChange,
  anbarlar,
  suppliers,
  menecerler,
  kassalar = [],
  hesablar = [],
  defaultManagerId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  anbarlar: AnbarOpt[];
  suppliers: SupplierOpt[];
  menecerler: SalespersonOption[];
  kassalar?: KassaOpt[];
  hesablar?: HesabOpt[];
  defaultManagerId: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  /* ── Header ──────────────────────────────────────── */
  const [barcode, setBarcode] = useState("");
  // Local suppliers list — quick-create ilə yeni təchizatçı əlavə oluna bilsin
  const [localSuppliers, setLocalSuppliers] = useState<SupplierOpt[]>(suppliers);
  const [techizatciId, setTechizatciId] = useState<string>("");
  const [menecerId, setMenecerId] = useState<string>(defaultManagerId ?? "");
  const [anbarId, setAnbarId] = useState<number>(anbarlar[0]?.id ?? 0);
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [tarix, setTarix] = useState<string>(today);
  const [qaimeNomre, setQaimeNomre] = useState("");

  /* ── Lines ───────────────────────────────────────── */
  const [lines, setLines] = useState<Line[]>([]);
  const [searchQ, setSearchQ] = useState("");
  const [searchResults, setSearchResults] = useState<ProductRow[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);

  /* ── Quick create product modal ─────────────────── */
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);

  /* ── Extra costs ─────────────────────────────────── */
  const [elaveXerc, setElaveXerc] = useState<number>(0);
  const [elaveXercIzah, setElaveXercIzah] = useState<string>("");

  /* ── Payment ─────────────────────────────────────── */
  // Hesab/kassa seçimi: boş = nisyə (təchizatçıya borc), seçilibsə avtomatik ödə.
  const [payHesabId, setPayHesabId] = useState<string>("");
  const payNow = payHesabId !== "";

  /* ── Notes ──────────────────────────────────────── */
  const [qeyd, setQeyd] = useState("");

  /* ── Reset on open ───────────────────────────────── */
  useEffect(() => {
    if (!open) return;
    setBarcode("");
    setLines([]);
    setSearchQ("");
    setSearchResults([]);
    setElaveXerc(0);
    setElaveXercIzah("");
    setPayHesabId("");
    setQeyd("");
    setQaimeNomre("");
  }, [open]);

  /* ── Product search ─────────────────────────────── */
  useEffect(() => {
    let alive = true;
    const delay = searchQ.trim().length === 0 ? 0 : 200;
    const id = setTimeout(() => {
      searchProductsAction(searchQ).then((r) => {
        if (alive) setSearchResults(r);
      });
    }, delay);
    return () => {
      alive = false;
      clearTimeout(id);
    };
  }, [searchQ]);

  /* ── Totals ──────────────────────────────────────── */
  const mehsulMebleg = useMemo(
    () => lines.reduce((s, l) => s + l.miqdar * l.qiymet, 0),
    [lines],
  );
  const realMayaCemi = mehsulMebleg + (Number.isFinite(elaveXerc) ? elaveXerc : 0);

  /* ── Handlers ────────────────────────────────────── */
  function addProduct(p: ProductRow) {
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
          qiymet: p.alish_qiymeti,
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

  function validate(): string | null {
    if (!techizatciId) return "Təchizatçı seç";
    if (!anbarId) return "Anbar seç";
    if (lines.length === 0) return "Ən az 1 məhsul əlavə et";
    return null;
  }

  async function onSubmit() {
    const err = validate();
    if (err) {
      toast.error(err);
      return;
    }
    startTransition(async () => {
      // Compose qeyd with extra-cost meta so receivers can audit later.
      const qeydParts: string[] = [];
      if (qeyd) qeydParts.push(qeyd);
      if (elaveXerc > 0) {
        qeydParts.push(
          `[ELAVE-XERC] ${formatMoney(elaveXerc)}${elaveXercIzah ? " — " + elaveXercIzah : ""}`,
        );
      }
      if (menecerId) qeydParts.push(`[MENECER:${menecerId}]`);
      if (tarix && tarix !== today) qeydParts.push(`[TARIX:${tarix}]`);

      const res = await createPurchase({
        techizatci_id: techizatciId,
        anbar_id: anbarId,
        qaime_nomre: qaimeNomre || undefined,
        qeyd: qeydParts.join("\n") || undefined,
        receive_now: true,
        diger_xerc: elaveXerc,
        pay_now: payNow,
        hesab_id: payNow ? payHesabId : undefined,
        lines: lines.map((l) => ({
          mehsul_id: l.mehsul_id,
          miqdar: l.miqdar,
          qiymet: l.qiymet,
        })),
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`Alış yaradıldı: ${res.nomre}`);
      onOpenChange(false);
      router.refresh();
    });
  }

  /* ── Keyboard shortcuts ──────────────────────────── */
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "F9") {
        e.preventDefault();
        onSubmit();
      } else if (e.key === "Escape") {
        onOpenChange(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, lines, elaveXerc, elaveXercIzah, techizatciId, anbarId, tarix, qaimeNomre, qeyd]);

  return (
    <>
    <OperationModalShell
      open={open}
      onOpenChange={onOpenChange}
      title="Yeni alış qaiməsi"
      size="4xl"
      footerHints={
        <>
          <span><Kbd>F3</Kbd> Təchizatçı</span>
          <span><Kbd>F4</Kbd> Barkod</span>
          <span><Kbd>F9</Kbd> Saxla</span>
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
            size="sm"
            onClick={onSubmit}
            disabled={pending}
            className="bg-rose-500 text-white hover:bg-rose-600"
          >
            {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Sifariş yarat — F9
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
            const r = await searchProductsAction(code);
            if (r.length === 0) toast.error("Tapılmadı");
            else addProduct(r[0]);
            setBarcode("");
          }}
          placeholder="Barkod skan və ya yaz, sonra Enter — yeni məhsul (qaimə) qəbul edir"
          className="h-9 pl-9 text-xs"
        />
        <span className="absolute top-2.5 right-3 text-[10px] text-muted-foreground">
          Skener avtomatik ↵ Enter
        </span>
      </div>

      {/* Row 1: Təchizatçı / Menecer / Anbar */}
      <div className="mb-3 grid grid-cols-3 gap-2">
        <div>
          <Label1>Təchizatçı</Label1>
          <div className="flex items-start gap-1">
            <div className="flex-1">
              <Combobox
                options={localSuppliers.map<ComboOption>((s) => ({
                  value: s.id,
                  label: (s.borc ?? 0) > 0 ? `${s.ad}  💰${formatMoney(s.borc ?? 0)}` : s.ad,
                  hint: s.telefon ?? undefined,
                }))}
                value={techizatciId}
                onChange={setTechizatciId}
                placeholder="Təchizatçı seçilməyib —"
                className="h-8 text-xs"
                searchPlaceholder="🔍 Təchizatçı axtar..."
              />
            </div>
            <QuickCreateSupplierDialog
              onCreated={(s) => {
                const newSupplier: SupplierOpt = {
                  id: s.id,
                  ad: s.ad,
                  telefon: s.telefon,
                  borc: 0,
                };
                setLocalSuppliers((prev) => [newSupplier, ...prev]);
                setTechizatciId(s.id);
              }}
            />
          </div>
          {techizatciId && (
            <div className="mt-2">
              <ContactContextPanel kontragentId={techizatciId} side="supplier" compact />
            </div>
          )}
        </div>
        <div>
          <Label1>Məsul menecer</Label1>
          <Combobox
            options={menecerler.map<ComboOption>((m) => ({ value: m.id, label: m.ad_soyad }))}
            value={menecerId}
            onChange={setMenecerId}
            placeholder="— Seç —"
            className="h-8 text-xs"
          />
        </div>
        <div>
          <Label1>Anbar</Label1>
          <Combobox
            options={anbarlar.map<ComboOption>((a) => ({ value: String(a.id), label: a.ad }))}
            value={anbarId ? String(anbarId) : ""}
            onChange={(v) => setAnbarId(Number(v) || 0)}
            placeholder="— Seç —"
            className="h-8 text-xs"
          />
        </div>
      </div>

      {/* Row 2: Tarix / Sənəd / Qaimə № */}
      <div className="mb-3 grid grid-cols-2 gap-2">
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
          <Label1>Sənəd / Qaimə №</Label1>
          <Input
            value={qaimeNomre}
            onChange={(e) => setQaimeNomre(e.target.value)}
            placeholder="Opsional"
            className="h-8 text-xs"
          />
        </div>
      </div>

      {/* Məhsullar */}
      <div className="mb-3">
        <div className="mb-1 flex items-center justify-between">
          <Label1>Məhsullar</Label1>
          <button
            type="button"
            onClick={() => setQuickCreateOpen(true)}
            className="inline-flex items-center gap-1 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[10.5px] font-semibold text-emerald-700 hover:bg-emerald-500/20"
          >
            <PackagePlus className="h-3 w-3" />
            Yeni məhsul yarat
          </button>
        </div>
        <div className="relative">
          <div className="flex items-center gap-1.5 rounded-md border border-border bg-background px-2 py-1">
            <Search className="h-3.5 w-3.5 text-muted-foreground" />
            <input
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              onFocus={() => setSearchOpen(true)}
              onBlur={() => setTimeout(() => setSearchOpen(false), 150)}
              placeholder="Məhsul axtar (ad, kod, barkod)…"
              className="h-7 flex-1 bg-transparent text-xs outline-none"
            />
          </div>
          {searchOpen && (searchResults.length > 0 || searchQ.trim().length >= 2) && (
            <ul className="absolute top-full left-0 right-0 z-20 mt-0.5 max-h-52 overflow-y-auto rounded-md border border-border bg-popover shadow">
              {searchResults.length === 0 ? (
                <li>
                  <button
                    type="button"
                    onClick={() => setQuickCreateOpen(true)}
                    className="flex w-full items-center gap-2 px-2 py-2 text-left text-xs hover:bg-emerald-500/10"
                  >
                    <PackagePlus className="h-3.5 w-3.5 text-emerald-600" />
                    <span>
                      «{searchQ}» tapılmadı — <span className="font-semibold text-emerald-700">Yeni məhsul yarat</span>
                    </span>
                  </button>
                </li>
              ) : (
                searchResults.map((p) => (
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
                        {formatMoney(p.alish_qiymeti)}
                      </span>
                    </button>
                  </li>
                ))
              )}
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
                  <th className="px-2 py-1.5 text-right w-24">Alış qiymət</th>
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
                        value={l.miqdar > 0 ? l.miqdar : ""}
                        placeholder="0"
                        onChange={(e) => updateLine(idx, { miqdar: Number(e.target.value) || 0 })}
                        className="h-6 w-14 rounded border border-border bg-background px-1 text-right text-xs tabular-nums"
                      />
                    </td>
                    <td className="px-2 py-1.5 text-right">
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={l.qiymet > 0 ? l.qiymet : ""}
                        placeholder="0"
                        onChange={(e) => updateLine(idx, { qiymet: Number(e.target.value) || 0 })}
                        className="h-6 w-20 rounded border border-border bg-background px-1 text-right text-xs tabular-nums"
                      />
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums font-medium">
                      {formatMoney(l.miqdar * l.qiymet)}
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

      {/* Əlavə xərclər (amber) */}
      <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
        <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-amber-700">
          <FileText className="h-3 w-3" />
          Əlavə xərclər (səmərəli kağız)
        </div>
        <div className="grid grid-cols-[120px_1fr] gap-2">
          <div>
            <Label1>Cəmi xərc (₼)</Label1>
            <Input
              type="number"
              min={0}
              step="0.01"
              value={elaveXerc > 0 ? elaveXerc : ""}
              placeholder="0"
              onChange={(e) => setElaveXerc(Number(e.target.value) || 0)}
              className="h-8 text-xs tabular-nums"
            />
          </div>
          <div>
            <Label1>Xərclər izahı</Label1>
            <Input
              value={elaveXercIzah}
              onChange={(e) => setElaveXercIzah(e.target.value)}
              placeholder="məs. təşk, yükləmə, anbara çatdırılma…"
              className="h-8 text-xs"
            />
          </div>
        </div>
        <p className="mt-1.5 text-[10px] text-amber-700/80">
          ⓘ Hər bir məhsulun məbləğinə görə proporsional bölüşdürüləcək və real maya
          dəyəri buna əsasən hesablanacaq
        </p>
      </div>

      {/* Ödəniş — boş = nisyə, hesab/kassa seçilərsə avtomatik ödə */}
      <div className="mb-3 rounded-lg border border-sky-200 bg-sky-50/50 px-3 py-2.5">
        <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-sky-700">
          Hesab / kassa (boş = nisyə)
        </div>
        <select
          value={payHesabId}
          onChange={(e) => setPayHesabId(e.target.value)}
          className="h-9 w-full rounded-md border border-input bg-background px-2 text-xs"
        >
          <option value="">— Nisyə (təchizatçıya borc) —</option>
          {kassalar.length > 0 && (
            <optgroup label="Kassalar (nəğd ödəniş)">
              {kassalar.map((k) => (
                <option key={k.id} value={k.id}>{k.ad}</option>
              ))}
            </optgroup>
          )}
          {hesablar.length > 0 && (
            <optgroup label="Bank / kart (köçürmə)">
              {hesablar.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.ad}{h.bank_adi ? ` · ${h.bank_adi}` : ""}
                </option>
              ))}
            </optgroup>
          )}
        </select>
        <p className="mt-1.5 text-[10px] text-sky-700/80">
          ⓘ {payHesabId
            ? "Seçilmiş hesabdan məbləğ məxariç olunacaq və finance qeydi yaranacaq."
            : "Boş saxlasanız təchizatçı borcu artırılacaq. Sonradan ödəniş etmək olar."}
        </p>
      </div>

      {/* Totals row (rose tinted) */}
      <div className="mb-3 grid grid-cols-3 gap-3 rounded-lg border border-rose-200 bg-rose-50/40 px-3 py-2">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Məhsul məbləği</div>
          <div className="mt-0.5 text-lg font-semibold tabular-nums">{formatMoney(mehsulMebleg)}</div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">+ Əlavə xərc</div>
          <div className="mt-0.5 text-lg font-semibold tabular-nums text-amber-600">
            {formatMoney(elaveXerc)}
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Real maya cəmi</div>
          <div className="mt-0.5 text-xl font-bold tabular-nums text-rose-600">
            {formatMoney(realMayaCemi)}
          </div>
        </div>
      </div>

      {/* Qeyd */}
      <div>
        <Label1>Qeyd</Label1>
        <textarea
          value={qeyd}
          onChange={(e) => setQeyd(e.target.value)}
          rows={2}
          placeholder="Əlavə qeydlər…"
          className="block w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs"
        />
      </div>
    </OperationModalShell>

    {/* Sürətli məhsul yaratma — modal-in-modal */}
    <QuickCreateProductModal
      open={quickCreateOpen}
      onOpenChange={setQuickCreateOpen}
      defaultAd={searchQ.trim()}
      onCreated={(p) => {
        // Yeni məhsulu birbaşa cədvələ əlavə et
        addProduct({
          id: p.id,
          ad: p.ad,
          kod: p.kod,
          barkod: p.barkod,
          satis_qiymeti: p.satis_qiymeti,
          alish_qiymeti: p.alish_qiymeti,
          min_satis_qiymeti: 0,
          topdan_qiymeti: 0,
          partnyor_qiymeti: 0,
          vip_qiymeti: 0,
          stok_miqdari: 0,
          diger_anbarlarda: [],
        });
        setSearchQ("");
        setSearchResults([]);
        setSearchOpen(false);
      }}
    />
    </>
  );
}

function Label1({ children }: { children: React.ReactNode }) {
  return (
    <label className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
      {children}
    </label>
  );
}
