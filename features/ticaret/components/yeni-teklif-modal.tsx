"use client";

/**
 * "Yeni təklif" — compact native modal.
 *
 * Təklif satış DEYİL: stok düşmür, kassaya pul düşmür, müştəri borcu yaranmır.
 * Sadəcə müştəriyə qiymət təklifi yaradır. Sonradan satışa çevrilə bilər.
 */

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Trash2, Search, FileText } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatMoney } from "@/lib/utils";
import { searchCustomersAction, searchProductsAction } from "@/features/pos/search-actions";
import type { CustomerRow, ProductRow, SalespersonOption } from "@/features/pos/sale-queries";
import { createTeklif, type CreateTeklifInput } from "../teklif-actions";
import { OperationModalShell, Kbd } from "./operation-modal-shell";

type Line = {
  mehsul_id: string;
  ad: string;
  kod: string | null;
  sayi: number;
  qiymet: number;
  endirim_faiz: number;
};

const SATISH_TIPI = [
  { value: "perakende", label: "Pərakəndə" },
  { value: "topdan", label: "Topdan" },
  { value: "vip", label: "VIP" },
  { value: "partner", label: "Partner" },
] as const;

function todayIso(): string {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

function plus7DaysIso(): string {
  const d = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
}

export function YeniTeklifModal({
  open,
  onOpenChange,
  saticilar,
  defaultSalespersonId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  saticilar: SalespersonOption[];
  defaultSalespersonId: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  // Müştəri
  const [musteri, setMusteri] = useState<CustomerRow | null>(null);
  const [musteriQ, setMusteriQ] = useState("");
  const [musteriResults, setMusteriResults] = useState<CustomerRow[]>([]);
  const [musteriFocused, setMusteriFocused] = useState(false);
  const [musteriManualAd, setMusteriManualAd] = useState("");
  const [musteriManualTel, setMusteriManualTel] = useState("");

  // Form
  const [menecerId, setMenecerId] = useState<string>(defaultSalespersonId ?? "");
  const [tarix, setTarix] = useState(todayIso());
  const [bitmeTarixi, setBitmeTarixi] = useState(plus7DaysIso());
  const [satishTipi, setSatishTipi] = useState<typeof SATISH_TIPI[number]["value"]>("perakende");
  const [endirimMebleg, setEndirimMebleg] = useState(0);
  const [qeyd, setQeyd] = useState("");
  const [shertler, setShertler] = useState("");

  // Məhsul axtarış
  const [searchQ, setSearchQ] = useState("");
  const [searchResults, setSearchResults] = useState<ProductRow[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);

  // Sətirlər
  const [lines, setLines] = useState<Line[]>([]);

  /* ── Müştəri axtarışı ── */
  useEffect(() => {
    let alive = true;
    const t = setTimeout(async () => {
      const r = await searchCustomersAction(musteriQ);
      if (alive) setMusteriResults(r);
    }, musteriQ.trim().length === 0 ? 0 : 200);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [musteriQ]);

  /* ── Məhsul axtarışı ── */
  useEffect(() => {
    let alive = true;
    const t = setTimeout(async () => {
      const r = await searchProductsAction(searchQ);
      if (alive) setSearchResults(r);
    }, searchQ.trim().length === 0 ? 0 : 200);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [searchQ]);

  function addProduct(p: ProductRow) {
    setLines((prev) => {
      const idx = prev.findIndex((l) => l.mehsul_id === p.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], sayi: next[idx].sayi + 1 };
        return next;
      }
      return [
        ...prev,
        {
          mehsul_id: p.id,
          ad: p.ad,
          kod: p.kod,
          sayi: 1,
          qiymet: Number(p.satis_qiymeti ?? 0),
          endirim_faiz: 0,
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

  /* ── Cəmi ── */
  const totals = useMemo(() => {
    const umumi = lines.reduce(
      (s, l) => s + l.sayi * l.qiymet * (1 - l.endirim_faiz / 100),
      0,
    );
    const son = Math.max(0, umumi - endirimMebleg);
    return { umumi, son };
  }, [lines, endirimMebleg]);

  async function onSave(asGonderildi: boolean) {
    if (lines.length === 0) {
      toast.error("Ən az 1 məhsul əlavə edin");
      return;
    }
    if (!musteri && musteriManualAd.trim().length < 2) {
      toast.error("Müştəri seçin və ya adını yazın");
      return;
    }

    const input: CreateTeklifInput = {
      musteri_id: musteri?.id ?? null,
      musteri_ad: musteri ? null : musteriManualAd.trim(),
      musteri_telefon: musteri ? null : musteriManualTel.trim() || null,
      menecer_id: menecerId || null,
      tarix,
      bitme_tarixi: bitmeTarixi,
      satish_tipi: satishTipi,
      endirim_meblegh: endirimMebleg,
      qeyd: qeyd.trim() || null,
      shertler: shertler.trim() || null,
      status: asGonderildi ? "gonderildi" : "qaralama",
      lines: lines.map((l) => ({
        mehsul_id: l.mehsul_id,
        ad: l.ad,
        kod: l.kod,
        sayi: l.sayi,
        qiymet: l.qiymet,
        endirim_faiz: l.endirim_faiz,
      })),
    };

    startTransition(async () => {
      const r = await createTeklif(input);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success(`Təklif yaradıldı: ${r.nomre}`);
      onOpenChange(false);
      router.refresh();
    });
  }

  /* ── Render ── */
  return (
    <OperationModalShell
      open={open}
      onOpenChange={onOpenChange}
      title="Yeni təklif"
      size="4xl"
      footerHints={
        <>
          <span><Kbd>F9</Kbd> Qaralama saxla</span>
          <span><Kbd>F10</Kbd> Göndər</span>
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
            Qaralama saxla
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => onSave(true)}
            disabled={pending}
            className="bg-violet-600 text-white hover:bg-violet-700"
          >
            <FileText className="h-3.5 w-3.5" />
            Göndər
          </Button>
        </>
      }
    >
      {/* Müştəri */}
      <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="sm:col-span-2">
          <Label1>Müştəri</Label1>
          <div className="relative">
            <Input
              value={musteri ? musteri.ad : musteriQ}
              onChange={(e) => {
                setMusteri(null);
                setMusteriQ(e.target.value);
              }}
              onFocus={() => setMusteriFocused(true)}
              onBlur={() => setTimeout(() => setMusteriFocused(false), 150)}
              placeholder="Ad, telefon… (boş = yeni müştəri)"
              className="h-8 text-xs"
            />
            {musteriFocused && musteriResults.length > 0 && !musteri && (
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
        </div>
        {!musteri && (
          <>
            <div>
              <Label1>Yeni ad</Label1>
              <Input
                value={musteriManualAd}
                onChange={(e) => setMusteriManualAd(e.target.value)}
                placeholder="ad soyad"
                className="h-8 text-xs"
              />
            </div>
            <div>
              <Label1>Telefon</Label1>
              <Input
                value={musteriManualTel}
                onChange={(e) => setMusteriManualTel(e.target.value)}
                placeholder="+994…"
                className="h-8 text-xs"
              />
            </div>
          </>
        )}
      </div>

      {/* Form row */}
      <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div>
          <Label1>Menecer</Label1>
          <select
            value={menecerId}
            onChange={(e) => setMenecerId(e.target.value)}
            className="h-8 w-full rounded-md border border-border bg-background px-2 text-xs"
          >
            <option value="">— Seçilməyib —</option>
            {saticilar.map((s) => (
              <option key={s.id} value={s.id}>
                {s.ad_soyad}
              </option>
            ))}
          </select>
        </div>
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
          <Label1>Bitmə tarixi</Label1>
          <Input
            type="date"
            value={bitmeTarixi}
            onChange={(e) => setBitmeTarixi(e.target.value)}
            className="h-8 text-xs"
          />
        </div>
        <div>
          <Label1>Satış tipi</Label1>
          <select
            value={satishTipi}
            onChange={(e) => setSatishTipi(e.target.value as typeof satishTipi)}
            className="h-8 w-full rounded-md border border-border bg-background px-2 text-xs"
          >
            {SATISH_TIPI.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Məhsul axtarış */}
      <div className="mb-2">
        <Label1>Məhsullar</Label1>
        <div className="relative">
          <div className="flex items-center gap-2 rounded-md border border-border bg-background px-2">
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
          {searchOpen && searchResults.length > 0 && (
            <ul className="absolute top-full left-0 right-0 z-20 mt-0.5 max-h-64 overflow-y-auto rounded-md border border-border bg-popover shadow">
              {searchResults.map((p) => {
                const stok = Number(p.stok_miqdari ?? 0);
                const stokTone =
                  stok <= 0
                    ? "text-rose-500 bg-rose-500/10 border-rose-500/30"
                    : stok < 5
                    ? "text-amber-600 bg-amber-500/10 border-amber-500/30"
                    : "text-emerald-600 bg-emerald-500/10 border-emerald-500/30";
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => addProduct(p)}
                      className="flex w-full items-center justify-between gap-2 px-2 py-1.5 text-left text-xs hover:bg-secondary"
                    >
                      <span className="min-w-0 flex-1 truncate">
                        <span className="font-medium">{p.ad}</span>
                        {p.kod && (
                          <span className="ml-1 text-muted-foreground">· {p.kod}</span>
                        )}
                      </span>
                      <span
                        className={`shrink-0 rounded border px-1.5 py-0.5 text-[10px] tabular-nums ${stokTone}`}
                      >
                        {stok > 0 ? `${stok} əd.` : "0 əd."}
                      </span>
                      <span className="shrink-0 tabular-nums text-muted-foreground">
                        {formatMoney(p.satis_qiymeti)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Sətirlər cədvəli */}
        {lines.length > 0 && (
          <div className="mt-2 overflow-hidden rounded-md border border-border">
            <table className="w-full text-xs">
              <thead className="border-b border-border bg-card/40 text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-2 py-1.5">Məhsul</th>
                  <th className="px-2 py-1.5 text-right w-16">Sayı</th>
                  <th className="px-2 py-1.5 text-right w-20">Qiymət</th>
                  <th className="px-2 py-1.5 text-right w-14">End. %</th>
                  <th className="px-2 py-1.5 text-right w-24">Cəmi</th>
                  <th className="px-2 py-1.5 w-7"></th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l, idx) => {
                  const satir = l.sayi * l.qiymet * (1 - l.endirim_faiz / 100);
                  return (
                    <tr key={`${l.mehsul_id}-${idx}`} className="border-b border-border/30">
                      <td className="px-2 py-1.5 truncate">{l.ad}</td>
                      <td className="px-2 py-1.5 text-right">
                        <input
                          type="number"
                          min={0.001}
                          step="0.01"
                          value={l.sayi}
                          onChange={(e) =>
                            updateLine(idx, { sayi: Number(e.target.value) || 0 })
                          }
                          className="h-6 w-14 rounded border border-border bg-background px-1 text-right text-xs tabular-nums"
                        />
                      </td>
                      <td className="px-2 py-1.5 text-right">
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={l.qiymet}
                          onChange={(e) =>
                            updateLine(idx, { qiymet: Number(e.target.value) || 0 })
                          }
                          className="h-6 w-20 rounded border border-border bg-background px-1 text-right text-xs tabular-nums"
                        />
                      </td>
                      <td className="px-2 py-1.5 text-right">
                        <input
                          type="number"
                          min={0}
                          max={100}
                          step="0.01"
                          value={l.endirim_faiz}
                          onChange={(e) =>
                            updateLine(idx, { endirim_faiz: Number(e.target.value) || 0 })
                          }
                          className="h-6 w-14 rounded border border-border bg-background px-1 text-right text-xs tabular-nums"
                        />
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums">
                        {formatMoney(satir)}
                      </td>
                      <td className="px-2 py-1.5">
                        <button
                          type="button"
                          onClick={() => removeLine(idx)}
                          className="grid h-5 w-5 place-items-center rounded text-muted-foreground hover:bg-rose-500/10 hover:text-rose-500"
                          aria-label="Sil"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Endirim + cəmi */}
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
        <div>
          <Label1>Endirim (₼)</Label1>
          <Input
            type="number"
            min={0}
            step="0.01"
            value={endirimMebleg}
            onChange={(e) => setEndirimMebleg(Number(e.target.value) || 0)}
            className="h-8 text-xs"
          />
        </div>
        <div>
          <Label1>Ümumi</Label1>
          <div className="h-8 rounded-md border border-border bg-background px-2 py-1.5 text-right text-xs tabular-nums text-muted-foreground">
            {formatMoney(totals.umumi)}
          </div>
        </div>
        <div>
          <Label1>YEKUN</Label1>
          <div className="h-8 rounded-md border border-violet-500/40 bg-violet-500/10 px-2 py-1.5 text-right text-sm font-bold tabular-nums text-violet-700 dark:text-violet-300">
            {formatMoney(totals.son)}
          </div>
        </div>
      </div>

      {/* Qeyd / Şərtlər */}
      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div>
          <Label1>Daxili qeyd</Label1>
          <textarea
            value={qeyd}
            onChange={(e) => setQeyd(e.target.value)}
            placeholder="Daxili qeyd (müştəriyə görünmür)…"
            className="h-16 w-full rounded-md border border-border bg-background p-2 text-xs"
          />
        </div>
        <div>
          <Label1>Şərtlər (müştəriyə görünür)</Label1>
          <textarea
            value={shertler}
            onChange={(e) => setShertler(e.target.value)}
            placeholder="Qiymət 7 gün etibarlıdır, ödəniş 50% avans…"
            className="h-16 w-full rounded-md border border-border bg-background p-2 text-xs"
          />
        </div>
      </div>
    </OperationModalShell>
  );
}

function Label1({ children }: { children: React.ReactNode }) {
  return (
    <label className="mb-1 block text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
      {children}
    </label>
  );
}
