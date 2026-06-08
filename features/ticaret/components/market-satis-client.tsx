"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Bike,
  Loader2,
  Trash2,
  ScanBarcode,
  Wallet,
  Percent,
  PackageCheck,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Combobox, type ComboOption } from "@/components/ui/combobox";
import { Badge } from "@/components/ui/badge";
import { PriceTiersPopover } from "@/features/anbar/components/price-tiers-popover";
import { toast } from "sonner";
import { formatMoney } from "@/lib/utils";
import { isEmbedded, closePageModal } from "@/lib/embed-mode";
import {
  searchCustomersAction,
  searchProductsAction,
  lookupBarcodeAction,
} from "@/features/pos/search-actions";
import { createMarketSatis } from "../market-satis-action";
import {
  getMarketplaceDefaults,
  suggestPlatformFromOrderCode,
} from "../marketplace-defaults";
import type { MarketplaceDefaultsMap } from "../marketplace-platforms";
import type { CustomerRow, ProductRow } from "@/features/pos/sale-queries";

export type AnbarOpt = { id: number; ad: string };
export type HesabOpt = {
  id: string;
  ad: string;
  nov: string;
  bank_adi: string | null;
  kart_son4: string | null;
};

type Line = {
  uid: string;
  mehsul_id: string;
  ad: string;
  kod: string | null;
  miqdar: number;
  qiymet: number;
  endirim_faiz: number;
  stok_miqdari: number;
};

const PLATFORM_OPTIONS = [
  { value: "bolt_food", label: "Bolt Food", defaultKomissiya: 25 },
  { value: "wolt", label: "Wolt", defaultKomissiya: 30 },
  { value: "yango_deli", label: "Yango Deli", defaultKomissiya: 22 },
  { value: "tap_az", label: "Tap.az", defaultKomissiya: 5 },
  { value: "progo", label: "ProGo", defaultKomissiya: 18 },
  { value: "diger", label: "Digər", defaultKomissiya: 0 },
] as const;

type PlatformValue = (typeof PLATFORM_OPTIONS)[number]["value"];

function looksLikeBarcode(s: string): boolean {
  const t = s.trim();
  return t.length >= 6 && /^[0-9]+$/.test(t);
}

