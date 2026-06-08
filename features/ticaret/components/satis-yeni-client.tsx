"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2,
  Plus,
  Save,
  Trash2,
  Wand2,
  Truck,
  Coins,
  ClipboardList,
  Layers,
  FileDown,
  Sparkles,
  Eye,
  CalendarClock,
  Inbox,
  AlertTriangle,
  ShieldCheck,
  CheckCircle2,
  HandCoins,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Combobox, type ComboOption } from "@/components/ui/combobox";
import { Badge } from "@/components/ui/badge";
import { PriceTiersPopover } from "@/features/anbar/components/price-tiers-popover";
import { toast } from "sonner";
import { cn, formatMoney } from "@/lib/utils";
import { isEmbedded, closePageModal } from "@/lib/embed-mode";
import {
  searchCustomersAction,
  searchProductsAction,
} from "@/features/pos/search-actions";
import {
  createOrUpdateSatisYeni,
  saveSatisSablon,
  deleteSatisSablon,
  suggestDiscountAction,
  validateCartStock,
  getCustomerCreditStatus,
  precheckDiscountApproval,
  type StockCheckRow,
  type CustomerCreditStatus,
  type DiscountApprovalCheck,
} from "../satis-yeni-actions";
import { usePermissions } from "@/components/providers/permissions-provider";
import type { CustomerRow, ProductRow, SalespersonOption } from "@/features/pos/sale-queries";

export type AnbarOpt = { id: number; ad: string };
export type SablonRow = { id: number; ad: string; payload: string | null };
export type QaralamaRow = {
  id: string;
  nomre: string;
  musteri_ad: string | null;
  son_mebleg: number;
  satir_sayi: number;
  yenilendi: Date | null;
};

type Line = {
  uid: string;
  mehsul_id: string;
  ad: string;
  kod: string | null;
  anbar_id: number;
  miqdar: number;
  qiymet: number;
  endirim_faiz: number;
  stok_miqdari: number;
};

const VALYUTALAR = [
  { kod: "AZN", kurs: 1.0 },
  { kod: "USD", kurs: 1.7 },
  { kod: "EUR", kurs: 1.85 },
  { kod: "RUB", kurs: 0.019 },
  { kod: "TRY", kurs: 0.05 },
];

type HesabOpt = { id: string; ad: string; nov: string };

