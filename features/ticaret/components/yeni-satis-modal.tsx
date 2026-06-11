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

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
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
import { ContactContextPanel } from "@/features/elaqe/components/contact-context-panel";
import { QuickCreateCustomerDialog } from "@/features/elaqe/components/quick-create-customer-dialog";
import { Combobox, type ComboOption } from "@/components/ui/combobox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatMoney } from "@/lib/utils";
import { searchCustomersAction, searchProductsAction, getCanViewCostAction } from "@/features/pos/search-actions";
import type { CustomerRow, ProductRow, SalespersonOption } from "@/features/pos/sale-queries";
import {
  createOrUpdateSatisYeni,
  precheckDiscountApproval,
  getCustomerCreditStatus,
  type CustomerCreditStatus,
} from "../satis-yeni-actions";
import { OperationModalShell, Kbd } from "./operation-modal-shell";

export type AnbarOpt = { id: number; ad: string };

type Line = {
  mehsul_id: string;
  ad: string;
  kod: string | null;
  miqdar: number;
  qiymet: number;
  /** Maya — yalnız `qiymet.oxu` icazəsi olan istifadəçilərə real dəyər, digərlərinə 0. */
  maya: number;
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

// Ödəniş növləri:
//   negd / kart / kecirme — dərhal ödəniş (Nəğd, Kart, Bank Köçürməsi)
//   nisye               — borc kimi qalır (müştəri sonra ödəyəcək)
const PAY_OPTIONS = [
  { value: "negd",    label: "Nəğd" },
  { value: "kart",    label: "Kart" },
  { value: "kecirme", label: "Köçürmə (bank)" },
  { value: "nisye",   label: "Nisyə (borc)" },
] as const;

export type KassaOpt = { id: string; ad: string };
export type HesabOpt = { id: string; ad: string; nov: string; bank_adi: string | null };

export function YeniSatisModal({
  open,
  onOpenChange,
  anbarlar,
  saticilar,
  defaultSalespersonId,
  kassalar = [],
  hesablar = [],
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  anbarlar: AnbarOpt[];
  saticilar: SalespersonOption[];
  defaultSalespersonId: string | null;
  /** Nəğd ödəniş üçün kassa siyahısı. */
  kassalar?: KassaOpt[];
  /** Kart / bank köçürmə üçün hesab siyahısı. */
  hesablar?: HesabOpt[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  // Idempotentlik açarı — double-submit / F9+F10 cüt tıklamada eyni satışın
  // iki dəfə yaranmasının qarşısını alır. Hər uğurlu saxlamadan sonra yenilənir.
  const clientOpIdRef = useRef<string>(crypto.randomUUID());

  /* ── Header fields ───────────────────────────────── */
  const [barcode, setBarcode] = useState("");
  const [musteri, setMusteri] = useState<CustomerRow | null>(null);
  const [musteriQ, setMusteriQ] = useState("");
  const [musteriFocused, setMusteriFocused] = useState(false);
  const [musteriResults, setMusteriResults] = useState<CustomerRow[]>([]);
  const [saticiId, setSaticiId] = useState<string>(defaultSalespersonId ?? "");
  const [anbarId, setAnbarId] = useState<number>(anbarlar[0]?.id ?? 0);

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [tarix, setTarix] = useState<string>(today);
  // Default: SEÇİLMƏYİB — istifadəçi "Pul hara daxil oldu" sahəsində ya kassa/hesab,
  // ya da açıq "Nisyə" seçməlidir (əvvəl default "nisye" idi → səssizcə borca düşürdü).
  const [odenisNov, setOdenisNov] = useState<string>("");
  const [kassaId, setKassaId] = useState<string>("");
  const [hesabId, setHesabId] = useState<string>("");
  const [sifarisKodu, setSifarisKodu] = useState<string>("");

  /* ── Marketplace block (visible when sifaris kodu or platform set) ── */
  const [platform, setPlatform] = useState<string>("");
  const [magaza, setMagaza] = useState<string>("Default");
  const marketplaceVisible = !!(sifarisKodu.trim() || platform);

  /* ── Lines ───────────────────────────────────────── */
  const [lines, setLines] = useState<Line[]>([]);

  // Maya görmə icazəsi — mount-da bir dəfə oxunur
  const [canSeeMaya, setCanSeeMaya] = useState(false);
  useEffect(() => {
    if (!open) return;
    let alive = true;
    getCanViewCostAction().then((v) => {
      if (alive) setCanSeeMaya(v);
    }).catch(() => {});
    return () => { alive = false; };
  }, [open]);

  // Müştəri kredit statusu — müştəri seçildikdə oxunur
  const [creditStatus, setCreditStatus] = useState<CustomerCreditStatus | null>(null);
  useEffect(() => {
    if (!musteri?.id) {
      setCreditStatus(null);
      return;
    }
    let alive = true;
    getCustomerCreditStatus(musteri.id)
      .then((s) => {
        if (alive) setCreditStatus(s);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [musteri?.id]);
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
    // Hər açılışda təzə idempotentlik açarı.
    clientOpIdRef.current = crypto.randomUUID();
  }, [open]);

  /* ── Customer search ─────────────────────────────── */
  useEffect(() => {
    let alive = true;
    const delay = musteriQ.trim().length === 0 ? 0 : 200;
    const id = setTimeout(() => {
      searchCustomersAction(musteriQ).then((r) => {
        if (alive) setMusteriResults(r);
      });
    }, delay);
    return () => {
      alive = false;
      clearTimeout(id);
    };
  }, [musteriQ]);

  /* ── Product search ──────────────────────────────── */
  useEffect(() => {
    let alive = true;
    const delay = searchQ.trim().length === 0 ? 0 : 200;
    const id = setTimeout(() => {
      searchProductsAction(searchQ, anbarId || undefined).then((r) => {
        if (alive) setSearchResults(r);
      });
    }, delay);
    return () => {
      alive = false;
      clearTimeout(id);
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

  // Effective endirim % (line endirimləri + ümumi endirim ilə)
  const effectiveEndirimPct = useMemo(() => {
    if (umumi <= 0) return 0;
    return Math.min(100, Math.max(0, (endirimAzn / umumi) * 100));
  }, [umumi, endirimAzn]);

  // Maya altı sətirlər — yalnız maya icazəsi olanlar üçün hesablanır
  const mayaAltiInfo = useMemo(() => {
    if (!canSeeMaya) return { count: 0, totalLoss: 0, lines: [] as number[] };
    let count = 0;
    let totalLoss = 0;
    const idxs: number[] = [];
    lines.forEach((l, idx) => {
      if (l.maya <= 0) return; // mayası məlum deyil
      const netSatis = l.qiymet * (1 - (l.endirim_faiz || 0) / 100);
      if (netSatis < l.maya) {
        count++;
        idxs.push(idx);
        totalLoss += (l.maya - netSatis) * l.miqdar;
      }
    });
    return { count, totalLoss, lines: idxs };
  }, [canSeeMaya, lines]);

  // Endirim limiti təsdiqi — debounced pre-check
  const [discountCheck, setDiscountCheck] = useState<{
    needs_approval: boolean;
    limit_pct: number;
    user_role: string | null;
  } | null>(null);
  useEffect(() => {
    if (!open || effectiveEndirimPct <= 0) {
      setDiscountCheck(null);
      return;
    }
    let alive = true;
    const t = setTimeout(async () => {
      try {
        const r = await precheckDiscountApproval(effectiveEndirimPct);
        if (alive) {
          setDiscountCheck({
            needs_approval: r.needs_approval,
            limit_pct: r.limit_pct,
            user_role: r.user_role,
          });
        }
      } catch {
        // non-fatal
      }
    }, 400);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [open, effectiveEndirimPct]);
  // ── Ödəniş hesablanması (TƏK mənbə: "Müştəri verir") ──────────────────
  // Əvvəl iki qopuq giriş vardı: "Müştəri verir/Qaytarılacaq" (dekorativ, serverə
  // getmirdi) + "Ödənilən məbləğ" (əsl). Kassa seçilməyəndə isə satış səssizcə tam
  // nisyəyə düşürdü — yəni eyni anda "qaytarılacaq 8" göstərib borca yazırdı.
  const accountPicked = !!(kassaId || hesabId);
  // Hesab/kassa seçiləndə "Müştəri verir" = verilən nağd/məbləğ. Boş (0) = tam ödəniş.
  const appliedNow = accountPicked
    ? (musteriVerir > 0 ? Math.min(musteriVerir, yekun) : yekun)
    : 0;
  // Qaytarma yalnız nağd verilən yekundan çox olduqda — və qalıq borc qarşılıqlı istisnadır.
  const qaytarilacaq = accountPicked && musteriVerir > 0 ? Math.max(0, musteriVerir - yekun) : 0;
  const qaliqBorc = Math.max(0, yekun - appliedNow);

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
          maya: Number(p.alish_qiymeti ?? 0),
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

    // Ödəniş: tək mənbə "Müştəri verir" (yuxarıda hesablanmış appliedNow/qaliqBorc).
    // appliedNow = bu satışa qəbul olunan (kassaya düşən), qaliqBorc = nisyə qalan.
    // Qaytarma (musteriVerir > yekun) odenilen_mebleg-ə təsir etmir — yalnız ekranda.
    const effectiveOdenilen = appliedNow;
    const hasDebt = qaliqBorc > 0.001;
    // Semantik tip: qalıq borc varsa nisyə (FIFO bağlanması üçün), tam ödənişdə hesab növü
    const effectiveOdenisNov: "negd" | "kart" | "kecirme" | "nisye" =
      !accountPicked || hasDebt ? "nisye" : (odenisNov as "negd" | "kart" | "kecirme" | "nisye");

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
      odenis_nov: effectiveOdenisNov,
      // QA-kritik: kassa_id və hesab_id AYRI sahələrdir. Əvvəl hesab seçimi də
      // `kassa_id`-yə yığılırdı (kassaId || hesabId) → server onu kassa FK kimi
      // işlədib pulu heç bir hesaba yazmırdı (pul yox olurdu). İndi hər biri
      // öz sahəsinə gedir; server hesab_id-dən maliye hesabını həll edir.
      kassa_id: kassaId || null,
      hesab_id: hesabId || null,
      // Hissəvi ödəniş: server bu məbləği kassaya/hesaba qəbul edir, qalıq borc olur
      odenilen_mebleg: effectiveOdenilen,
      client_op_id: clientOpIdRef.current,
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

    // "Pul hara daxil oldu" mütləq seçilməlidir — ya kassa/hesab, ya açıq nisyə.
    if (!accountPicked && odenisNov !== "nisye") {
      return "Pul hara daxil oldu? Kassa/hesab seçin və ya «Nisyə» işarələyin";
    }
    // Nağd/məbləğ yazılıbsa, mütləq kassa/hesab seçilməlidir (pul hara düşəcək).
    if (!accountPicked && musteriVerir > 0) {
      return "Ödəniş üçün əvvəlcə kassa/hesab seçin (pul hara düşəcək?)";
    }
    if (musteriVerir < 0) return "«Müştəri verir» məbləği yanlışdır";
    // Qalıq borc (tam nisyə və ya hissəvi ödəniş) → müştəri tələb olunur.
    if (qaliqBorc > 0.001 && !musteri) {
      return accountPicked
        ? "Hissəvi ödənişdə qalıq borc olur — müştəri seçilməlidir"
        : "Nisyə satış üçün müştəri seçilməlidir";
    }
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
      // Növbəti satış üçün yeni idempotentlik açarı — köhnə açar dublikat tutmasın.
      clientOpIdRef.current = crypto.randomUUID();
      onOpenChange(false);
      router.refresh();
      if (printAfter) {
        // Open A4 invoice in new tab — termal qəbz üçün ?format=thermal əlavə et
        window.open(`/ticaret/satislar/${res.satis_id}/print`, "_blank");
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
      size="4xl"
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
          <div className="relative flex gap-1">
            <Input
              value={musteri ? musteri.ad : musteriQ}
              onChange={(e) => {
                setMusteri(null);
                setMusteriQ(e.target.value);
              }}
              onFocus={() => setMusteriFocused(true)}
              onBlur={() => setTimeout(() => setMusteriFocused(false), 150)}
              placeholder="Ad, telefon… Boş = nağdı"
              className="h-8 flex-1 text-xs"
            />
            <QuickCreateCustomerDialog
              defaultName={musteriQ}
              onCreated={(c) => {
                setMusteri({
                  id: c.id,
                  ad: c.ad,
                  telefon: c.telefon,
                  email: null,
                  borc: c.borc,
                });
                setMusteriQ("");
                setMusteriResults([]);
              }}
            />
            {musteriFocused && musteriResults.length > 0 && !musteri && (
              <ul className="absolute top-full left-0 right-0 z-10 mt-0.5 max-h-52 overflow-y-auto rounded-md border border-border bg-popover shadow">
                {musteriResults.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setMusteri(c);
                        setMusteriQ("");
                        setMusteriResults([]);
                      }}
                      className="flex w-full items-center justify-between gap-2 px-2 py-1.5 text-left text-xs hover:bg-secondary"
                    >
                      <span className="min-w-0 flex-1 truncate">
                        <span className="font-medium">{c.ad}</span>
                        {c.telefon && (
                          <span className="ml-1 text-muted-foreground">· {c.telefon}</span>
                        )}
                      </span>
                      {c.borc > 0 && (
                        <span
                          className="shrink-0 rounded border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-amber-700 dark:text-amber-300"
                          title={`Cari borc: ${formatMoney(c.borc)}`}
                        >
                          {formatMoney(c.borc)}
                        </span>
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

      {/* Müştəri kontekst paneli (universal) — son satış, son ödəniş, açıq qaimə, risk */}
      {musteri && (
        <div className="mb-2">
          <ContactContextPanel kontragentId={musteri.id} side="customer" compact />
        </div>
      )}

      {/* Müştəri kredit xülasəsi — limit aşması yoxlaması */}
      {musteri && creditStatus && (
        <CreditSummaryPanel status={creditStatus} odenisNov={odenisNov} yekun={yekun} />
      )}

      {/* Row 2: Tarix / Ödəniş / Hesab-Kassa / Sifariş kodu */}
      <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div>
          <Label1>Tarix</Label1>
          <Input
            type="date"
            value={tarix}
            max={today}
            onChange={(e) => setTarix(e.target.value)}
            className={`h-8 text-xs ${tarix !== today ? "border-amber-500/60 ring-1 ring-amber-500/20" : ""}`}
          />
          {tarix !== today && (
            <p className="mt-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400">
              ⚠ Köhnə tarix — «tarix.geri» icazəsi tələb olunur
            </p>
          )}
        </div>
        {/* UNIFIED: Pul hara daxil oldu — hesab seçimindən ödəniş növü avtomatik */}
        <div className="col-span-2">
          <Label1>Pul hara daxil oldu *</Label1>
          <Combobox
            options={[
              ...kassalar.map<ComboOption>((k) => ({
                value: `kassa:${k.id}`,
                label: `💵 ${k.ad}`,
                hint: "Nəğd kassa",
              })),
              ...hesablar.map<ComboOption>((h) => ({
                value: `hesab:${h.id}`,
                label: `${h.nov === "kart" ? "💳" : "🏦"} ${h.ad}${h.bank_adi ? ` · ${h.bank_adi}` : ""}`,
                hint: h.nov === "kart" ? "Kart hesabı" : "Bank hesabı",
              })),
              { value: "nisye", label: "⚠ Müştəri borcuna yaz (nisyə)", hint: "Sonra ödənəcək" },
            ]}
            value={
              odenisNov === "nisye"
                ? "nisye"
                : kassaId
                ? `kassa:${kassaId}`
                : hesabId
                ? `hesab:${hesabId}`
                : ""
            }
            onChange={(val) => {
              if (val === "nisye") {
                setOdenisNov("nisye");
                setKassaId("");
                setHesabId("");
              } else if (val.startsWith("kassa:")) {
                setOdenisNov("negd");
                setKassaId(val.slice(6));
                setHesabId("");
              } else if (val.startsWith("hesab:")) {
                const id = val.slice(6);
                const h = hesablar.find((x) => x.id === id);
                setOdenisNov(h?.nov === "kart" ? "kart" : "kecirme");
                setHesabId(id);
                setKassaId("");
              }
            }}
            placeholder="— Hesab/Kassa seçin —"
            searchPlaceholder="Hesab axtar..."
            className="h-8 text-xs"
          />
        </div>
        <div>
          <Label1>Sifariş / Qaimə kodu</Label1>
          <Input
            value={sifarisKodu}
            onChange={(e) => setSifarisKodu(e.target.value)}
            placeholder="Boş = avto"
            className="h-8 text-xs"
          />
        </div>
      </div>

      {/* Ödəniş — kassa/hesab seçiləndə görünür. "Müştəri verir" TƏK mənbədir:
          qaytarma və qalıq borc bundan hesablanır (qarşılıqlı istisna). */}
      {accountPicked && (
        <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50/40 dark:bg-emerald-500/5 dark:border-emerald-500/30 p-2.5">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label1>Müştəri verir (₼)</Label1>
              <Input
                type="number"
                value={musteriVerir > 0 ? musteriVerir : ""}
                onChange={(e) => setMusteriVerir(Number(e.target.value) || 0)}
                min={0}
                step="0.01"
                placeholder={`${yekun.toFixed(2)} (tam)`}
                className="h-8 text-xs tabular-nums"
              />
              <p className="mt-0.5 text-[10px] text-muted-foreground">
                Boş = tam ödəniş ({yekun.toFixed(2)} ₼)
              </p>
            </div>
            <div className="flex flex-col justify-end gap-1">
              {qaytarilacaq > 0 && (
                <div className="rounded-md border border-sky-400/50 bg-sky-50 dark:bg-sky-500/10 px-2 py-1 text-[11px] text-sky-700 dark:text-sky-300">
                  Qaytarılacaq: <span className="font-bold">{qaytarilacaq.toFixed(2)} ₼</span>
                </div>
              )}
              {qaliqBorc > 0.001 ? (
                <div className="rounded-md border border-amber-400/50 bg-amber-50 dark:bg-amber-500/10 px-2 py-1 text-[11px] text-amber-700 dark:text-amber-400">
                  ⚠ Qalıq borc: <span className="font-bold">{qaliqBorc.toFixed(2)} ₼</span> — müştəri lazımdır
                </div>
              ) : (
                <div className="rounded-md border border-emerald-400/50 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-1 text-[11px] text-emerald-700 dark:text-emerald-400">
                  ✓ Tam ödənildi
                </div>
              )}
            </div>
          </div>
        </div>
      )}

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
              onFocus={() => setSearchOpen(true)}
              onBlur={() => setTimeout(() => setSearchOpen(false), 150)}
              placeholder="Məhsul axtar (ad, kod, barkod)…"
              className="h-7 flex-1 bg-transparent text-xs outline-none"
            />
          </div>
          {searchOpen && searchResults.length > 0 && (
            <ul className="absolute top-full left-0 right-0 z-20 mt-0.5 max-h-72 overflow-y-auto rounded-md border border-border bg-popover shadow">
              {searchResults.map((p) => {
                const stok = Number(p.stok_miqdari ?? 0);
                const diger = p.diger_anbarlarda ?? [];
                const digerSum = diger.reduce((s, d) => s + d.miqdar, 0);
                const blocked = stok <= 0 && digerSum <= 0; // heç yerdə yox
                const stokTone =
                  stok <= 0
                    ? digerSum > 0
                      ? "text-amber-600 bg-amber-500/10 border-amber-500/30"
                      : "text-rose-500 bg-rose-500/10 border-rose-500/30"
                    : stok < 5
                    ? "text-amber-600 bg-amber-500/10 border-amber-500/30"
                    : "text-emerald-600 bg-emerald-500/10 border-emerald-500/30";
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => addProduct(p)}
                      disabled={stok <= 0}
                      title={
                        stok <= 0 && digerSum > 0
                          ? `Bu anbarda 0; digər anbarlarda var: ${diger
                              .map((d) => `${d.anbar_ad} (${d.miqdar})`)
                              .join(", ")}`
                          : stok > 0
                          ? `${stok} ədəd mövcud${
                              digerSum > 0
                                ? ` · digər: ${diger
                                    .map((d) => `${d.anbar_ad} (${d.miqdar})`)
                                    .join(", ")}`
                                : ""
                            }`
                          : "Stok yoxdur"
                      }
                      className={`flex w-full items-start gap-2 px-2 py-1.5 text-left text-xs hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-transparent`}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">
                          <span className="font-medium">{p.ad}</span>
                          {p.kod && (
                            <span className="ml-1 text-muted-foreground">· {p.kod}</span>
                          )}
                          {p.barkod && (
                            <span className="ml-1 text-muted-foreground">· {p.barkod}</span>
                          )}
                        </span>
                        {/* Digər anbarlarda var bildirişi */}
                        {diger.length > 0 && (
                          <span className="mt-0.5 block truncate text-[10px] text-amber-700 dark:text-amber-400">
                            📦 Digər anbar:{" "}
                            {diger
                              .slice(0, 2)
                              .map((d) => `${d.anbar_ad} ${d.miqdar}`)
                              .join(" · ")}
                            {diger.length > 2 && ` +${diger.length - 2}`}
                          </span>
                        )}
                      </span>
                      <span
                        className={`shrink-0 rounded border px-1.5 py-0.5 text-[10px] tabular-nums ${stokTone}`}
                      >
                        {stok > 0 ? `${stok} əd.` : blocked ? "yoxdur" : "0 (bu anbar)"}
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

        {lines.length > 0 && (
          <div className="mt-2 overflow-hidden rounded-md border border-border">
            <table className="w-full text-xs">
              <thead className="border-b border-border bg-card/40 text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-2 py-1.5">Məhsul</th>
                  <th className="px-2 py-1.5 text-right w-16">Miqdar</th>
                  <th className="px-2 py-1.5 text-right w-20">Qiymət</th>
                  <th className="px-2 py-1.5 text-right w-14">End. %</th>
                  {canSeeMaya && <th className="px-2 py-1.5 text-right w-20">Maya</th>}
                  {canSeeMaya && <th className="px-2 py-1.5 text-right w-20">Mənfəət</th>}
                  <th className="px-2 py-1.5 text-right w-24">Cəmi</th>
                  <th className="px-2 py-1.5 w-7"></th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l, idx) => {
                  const satir = l.miqdar * l.qiymet * (1 - (l.endirim_faiz || 0) / 100);
                  const mayaCemi = l.miqdar * l.maya;
                  const menfeet = satir - mayaCemi;
                  const menfeetTone = menfeet < 0 ? "text-rose-600" : menfeet === 0 ? "text-muted-foreground" : "text-emerald-700";
                  const isMayaAlti = canSeeMaya && l.maya > 0 && satir < l.maya;
                  return (
                  <tr
                    key={`${l.mehsul_id}-${idx}`}
                    className={`border-b border-border/30 ${isMayaAlti ? "bg-rose-500/5" : ""}`}
                    title={isMayaAlti ? "Maya altı — bu sətr mayadan aşağı satılır" : undefined}
                  >
                    <td className="px-2 py-1.5 truncate">
                      {isMayaAlti && <span className="mr-1 text-rose-500" title="Maya altı">⚠️</span>}
                      {l.ad}
                    </td>
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
                        className="h-6 w-16 rounded border border-border bg-background px-1 text-right text-xs tabular-nums"
                      />
                    </td>
                    <td className="px-2 py-1.5 text-right">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step="0.1"
                        value={l.endirim_faiz > 0 ? l.endirim_faiz : ""}
                        placeholder="0"
                        onChange={(e) => updateLine(idx, { endirim_faiz: Number(e.target.value) || 0 })}
                        className="h-6 w-12 rounded border border-border bg-background px-1 text-right text-xs tabular-nums"
                      />
                    </td>
                    {canSeeMaya && (
                      <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">
                        {l.maya > 0 ? formatMoney(l.maya) : "—"}
                      </td>
                    )}
                    {canSeeMaya && (
                      <td className={`px-2 py-1.5 text-right tabular-nums font-medium ${menfeetTone}`}>
                        {l.maya > 0 ? formatMoney(menfeet) : "—"}
                      </td>
                    )}
                    <td className="px-2 py-1.5 text-right tabular-nums font-medium">
                      {formatMoney(satir)}
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
                  );
                })}
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
              value={endirimMebleg > 0 ? endirimMebleg : ""}
              placeholder="0"
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

      {/* Endirim təsdiq xəbərdarlığı — limit aşılıbsa */}
      {/* Maya altı xəbərdarlığı — yalnız maya icazəsi olan istifadəçilərə görünür */}
      {canSeeMaya && mayaAltiInfo.count > 0 && (
        <div className="mb-3 rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-800 dark:text-rose-200">
          <div className="flex items-start gap-2">
            <span className="text-base">📉</span>
            <div className="flex-1">
              <div className="font-semibold">
                Maya altı satış: {mayaAltiInfo.count} sətr maya qiymətindən aşağı
              </div>
              <div className="mt-0.5 opacity-90">
                Bu sətirlər boyu mənfəət itkisi: <strong className="tabular-nums">{formatMoney(mayaAltiInfo.totalLoss)}</strong>.
                Ayarlardan asılı olaraq satış üçün sahibkar/admin təsdiqi tələb oluna bilər.
              </div>
            </div>
          </div>
        </div>
      )}

      {discountCheck?.needs_approval && (
        <div className="mb-3 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
          <div className="flex items-start gap-2">
            <span className="text-base">⚠️</span>
            <div className="flex-1">
              <div className="font-semibold">
                Endirim limiti aşılır: {effectiveEndirimPct.toFixed(1)}% &gt; {discountCheck.limit_pct}%
              </div>
              <div className="mt-0.5 opacity-90">
                Sizin rol üçün ({discountCheck.user_role ?? "naməlum"}) maksimum endirim limiti{" "}
                <strong>{discountCheck.limit_pct}%</strong>. Bu satışın tamamlanması üçün üst rəhbər
                təsdiqi tələb olunacaq — Tamamla basanda təsdiq sorğusu yaranır.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* "Müştəri verir / Qaytarılacaq" yuxarıda — Pul hara daxil oldu blokunda
          (tək mənbə). Burada təkrar göstərilmir. */}

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

/**
 * Seçilmiş müştərinin cari borc / limit / 90+ gün gecikmə xülasəsi.
 * Borc limitə çatıbsa kassiri xəbərdar edir; "Borc" ödəniş üsulu seçildikdə
 * və yekun limiti aşırsa qırmızı xəbərdarlıq göstərir.
 */
function CreditSummaryPanel({
  status,
  odenisNov,
  yekun,
}: {
  status: CustomerCreditStatus;
  odenisNov: string;
  yekun: number;
}) {
  const borc = status.borc;
  const limit = status.borc_limiti;
  const available = status.available;
  const overdue = status.overdue_90;
  const overdueCount = status.overdue_count;

  // Borc ödənişi seçilibsə və yekun ödənilməmiş borcla cəm limiti aşırsa
  const willExceedLimit =
    odenisNov === "borc" && limit != null && borc + yekun > limit + 0.001;

  // Tonu təyin et
  const tone =
    willExceedLimit || overdue > 0
      ? "border-rose-500/40 bg-rose-500/10 text-rose-800 dark:text-rose-200"
      : limit != null && available != null && available < limit * 0.2
      ? "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-200"
      : "border-sky-500/30 bg-sky-500/10 text-sky-800 dark:text-sky-200";

  return (
    <div className={`mb-3 rounded-md border px-3 py-2 text-xs ${tone}`}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <span className="font-semibold">{status.musteri_ad}</span>
        <span className="opacity-90">
          Cari borc:{" "}
          <strong className="tabular-nums">{borc.toFixed(2)} ₼</strong>
        </span>
        {limit != null && (
          <span className="opacity-90">
            Limit:{" "}
            <strong className="tabular-nums">{limit.toFixed(2)} ₼</strong>
            {available != null && (
              <>
                {" "}— qalıq:{" "}
                <strong className="tabular-nums">{available.toFixed(2)} ₼</strong>
              </>
            )}
          </span>
        )}
        {overdueCount > 0 && (
          <span className="font-semibold">
            ⚠️ 90+ gün gecikmiş: {overdueCount} sənəd ({overdue.toFixed(2)} ₼)
          </span>
        )}
      </div>
      {willExceedLimit && (
        <div className="mt-1 font-semibold">
          🛑 «Borc» seçilib və bu satış limiti aşır:{" "}
          {(borc + yekun).toFixed(2)} ₼ &gt; {limit?.toFixed(2)} ₼
        </div>
      )}
    </div>
  );
}