export function MarketSatisClient({
  anbarlar,
  hesablar,
}: {
  anbarlar: AnbarOpt[];
  hesablar: HesabOpt[];
}) {
  const router = useRouter();
  const defaultAnbarId = anbarlar[0]?.id ?? 0;
  const defaultHesabId = hesablar[0]?.id ?? "";

  // Header — platform & komissiya kept across sales (kassir adətən eyni platformadan ardıcıl satışlar edir)
  const [platform, setPlatform] = useState<PlatformValue>("bolt_food");
  const [komissiyaFaiz, setKomissiyaFaiz] = useState<number>(25);
  const [anbarId, setAnbarId] = useState<number>(defaultAnbarId);
  const [hesabId, setHesabId] = useState<string>(defaultHesabId);

  // Platform defaultları — ilk yükləmədə bir dəfə oxunur, platforma seçildikcə tətbiq olunur
  const [platformDefaults, setPlatformDefaults] = useState<MarketplaceDefaultsMap>({});
  // İstifadəçinin manual dəyişdirdiyi sahələri overwrite etməmək üçün
  const [komissiyaTouched, setKomissiyaTouched] = useState(false);
  const [hesabTouched, setHesabTouched] = useState(false);
  const [anbarTouched, setAnbarTouched] = useState(false);
  // Platforma təklifi (sifariş kodundan)
  const [suggestedPlatform, setSuggestedPlatform] = useState<PlatformValue | null>(null);

  useEffect(() => {
    let alive = true;
    getMarketplaceDefaults().then((m) => {
      if (!alive) return;
      setPlatformDefaults(m);
      // İlk yükləmədə cari platforma üçün defaultları tətbiq et
      const cur = m[platform];
      if (cur) {
        if (!komissiyaTouched && cur.komissiya_faiz > 0) setKomissiyaFaiz(cur.komissiya_faiz);
        if (!hesabTouched && cur.hesab_id) setHesabId(cur.hesab_id);
        if (!anbarTouched && cur.anbar_id) setAnbarId(cur.anbar_id);
      }
    }).catch(() => { /* non-fatal */ });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Platforma dəyişəndə → həmin platformanın defaultlarını tətbiq et (touched olmayanları)
  useEffect(() => {
    const cur = platformDefaults[platform];
    if (!cur) return;
    if (!komissiyaTouched && cur.komissiya_faiz > 0) setKomissiyaFaiz(cur.komissiya_faiz);
    if (!hesabTouched && cur.hesab_id) setHesabId(cur.hesab_id);
    if (!anbarTouched && cur.anbar_id) setAnbarId(cur.anbar_id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [platform, platformDefaults]);

  // Sifariş & müştəri
  const [sifarisNomresi, setSifarisNomresi] = useState("");
  const [qaimeNomresi, setQaimeNomresi] = useState("");
  const [musteri, setMusteri] = useState<CustomerRow | null>(null);
  const [musteriQ, setMusteriQ] = useState("");
  const [musteriResults, setMusteriResults] = useState<CustomerRow[]>([]);
  const [showCustResults, setShowCustResults] = useState(false);
  const [catdirmaUnvani, setCatdirmaUnvani] = useState("");

  // Endirim
  const [endirimMebleg, setEndirimMebleg] = useState(0);

  // Lines / search
  const [lines, setLines] = useState<Line[]>([]);
  const [searchQ, setSearchQ] = useState("");
  const [searchResults, setSearchResults] = useState<ProductRow[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [saving, startSave] = useTransition();

  /* ---------------- Müştəri search ---------------- */
  useEffect(() => {
    const id = setTimeout(async () => {
      const r = await searchCustomersAction(musteriQ);
      setMusteriResults(r);
    }, musteriQ.trim().length === 0 ? 0 : 200);
    return () => clearTimeout(id);
  }, [musteriQ]);

  /* ---------------- Product search ---------------- */
  useEffect(() => {
    setSearching(true);
    const id = setTimeout(async () => {
      const r = await searchProductsAction(searchQ, anbarId);
      setSearchResults(r);
      setSearching(false);
    }, searchQ.trim().length === 0 ? 0 : 200);
    return () => clearTimeout(id);
  }, [searchQ, anbarId]);

  function addProduct(p: ProductRow) {
    setLines((prev) => {
      // If same product already in cart, increment miqdar
      const existing = prev.find((l) => l.mehsul_id === p.id);
      if (existing) {
        return prev.map((l) =>
          l.mehsul_id === p.id ? { ...l, miqdar: l.miqdar + 1 } : l,
        );
      }
      return [
        ...prev,
        {
          uid: Math.random().toString(36).slice(2, 10),
          mehsul_id: p.id,
          ad: p.ad,
          kod: p.kod,
          miqdar: 1,
          qiymet: p.satis_qiymeti,
          endirim_faiz: 0,
          stok_miqdari: p.stok_miqdari,
        },
      ];
    });
    setSearchQ("");
    setSearchResults([]);
    // Keep focus on the search input for rapid scanning
    searchInputRef.current?.focus();
  }

  function setLineField<K extends keyof Line>(uid: string, key: K, value: Line[K]) {
    setLines((prev) => prev.map((l) => (l.uid === uid ? { ...l, [key]: value } : l)));
  }

  function removeLine(uid: string) {
    setLines((prev) => prev.filter((l) => l.uid !== uid));
  }

  function handleSearchKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      e.preventDefault();
      setSearchQ("");
      setSearchResults([]);
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const code = (e.target as HTMLInputElement).value.trim();
      if (!code) return;
      if (looksLikeBarcode(code)) {
        lookupBarcodeAction(code, anbarId).then((p) => {
          if (p) {
            addProduct(p);
            toast.success(`${p.ad} əlavə olundu`);
          } else {
            toast.error(`Barkod "${code}" tapılmadı`);
          }
        });
      } else if (searchResults.length > 0) {
        addProduct(searchResults[0]);
      } else {
        lookupBarcodeAction(code, anbarId).then((p) => {
          if (p) addProduct(p);
          else toast.error(`"${code}" üçün nəticə yoxdur`);
        });
      }
    }
  }

  function handlePlatformChange(value: string) {
    const p = PLATFORM_OPTIONS.find((o) => o.value === value);
    if (!p) return;
    setPlatform(p.value);
    setKomissiyaFaiz(p.defaultKomissiya);
  }

  /* ---------------- Totals ---------------- */
  const umumi = useMemo(
    () => lines.reduce((s, l) => s + l.miqdar * l.qiymet * (1 - l.endirim_faiz / 100), 0),
    [lines],
  );
  const effectiveEndirim = Math.min(endirimMebleg, umumi);
  const sonMebleg = Math.max(0, umumi - effectiveEndirim);
  const komissiyaMebleg =
    Math.round(sonMebleg * (komissiyaFaiz / 100) * 100) / 100;
  const netMebleg = Math.max(0, sonMebleg - komissiyaMebleg);

  function resetAfterSale() {
    setLines([]);
    setSifarisNomresi("");
    setQaimeNomresi("");
    setEndirimMebleg(0);
    setMusteri(null);
    setMusteriQ("");
    setCatdirmaUnvani("");
    // Keep platform + komissiya
    searchInputRef.current?.focus();
  }

  function submit() {
    if (!sifarisNomresi.trim()) {
      toast.error("Sifariş nömrəsini daxil edin");
      return;
    }
    if (lines.length === 0) {
      toast.error("Ən az 1 məhsul olmalıdır");
      return;
    }
    if (anbarId <= 0) {
      toast.error("Anbar seçin");
      return;
    }

    startSave(async () => {
      const res = await createMarketSatis({
        platform,
        sifaris_nomresi: sifarisNomresi.trim(),
        qaime_nomresi: qaimeNomresi.trim() || null,
        komissiya_faiz: komissiyaFaiz,
        anbar_id: anbarId,
        musteri_id: musteri?.id ?? null,
        catdirma_unvani: catdirmaUnvani.trim() || null,
        hesab_id: hesabId || null,
        endirim_mebleg: effectiveEndirim,
        qeyd: null,
        lines: lines.map((l) => ({
          mehsul_id: l.mehsul_id,
          miqdar: l.miqdar,
          qiymet: l.qiymet,
          endirim_faiz: l.endirim_faiz,
        })),
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(
        `Satış yaradıldı: ${res.nomre} — net ${formatMoney(res.net_meblegh)}`,
      );
      if (isEmbedded()) {
        closePageModal();
      } else {
        resetAfterSale();
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-4">
      {/* Header bar — platform + sifariş nömrəsi + qaimə nömrəsi + komissiya + anbar */}
      <Card className="glass">
        <CardContent className="grid grid-cols-1 gap-3 py-4 md:grid-cols-2 lg:grid-cols-5">
          <div className="space-y-1">
            <Label className="inline-flex items-center gap-1">
              <Bike className="h-3.5 w-3.5 text-sky-600" /> Platforma
            </Label>
            <Combobox
              options={PLATFORM_OPTIONS.map<ComboOption>((p) => ({
                value: p.value,
                label: p.label,
              }))}
              value={platform}
              onChange={handlePlatformChange}
              placeholder="Platforma seç"
              searchPlaceholder="Axtar..."
              emptyText="Tapılmadı"
            />
          </div>
          <div className="space-y-1">
            <Label>Sifariş kodu *</Label>
            <Input
              value={sifarisNomresi}
              onChange={(e) => {
                const v = e.target.value;
                setSifarisNomresi(v);
                // Platforma təklifi — yalnız təklif et, məcburi dəyişmə
                if (v.length >= 3) {
                  suggestPlatformFromOrderCode(v).then((p) => {
                    if (p && p !== platform) setSuggestedPlatform(p as PlatformValue);
                    else setSuggestedPlatform(null);
                  }).catch(() => {});
                } else {
                  setSuggestedPlatform(null);
                }
              }}
              placeholder="Məs. WLT-12345"
              className="h-9"
              required
            />
            {suggestedPlatform && (
              <button
                type="button"
                onClick={() => {
                  setPlatform(suggestedPlatform);
                  setSuggestedPlatform(null);
                }}
                className="text-[10.5px] text-amber-700 hover:underline"
              >
                💡 Bu kod {suggestedPlatform.replace("_", " ")} kimi görünür — platformanı dəyiş?
              </button>
            )}
          </div>
          <div className="space-y-1">
            <Label>Qaimə nömrəsi</Label>
            <Input
              value={qaimeNomresi}
              onChange={(e) => setQaimeNomresi(e.target.value)}
              placeholder="Opsionel"
              className="h-9"
            />
          </div>
          <div className="space-y-1">
            <Label className="inline-flex items-center gap-1">
              <Percent className="h-3.5 w-3.5 text-amber-600" /> Komissiya %
            </Label>
            <Input
              type="number"
              min={0}
              max={100}
              step="0.1"
              value={komissiyaFaiz}
              onChange={(e) => {
                setKomissiyaTouched(true);
                setKomissiyaFaiz(
                  Math.max(0, Math.min(100, Number(e.target.value) || 0)),
                );
              }}
              className="h-9 text-right"
            />
          </div>
          <div className="space-y-1">
            <Label>Anbar</Label>
            <Combobox
              options={anbarlar.map<ComboOption>((a) => ({
                value: String(a.id),
                label: a.ad,
              }))}
              value={String(anbarId)}
              onChange={(v) => {
                setAnbarTouched(true);
                setAnbarId(Number(v));
              }}
              placeholder="Anbar seç"
              searchPlaceholder="Axtar..."
              emptyText="Tapılmadı"
            />
          </div>
        </CardContent>
      </Card>

      {/* Main grid: LEFT 60% cart, RIGHT 40% payment */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[3fr_2fr]">
        {/* LEFT — barcode + cart */}
        <Card className="glass">
          <CardContent className="space-y-3 py-3">
            <div className="flex items-center justify-between">
              <h3 className="inline-flex items-center gap-1.5 text-sm font-semibold">
                <ScanBarcode className="h-4 w-4 text-rose-500" />
                Səbət (skan və ya axtar)
              </h3>
              <span className="text-xs text-muted-foreground">
                {lines.length} sətir
              </span>
            </div>

            <div className="relative">
              <Input
                ref={searchInputRef}
                value={searchQ}
                autoFocus
                placeholder="Barkod / ad / kod yaz və ya skan et — Enter ilə əlavə et"
                className="h-12 rounded-lg border-2 border-rose-300 bg-white pl-3 pr-10 text-sm font-medium"
                onChange={(e) => setSearchQ(e.target.value)}
                onKeyDown={handleSearchKey}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setTimeout(() => setSearchFocused(false), 150)}
              />
              {searching && (
                <Loader2 className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-rose-400" />
              )}
              {searchQ && !searching && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQ("");
                    setSearchResults([]);
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-300 hover:bg-slate-100 hover:text-slate-600"
                  aria-label="Təmizlə"
                  tabIndex={-1}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
              {searchFocused && searchResults.length > 0 && (
                <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-[360px] overflow-y-auto rounded-md border border-border bg-popover shadow-lg">
                  {searchResults.map((p) => {
                    const stok = Number(p.stok_miqdari ?? 0);
                    const diger = p.diger_anbarlarda ?? [];
                    const digerSum = diger.reduce((s, d) => s + d.miqdar, 0);
                    const blocked = stok <= 0 && digerSum <= 0;
                    const stokTone =
                      stok <= 0
                        ? digerSum > 0
                          ? "text-amber-600 bg-amber-500/10 border-amber-500/30"
                          : "text-rose-600 bg-rose-500/10 border-rose-500/30"
                        : stok < 5
                        ? "text-amber-600 bg-amber-500/10 border-amber-500/30"
                        : "text-emerald-600 bg-emerald-500/10 border-emerald-500/30";
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => addProduct(p)}
                        disabled={stok <= 0}
                        title={
                          stok <= 0 && digerSum > 0
                            ? `Bu anbarda 0; digər anbarlarda: ${diger.map((d) => `${d.anbar_ad} (${d.miqdar})`).join(", ")}`
                            : undefined
                        }
                        className="flex w-full items-start justify-between gap-3 border-b border-border/40 p-2 text-left text-sm hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-transparent"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate">
                            {p.ad}
                            {p.kod && (
                              <span className="ml-1 text-xs text-muted-foreground">· {p.kod}</span>
                            )}
                          </span>
                          {diger.length > 0 && (
                            <span className="mt-0.5 block truncate text-[10px] text-amber-700 dark:text-amber-400">
                              📦 Digər anbar:{" "}
                              {diger.slice(0, 2).map((d) => `${d.anbar_ad} ${d.miqdar}`).join(" · ")}
                              {diger.length > 2 && ` +${diger.length - 2}`}
                            </span>
                          )}
                        </span>
                        <span
                          className={`shrink-0 rounded border px-1.5 py-0.5 text-[11px] tabular-nums ${stokTone}`}
                        >
                          {stok > 0 ? `${stok} əd.` : blocked ? "yoxdur" : "0 (bu anbar)"}
                        </span>
                        <span className="shrink-0 font-semibold tabular-nums">
                          {formatMoney(p.satis_qiymeti)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {lines.length === 0 ? (
              <div className="rounded-md border border-dashed border-border/60 py-12 text-center text-sm text-muted-foreground">
                Səbət boşdur — yuxarıdan barkod skan edin və ya axtarış yazın
              </div>
            ) : (
              <div className="max-h-[420px] overflow-y-auto overflow-x-auto">
                <table className="w-[640px] sm:w-full text-sm">
                  <thead className="sticky top-0 bg-background">
                    <tr className="text-left text-xs text-muted-foreground">
                      <th className="px-2 py-1">Məhsul</th>
                      <th className="px-2 py-1 text-right">Miqdar</th>
                      <th className="px-2 py-1 text-right">Qiymət</th>
                      <th className="px-2 py-1 text-right">End %</th>
                      <th className="px-2 py-1 text-right">Cəm</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((l) => {
                      const lineTotal =
                        l.miqdar * l.qiymet * (1 - l.endirim_faiz / 100);
                      return (
                        <tr key={l.uid} className="border-t border-border/40">
                          <td className="px-2 py-1">
                            <div className="flex items-center gap-1">
                              <span className="truncate" title={l.ad}>
                                {l.ad}
                              </span>
                              <PriceTiersPopover
                                mehsulId={l.mehsul_id}
                                title="Qiymət tipləri"
                                onPickPrice={(price) =>
                                  setLineField(l.uid, "qiymet", price)
                                }
                              />
                            </div>
                            {l.kod && (
                              <div className="text-[10px] text-muted-foreground">
                                {l.kod}
                              </div>
                            )}
                          </td>
                          <td className="px-2 py-1">
                            <Input
                              type="number"
                              step="0.001"
                              value={l.miqdar}
                              onChange={(e) =>
                                setLineField(
                                  l.uid,
                                  "miqdar",
                                  Math.max(0.001, Number(e.target.value) || 0),
                                )
                              }
                              className="h-7 w-20 text-right"
                            />
                          </td>
                          <td className="px-2 py-1">
                            <Input
                              type="number"
                              step="0.01"
                              value={l.qiymet}
                              onChange={(e) =>
                                setLineField(
                                  l.uid,
                                  "qiymet",
                                  Math.max(0, Number(e.target.value) || 0),
                                )
                              }
                              className="h-7 w-24 text-right"
                            />
                          </td>
                          <td className="px-2 py-1">
                            <Input
                              type="number"
                              min={0}
                              max={100}
                              step="0.1"
                              value={l.endirim_faiz}
                              onChange={(e) =>
                                setLineField(
                                  l.uid,
                                  "endirim_faiz",
                                  Math.max(
                                    0,
                                    Math.min(100, Number(e.target.value) || 0),
                                  ),
                                )
                              }
                              className="h-7 w-16 text-right"
                            />
                          </td>
                          <td className="px-2 py-1 text-right font-semibold tabular-nums">
                            {formatMoney(lineTotal)}
                          </td>
                          <td className="px-2 py-1">
                            <button
                              type="button"
                              onClick={() => removeLine(l.uid)}
                              className="text-muted-foreground hover:text-danger"
                              aria-label="Sil"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* RIGHT — customer + delivery + payout */}
        <Card className="glass">
          <CardContent className="space-y-3 py-3">
            <div className="space-y-1 relative">
              <Label>Müştəri (opsionel)</Label>
              {musteri ? (
                <div className="flex items-center gap-2 rounded-md border border-border bg-secondary/40 px-3 py-2 text-sm">
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{musteri.ad}</div>
                    {musteri.telefon && (
                      <div className="text-xs text-muted-foreground">
                        {musteri.telefon}
                      </div>
                    )}
                  </div>
                  {musteri.borc > 0 && (
                    <Badge
                      variant="outline"
                      className="border-amber-500/40 bg-amber-500/10 text-[10px] font-semibold tabular-nums text-amber-700 dark:text-amber-300"
                      title={`Cari borc: ${formatMoney(musteri.borc)}`}
                    >
                      Borc: {formatMoney(musteri.borc)}
                    </Badge>
                  )}
                  <Badge variant="outline" className="text-[10px]">
                    market
                  </Badge>
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-foreground text-sm"
                    onClick={() => setMusteri(null)}
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <>
                  <Input
                    value={musteriQ}
                    onChange={(e) => setMusteriQ(e.target.value)}
                    onFocus={() => setShowCustResults(true)}
                    onBlur={() => setTimeout(() => setShowCustResults(false), 150)}
                    placeholder="Müştəri axtar (marketplace üçün adətən boşdur)..."
                    className="h-9"
                  />
                  {showCustResults && (
                    <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-[280px] overflow-y-auto rounded-md border border-border bg-popover shadow-lg">
                      {musteriResults.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => {
                            setMusteri(c);
                            setMusteriQ("");
                            setShowCustResults(false);
                          }}
                          className="flex w-full items-center justify-between gap-2 border-b border-border/40 p-2 text-left text-sm hover:bg-secondary"
                        >
                          <span className="min-w-0 flex-1 truncate">
                            <span className="font-medium">{c.ad}</span>
                            {c.telefon && (
                              <span className="ml-1 text-xs text-muted-foreground">
                                · {c.telefon}
                              </span>
                            )}
                          </span>
                          {c.borc > 0 && (
                            <span
                              className="shrink-0 rounded border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-amber-700 dark:text-amber-300"
                              title={`Cari borc: ${formatMoney(c.borc)}`}
                            >
                              {formatMoney(c.borc)}
                            </span>
                          )}
                        </button>
                      ))}
                      {musteriResults.length === 0 && (
                        <div className="px-2 py-2 text-xs text-muted-foreground">
                          Tapılmadı
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="space-y-1">
              <Label>Çatdırılma ünvanı (opsionel)</Label>
              <Input
                value={catdirmaUnvani}
                onChange={(e) => setCatdirmaUnvani(e.target.value)}
                placeholder="Məs. Nizami küç. 12, mən. 5"
                className="h-9"
              />
            </div>

            <div className="space-y-1">
              <Label>Endirim (manat)</Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={endirimMebleg}
                onChange={(e) =>
                  setEndirimMebleg(Math.max(0, Number(e.target.value) || 0))
                }
                className="h-9 text-right"
              />
            </div>

            <div className="space-y-1">
              <Label className="inline-flex items-center gap-1">
                <Wallet className="h-3.5 w-3.5 text-emerald-600" /> Marketplace payout hesabı
              </Label>
              <Combobox
                options={hesablar.map<ComboOption>((h) => ({
                  value: h.id,
                  label: `${h.ad}${h.bank_adi ? ` · ${h.bank_adi}` : ""}${h.kart_son4 ? ` ****${h.kart_son4}` : ""}`,
                }))}
                value={hesabId}
                onChange={(v) => {
                  setHesabTouched(true);
                  setHesabId(v);
                }}
                placeholder={hesablar.length === 0 ? "Hesab yoxdur" : "Hesab seç"}
                searchPlaceholder="Axtar..."
                emptyText="Tapılmadı"
              />
              <p className="text-[10.5px] text-muted-foreground">
                Net məbləğ bu hesaba daxil olacaq (Kart/Bank).
              </p>
            </div>

            {/* Totals */}
            <div className="space-y-1.5 rounded-lg border border-border bg-secondary/30 p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Cəm:</span>
                <span className="font-semibold tabular-nums">
                  {formatMoney(umumi)}
                </span>
              </div>
              {effectiveEndirim > 0 && (
                <div className="flex items-center justify-between text-rose-600">
                  <span>Endirim:</span>
                  <span className="tabular-nums">
                    −{formatMoney(effectiveEndirim)}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Cəmi (brutto):</span>
                <span className="font-semibold tabular-nums">
                  {formatMoney(sonMebleg)}
                </span>
              </div>
              <div className="flex items-center justify-between text-amber-700">
                <span>Komissiya ({komissiyaFaiz}%):</span>
                <span className="tabular-nums">−{formatMoney(komissiyaMebleg)}</span>
              </div>
              <div className="flex items-center justify-between border-t border-border pt-1.5 text-base font-bold text-emerald-700">
                <span className="inline-flex items-center gap-1">
                  <PackageCheck className="h-4 w-4" /> Net:
                </span>
                <span className="tabular-nums">{formatMoney(netMebleg)}</span>
              </div>
            </div>

            <Button
              type="button"
              onClick={submit}
              disabled={saving || lines.length === 0 || !sifarisNomresi.trim()}
              className="h-12 w-full bg-emerald-600 text-base font-bold text-white shadow-sm hover:bg-emerald-700"
            >
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Yadda saxlanılır...
                </>
              ) : (
                <>TAMAMLA · {formatMoney(netMebleg)}</>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