export function SatisYeniClient({
  anbarlar,
  saticilar,
  defaultSalespersonId,
  sablonlar,
  qaralamalar,
  prefillMehsulId,
  prefillProduct,
  hesablar = [],
}: {
  anbarlar: AnbarOpt[];
  saticilar: SalespersonOption[];
  defaultSalespersonId: string;
  sablonlar: SablonRow[];
  qaralamalar: QaralamaRow[];
  /** URL-dən gələn ?mehsul=X — ilk açılışda avtomatik satış sətrinə əlavə et. */
  prefillMehsulId?: string;
  /** Server-side hazırlanmış ProductRow — useEffect-də əl ilə fetch etmədən. */
  prefillProduct?: ProductRow;
  /** Ödəniş gediləcək maliyə hesabları (nağd, kart, bank) */
  hesablar?: HesabOpt[];
}) {
  const router = useRouter();
  const defaultAnbarId = anbarlar[0]?.id ?? 0;
  const icazeler = usePermissions();
  const canOverrideStock = icazeler.includes("pos.sell_no_stock");
  const canOverCredit = icazeler.includes("sales.over_credit");

  // Header
  const [musteri, setMusteri] = useState<CustomerRow | null>(null);
  const [musteriQ, setMusteriQ] = useState("");
  const [musteriResults, setMusteriResults] = useState<CustomerRow[]>([]);
  const [showCustResults, setShowCustResults] = useState(false);
  const [tarix, setTarix] = useState(new Date().toISOString().slice(0, 10));
  const [salespersonId, setSalespersonId] = useState(defaultSalespersonId);
  // ERP-2: payment type (cash by default; "nisye" = borc triggers credit guard)
  const [odenisNov, setOdenisNov] = useState<"negd" | "kart" | "kecirme" | "nisye">("negd");

  // Ödəniş hesabı — istifadəçi seçir, ya da ödəniş növünə görə avto-seçilir.
  // nisye olarsa hesab gərək deyil (borca yazılır).
  const defaultHesabForNov = (nov: typeof odenisNov): string => {
    if (nov === "nisye") return "";
    const targetNov = nov === "kart" ? "kart" : nov === "kecirme" ? "bank" : "negd";
    const match = hesablar.find((h) => h.nov === targetNov);
    return match?.id ?? hesablar[0]?.id ?? "";
  };
  const [hesabId, setHesabId] = useState<string>(defaultHesabForNov("negd"));
  // Ödəniş növü dəyişəndə hesabı avto-uyğunlaşdır
  useEffect(() => {
    setHesabId(defaultHesabForNov(odenisNov));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [odenisNov, hesablar.length]);

  // Lines
  const [lines, setLines] = useState<Line[]>([]);

  // ERP-1: stock check state (per-line)
  const [stockMap, setStockMap] = useState<Record<string, StockCheckRow>>({});
  const [stockChecking, setStockChecking] = useState(false);

  // ERP-2: customer credit status (loaded when a customer is picked)
  const [creditStatus, setCreditStatus] = useState<CustomerCreditStatus | null>(null);
  const [creditLoading, setCreditLoading] = useState(false);

  // ERP-3: discount approval threshold pre-check (server-driven)
  const [approvalCheck, setApprovalCheck] = useState<DiscountApprovalCheck | null>(null);

  // Header discount
  const [endirimMode, setEndirimMode] = useState<"faiz" | "mebleg">("faiz");
  const [endirimFaiz, setEndirimFaiz] = useState(0);
  const [endirimMebleg, setEndirimMebleg] = useState(0);

  // VAT
  const [vatOn, setVatOn] = useState(false);
  const [vatFaiz, setVatFaiz] = useState(18);

  // Currency
  const [valyuta, setValyuta] = useState("AZN");
  const [valyutaKurs, setValyutaKurs] = useState(1.0);

  // Delivery
  const [catdirma, setCatdirma] = useState(0);

  // Notes
  const [daxiliQeyd, setDaxiliQeyd] = useState("");
  const [musteriQeyd, setMusteriQeyd] = useState("");

  // Payment schedule
  const [planAktiv, setPlanAktiv] = useState(false);
  const [planAdet, setPlanAdet] = useState(3);

  // Stock reservation
  const [reserveStock, setReserveStock] = useState(true);

  // Template
  const [sablonName, setSablonName] = useState("");

  // Product search (modal-less inline)
  const [productQ, setProductQ] = useState("");
  const [productResults, setProductResults] = useState<ProductRow[]>([]);
  const [productSearching, setProductSearching] = useState(false);
  const [productAnbarId, setProductAnbarId] = useState<number>(defaultAnbarId);
  const [productFocused, setProductFocused] = useState(false);

  // Loading state
  const [saving, startSave] = useTransition();
  const [savingDraft, startDraft] = useTransition();
  const [suggestion, setSuggestion] = useState<{ pct: number; reason: string } | null>(null);
  const [suggesting, startSuggest] = useTransition();

  /* ---------------- Customer search ---------------- */
  useEffect(() => {
    const id = setTimeout(async () => {
      const r = await searchCustomersAction(musteriQ);
      setMusteriResults(r);
    }, musteriQ.trim().length === 0 ? 0 : 200);
    return () => clearTimeout(id);
  }, [musteriQ]);

  /* ---------------- Product search ---------------- */
  useEffect(() => {
    setProductSearching(true);
    const id = setTimeout(async () => {
      const r = await searchProductsAction(productQ, productAnbarId);
      setProductResults(r);
      setProductSearching(false);
    }, productQ.trim().length === 0 ? 0 : 200);
    return () => clearTimeout(id);
  }, [productQ, productAnbarId]);

  function addLine(p: ProductRow) {
    setLines((prev) => [
      ...prev,
      {
        uid: Math.random().toString(36).slice(2, 10),
        mehsul_id: p.id,
        ad: p.ad,
        kod: p.kod,
        anbar_id: productAnbarId,
        miqdar: 1,
        qiymet: p.satis_qiymeti,
        endirim_faiz: 0,
        stok_miqdari: p.stok_miqdari,
      },
    ]);
    setProductQ("");
    setProductResults([]);
  }

  /* ---- URL prefill: ?mehsul=UUID → ilk açılışda 1 dəfə satış sətri yarat ---- */
  const [prefillDone, setPrefillDone] = useState(false);
  useEffect(() => {
    if (prefillDone || !prefillMehsulId) return;
    // Server-side hazır obyekt varsa onu istifadə et — anlıq əlavə.
    if (prefillProduct) {
      addLine(prefillProduct);
      setPrefillDone(true);
      return;
    }
    // Fallback: ad/kod/barkod axtarışı (UUID-ni tap)
    let cancelled = false;
    (async () => {
      try {
        const results = await searchProductsAction(prefillMehsulId, productAnbarId);
        if (cancelled) return;
        const match = results.find((p) => p.id === prefillMehsulId);
        if (match) addLine(match);
      } catch {
        /* non-fatal */
      } finally {
        if (!cancelled) setPrefillDone(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [prefillMehsulId, prefillProduct, productAnbarId, prefillDone]);

  /* ----------------- ERP-1: Real-time stock validation ----------------- */
  useEffect(() => {
    if (lines.length === 0) {
      setStockMap({});
      return;
    }
    setStockChecking(true);
    const id = setTimeout(async () => {
      try {
        const res = await validateCartStock(
          lines.map((l) => ({
            uid: l.uid,
            mehsul_id: l.mehsul_id,
            anbar_id: l.anbar_id,
            miqdar: l.miqdar,
          })),
        );
        const map: Record<string, StockCheckRow> = {};
        for (const r of res.rows) map[r.uid] = r;
        setStockMap(map);
      } finally {
        setStockChecking(false);
      }
    }, 250);
    return () => clearTimeout(id);
  }, [lines]);

  const stockProblems = useMemo(
    () => Object.values(stockMap).filter((r) => !r.ok).length,
    [stockMap],
  );
  const stockOk = stockProblems === 0;

  /* ----------------- ERP-2: Load credit status on customer change ----- */
  useEffect(() => {
    if (!musteri) {
      setCreditStatus(null);
      return;
    }
    setCreditLoading(true);
    let cancelled = false;
    getCustomerCreditStatus(musteri.id)
      .then((s) => {
        if (!cancelled) setCreditStatus(s);
      })
      .finally(() => {
        if (!cancelled) setCreditLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [musteri]);

  function setLineField<K extends keyof Line>(uid: string, key: K, value: Line[K]) {
    setLines((prev) => prev.map((l) => (l.uid === uid ? { ...l, [key]: value } : l)));
  }

  function removeLine(uid: string) {
    setLines((prev) => prev.filter((l) => l.uid !== uid));
  }

  /* ---------------- Totals ---------------- */
  const umumi = useMemo(
    () => lines.reduce((s, l) => s + l.miqdar * l.qiymet * (1 - l.endirim_faiz / 100), 0),
    [lines],
  );
  const effectiveEndirim = useMemo(() => {
    if (endirimMode === "mebleg") return Math.min(endirimMebleg, umumi);
    return Math.min(umumi * (endirimFaiz / 100), umumi);
  }, [endirimMode, endirimFaiz, endirimMebleg, umumi]);
  const afterDiscount = Math.max(0, umumi - effectiveEndirim);
  const vat = vatOn ? afterDiscount * (vatFaiz / 100) : 0;
  const sonMebleg = afterDiscount + vat + (catdirma > 0 ? catdirma : 0);

  /* ---------------- ERP-3: Discount approval pre-check ----------------- */
  // Overall effective discount % combining per-line + header.
  const effectiveDiscountPct = useMemo(() => {
    if (umumi <= 0) return 0;
    // Gross before any line-level discounts:
    const gross = lines.reduce((s, l) => s + l.miqdar * l.qiymet, 0);
    if (gross <= 0) return 0;
    return Math.round(((gross - (umumi - effectiveEndirim)) / gross) * 1000) / 10;
  }, [lines, umumi, effectiveEndirim]);

  useEffect(() => {
    if (effectiveDiscountPct <= 0) {
      setApprovalCheck(null);
      return;
    }
    let cancelled = false;
    const id = setTimeout(async () => {
      const r = await precheckDiscountApproval(effectiveDiscountPct);
      if (!cancelled) setApprovalCheck(r);
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [effectiveDiscountPct]);

  /* ---------------- Multi-warehouse summary ---------------- */
  const anbarBreakdown = useMemo(() => {
    const map = new Map<number, number>();
    for (const l of lines) {
      const cur = map.get(l.anbar_id) ?? 0;
      map.set(l.anbar_id, cur + l.miqdar * l.qiymet * (1 - l.endirim_faiz / 100));
    }
    return Array.from(map.entries()).map(([anbar_id, sum]) => ({
      anbar_id,
      ad: anbarlar.find((a) => a.id === anbar_id)?.ad ?? `#${anbar_id}`,
      mebleg: sum,
    }));
  }, [lines, anbarlar]);

  /* ---------------- Payment schedule ---------------- */
  const odenisCedveli = useMemo(() => {
    if (!planAktiv || planAdet <= 0 || sonMebleg <= 0) return [];
    const per = Math.round((sonMebleg / planAdet) * 100) / 100;
    return Array.from({ length: planAdet }, (_, i) => ({
      tarix: new Date(Date.now() + (i + 1) * 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      mebleg: i === planAdet - 1 ? Math.round((sonMebleg - per * (planAdet - 1)) * 100) / 100 : per,
    }));
  }, [planAktiv, planAdet, sonMebleg]);

  /* ---------------- Currency conversion preview ---------------- */
  function convertedToAzn(): number {
    if (valyuta === "AZN") return sonMebleg;
    return sonMebleg * valyutaKurs;
  }

  /* ---------------- AI discount suggestion ---------------- */
  function fetchSuggestion() {
    if (!musteri) {
      toast.error("Əvvəlcə müştəri seçin");
      return;
    }
    startSuggest(async () => {
      const res = await suggestDiscountAction(musteri.id);
      setSuggestion({ pct: res.suggested_pct, reason: res.reason });
      toast.success(`AI təklif: ${res.suggested_pct}%`);
    });
  }

  function applySuggestion() {
    if (!suggestion) return;
    setEndirimMode("faiz");
    setEndirimFaiz(suggestion.pct);
    toast.success(`Endirim tətbiq olundu: ${suggestion.pct}%`);
  }

  /* ---------------- Templates ---------------- */
  function saveTemplate() {
    if (!sablonName.trim()) {
      toast.error("Şablon adı yazın");
      return;
    }
    if (lines.length === 0) {
      toast.error("Şablon yaratmaq üçün ən az 1 sətir olmalıdır");
      return;
    }
    const payload = {
      lines: lines.map((l) => ({
        mehsul_id: l.mehsul_id,
        ad: l.ad,
        kod: l.kod,
        anbar_id: l.anbar_id,
        miqdar: l.miqdar,
        qiymet: l.qiymet,
        endirim_faiz: l.endirim_faiz,
      })),
      endirim_faiz: endirimFaiz,
      endirim_mode: endirimMode,
      catdirma,
      vat_faiz: vatOn ? vatFaiz : 0,
    };
    startSave(async () => {
      const r = await saveSatisSablon(sablonName.trim(), JSON.stringify(payload));
      if (r.ok) {
        toast.success("Şablon yadda saxlanıldı");
        setSablonName("");
        router.refresh();
      } else {
        toast.error(r.error);
      }
    });
  }

  function loadTemplate(s: SablonRow) {
    if (!s.payload) return;
    try {
      const p = JSON.parse(s.payload);
      if (Array.isArray(p.lines)) {
        setLines(
          p.lines.map((l: Line) => ({
            ...l,
            uid: Math.random().toString(36).slice(2, 10),
          })),
        );
      }
      if (p.endirim_faiz != null) setEndirimFaiz(Number(p.endirim_faiz));
      if (p.endirim_mode) setEndirimMode(p.endirim_mode);
      if (p.catdirma != null) setCatdirma(Number(p.catdirma));
      if (p.vat_faiz) {
        setVatOn(true);
        setVatFaiz(Number(p.vat_faiz));
      }
      toast.success(`Şablon "${s.ad}" yükləndi`);
    } catch {
      toast.error("Şablon yüklənmədi");
    }
  }

  function deleteTemplate(id: number) {
    startSave(async () => {
      await deleteSatisSablon(id);
      router.refresh();
    });
  }

  /* ---------------- PDF Quote export ---------------- */
  function exportPdfQuote() {
    if (lines.length === 0) {
      toast.error("Sətir yoxdur");
      return;
    }
    const payload = encodeURIComponent(
      JSON.stringify({
        musteri_ad: musteri?.ad ?? "—",
        tarix,
        lines: lines.map((l) => ({
          ad: l.ad,
          kod: l.kod,
          miqdar: l.miqdar,
          qiymet: l.qiymet,
          endirim_faiz: l.endirim_faiz,
        })),
        endirim: effectiveEndirim,
        catdirma,
        vat,
        vat_faiz: vatFaiz,
        son_mebleg: sonMebleg,
        valyuta,
        musteri_qeyd: musteriQeyd,
      }),
    );
    window.open(`/ticaret/teklif-pdf?d=${payload}`, "_blank");
  }

  /* ---------------- Submit ---------------- */
  function submit(asDraft: boolean) {
    if (lines.length === 0) {
      toast.error("Ən az 1 sətir olmalıdır");
      return;
    }
    // ERP-1: block on stock shortage for non-draft sales unless override permission.
    if (!asDraft && stockProblems > 0 && !canOverrideStock) {
      toast.error(`Stok çatışmır: ${stockProblems} sətir bloklayır`);
      return;
    }
    // ERP-2: block on credit limit when paying as Borc unless override.
    if (
      !asDraft &&
      odenisNov === "nisye" &&
      creditStatus &&
      creditStatus.borc_limiti !== null &&
      creditStatus.available !== null &&
      sonMebleg > creditStatus.available &&
      !canOverCredit
    ) {
      toast.error(
        `Müştəri kredit limiti aşılır: ${formatMoney(creditStatus.available)} mövcud, ${formatMoney(sonMebleg)} tələb`,
      );
      return;
    }
    const fn = asDraft ? startDraft : startSave;
    fn(async () => {
      const res = await createOrUpdateSatisYeni({
        musteri_id: musteri?.id ?? null,
        tarix,
        endirim_mebleg: effectiveEndirim,
        catdirma_xerc: catdirma,
        vat_faiz: vatOn ? vatFaiz : 0,
        daxili_qeyd: daxiliQeyd || null,
        musteri_qeyd: musteriQeyd || null,
        qaralama: asDraft,
        reserve_stock: reserveStock,
        satis_meneceri_id: salespersonId,
        odenis_cedveli: planAktiv ? odenisCedveli : null,
        odenis_nov: odenisNov,
        hesab_id: odenisNov === "nisye" ? null : hesabId || null,
        valyuta,
        valyuta_kurs: valyutaKurs,
        lines: lines.map((l) => ({
          mehsul_id: l.mehsul_id,
          anbar_id: l.anbar_id,
          miqdar: l.miqdar,
          qiymet: l.qiymet,
          endirim_faiz: l.endirim_faiz,
        })),
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      if (asDraft) {
        toast.success(`Qaralama saxlanıldı: ${res.nomre}`);
        if (isEmbedded()) closePageModal();
        else router.refresh();
      } else {
        toast.success(`Satış yaradıldı: ${res.nomre}`);
        if (isEmbedded()) closePageModal();
        else router.push(`/ticaret/satislar/${res.satis_id}`);
      }
    });
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_360px]">
      {/* LEFT — main form */}
      <div className="space-y-4">
        <Card className="glass">
          <CardContent className="grid grid-cols-1 gap-3 py-4 md:grid-cols-2">
            {/* Customer */}
            <div className="space-y-1 relative">
              <Label>Müştəri</Label>
              {musteri ? (
                <div className="flex items-center gap-2 rounded-md border border-border bg-secondary/40 px-3 py-2 text-sm">
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{musteri.ad}</div>
                    {musteri.telefon && (
                      <div className="text-xs text-muted-foreground">{musteri.telefon}</div>
                    )}
                  </div>
                  <Badge variant="outline" className="text-[10px]">satış</Badge>
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
                    placeholder="Müştəri axtar və ya seçin..."
                    className="h-9"
                  />
                  {showCustResults && (
                    <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-[240px] overflow-y-auto rounded-md border border-border bg-popover shadow-lg">
                      {musteriResults.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => {
                            setMusteri(c);
                            setMusteriQ("");
                            setShowCustResults(false);
                          }}
                          className="flex w-full items-center justify-between border-b border-border/40 p-2 text-left text-sm hover:bg-secondary"
                        >
                          <span className="truncate">{c.ad}</span>
                          <span className="text-xs text-muted-foreground">{c.telefon ?? ""}</span>
                        </button>
                      ))}
                      {musteriResults.length === 0 && (
                        <div className="px-2 py-2 text-xs text-muted-foreground">Tapılmadı</div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="space-y-1">
              <Label>Tarix</Label>
              <Input type="date" value={tarix} onChange={(e) => setTarix(e.target.value)} className="h-9" />
            </div>

            <div className="space-y-1">
              <Label>Standart anbar (yeni sətir üçün)</Label>
              <Combobox
                options={anbarlar.map<ComboOption>((a) => ({ value: String(a.id), label: a.ad }))}
                value={String(productAnbarId)}
                onChange={(v) => setProductAnbarId(Number(v))}
                placeholder="Anbar seçin"
                searchPlaceholder="Anbar axtar..."
                emptyText="Tapılmadı"
              />
            </div>
            <div className="space-y-1">
              <Label>Satış meneceri</Label>
              <Combobox
                options={saticilar.map<ComboOption>((s) => ({ value: s.id, label: s.ad_soyad }))}
                value={salespersonId}
                onChange={setSalespersonId}
                placeholder="Seçin"
                searchPlaceholder="Axtar..."
                emptyText="Tapılmadı"
              />
            </div>
            <div className="space-y-1">
              <Label>Ödəniş növü</Label>
              <select
                value={odenisNov}
                onChange={(e) => setOdenisNov(e.target.value as typeof odenisNov)}
                className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
              >
                <option value="negd">Nağd</option>
                <option value="kart">Kart</option>
                <option value="kecirme">Bank köçürməsi</option>
                <option value="nisye">Borc (nisyə)</option>
              </select>
            </div>
            {/* Maliyə hesabı seçimi — ödəniş növünə görə avto-uyğunlaşır,
                istifadəçi başqa hesab seçə bilər. Nisyə-də gizlədilir. */}
            {odenisNov !== "nisye" && hesablar.length > 0 && (
              <div className="space-y-1">
                <Label>Hansı kassa / hesab?</Label>
                <select
                  value={hesabId}
                  onChange={(e) => setHesabId(e.target.value)}
                  className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                >
                  {hesablar.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.ad} ({h.nov})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ERP-2: Credit status panel for selected customer */}
        {musteri && (
          <Card className="glass">
            <CardContent className="space-y-2 py-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold inline-flex items-center gap-1.5">
                  <HandCoins className="h-4 w-4 text-primary-light" />
                  Müştəri kredit statusu
                </h3>
                {creditLoading && (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                )}
              </div>
              {creditStatus ? (
                <>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="rounded-md bg-secondary/40 p-2">
                      <div className="text-muted-foreground">Cari borc</div>
                      <div className="font-semibold tabular-nums">{formatMoney(creditStatus.borc)}</div>
                    </div>
                    <div className="rounded-md bg-secondary/40 p-2">
                      <div className="text-muted-foreground">Limit</div>
                      <div className="font-semibold tabular-nums">
                        {creditStatus.borc_limiti === null ? "—" : formatMoney(creditStatus.borc_limiti)}
                      </div>
                    </div>
                    <div className="rounded-md bg-secondary/40 p-2">
                      <div className="text-muted-foreground">Available</div>
                      <div
                        className={cn(
                          "font-semibold tabular-nums",
                          creditStatus.available !== null && creditStatus.available <= 0 && "text-danger",
                        )}
                      >
                        {creditStatus.available === null ? "—" : formatMoney(creditStatus.available)}
                      </div>
                    </div>
                  </div>
                  {creditStatus.overdue_count > 0 && (
                    <div className="flex items-center gap-2 rounded-md border border-warning/40 bg-warning/10 px-2 py-1.5 text-xs">
                      <AlertTriangle className="h-3.5 w-3.5 text-warning" />
                      <span>
                        Gecikmiş ödənişlər: <strong>{creditStatus.overdue_count}</strong> sənəd ·{" "}
                        <strong>{formatMoney(creditStatus.overdue_90)}</strong> (90+ gün)
                      </span>
                    </div>
                  )}
                  {creditStatus.overdue_count > 0 && odenisNov !== "negd" && (
                    <div className="text-[11px] text-muted-foreground">
                      <Sparkles className="inline h-3 w-3 text-primary-light" /> AI: Bu müştəridə
                      gecikmiş borc var — Nağd ödəniş tövsiyə edirik.
                    </div>
                  )}
                  {odenisNov === "nisye" &&
                    creditStatus.available !== null &&
                    sonMebleg > creditStatus.available && (
                      <div className="flex items-center gap-2 rounded-md border border-danger/40 bg-danger/10 px-2 py-1.5 text-xs text-danger">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        <span>
                          Satış borcu: <strong>{formatMoney(sonMebleg)}</strong> &gt; mövcud kredit:{" "}
                          <strong>{formatMoney(creditStatus.available)}</strong>
                          {canOverCredit ? " — override icazəniz var" : " — bloklanır"}
                        </span>
                      </div>
                    )}
                </>
              ) : (
                !creditLoading && (
                  <p className="text-xs text-muted-foreground">Kredit məlumatı yoxdur</p>
                )
              )}
            </CardContent>
          </Card>
        )}

        {/* Products section */}
        <Card className="glass">
          <CardContent className="space-y-3 py-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold inline-flex items-center gap-1.5">
                <Layers className="h-4 w-4 text-primary-light" />
                Məhsullar (çox-anbarlı dəstək)
              </h3>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground">
                  {lines.length} sətir · {anbarBreakdown.length} anbar
                </span>
                {/* ERP-1: Stock safety status */}
                {lines.length > 0 && (
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[10px] gap-1",
                      stockChecking
                        ? "border-muted"
                        : stockOk
                          ? "border-success/40 text-success"
                          : "border-danger/40 text-danger",
                    )}
                  >
                    {stockChecking ? (
                      <Loader2 className="h-2.5 w-2.5 animate-spin" />
                    ) : stockOk ? (
                      <CheckCircle2 className="h-2.5 w-2.5" />
                    ) : (
                      <AlertTriangle className="h-2.5 w-2.5" />
                    )}
                    {stockChecking
                      ? "Stok yoxlanılır..."
                      : stockOk
                        ? "Stok təhlükəsizliyi: OK"
                        : `${stockProblems} məhsul stokda yoxdur`}
                  </Badge>
                )}
              </div>
            </div>

            <div className="relative">
              <Input
                value={productQ}
                onChange={(e) => setProductQ(e.target.value)}
                onFocus={() => setProductFocused(true)}
                onBlur={() => setTimeout(() => setProductFocused(false), 150)}
                placeholder="Məhsul axtar (ad, kod, barkod)..."
                className="h-9"
              />
              {productSearching && (
                <Loader2 className="absolute right-2 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />
              )}
              {productFocused && productResults.length > 0 && (
                <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-[320px] overflow-y-auto rounded-md border border-border bg-popover shadow-lg">
                  {productResults.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => addLine(p)}
                      className="flex w-full items-center justify-between gap-3 border-b border-border/40 p-2 text-left text-sm hover:bg-secondary"
                    >
                      <span className="min-w-0 flex-1 truncate">{p.ad}</span>
                      <span className="text-xs text-muted-foreground">
                        {p.kod ?? "—"} · stok: {p.stok_miqdari}
                      </span>
                      <span className="font-semibold tabular-nums">{formatMoney(p.satis_qiymeti)}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Lines table */}
            {lines.length === 0 ? (
              <div className="rounded-md border border-dashed border-border/60 py-8 text-center text-sm text-muted-foreground">
                Hələ sətir yoxdur — yuxarıdan məhsul axtarın
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-muted-foreground">
                      <th className="px-2 py-1">Məhsul</th>
                      <th className="px-2 py-1">Anbar</th>
                      <th className="px-2 py-1 text-right">Miqdar</th>
                      <th className="px-2 py-1 text-right">Qiymət</th>
                      <th className="px-2 py-1 text-right">End %</th>
                      <th className="px-2 py-1 text-right">Cəm</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((l) => {
                      const lineTotal = l.miqdar * l.qiymet * (1 - l.endirim_faiz / 100);
                      const stockRow = stockMap[l.uid];
                      const stockBad = stockRow && !stockRow.ok;
                      return (
                        <tr key={l.uid} className={cn("border-t border-border/40", stockBad && "bg-danger/5")}>
                          <td className="px-2 py-1">
                            <div className="flex items-center gap-1">
                              {stockBad && (
                                <span
                                  title={`Stokda yoxdur: ${stockRow?.available ?? 0} mövcud, ${stockRow?.requested ?? 0} tələb`}
                                  className="inline-flex"
                                >
                                  <AlertTriangle className="h-3.5 w-3.5 text-danger" />
                                </span>
                              )}
                              <span className="truncate" title={l.ad}>{l.ad}</span>
                              <PriceTiersPopover
                                mehsulId={l.mehsul_id}
                                title="Qiymət tipləri"
                                onPickPrice={(price) => setLineField(l.uid, "qiymet", price)}
                              />
                            </div>
                            {l.kod && (
                              <div className="text-[10px] text-muted-foreground">{l.kod}</div>
                            )}
                            {stockBad && (
                              <div className="text-[10px] text-danger">
                                Mövcud: {stockRow?.available} · Tələb: {stockRow?.requested}
                              </div>
                            )}
                          </td>
                          <td className="px-2 py-1">
                            <select
                              value={l.anbar_id}
                              onChange={(e) => setLineField(l.uid, "anbar_id", Number(e.target.value))}
                              className="h-7 rounded-md border border-border bg-background px-1.5 text-xs"
                            >
                              {anbarlar.map((a) => (
                                <option key={a.id} value={a.id}>{a.ad}</option>
                              ))}
                            </select>
                          </td>
                          <td className="px-2 py-1">
                            <Input
                              type="number"
                              step="0.001"
                              value={l.miqdar}
                              onChange={(e) => setLineField(l.uid, "miqdar", Math.max(0.001, Number(e.target.value) || 0))}
                              className="h-7 w-20 text-right"
                            />
                          </td>
                          <td className="px-2 py-1">
                            <Input
                              type="number"
                              step="0.01"
                              value={l.qiymet}
                              onChange={(e) => setLineField(l.uid, "qiymet", Math.max(0, Number(e.target.value) || 0))}
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
                              onChange={(e) => setLineField(l.uid, "endirim_faiz", Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
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

            <div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => document.querySelector<HTMLInputElement>('input[placeholder*="Məhsul axtar"]')?.focus()}
                className="gap-1"
              >
                <Plus className="h-3.5 w-3.5" />
                Sətir əlavə et (məhsul axtar)
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Notes */}
        <Card className="glass">
          <CardContent className="grid grid-cols-1 gap-3 py-4 md:grid-cols-2">
            <div className="space-y-1">
              <Label className="inline-flex items-center gap-1.5">
                <ClipboardList className="h-3.5 w-3.5" />
                Daxili qeyd (yalnız personalın)
              </Label>
              <textarea
                value={daxiliQeyd}
                onChange={(e) => setDaxiliQeyd(e.target.value)}
                rows={3}
                maxLength={2000}
                className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <div className="space-y-1">
              <Label className="inline-flex items-center gap-1.5">
                <Eye className="h-3.5 w-3.5" />
                Müştəri qeydi (cek/PDF-də görsənir)
              </Label>
              <textarea
                value={musteriQeyd}
                onChange={(e) => setMusteriQeyd(e.target.value)}
                rows={3}
                maxLength={2000}
                className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          </CardContent>
        </Card>

        {/* Templates + drafts */}
        <Card className="glass">
          <CardContent className="space-y-3 py-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold inline-flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-primary-light" />
                Şablonlar
              </h3>
              <div className="flex items-center gap-1">
                <Input
                  value={sablonName}
                  onChange={(e) => setSablonName(e.target.value)}
                  placeholder="Şablon adı (məs. Aylıq sifariş — Kontur)"
                  className="h-8 w-72 text-xs"
                />
                <Button size="sm" variant="outline" onClick={saveTemplate} disabled={saving}>
                  <Save className="h-3.5 w-3.5" /> Saxla
                </Button>
              </div>
            </div>
            {sablonlar.length === 0 ? (
              <div className="text-xs text-muted-foreground">Şablon yoxdur</div>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {sablonlar.map((s) => (
                  <div key={s.id} className="flex items-center gap-1 rounded-md border border-border/60 bg-secondary/30 px-2 py-1 text-xs">
                    <button type="button" onClick={() => loadTemplate(s)} className="font-medium hover:text-primary-light">
                      {s.ad}
                    </button>
                    <button type="button" onClick={() => deleteTemplate(s.id)} className="text-muted-foreground hover:text-danger" aria-label="Sil">
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {qaralamalar.length > 0 && (
          <Card className="glass">
            <CardContent className="space-y-2 py-3">
              <h3 className="text-sm font-semibold inline-flex items-center gap-1.5">
                <Inbox className="h-4 w-4 text-primary-light" />
                Son qaralamalar
              </h3>
              <div className="divide-y divide-border/40">
                {qaralamalar.slice(0, 6).map((q) => (
                  <div key={q.id} className="flex items-center justify-between gap-2 py-1.5 text-sm">
                    <div className="min-w-0">
                      <div className="font-mono text-xs text-muted-foreground">{q.nomre}</div>
                      <div className="truncate">{q.musteri_ad ?? "—"} · {q.satir_sayi} sətir</div>
                    </div>
                    <div className="font-semibold tabular-nums">{formatMoney(q.son_mebleg)}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* RIGHT — totals + side actions */}
      <div className="space-y-4">
        {/* AI Discount */}
        <Card className="glass">
          <CardContent className="space-y-2 py-3">
            <h3 className="text-sm font-semibold inline-flex items-center gap-1.5">
              <Wand2 className="h-4 w-4 text-primary-light" />
              Avto qiymət təklifi (AI)
            </h3>
            <p className="text-xs text-muted-foreground">
              Müştərinin son 90 gün satışlarına əsasən optimal endirim faizi.
            </p>
            <div className="flex items-center gap-1.5">
              <Button size="sm" variant="outline" onClick={fetchSuggestion} disabled={suggesting || !musteri}>
                {suggesting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                Hesabla
              </Button>
              {suggestion && (
                <Button size="sm" onClick={applySuggestion}>Tətbiq et: {suggestion.pct}%</Button>
              )}
            </div>
            {suggestion && (
              <div className="text-xs text-muted-foreground">{suggestion.reason}</div>
            )}
          </CardContent>
        </Card>

        {/* Discount + VAT */}
        <Card className="glass">
          <CardContent className="space-y-3 py-3">
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label>Başlıq endirimi</Label>
                <div className="flex rounded-md border border-border p-0.5">
                  <button type="button" onClick={() => setEndirimMode("faiz")} className={cn("px-2 py-0.5 text-[10px]", endirimMode === "faiz" ? "bg-primary/15 text-primary-light" : "text-muted-foreground")}>%</button>
                  <button type="button" onClick={() => setEndirimMode("mebleg")} className={cn("px-2 py-0.5 text-[10px]", endirimMode === "mebleg" ? "bg-primary/15 text-primary-light" : "text-muted-foreground")}>AZN</button>
                </div>
              </div>
              {endirimMode === "faiz" ? (
                <Input type="number" min={0} max={100} value={endirimFaiz} onChange={(e) => setEndirimFaiz(Math.max(0, Math.min(100, Number(e.target.value) || 0)))} className="h-9" />
              ) : (
                <Input type="number" min={0} value={endirimMebleg} onChange={(e) => setEndirimMebleg(Math.max(0, Number(e.target.value) || 0))} className="h-9" />
              )}
            </div>

            <div className="flex items-center justify-between">
              <Label className="inline-flex items-center gap-1.5">
                <input type="checkbox" checked={vatOn} onChange={(e) => setVatOn(e.target.checked)} className="h-3.5 w-3.5 accent-primary" />
                ƏDV (VAT) tətbiq et
              </Label>
              {vatOn && (
                <Input type="number" min={0} max={50} value={vatFaiz} onChange={(e) => setVatFaiz(Math.max(0, Math.min(50, Number(e.target.value) || 0)))} className="h-7 w-16 text-right" />
              )}
            </div>

            <div className="space-y-1">
              <Label className="inline-flex items-center gap-1.5">
                <Truck className="h-3.5 w-3.5" /> Çatdırılma xərci
              </Label>
              <Input type="number" min={0} value={catdirma} onChange={(e) => setCatdirma(Math.max(0, Number(e.target.value) || 0))} className="h-9" />
            </div>
          </CardContent>
        </Card>

        {/* Currency */}
        <Card className="glass">
          <CardContent className="space-y-2 py-3">
            <h3 className="text-sm font-semibold inline-flex items-center gap-1.5">
              <Coins className="h-4 w-4 text-primary-light" />
              Valyuta konvertasiyası
            </h3>
            <div className="grid grid-cols-2 gap-2">
              <select
                value={valyuta}
                onChange={(e) => {
                  setValyuta(e.target.value);
                  const v = VALYUTALAR.find((x) => x.kod === e.target.value);
                  if (v) setValyutaKurs(v.kurs);
                }}
                className="h-9 rounded-md border border-input bg-background px-2 text-sm"
              >
                {VALYUTALAR.map((v) => (
                  <option key={v.kod} value={v.kod}>{v.kod}</option>
                ))}
              </select>
              <Input type="number" step="0.001" value={valyutaKurs} onChange={(e) => setValyutaKurs(Math.max(0, Number(e.target.value) || 0))} className="h-9" />
            </div>
            {valyuta !== "AZN" && (
              <div className="text-xs text-muted-foreground">
                1 {valyuta} ≈ {valyutaKurs} AZN · AZN ekvivalent: <strong>{formatMoney(convertedToAzn())}</strong>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Payment schedule */}
        <Card className="glass">
          <CardContent className="space-y-2 py-3">
            <h3 className="text-sm font-semibold inline-flex items-center gap-1.5">
              <CalendarClock className="h-4 w-4 text-primary-light" />
              Ödəniş cədvəli
            </h3>
            <div className="flex items-center gap-2">
              <label className="inline-flex items-center gap-1.5 text-xs">
                <input type="checkbox" checked={planAktiv} onChange={(e) => setPlanAktiv(e.target.checked)} className="h-3.5 w-3.5 accent-primary" />
                Bölünmüş ödəniş
              </label>
              {planAktiv && (
                <select value={planAdet} onChange={(e) => setPlanAdet(Number(e.target.value))} className="h-7 rounded-md border border-border bg-background px-1.5 text-xs">
                  {[2, 3, 4, 5].map((n) => <option key={n} value={n}>{n} taksit</option>)}
                </select>
              )}
            </div>
            {planAktiv && odenisCedveli.length > 0 && (
              <div className="space-y-0.5 text-xs">
                {odenisCedveli.map((p, i) => (
                  <div key={i} className="flex items-center justify-between border-b border-border/40 py-0.5 last:border-0">
                    <span className="text-muted-foreground">{i + 1}. {p.tarix}</span>
                    <span className="font-semibold tabular-nums">{formatMoney(p.mebleg)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Reserve stock */}
        <Card className="glass">
          <CardContent className="space-y-1 py-3">
            <h3 className="text-sm font-semibold inline-flex items-center gap-1.5">
              <Layers className="h-4 w-4 text-primary-light" />
              Stok rezerv (qaralamada)
            </h3>
            <label className="flex items-center gap-1.5 text-xs">
              <input type="checkbox" checked={reserveStock} onChange={(e) => setReserveStock(e.target.checked)} className="h-3.5 w-3.5 accent-primary" />
              Qaralama yaratdıqda məhsulları 48 saatlıq rezerv et
            </label>
          </CardContent>
        </Card>

        {/* ERP-3: Discount approval banner */}
        {approvalCheck?.needs_approval && (
          <Card className="glass border-warning/40 bg-warning/5">
            <CardContent className="space-y-1 py-3">
              <div className="inline-flex items-center gap-1.5 text-sm font-semibold text-warning">
                <ShieldCheck className="h-4 w-4" />
                Endirim təsdiq tələb edir
              </div>
              <p className="text-xs text-muted-foreground">
                Endirim {approvalCheck.effective_pct.toFixed(1)}% &gt; limit{" "}
                {approvalCheck.limit_pct}%
                {approvalCheck.user_role ? ` (rol: ${approvalCheck.user_role})` : ""}.
                Satış &ldquo;tesdiq_gozleyir&rdquo; statusu ilə yaranacaq.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Totals + actions */}
        <Card className="glass border-primary/20">
          <CardContent className="space-y-2 py-4">
            <Row label="Cəm" value={formatMoney(umumi)} />
            {effectiveEndirim > 0 && (
              <Row label="Endirim" value={`- ${formatMoney(effectiveEndirim)}`} />
            )}
            {vat > 0 && <Row label={`ƏDV ${vatFaiz}%`} value={`+ ${formatMoney(vat)}`} />}
            {catdirma > 0 && <Row label="Çatdırılma" value={`+ ${formatMoney(catdirma)}`} />}
            {anbarBreakdown.length > 1 && (
              <div className="rounded-md bg-secondary/30 px-2 py-1 text-[11px] text-muted-foreground">
                {anbarBreakdown.map((a) => (
                  <div key={a.anbar_id} className="flex items-center justify-between">
                    <span>{a.ad}</span>
                    <span className="tabular-nums">{formatMoney(a.mebleg)}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="h-px bg-border/60" />
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Yekun</span>
              <span className="text-2xl font-bold brand-text tabular-nums">{formatMoney(sonMebleg)}</span>
            </div>

            <div className="grid grid-cols-2 gap-1.5 pt-1">
              <Button size="sm" variant="outline" onClick={exportPdfQuote} className="gap-1">
                <FileDown className="h-3.5 w-3.5" /> PDF Quote
              </Button>
              <Button size="sm" variant="outline" onClick={() => submit(true)} disabled={savingDraft} className="gap-1">
                {savingDraft ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                Qaralama saxla
              </Button>
            </div>
            <Button
              size="lg"
              className="w-full font-bold text-white"
              style={{ background: "var(--brand-gradient)" }}
              onClick={() => submit(false)}
              disabled={
                saving ||
                lines.length === 0 ||
                (!canOverrideStock && stockProblems > 0) ||
                (!canOverCredit &&
                  odenisNov === "nisye" &&
                  !!creditStatus &&
                  creditStatus.borc_limiti !== null &&
                  creditStatus.available !== null &&
                  sonMebleg > creditStatus.available)
              }
            >
              {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : "Satış yarat"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
    </div>
  );
}
