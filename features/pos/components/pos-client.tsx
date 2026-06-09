"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  ScanBarcode,
  Trash2,
  Plus,
  Minus,
  X,
  CreditCard,
  Banknote,
  Building2,
  HandCoins,
  Sparkles,
  Layers,
  CalendarClock,
  Wallet,
  Loader2,
  CheckCircle2,
  Save,
  Inbox,
  Keyboard,
  UserPlus,
  Printer,
  Receipt,
  ShieldCheck,
  PlusCircle,
  AlertTriangle,
  Eye,
  Inspect,
  StickyNote,
  Percent,
} from "lucide-react";
import { usePosSalesperson } from "@/stores/pos-salesperson";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BarcodeScannerButton } from "@/components/ui/barcode-scanner";
import { Camera } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { PriceTiersPopover } from "@/features/anbar/components/price-tiers-popover";
import { QuickViewDialog } from "@/features/anbar/components/quick-view-dialog";
import { PosLoyaltyWidget } from "@/features/kampaniyalar/components/pos-loyalty-widget";
import { PosCouponInput } from "@/features/kampaniyalar/components/pos-coupon-input";
import type { FoundLoyaltyCard } from "@/features/kampaniyalar/actions";
import type { AppliedCampaign } from "@/features/kampaniyalar/matcher";
import { toast } from "sonner";
import { cn, formatMoney } from "@/lib/utils";
import {
  searchProductsAction,
  lookupBarcodeAction,
  searchCustomersAction,
} from "../search-actions";
import { createSale } from "../sale-action";
import { enqueueSale, getQueueSize } from "@/lib/pos/offline-queue";
import { useOnlineStatus } from "../hooks/use-online-status";
import {
  getQuickProductsAction,
  createQuickCustomer,
  ensureWarrantyForSale,
} from "../extras-actions";
import { closeKassa } from "../session-actions";
import type {
  ProductRow,
  CustomerRow,
  SalespersonOption,
} from "../sale-queries";
import type { QuickProductRow } from "../quick-products-queries";
import { usePermissions } from "@/components/providers/permissions-provider";
import type { PosPriceSettings } from "@/features/ayarlar/pos-qiymet-types";
import type { TierKey } from "@/features/ayarlar/qiymet-icaze-types";

type TierName =
  | "satis_qiymeti"
  | "endirimli_qiymet"
  | "topdan_qiymeti"
  | "partnyor_qiymeti"
  | "vip_qiymeti"
  | "custom";

type CartLine = {
  uid: string;
  mehsul_id: string;
  ad: string;
  kod: string | null;
  miqdar: number;
  qiymet: number;
  /** Line-level discount percent (0-100). Combined with `endirim_mebleg`. */
  endirim_faiz: number;
  /** Line-level absolute discount in AZN. Applied to the line subtotal after `endirim_faiz`. */
  endirim_mebleg: number;
  /** Toggle drives which one of `endirim_faiz`/`endirim_mebleg` is "active" in the UI. */
  endirim_mode: "faiz" | "mebleg";
  alish_qiymeti: number;
  min_satis_qiymeti: number;
  topdan_qiymeti: number;
  partnyor_qiymeti: number;
  vip_qiymeti: number;
  pere_qiymeti: number;
  stok_miqdari: number;
  tier: TierName;
  zemanet_ay: 0 | 3 | 6 | 12 | 24;
  qeyd: string;
  needs_approval: boolean;
};

/** Effective per-line discount % combining `endirim_faiz` and `endirim_mebleg` (informational). */
function lineNetTotal(l: CartLine): number {
  const grossLine = l.miqdar * l.qiymet;
  const afterPct = grossLine * (1 - (l.endirim_faiz || 0) / 100);
  const afterAzn = Math.max(0, afterPct - (l.endirim_mebleg || 0));
  return afterAzn;
}

type KassaInfo = {
  ad: string;
  acan_ad: string | null;
  filial_ad: string | null;
  acilis_tarixi: string;
  acilis_qaligi: number;
  emeliyyatlar_say: number;
  cari_negd: number;
  cari_kart: number;
  cari_bank: number;
  cari_borc: number;
  cemi_satis: number;
};

type Props = {
  kassaId: string;
  anbarId: number;
  anbarAd: string;
  /** POS-da anbar dəyişdirmə üçün siyahı — stoklu anbarlar yuxarıda */
  anbarOptions?: Array<{ id: number; ad: string; total: number }>;
  saticilar: SalespersonOption[];
  defaultSalespersonId: string;
  initialQuickProducts?: QuickProductRow[];
  allowedTiers?: TierKey[];
  posSettings: PosPriceSettings;
  isOwner: boolean;
  isAdmin: boolean;
  kassaInfo: KassaInfo;
};

type PaymentMethod =
  | "negd"
  | "kart"
  | "kecirme"
  | "nisye"
  | "bonus"
  | "qarisiq"
  | "kreditle"
  | "taksit";

const PAYMENT_OPTIONS: {
  value: PaymentMethod;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  // POS — 90% hallar Nağd. Default Nağd, lakin standart olaraq Borc da var.
  { value: "negd", label: "Nağd", icon: Banknote },
  { value: "kart", label: "Kart", icon: CreditCard },
  { value: "kecirme", label: "Bank", icon: Building2 },
  { value: "nisye", label: "Borc", icon: HandCoins },
  { value: "bonus", label: "Bonus", icon: Sparkles },
  { value: "qarisiq", label: "Qarışıq", icon: Layers },
];

type ParkedSale = {
  id: string;
  ts: number;
  cart: CartLine[];
  customerName: string | null;
  paymentMethod: PaymentMethod;
  endirimMebleg: number;
  endirimMode: "faiz" | "mebleg";
  qeyd: string;
};

const PARK_KEY = "pos.parkedSales.v2";

type SuccessState = {
  satis_id: string;
  nomre: string;
  pos_cek_nomresi: string;
  son_mebleg: number;
  customer_ad: string | null;
  odenis_nov: PaymentMethod;
};

function loadParked(): ParkedSale[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(PARK_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as ParkedSale[];
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    return Array.isArray(arr) ? arr.filter((p) => p.ts > cutoff) : [];
  } catch {
    return [];
  }
}

function saveParked(items: ParkedSale[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PARK_KEY, JSON.stringify(items));
  } catch {
    /* quota */
  }
}

function elapsedFrom(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return `${h}:${String(m).padStart(2, "0")}`;
}

function tierPriceOf(line: CartLine, tier: TierName): number {
  switch (tier) {
    case "satis_qiymeti":
      return line.pere_qiymeti;
    case "endirimli_qiymet":
      // We don't carry endirimli_qiymet on the cart; treat as 0 to indicate
      // "use custom" if user picked it directly via popover.
      return line.qiymet;
    case "topdan_qiymeti":
      return line.topdan_qiymeti;
    case "partnyor_qiymeti":
      return line.partnyor_qiymeti;
    case "vip_qiymeti":
      return line.vip_qiymeti;
    case "custom":
      return line.qiymet;
  }
}

function stokTone(qty: number) {
  if (qty <= 0) return "bg-rose-100 text-rose-700 border-rose-200";
  if (qty < 10) return "bg-amber-100 text-amber-700 border-amber-200";
  return "bg-emerald-100 text-emerald-700 border-emerald-200";
}

export function PosClient({
  kassaId,
  anbarId: initialAnbarId,
  anbarAd: initialAnbarAd,
  anbarOptions = [],
  saticilar,
  defaultSalespersonId,
  initialQuickProducts = [],
  allowedTiers,
  posSettings,
  isOwner,
  isAdmin,
  kassaInfo,
}: Props) {
  const router = useRouter();
  const icazeler = usePermissions();
  // Anbar dəyişdirmə — istifadəçi başqa anbara baxa bilsin
  const [anbarId, setAnbarId] = useState(initialAnbarId);
  const anbarAd = anbarOptions.find((a) => a.id === anbarId)?.ad ?? initialAnbarAd;

  /* ------------------------------ Permissions ----------------------------- */
  const can = useMemo(() => {
    const has = (c: string) => icazeler.includes(c);
    return {
      changePrice:
        isOwner || isAdmin || has("pos.change_price") || posSettings.cashier_can_change_price,
      sellBelowMin:
        isOwner || has("pos.sell_below_min_price") || posSettings.cashier_can_sell_below_min,
      discount: isOwner || isAdmin || has("pos.discount") || true, // discount field is shown to all; server enforces
      viewCost:
        isOwner || has("pos.view_cost") || !posSettings.show_cost_only_owner,
      viewMargin:
        isOwner ||
        has("pos.view_margin") ||
        !posSettings.show_margin_only_owner,
      viewMinPrice:
        isAdmin || isOwner || has("pos.view_min_price") || !posSettings.show_min_only_admin,
      printReceipt: isOwner || isAdmin || has("pos.print_receipt") || true,
      printWarranty: isOwner || isAdmin || has("pos.print_warranty") || true,
      creditSell: isOwner || isAdmin || has("pos.credit_sell"),
    };
  }, [icazeler, isOwner, isAdmin, posSettings]);

  /* ------------------------------ Cart state ------------------------------ */
  const [cart, setCart] = useState<CartLine[]>([]);
  const [searchQ, setSearchQ] = useState("");
  const [searchResults, setSearchResults] = useState<ProductRow[]>([]);
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [quickViewId, setQuickViewId] = useState<string | null>(null);

  const [customer, setCustomer] = useState<CustomerRow | null>(null);
  const [customerQ, setCustomerQ] = useState("");
  const [customerResults, setCustomerResults] = useState<CustomerRow[]>([]);
  const [showCustomerResults, setShowCustomerResults] = useState(false);
  // Loyalty: müştəri seçildikdə kart və bonus serf state-i
  const [loyaltyCard, setLoyaltyCard] = useState<FoundLoyaltyCard | null>(null);
  const [bonusSerfMebleg, setBonusSerfMebleg] = useState<number>(0);
  // Kupon: POS-da promokod tətbiq olunduqda
  const [couponApplied, setCouponApplied] = useState<AppliedCampaign | null>(null);
  const [keepCustomer, setKeepCustomer] = useState(false);
  const [salespersonId, setSalespersonId] = useState(defaultSalespersonId);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("negd");
  // Mobil ödəniş sheet-i — alt sabit zolaqdakı ÖDƏNİŞ açır (desktop-da istifadə olunmur)
  const [paymentSheetOpen, setPaymentSheetOpen] = useState(false);

  // Mixed payment splits (Qarışıq)
  const [splitNegd, setSplitNegd] = useState<string>("");
  const [splitKart, setSplitKart] = useState<string>("");
  const [splitBank, setSplitBank] = useState<string>("");

  // Credit (Kreditlə)
  const [creditBank, setCreditBank] = useState<string>("Kapital Bank");
  const [creditFaiz, setCreditFaiz] = useState<number>(18);
  const [creditMuddet, setCreditMuddet] = useState<number>(12);
  const [creditIlkin, setCreditIlkin] = useState<number>(0);

  // Taksit
  const [taksitCount, setTaksitCount] = useState<number>(3);

  // Discount
  const [endirimMode, setEndirimMode] = useState<"faiz" | "mebleg">("mebleg");
  const [endirimFaiz, setEndirimFaiz] = useState<number>(0);
  const [endirimMebleg, setEndirimMebleg] = useState<number>(0);

  const [tender, setTender] = useState<string>("");
  const [qeyd, setQeyd] = useState("");
  const [showQeyd, setShowQeyd] = useState(false);
  const [completing, startCompleting] = useTransition();
  const online = useOnlineStatus();

  // Auto actions
  const [autoVergiCek, setAutoVergiCek] = useState(true);
  const [autoZemanet, setAutoZemanet] = useState(false);
  const [autoDavam, setAutoDavam] = useState(true);
  const [autoPrint, setAutoPrint] = useState(false);
  const [autoQaime, setAutoQaime] = useState(false);

  // Quick products (kept for hourly refresh side-effects)
  const setQuickProducts = useState<QuickProductRow[]>(initialQuickProducts)[1];

  // Parked sales
  const [parked, setParked] = useState<ParkedSale[]>([]);
  const [parkedOpen, setParkedOpen] = useState(false);

  // Quick customer
  const [quickCustomerOpen, setQuickCustomerOpen] = useState(false);
  const [qcAd, setQcAd] = useState("");
  const [qcTel, setQcTel] = useState("");
  const [qcPending, startQc] = useTransition();

  // Help
  const [helpOpen, setHelpOpen] = useState(false);

  // Close-session dialog (wired from header chip and SessionStrip "Bağla")
  const [closeSessionOpen, setCloseSessionOpen] = useState(false);
  const [closeAmount, setCloseAmount] = useState<string>("");
  const [closeQeyd, setCloseQeyd] = useState<string>("");
  const [closing, startClosing] = useTransition();

  // Success
  const [success, setSuccess] = useState<SuccessState | null>(null);
  const [vergiSending, startVergiCek] = useTransition();
  const [vergiCekSent, setVergiCekSent] = useState(false);
  const [warrantyOpening, startWarranty] = useTransition();

  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const endirimInputRef = useRef<HTMLInputElement>(null);
  const customerInputRef = useRef<HTMLInputElement>(null);
  const lastAddedIdxRef = useRef<number | null>(null);

  /* ----------------------------- Mount: parked ---------------------------- */
  useEffect(() => {
    const items = loadParked();
    setParked(items);
  }, []);

  /* ----------------- Sync salesperson chip with the header --------------- */
  const setStoreSaticilar = usePosSalesperson((s) => s.setSaticilar);
  const setStoreSalespersonId = usePosSalesperson((s) => s.setSalespersonId);
  const setStoreCanSwitch = usePosSalesperson((s) => s.setCanSwitch);
  const storeSalespersonId = usePosSalesperson((s) => s.salespersonId);

  // Push the list/default + permission into the store on mount.
  useEffect(() => {
    setStoreSaticilar(saticilar);
    setStoreSalespersonId(defaultSalespersonId);
    setStoreCanSwitch(Boolean(isOwner || isAdmin));
  }, [saticilar, defaultSalespersonId, isOwner, isAdmin, setStoreSaticilar, setStoreSalespersonId, setStoreCanSwitch]);

  // Mirror the chip's selected id into the local active-sale state so the
  // server action receives the right `satis_meneceri_id` on completion.
  useEffect(() => {
    if (storeSalespersonId && storeSalespersonId !== salespersonId) {
      setSalespersonId(storeSalespersonId);
    }
  }, [storeSalespersonId, salespersonId]);

  /* ------------------------------- Totals -------------------------------- */
  // Gross of all lines (before any line- or global-discount).
  const grossUmumi = useMemo(
    () => cart.reduce((s, l) => s + l.miqdar * l.qiymet, 0),
    [cart],
  );

  // Subtotal after per-line discounts (faiz then AZN).
  const umumi = useMemo(() => cart.reduce((s, l) => s + lineNetTotal(l), 0), [cart]);

  // Total AZN absorbed by line-level discounts.
  const lineDiscountsTotal = Math.max(0, grossUmumi - umumi);

  const endirimEffectiveMebleg =
    endirimMode === "mebleg"
      ? Math.min(endirimMebleg, umumi)
      : Math.min(umumi * (endirimFaiz / 100), umumi);
  const endirimEffectiveFaiz =
    umumi > 0 ? Math.round((endirimEffectiveMebleg / umumi) * 1000) / 10 : 0;
  // Kupon endirimi — endirim üstünə əlavə olunur (admin verdiyi kod)
  const couponEndirim = couponApplied
    ? Math.min(couponApplied.endirim_mebleg, Math.max(0, umumi - endirimEffectiveMebleg))
    : 0;
  // Loyalty bonus sərfi — endirim + kupon-dan sonra qalanından
  const bonusAfterDiscount = Math.min(
    bonusSerfMebleg,
    Math.max(0, umumi - endirimEffectiveMebleg - couponEndirim),
  );
  const sonMebleg = Math.max(0, umumi - endirimEffectiveMebleg - couponEndirim - bonusAfterDiscount);
  const edvMebleg = sonMebleg * 0.18; // informational only

  const tenderNum = Number(tender) || 0;
  const change =
    paymentMethod === "negd" ? Math.max(0, tenderNum - sonMebleg) : 0;
  const insufficient =
    paymentMethod === "negd" && tenderNum > 0 && tenderNum < sonMebleg;

  // Mixed payment validation
  const splitSum =
    (Number(splitNegd) || 0) +
    (Number(splitKart) || 0) +
    (Number(splitBank) || 0);
  const splitOk =
    paymentMethod !== "qarisiq" || Math.abs(splitSum - sonMebleg) < 0.01;

  // Credit calc (PMT)
  const creditAmount = Math.max(0, sonMebleg - (Number(creditIlkin) || 0));
  const creditMonthly = useMemo(() => {
    if (creditMuddet <= 0) return 0;
    const r = creditFaiz / 100 / 12;
    if (r === 0) return creditAmount / creditMuddet;
    return (creditAmount * r) / (1 - Math.pow(1 + r, -creditMuddet));
  }, [creditAmount, creditFaiz, creditMuddet]);

  // Min price check — considers both per-line `endirim_faiz` and `endirim_mebleg`.
  const minPriceViolation = useMemo(() => {
    for (const l of cart) {
      if (l.min_satis_qiymeti > 0 && l.miqdar > 0) {
        const eff =
          lineNetTotal(l) / l.miqdar; // average per-unit price after line discounts
        if (eff < l.min_satis_qiymeti) return true;
      }
    }
    return false;
  }, [cart]);

  /* -------------------------- Unified product search ---------------------- */
  // Detect 6+ digits (no letters) as a barcode pattern — when typed the field
  // does NOT search; Enter on a barcode triggers a direct lookup.
  const looksLikeBarcode = useMemo(
    () => /^[0-9]{6,}$/.test(searchQ.trim()),
    [searchQ],
  );

  useEffect(() => {
    const q = searchQ.trim();
    if (looksLikeBarcode) {
      // Don't run a text search for pure barcodes; Enter handles them.
      setSearchResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const id = setTimeout(async () => {
      const rows = await searchProductsAction(q, anbarId);
      setSearchResults(rows);
      setSearching(false);
    }, q.length === 0 ? 0 : 200);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQ, anbarId, looksLikeBarcode]);

  /* -------------------------- Debounced customer search ------------------ */
  useEffect(() => {
    // Mobil donma fix: boş/qısa sorğuda DB-yə getmə (əvvəl mount-da boş sorğu
    // ilə 2 DB round-trip gedirdi — gizli sheet arxasında belə).
    const q = customerQ.trim();
    if (q.length < 2) {
      setCustomerResults([]);
      return;
    }
    const id = setTimeout(async () => {
      const rows = await searchCustomersAction(customerQ);
      setCustomerResults(rows);
    }, 200);
    return () => clearTimeout(id);
  }, [customerQ]);

  /* -------------------------- Refresh quick products --------------------- */
  useEffect(() => {
    const id = setInterval(
      () => {
        getQuickProductsAction(anbarId)
          .then(setQuickProducts)
          .catch(() => {});
      },
      60 * 60 * 1000,
    );
    return () => clearInterval(id);
  }, [anbarId, setQuickProducts]);

  /* ---------------------- Cross-component: open close-session ------------ */
  // Header chip dispatches `pos:open-close-session` to ask us to open the dialog.
  useEffect(() => {
    function onOpen() {
      setCloseAmount(String(kassaInfo.acilis_qaligi + kassaInfo.cari_negd));
      setCloseSessionOpen(true);
    }
    window.addEventListener("pos:open-close-session", onOpen);
    return () => window.removeEventListener("pos:open-close-session", onOpen);
  }, [kassaInfo.acilis_qaligi, kassaInfo.cari_negd]);

  function submitCloseSession() {
    startClosing(async () => {
      const fd = new FormData();
      fd.append("hesablanan_qaliq", closeAmount || "0");
      if (closeQeyd) fd.append("qeyd", closeQeyd);
      const res = await closeKassa(kassaId, fd);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Sessiya bağlandı");
      setCloseSessionOpen(false);
      router.refresh();
    });
  }

  /* --------------------------- Unload protections ------------------------ */
  useEffect(() => {
    function beforeUnload(e: BeforeUnloadEvent) {
      if (cart.length === 0) return;
      e.preventDefault();
      e.returnValue =
        "Səbətdə məhsullar var. Səhifədən çıxmaq istəyirsiniz?";
      return e.returnValue;
    }
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [cart.length]);

  /* ----------------------------- Add product ---------------------------- */
  const addProductLocal = useCallback(
    (p: ProductRow | QuickProductRow, qty = 1) => {
      const defaultTier = posSettings.default_tier ?? "satis_qiymeti";
      setCart((prev) => {
        const existingIdx = prev.findIndex((l) => l.mehsul_id === p.id);
        if (existingIdx >= 0) {
          lastAddedIdxRef.current = existingIdx;
          return prev.map((l, i) =>
            i === existingIdx ? { ...l, miqdar: l.miqdar + qty } : l,
          );
        }
        // pull tier prices — ProductRow has them; QuickProductRow doesn't
        const full = p as Partial<ProductRow>;
        // For the chosen default tier, pick its price (if 0, fall back to retail).
        const peoplePrice = Number(full.satis_qiymeti ?? p.satis_qiymeti);
        const topdan = Number(full.topdan_qiymeti ?? 0);
        const partnyor = Number(full.partnyor_qiymeti ?? 0);
        const vip = Number(full.vip_qiymeti ?? 0);
        const min = Number(full.min_satis_qiymeti ?? 0);
        let chosen = peoplePrice;
        if (defaultTier === "topdan_qiymeti" && topdan > 0) chosen = topdan;
        else if (defaultTier === "partnyor_qiymeti" && partnyor > 0)
          chosen = partnyor;
        else if (defaultTier === "vip_qiymeti" && vip > 0) chosen = vip;
        const newLine: CartLine = {
          uid: `${p.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          mehsul_id: p.id,
          ad: p.ad,
          kod: p.kod,
          miqdar: qty,
          qiymet: chosen,
          endirim_faiz: 0,
          endirim_mebleg: 0,
          endirim_mode: "faiz",
          alish_qiymeti: Number(p.alish_qiymeti ?? 0),
          min_satis_qiymeti: min,
          topdan_qiymeti: topdan,
          partnyor_qiymeti: partnyor,
          vip_qiymeti: vip,
          pere_qiymeti: peoplePrice,
          stok_miqdari: p.stok_miqdari,
          tier: defaultTier as TierName,
          zemanet_ay: 0,
          qeyd: "",
          needs_approval: false,
        };
        lastAddedIdxRef.current = prev.length;
        return [...prev, newLine];
      });
    },
    [posSettings.default_tier],
  );

  const addProduct = useCallback(
    (p: ProductRow, qty = 1) => {
      addProductLocal(p, qty);
      setSearchQ("");
      setShowResults(false);
      setSearchResults([]);
      barcodeInputRef.current?.focus();
    },
    [addProductLocal],
  );

  function clearCart() {
    setPaymentSheetOpen(false);
    setCart([]);
    if (!keepCustomer) {
      setCustomer(null);
      setCustomerQ("");
      setLoyaltyCard(null);
    }
    setBonusSerfMebleg(0);
    setCouponApplied(null);
    setEndirimMebleg(0);
    setEndirimFaiz(0);
    setTender("");
    setQeyd("");
    setSplitNegd("");
    setSplitKart("");
    setSplitBank("");
  }

  /* ----------------------------- Cart edits ------------------------------ */
  function updateLineQty(idx: number, delta: number) {
    setCart((prev) =>
      prev.map((l, i) =>
        i === idx ? { ...l, miqdar: Math.max(0.001, l.miqdar + delta) } : l,
      ),
    );
  }
  function setLinePrice(idx: number, price: number) {
    setCart((prev) =>
      prev.map((l, i) => {
        if (i !== idx) return l;
        const next = Math.max(0, price);
        const candidate: CartLine = { ...l, qiymet: next };
        const eff = l.miqdar > 0 ? lineNetTotal(candidate) / l.miqdar : next;
        const violates = l.min_satis_qiymeti > 0 && eff < l.min_satis_qiymeti;
        const needs =
          violates && !can.sellBelowMin && posSettings.below_min_needs_approval;
        return {
          ...l,
          qiymet: next,
          needs_approval: needs,
          tier: "custom" as TierName,
        };
      }),
    );
  }
  function setLineDiscount(idx: number, pct: number) {
    setCart((prev) =>
      prev.map((l, i) => {
        if (i !== idx) return l;
        const clamped = Math.min(100, Math.max(0, pct));
        const eff = l.qiymet * (1 - clamped / 100);
        const violates = l.min_satis_qiymeti > 0 && eff < l.min_satis_qiymeti;
        const needs =
          violates && !can.sellBelowMin && posSettings.below_min_needs_approval;
        return { ...l, endirim_faiz: clamped, needs_approval: needs };
      }),
    );
  }
  function setLineTier(idx: number, tier: TierName) {
    setCart((prev) =>
      prev.map((l, i) => {
        if (i !== idx) return l;
        const newPrice = tierPriceOf(l, tier);
        const eff = newPrice * (1 - l.endirim_faiz / 100);
        const violates = l.min_satis_qiymeti > 0 && eff < l.min_satis_qiymeti;
        const needs =
          violates && !can.sellBelowMin && posSettings.below_min_needs_approval;
        return { ...l, tier, qiymet: newPrice, needs_approval: needs };
      }),
    );
  }
  function setLineZemanet(idx: number, m: 0 | 3 | 6 | 12 | 24) {
    setCart((prev) => prev.map((l, i) => (i === idx ? { ...l, zemanet_ay: m } : l)));
  }
  function setLineQeyd(idx: number, q: string) {
    setCart((prev) => prev.map((l, i) => (i === idx ? { ...l, qeyd: q } : l)));
  }
  function removeLine(idx: number) {
    setCart((prev) => prev.filter((_, i) => i !== idx));
  }

  /* ------------------------------ Park / restore ------------------------- */
  function parkCurrent() {
    if (cart.length === 0) {
      toast.error("Səbət boşdur");
      return;
    }
    const item: ParkedSale = {
      id: Math.random().toString(36).slice(2, 10),
      ts: Date.now(),
      cart,
      customerName: customer?.ad ?? null,
      paymentMethod,
      endirimMebleg,
      endirimMode,
      qeyd,
    };
    const next = [item, ...parked].slice(0, 30);
    setParked(next);
    saveParked(next);
    clearCart();
    toast.success("Səbət saxlanıldı (Qaralama)");
  }

  function restoreParked(p: ParkedSale) {
    if (cart.length > 0) {
      if (!confirm("Cari səbət silinəcək. Davam edək?")) return;
    }
    // Migrate older parked rows that don't have line-discount fields yet.
    const migrated = p.cart.map((l) => ({
      ...l,
      endirim_mebleg: typeof l.endirim_mebleg === "number" ? l.endirim_mebleg : 0,
      endirim_mode: l.endirim_mode ?? "faiz",
    })) as CartLine[];
    setCart(migrated);
    setPaymentMethod(p.paymentMethod);
    setEndirimMebleg(p.endirimMebleg);
    setEndirimMode(p.endirimMode);
    setQeyd(p.qeyd);
    const next = parked.filter((x) => x.id !== p.id);
    setParked(next);
    saveParked(next);
    setParkedOpen(false);
    toast.success("Səbət bərpa olundu");
  }
  function deleteParked(id: string) {
    const next = parked.filter((x) => x.id !== id);
    setParked(next);
    saveParked(next);
  }

  /* ----------------------------- Quick customer ------------------------- */
  function submitQuickCustomer() {
    if (!qcAd.trim() || qcAd.trim().length < 2) {
      toast.error("Ad ən az 2 simvol olmalıdır");
      return;
    }
    startQc(async () => {
      const res = await createQuickCustomer({
        ad: qcAd,
        telefon: qcTel || null,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setCustomer({
        id: res.id,
        ad: res.ad,
        telefon: res.telefon,
        email: null,
        borc: 0,
      });
      setQuickCustomerOpen(false);
      setQcAd("");
      setQcTel("");
      setCustomerQ("");
      setShowCustomerResults(false);
      toast.success("Müştəri yaradıldı");
    });
  }

  /* ------------------------- Chain actions (F10/F11) -------------------- */
  const postActionRef = useRef<"park" | "print" | null>(null);

  function completeAndPark() {
    if (cart.length === 0) return;
    postActionRef.current = "park";
    onComplete();
  }
  function completePrintNew() {
    if (cart.length === 0) return;
    postActionRef.current = "print";
    onComplete();
  }

  /* ------------------------------- Complete ----------------------------- */
  function onComplete() {
    if (cart.length === 0) {
      toast.error("Səbət boşdur");
      return;
    }
    if (paymentMethod === "nisye" && !customer) {
      toast.error("Borc satışda müştəri seçilməlidir");
      return;
    }
    if (paymentMethod === "qarisiq" && !splitOk) {
      toast.error("Qarışıq ödəniş cəmi yekun məbləğə bərabər olmalıdır");
      return;
    }
    if (cart.some((l) => l.needs_approval)) {
      toast.error("Min qiymət altı sətirlər var — rəhbər təsdiqi tələb olunur");
      return;
    }

    // Stok < tələb yoxlanışı (köhnə POS-dakı kimi confirm)
    const stokAltı = cart.filter((l) => l.miqdar > l.stok_miqdari);
    if (stokAltı.length > 0) {
      const txt = stokAltı
        .map((l) => `• ${l.ad} (stok: ${l.stok_miqdari}, tələb: ${l.miqdar})`)
        .join("\n");
      if (
        !confirm(
          `Stok kifayət etmir:\n${txt}\n\nYenə də satış davam etsin?`,
        )
      )
        return;
    }

    // Marja risk yoxlanışı — mayadan aşağı / aşağı marja confirm
    // Risk ≤ 10% → sarı, ≤ 0% → qırmızı (kritik)
    const RISK_FAIZ = 10;
    type RiskLine = { ad: string; marja: number };
    const altiList: RiskLine[] = [];
    const riskList: RiskLine[] = [];
    for (const l of cart) {
      const maya = l.alish_qiymeti;
      if (!maya || maya <= 0) continue;
      const eff = l.miqdar > 0 ? lineNetTotal(l) / l.miqdar : l.qiymet;
      const marja = ((eff - maya) / maya) * 100;
      if (marja <= 0) altiList.push({ ad: l.ad, marja });
      else if (marja < RISK_FAIZ) riskList.push({ ad: l.ad, marja });
    }
    if (altiList.length > 0) {
      const txt = altiList
        .map((r) => `• ${r.ad} (marja ${r.marja.toFixed(1)}%)`)
        .join("\n");
      if (
        !confirm(
          `${altiList.length} məhsul mayadan aşağı satılır:\n${txt}\n\nSatış davam etsin? (Xəbərdarlıq qeydə alınacaq)`,
        )
      )
        return;
    } else if (riskList.length > 0) {
      const txt = riskList
        .map((r) => `• ${r.ad} (marja ${r.marja.toFixed(1)}%)`)
        .join("\n");
      if (
        !confirm(
          `${riskList.length} məhsulun marjası ${RISK_FAIZ}%-dən aşağıdır:\n${txt}\n\nSatış davam etsin?`,
        )
      )
        return;
    }

    // Bonus və qarışıq nağd kassaya düşür; nisye birbaşa nisye gedir.
    const serverOdenis: "negd" | "kart" | "kecirme" | "nisye" =
      paymentMethod === "kart"
        ? "kart"
        : paymentMethod === "kecirme"
          ? "kecirme"
          : paymentMethod === "nisye"
            ? "nisye"
            : "negd"; // negd / bonus / qarisiq

    const customerSnapshotName = customer?.ad ?? null;
    startCompleting(async () => {
      // Offline rejimdə satışı server-ə yox, localStorage-yə yığ.
      // OfflineBanner online qayıdanda avtomat sinxron edir.
      const payloadBuilder = () => ({
        kassa_id: kassaId,
        anbar_id: anbarId,
        // Idempotentlik açarı (audit #3): offline növbə eyni payload-u təkrar
        // göndərəndə server dublikat satış yaratmır (sale-action-da yoxlanılır).
        client_op_id: crypto.randomUUID(),
        musteri_id: customer?.id ?? null,
        satis_meneceri_id: salespersonId,
        odenis_nov: serverOdenis,
        // Kupon + loyallıq bonusu da serverə gedən endirimə daxildir ki, son_mebleg
        // göstərilən məbləğə bərabər olsun və kassa/maliyyə uyğunsuzluğu olmasın
        // (audit #11/#12). Bonus kartdan ayrıca düşür (applyBonusToSale) — nağd yazılmır.
        endirim_mebleg: endirimEffectiveMebleg + couponEndirim + bonusAfterDiscount,
        // Tətbiq olunan kupon/kampaniya (audit #10) — istifadə qeydə alınsın
        applied_campaigns: couponApplied ? [couponApplied] : undefined,
        qeyd:
          qeyd ||
          (paymentMethod === "kreditle"
            ? `Kreditlə — ${creditBank}, ${creditMuddet} ay, ${creditFaiz}% (aylıq ≈ ${formatMoney(
                creditMonthly,
              )})`
            : paymentMethod === "taksit"
              ? `Taksit — ${taksitCount} hissə`
              : paymentMethod === "qarisiq"
                ? `Qarışıq — N:${splitNegd || 0} K:${splitKart || 0} B:${splitBank || 0}`
                : null),
        lines: cart.map((l) => {
          const gross = l.miqdar * l.qiymet;
          const net = lineNetTotal(l);
          const effFaiz = gross > 0 ? Math.max(0, Math.min(100, (1 - net / gross) * 100)) : 0;
          return {
            mehsul_id: l.mehsul_id,
            miqdar: l.miqdar,
            qiymet: l.qiymet,
            endirim_faiz: Number(effFaiz.toFixed(4)),
          };
        }),
      });
      // payloadBuilder() ortaq — həm offline enqueue, həm online createSale
      // eyni payload ilə işləsin. Köhnə inline payload silindi (duplikatlıq idi).
      const payload = payloadBuilder();
      if (!online) {
        const item = enqueueSale(payload);
        toast.success(`Offline rejim — satış növbəyə yazıldı (#${item.id.slice(0, 8)}). Internet qayıdanda avtomat sinxron olacaq. Növbədə: ${getQueueSize()}`);
        clearCart();
        return;
      }
      const res = await createSale(payload);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      const successState: SuccessState = {
        satis_id: res.satis_id,
        nomre: res.nomre,
        pos_cek_nomresi: res.pos_cek_nomresi,
        son_mebleg: res.son_mebleg,
        customer_ad: customerSnapshotName,
        odenis_nov: paymentMethod,
      };
      const skipModal = autoDavam || postActionRef.current !== null;
      setSuccess(skipModal ? null : successState);
      setVergiCekSent(false);
      clearCart();

      if (autoPrint || postActionRef.current === "print") {
        window.open(`/ticaret/satislar/${res.satis_id}/print`, "_blank");
      }
      if (autoQaime) {
        window.open(`/ticaret/satislar/${res.satis_id}/qaime`, "_blank");
      }
      if (autoVergiCek) {
        fetch("/api/ticaret/vergi-cek", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ satis_id: res.satis_id }),
        }).catch(() => {});
      }
      if (autoZemanet) {
        const months = Math.max(
          ...cart.map((l) => l.zemanet_ay),
          12,
        );
        ensureWarrantyForSale(res.satis_id, months || 12).catch(() => {});
      }

      postActionRef.current = null;

      // Loyalty bonus serf et — satış uğurla yaradılandan sonra
      if (loyaltyCard && bonusAfterDiscount > 0) {
        try {
          const { applyBonusToSale } = await import("@/features/kampaniyalar/actions");
          await applyBonusToSale(loyaltyCard.id, res.satis_id, bonusAfterDiscount);
        } catch (e) {
          console.warn("[pos bonus serf]", e);
        }
      }

      getQuickProductsAction(anbarId)
        .then(setQuickProducts)
        .catch(() => {});
      router.refresh();
      if (skipModal) {
        toast.success(
          `Satış tamamlandı · ${res.pos_cek_nomresi} · ${formatMoney(res.son_mebleg)}`,
        );
        setTimeout(() => barcodeInputRef.current?.focus(), 80);
      }
    });
  }

  /* ----------------------------- Success actions ------------------------ */
  function actionPrint() {
    if (!success) return;
    window.open(`/ticaret/satislar/${success.satis_id}/print`, "_blank");
  }
  function actionVergiCek() {
    if (!success) return;
    startVergiCek(async () => {
      try {
        const r = await fetch("/api/ticaret/vergi-cek", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ satis_id: success.satis_id }),
        });
        const data = (await r.json()) as {
          ok: boolean;
          cek_nomresi?: string;
          error?: string;
        };
        if (!data.ok) {
          toast.error(data.error || "Vergi çeki vurulmadı");
          return;
        }
        setVergiCekSent(true);
        toast.success(`Vergi çeki göndərildi (${data.cek_nomresi ?? ""})`);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Şəbəkə xətası");
      }
    });
  }
  function actionWarranty() {
    if (!success) return;
    startWarranty(async () => {
      const res = await ensureWarrantyForSale(success.satis_id, 12);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      if (res.count === 0) {
        toast.info("Heç bir məhsul üçün zəmanət yaradılmadı");
        return;
      }
      window.open(`/zemanet/print?satis=${success.satis_id}`, "_blank");
    });
  }
  function actionNewSale() {
    setSuccess(null);
    setVergiCekSent(false);
    setTimeout(() => searchInputRef.current?.focus(), 50);
  }

  /* ----------------------------- Keyboard ----------------------------- */
  // Latest-ref pattern (audit/mobil donma fix): əvvəl bu effektdə dependency
  // array YOX idi → window listener HƏR render-də söküb-bağlanırdı (hər hərf/say
  // dəyişikliyində 2600 sətirlik komponentdə) → mobildə "donur". İndi listener
  // bir dəfə bağlanır; handler ref-i hər render ucuz şəkildə təzələnir.
  const keyHandlerRef = useRef<(e: KeyboardEvent) => void>(() => {});
  keyHandlerRef.current = (e: KeyboardEvent) => {
    {
      const tgt = e.target;
      const inField =
        tgt instanceof HTMLInputElement ||
        tgt instanceof HTMLTextAreaElement ||
        tgt instanceof HTMLSelectElement;
      // Esc inside field should blur, not clear cart
      if (e.key === "Escape" && inField) {
        (tgt as HTMLElement).blur();
        return;
      }
      if (e.key === "F1") {
        e.preventDefault();
        setHelpOpen((s) => !s);
      } else if (e.key === "F2") {
        e.preventDefault();
        customerInputRef.current?.focus();
      } else if (e.key === "F3") {
        e.preventDefault();
        barcodeInputRef.current?.focus();
      } else if (e.key === "F4") {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === "F5") {
        // No-op: tier popover per line is opened via click in current UI.
      } else if (e.key === "F6") {
        e.preventDefault();
        endirimInputRef.current?.focus();
      } else if (e.key === "F7") {
        e.preventDefault();
        // Cycle payment
        const idx = PAYMENT_OPTIONS.findIndex(
          (o) => o.value === paymentMethod,
        );
        setPaymentMethod(
          PAYMENT_OPTIONS[(idx + 1) % PAYMENT_OPTIONS.length].value,
        );
      } else if (e.key === "F8") {
        e.preventDefault();
        setAutoZemanet((v) => !v);
      } else if (e.key === "F9") {
        e.preventDefault();
        if (cart.length > 0 && !insufficient && !success) onComplete();
      } else if (e.key === "F10") {
        e.preventDefault();
        if (cart.length > 0 && !insufficient && !success) completePrintNew();
      } else if (e.key === "F11") {
        e.preventDefault();
        if (cart.length > 0 && !insufficient && !success) parkCurrent();
      } else if (e.key === "Escape" && !inField) {
        if (cart.length > 0 && confirm("Səbəti boşaldım?")) clearCart();
      }
    }
  };
  useEffect(() => {
    const h = (e: KeyboardEvent) => keyHandlerRef.current(e);
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  /* ------------------------------- Render ------------------------------- */
  const tierColumns: { key: TierName; label: string }[] = [
    posSettings.show_pere && { key: "satis_qiymeti" as TierName, label: "Pərakəndə" },
    posSettings.show_topdan && { key: "topdan_qiymeti" as TierName, label: "Topdan" },
    posSettings.show_partnyor && { key: "partnyor_qiymeti" as TierName, label: "Partnyor" },
    posSettings.show_vip && { key: "vip_qiymeti" as TierName, label: "VIP" },
    posSettings.show_endirimli && { key: "endirimli_qiymet" as TierName, label: "Endirimli" },
  ].filter(Boolean) as { key: TierName; label: string }[];

  return (
    <div className="grid h-full grid-cols-1 gap-2 overflow-y-auto p-2 pb-24 sm:p-3 sm:pb-24 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-3 lg:overflow-hidden lg:pb-3">
      {/* ====================== LEFT COLUMN ====================== */}
      <section className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm lg:h-full">
        {/* Top bar: active session strip + UNIFIED search input */}
        <div className="shrink-0 space-y-2 px-3 pt-3">
          <SessionStrip
            kassaInfo={kassaInfo}
            onClose={() => {
              setCloseAmount(
                String(kassaInfo.acilis_qaligi + kassaInfo.cari_negd),
              );
              setCloseSessionOpen(true);
            }}
          />
          <div className="relative">
            <div className="pointer-events-none absolute left-1.5 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-md bg-rose-500 text-white">
              <ScanBarcode className="h-4 w-4" />
            </div>
            <Input
              ref={(node) => {
                // single ref serves both F3 + F4 hotkeys
                barcodeInputRef.current = node;
                searchInputRef.current = node;
              }}
              value={searchQ}
              autoFocus
              placeholder="Barkod / ad / SKU / kod yaz və ya skan et — Enter ilə əlavə et"
              className="h-12 sm:h-14 rounded-lg border-2 border-rose-300 bg-white pl-14 pr-12 text-sm font-medium placeholder:text-rose-300/80 focus-visible:border-rose-400 focus-visible:ring-rose-200"
              onChange={(e) => setSearchQ(e.target.value)}
              onFocus={() => setShowResults(true)}
              onBlur={() => setTimeout(() => setShowResults(false), 150)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.preventDefault();
                  setSearchQ("");
                  setShowResults(false);
                  setSearchResults([]);
                  return;
                }
                if (e.key === "Enter") {
                  e.preventDefault();
                  const code = (e.target as HTMLInputElement).value.trim();
                  if (!code) return;
                  if (looksLikeBarcode) {
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
                    // No results yet — try a barcode-style lookup as a fallback.
                    lookupBarcodeAction(code, anbarId).then((p) => {
                      if (p) addProduct(p);
                      else toast.error(`"${code}" üçün nəticə yoxdur`);
                    });
                  }
                }
              }}
            />
            {searching && (
              <Loader2 className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-rose-400" />
            )}
            {searchQ && !searching && (
              <button
                type="button"
                onClick={() => {
                  setSearchQ("");
                  setShowResults(false);
                  setSearchResults([]);
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-300 hover:bg-slate-100 hover:text-slate-600"
                aria-label="Axtarışı təmizlə"
                tabIndex={-1}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
            {/* Mobil kamera skan düyməsi — searchQ yoxdursa göstərilir */}
            {!searchQ && (
              <BarcodeScannerButton
                onDetected={(code) => {
                  setSearchQ(code);
                  lookupBarcodeAction(code, anbarId).then((p) => {
                    if (p) {
                      addProduct(p);
                      toast.success(`${p.ad} əlavə olundu`);
                      setSearchQ("");
                    } else {
                      toast.error(`Barkod "${code}" tapılmadı`);
                    }
                  });
                }}
                trigger={
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-md bg-rose-500 text-white hover:bg-rose-600"
                    aria-label="Kamera ilə skanla"
                    title="Telefon/tablet kamerası ilə skanla"
                  >
                    <Camera className="h-4 w-4" />
                  </button>
                }
              />
            )}
            {/* Result dropdown — anchored to the unified input */}
            <div className="relative">
              {showResults && searchResults.length > 0 && (
                <div className="absolute left-0 right-0 top-1 z-40 max-h-[420px] overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-xl">
                  {searchResults.map((p) => {
                    const tone = stokTone(p.stok_miqdari);
                    return (
                      <button
                        type="button"
                        key={p.id}
                        onClick={() => addProduct(p)}
                        className="grid w-full grid-cols-[1fr_auto_auto] items-center gap-3 border-b border-slate-100 px-3 py-2.5 text-left transition last:border-0 hover:bg-rose-50/60"
                      >
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium text-slate-900">
                            {p.ad}
                          </div>
                          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-500">
                            {p.kod && <span className="font-mono">{p.kod}</span>}
                            {p.barkod && (
                              <span className="font-mono">· {p.barkod}</span>
                            )}
                          </div>
                          {/* Tier columns */}
                          <div className="mt-1 flex flex-wrap items-center gap-1.5">
                            {tierColumns.map((tc) => {
                              const v =
                                tc.key === "satis_qiymeti"
                                  ? p.satis_qiymeti
                                  : tc.key === "topdan_qiymeti"
                                    ? p.topdan_qiymeti
                                    : tc.key === "partnyor_qiymeti"
                                      ? p.partnyor_qiymeti
                                      : tc.key === "vip_qiymeti"
                                        ? p.vip_qiymeti
                                        : 0;
                              if (!v) return null;
                              return (
                                <span
                                  key={tc.key}
                                  className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-700"
                                >
                                  <span className="text-slate-500">
                                    {tc.label}:
                                  </span>
                                  <span className="tabular-nums">
                                    {formatMoney(v)}
                                  </span>
                                </span>
                              );
                            })}
                            {can.viewMinPrice && p.min_satis_qiymeti > 0 && (
                              <span className="inline-flex items-center gap-1 rounded-md bg-rose-50 px-1.5 py-0.5 text-[10px] font-medium text-rose-700">
                                Min: {formatMoney(p.min_satis_qiymeti)}
                              </span>
                            )}
                            {can.viewCost && p.alish_qiymeti > 0 && (
                              <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                                Maya: {formatMoney(p.alish_qiymeti)}
                              </span>
                            )}
                          </div>
                        </div>
                        <span
                          className={cn(
                            "rounded-md border px-2 py-0.5 text-[11px] font-medium tabular-nums",
                            tone,
                          )}
                        >
                          {p.stok_miqdari} əd
                        </span>
                        <div className="text-right text-sm font-semibold tabular-nums text-slate-900">
                          {formatMoney(p.satis_qiymeti)}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
              {showResults &&
                searchResults.length === 0 &&
                !searching &&
                searchQ.length >= 2 && (
                  <div className="absolute left-0 right-0 top-1 z-30 rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-500 shadow-lg">
                    Nəticə yoxdur
                  </div>
                )}
            </div>
          </div>
        </div>

        {/* Cart list — only this scrolls */}
        <div className="mt-2 flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto overflow-x-auto">
            {cart.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center px-6 py-10 text-center">
                <div className="mb-2 grid h-12 w-12 place-items-center rounded-full bg-rose-100 text-rose-600">
                  <ScanBarcode className="h-6 w-6" />
                </div>
                <p className="text-sm font-semibold text-slate-900">
                  Səbət boşdur
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  Barkod skan edin və ya məhsul axtarın
                </p>
              </div>
            ) : (
              <ul>
                {cart.map((l, idx) => {
                  const lineTotal = lineNetTotal(l);
                  const effPerUnit =
                    l.miqdar > 0 ? lineTotal / l.miqdar : l.qiymet;
                  const belowMin =
                    l.min_satis_qiymeti > 0 && effPerUnit < l.min_satis_qiymeti;
                  return (
                    <li
                      key={l.uid}
                      className={cn(
                        "grid grid-cols-[20px_minmax(120px,1fr)_auto_auto_auto_auto_72px_auto] sm:grid-cols-[24px_minmax(0,1fr)_auto_auto_auto_auto_88px_auto] items-center gap-2 sm:gap-3 border-b border-slate-100 px-2 py-2 sm:px-3 transition hover:bg-slate-50/60",
                        belowMin && "bg-rose-50/40",
                      )}
                    >
                      <span className="text-sm font-semibold text-slate-700 tabular-nums">
                        {idx + 1}
                      </span>
                      <div className="min-w-0">
                        <div
                          className="truncate text-sm font-medium text-slate-900"
                          title={l.ad}
                        >
                          {l.ad}
                        </div>
                        <div className="truncate text-[11px] text-slate-500">
                          {l.kod ?? ""}
                          {l.needs_approval && (
                            <Badge className="ml-1 h-3.5 border-amber-200 bg-amber-50 px-1 py-0 text-[9px] text-amber-700">
                              Təsdiq
                            </Badge>
                          )}
                          {belowMin && (
                            <Badge className="ml-1 h-3.5 border-rose-200 bg-rose-50 px-1 py-0 text-[9px] text-rose-700">
                              Min altı
                            </Badge>
                          )}
                        </div>
                      </div>
                      {/* Qty stepper */}
                      <div className="inline-flex items-center overflow-hidden rounded-md border border-slate-200">
                        <button
                          type="button"
                          onClick={() => updateLineQty(idx, -1)}
                          className="grid h-8 w-8 sm:h-7 sm:w-7 place-items-center text-slate-600 hover:bg-slate-100"
                          aria-label="Azalt"
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <input
                          type="number"
                          value={l.miqdar}
                          onChange={(e) =>
                            setCart((prev) =>
                              prev.map((row, i) =>
                                i === idx
                                  ? {
                                      ...row,
                                      miqdar: Math.max(
                                        0.001,
                                        Number(e.target.value) || 0,
                                      ),
                                    }
                                  : row,
                              ),
                            )
                          }
                          className="h-8 w-10 sm:h-7 border-0 bg-transparent text-center text-sm font-medium tabular-nums focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => updateLineQty(idx, 1)}
                          className="grid h-8 w-8 sm:h-7 sm:w-7 place-items-center text-slate-600 hover:bg-slate-100"
                          aria-label="Artır"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      {/* Price input */}
                      <input
                        type="number"
                        step="0.01"
                        value={l.qiymet}
                        disabled={!can.changePrice}
                        onChange={(e) =>
                          setLinePrice(idx, Number(e.target.value) || 0)
                        }
                        className={cn(
                          "h-8 w-16 sm:h-7 sm:w-20 rounded-md border bg-white px-2 text-right text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-rose-300",
                          belowMin ? "border-rose-300" : "border-slate-200",
                          !can.changePrice && "cursor-not-allowed opacity-60",
                        )}
                      />
                      {/* Line-level discount (faiz / AZN) */}
                      <EndirimCell
                        faiz={l.endirim_faiz}
                        mebleg={l.endirim_mebleg}
                        mode={l.endirim_mode}
                        onChange={(next) =>
                          setCart((prev) =>
                            prev.map((row, i) =>
                              i === idx
                                ? {
                                    ...row,
                                    endirim_mode: next.mode,
                                    endirim_faiz:
                                      next.mode === "faiz" ? next.value : 0,
                                    endirim_mebleg:
                                      next.mode === "mebleg" ? next.value : 0,
                                  }
                                : row,
                            ),
                          )
                        }
                      />
                      {/* Eye / quick view + tier popover */}
                      <div className="flex items-center gap-0.5">
                        <PriceTiersPopover
                          mehsulId={l.mehsul_id}
                          title="Qiymət tipləri"
                          allowedTiers={allowedTiers}
                          onPickPrice={(price) => {
                            setCart((prev) =>
                              prev.map((row, i) =>
                                i === idx
                                  ? {
                                      ...row,
                                      qiymet: price,
                                      tier: "custom" as TierName,
                                    }
                                  : row,
                              ),
                            );
                            toast.success(
                              `Sətrə tətbiq olundu: ${formatMoney(price)}`,
                            );
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => setQuickViewId(l.mehsul_id)}
                          className="grid h-6 w-6 place-items-center rounded text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                          title="Sürətli baxış"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      {/* Line total */}
                      <div className="text-right text-sm font-semibold tabular-nums text-slate-900">
                        {formatMoney(lineTotal)}
                      </div>
                      {/* Delete */}
                      <button
                        type="button"
                        onClick={() => removeLine(idx)}
                        className="grid h-6 w-6 place-items-center rounded text-slate-300 transition hover:bg-rose-50 hover:text-rose-600"
                        aria-label="Sətri sil"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Bottom keyboard hint strip */}
          <div className="flex items-center gap-3 border-t border-slate-100 px-3 py-2 text-[10.5px] text-slate-500">
            <div className="hidden md:flex items-center gap-3">
              <KeyHint k="F2" l="Müştəri" />
              <KeyHint k="F3" l="Barkod" />
              <KeyHint k="F6" l="Endirim" />
              <KeyHint k="F9" l="Tamamla" />
              <KeyHint k="F11" l="Növbəti" />
              <KeyHint k="Esc" l="Boşalt" />
            </div>
            <button
              type="button"
              onClick={() => setParkedOpen(true)}
              className="ml-auto inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-600 hover:border-rose-300 hover:text-rose-700"
            >
              <Inbox className="h-3 w-3" />
              Qaralamalar ({parked.length})
            </button>
            {anbarOptions.length > 1 ? (
              <select
                value={anbarId}
                onChange={(e) => setAnbarId(Number(e.target.value))}
                className="rounded-md border border-rose-200 bg-rose-50 px-2 py-0.5 text-[10px] font-medium text-rose-700 focus:outline-none focus:ring-1 focus:ring-rose-400"
                title="Anbar dəyişdir"
              >
                {anbarOptions.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.ad} ({a.total})
                  </option>
                ))}
              </select>
            ) : (
              <span className="rounded-md bg-rose-100 px-2 py-0.5 text-[10px] font-medium text-rose-700">
                {anbarAd}
              </span>
            )}
          </div>
        </div>
      </section>

      {/* ====================== RIGHT COLUMN ====================== */}
      <aside
        className={cn(
          "flex min-h-0 flex-col overflow-hidden border border-slate-200 bg-white shadow-sm",
          // Desktop: normal sağ sütun
          "lg:static lg:z-auto lg:h-full lg:max-h-none lg:translate-y-0 lg:rounded-xl lg:shadow-sm",
          // Mobil: aşağıdan açılan ödəniş sheet-i
          "fixed inset-x-0 bottom-0 z-50 max-h-[88vh] rounded-t-2xl shadow-2xl transition-transform duration-300 ease-out",
          paymentSheetOpen ? "translate-y-0" : "translate-y-full lg:translate-y-0",
        )}
      >
        {/* Mobil sheet başlığı — drag handle + bağla (desktop-da gizli) */}
        <div className="relative flex shrink-0 items-center justify-center border-b border-slate-100 px-4 py-2.5 lg:hidden">
          <div className="h-1 w-10 rounded-full bg-slate-300" aria-hidden />
          <button
            type="button"
            onClick={() => setPaymentSheetOpen(false)}
            className="absolute right-3 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-md text-lg leading-none text-slate-500 hover:bg-slate-100"
            aria-label="Bağla"
          >
            ✕
          </button>
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3 lg:overflow-hidden">
          {/* Customer */}
          <div>
            <Label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Müştəri
            </Label>
            {customer ? (
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 rounded-md border border-rose-200 bg-rose-50/40 px-2 py-1.5 text-sm">
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium text-slate-900">
                      {customer.ad}
                    </div>
                    {customer.telefon && (
                      <div className="truncate text-[11px] text-slate-500">
                        {customer.telefon}
                      </div>
                    )}
                  </div>
                  {customer.borc > 0 ? (
                    <Badge
                      className="border-amber-400 bg-amber-100 text-[11px] font-semibold tabular-nums text-amber-800"
                      title={`Cari borc: ${formatMoney(customer.borc)}`}
                    >
                      Borc: {formatMoney(customer.borc)}
                    </Badge>
                  ) : (
                    <Badge className="border-emerald-300 bg-emerald-50 text-[10px] text-emerald-700">
                      Borc yox
                    </Badge>
                  )}
                  <button
                    type="button"
                    onClick={() => setCustomer(null)}
                    className="text-slate-400 hover:text-rose-600"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                {/* Nisyə xəbərdarlığı — müştərinin borcu varsa və ya nisyə seçilibsə */}
                {customer.borc > 0 && (
                  <div className="rounded-md border border-amber-300 bg-amber-50/60 px-2 py-1 text-[11px] text-amber-800">
                    ⚠️ Bu müştərinin {formatMoney(customer.borc)} ödənilməmiş borcu var
                  </div>
                )}
                {/* Loyalty widget — tier, balans, bonus ilə öde */}
                <PosLoyaltyWidget
                  kontragentId={customer.id}
                  sebetCemi={sonMebleg}
                  onBonusChange={(kart, serfMebleg) => {
                    setLoyaltyCard(kart);
                    setBonusSerfMebleg(serfMebleg);
                  }}
                />
              </div>
            ) : (
              <div className="relative">
                <Input
                  ref={customerInputRef}
                  value={customerQ}
                  onChange={(e) => setCustomerQ(e.target.value)}
                  onFocus={() => setShowCustomerResults(true)}
                  onBlur={() => setTimeout(() => setShowCustomerResults(false), 150)}
                  placeholder="Klik et — şəxsiyyət, yaz — axtar"
                  className="h-9 text-sm"
                />
                {showCustomerResults && (
                  <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-[240px] overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-xl">
                    {customerResults.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          setCustomer(c);
                          setCustomerQ("");
                          setShowCustomerResults(false);
                        }}
                        className="flex w-full items-center justify-between gap-2 border-b border-slate-100 p-2 text-left text-sm last:border-0 hover:bg-rose-50/60"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-medium">{c.ad}</div>
                          <div className="text-xs text-slate-500">
                            {c.telefon ?? "—"}
                          </div>
                        </div>
                        {c.borc > 0 && (
                          <Badge
                            className="shrink-0 border-amber-400 bg-amber-100 text-[11px] font-semibold tabular-nums text-amber-800"
                            title={`Cari borc: ${formatMoney(c.borc)}`}
                          >
                            Borc: {formatMoney(c.borc)}
                          </Badge>
                        )}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => {
                        setQcAd(customerQ);
                        setQuickCustomerOpen(true);
                      }}
                      className="flex w-full items-center gap-1.5 border-t border-slate-100 bg-rose-50/40 p-2 text-left text-sm font-medium text-rose-700 hover:bg-rose-100"
                    >
                      <PlusCircle className="h-3.5 w-3.5" />
                      Yeni müştəri yarat
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Kupon / promokod — müştəri olmasa da işləyir */}
          <div className="space-y-1">
            <Label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Endirim kodu (opsional)
            </Label>
            <PosCouponInput
              sebetCemi={Math.max(0, umumi - endirimEffectiveMebleg)}
              kontragentId={customer?.id ?? null}
              onApply={setCouponApplied}
              onClear={() => setCouponApplied(null)}
            />
          </div>

          {/* Stats rows */}
          <div className="space-y-1.5 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Sətir sayı</span>
              <span className="font-semibold tabular-nums text-slate-900">{cart.length}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Ümumi</span>
              <span className="font-semibold tabular-nums text-slate-900">
                {formatMoney(grossUmumi)}
              </span>
            </div>
            {lineDiscountsTotal > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Sətir endirimləri</span>
                <span className="font-semibold tabular-nums text-rose-600">
                  −{formatMoney(lineDiscountsTotal)}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-500">Ümumi endirim</span>
              <input
                ref={endirimInputRef}
                type="number"
                min={0}
                step={endirimMode === "faiz" ? 0.1 : 0.01}
                max={endirimMode === "faiz" ? 100 : undefined}
                value={endirimMode === "mebleg" ? endirimMebleg : endirimFaiz}
                onChange={(e) => {
                  const v = Math.max(0, Number(e.target.value) || 0);
                  if (endirimMode === "mebleg") setEndirimMebleg(v);
                  else setEndirimFaiz(Math.min(100, v));
                }}
                className="h-7 w-20 rounded-md border border-slate-200 bg-white px-2 text-right text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-rose-300"
              />
              <div className="flex h-7 items-center rounded-md border border-slate-200 bg-white p-0.5">
                <button
                  type="button"
                  onClick={() => setEndirimMode("mebleg")}
                  className={cn(
                    "rounded px-1.5 text-[10px] font-semibold transition",
                    endirimMode === "mebleg"
                      ? "bg-slate-800 text-white"
                      : "text-slate-500 hover:bg-slate-100",
                  )}
                >
                  ₼
                </button>
                <button
                  type="button"
                  onClick={() => setEndirimMode("faiz")}
                  className={cn(
                    "rounded px-1.5 text-[10px] font-semibold transition",
                    endirimMode === "faiz"
                      ? "bg-amber-500 text-white"
                      : "text-amber-600 hover:bg-amber-50",
                  )}
                >
                  %
                </button>
              </div>
            </div>
          </div>

          {/* Yekun */}
          <div className="flex items-end justify-between border-t border-slate-200 pt-2">
            <span className="text-base font-semibold text-slate-900">
              Yekun
            </span>
            <div className="text-right">
              <div className="text-2xl font-extrabold tabular-nums text-slate-900">
                {formatMoney(sonMebleg)}
              </div>
              {endirimEffectiveMebleg > 0 && (
                <div className="text-[10px] tabular-nums text-rose-600">
                  (endirim −{formatMoney(endirimEffectiveMebleg)})
                </div>
              )}
              {couponEndirim > 0 && (
                <div className="text-[10px] tabular-nums text-violet-600">
                  (kupon −{formatMoney(couponEndirim)})
                </div>
              )}
              {bonusAfterDiscount > 0 && (
                <div className="text-[10px] tabular-nums text-amber-600">
                  (bonus −{formatMoney(bonusAfterDiscount)})
                </div>
              )}
            </div>
          </div>

          {/* Payment methods */}
          <div>
            <Label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Ödəniş növü
            </Label>
            <div className="grid grid-cols-4 gap-1.5">
              {PAYMENT_OPTIONS.slice(0, 4).map((p) => {
                const active = paymentMethod === p.value;
                return (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => setPaymentMethod(p.value)}
                    className={cn(
                      "h-9 rounded-md border text-xs font-semibold transition",
                      active
                        ? "border-rose-500 bg-rose-500 text-white shadow-sm"
                        : "border-slate-200 bg-white text-slate-700 hover:border-rose-300",
                    )}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
            {/* Mixed/Credit/Taksit inline forms */}
            {paymentMethod === "qarisiq" && (
              <div className="mt-2 space-y-1.5 rounded-md border border-rose-200 bg-rose-50/40 p-2">
                <div className="grid grid-cols-3 gap-1.5">
                  <NumField label="Nağd" value={splitNegd} onChange={setSplitNegd} />
                  <NumField label="Kart" value={splitKart} onChange={setSplitKart} />
                  <NumField label="Bank" value={splitBank} onChange={setSplitBank} />
                </div>
                <div
                  className={cn(
                    "text-right text-[11px] tabular-nums",
                    splitOk ? "text-emerald-700" : "text-rose-600",
                  )}
                >
                  Cəm: {formatMoney(splitSum)} / {formatMoney(sonMebleg)}
                </div>
              </div>
            )}
            {paymentMethod === "kreditle" && (
              <div className="mt-2 space-y-1.5 rounded-md border border-rose-200 bg-rose-50/40 p-2">
                <select
                  value={creditBank}
                  onChange={(e) => setCreditBank(e.target.value)}
                  className="h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-xs"
                >
                  <option>Kapital Bank</option>
                  <option>ABB</option>
                  <option>Unibank</option>
                  <option>Digər</option>
                </select>
                <div className="grid grid-cols-3 gap-1.5">
                  <NumField label="%" value={String(creditFaiz)} onChange={(v) => setCreditFaiz(Number(v) || 0)} />
                  <NumField label="Ay" value={String(creditMuddet)} onChange={(v) => setCreditMuddet(Number(v) || 0)} />
                  <NumField label="İlkin" value={String(creditIlkin)} onChange={(v) => setCreditIlkin(Number(v) || 0)} />
                </div>
                <div className="text-right text-[11px] tabular-nums text-rose-700">
                  Aylıq ≈ {formatMoney(creditMonthly)}
                </div>
              </div>
            )}
            {paymentMethod === "taksit" && (
              <div className="mt-2 flex items-center gap-2 rounded-md border border-rose-200 bg-rose-50/40 p-2 text-xs">
                <Label className="text-slate-600">Hissə sayı</Label>
                <select
                  value={taksitCount}
                  onChange={(e) => setTaksitCount(Number(e.target.value))}
                  className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs"
                >
                  <option value={2}>2</option>
                  <option value={3}>3</option>
                  <option value={4}>4</option>
                  <option value={5}>5</option>
                </select>
                <div className="ml-auto tabular-nums text-slate-600">
                  ≈ {formatMoney(taksitCount > 0 ? sonMebleg / taksitCount : 0)}
                </div>
              </div>
            )}
          </div>

          {/* Müştəri verir / Qaytar */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Müştəri verir
              </Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={tender}
                onChange={(e) => setTender(e.target.value)}
                className="h-9 text-right text-sm font-semibold tabular-nums"
                placeholder="0"
              />
            </div>
            <div>
              <Label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Qaytar
              </Label>
              <div
                className={cn(
                  "flex h-9 items-center justify-end rounded-md border bg-emerald-50 px-3 text-right text-sm font-semibold tabular-nums",
                  insufficient
                    ? "border-rose-200 text-rose-600"
                    : "border-emerald-200 text-emerald-700",
                )}
              >
                {insufficient && tenderNum > 0
                  ? `−${formatMoney(sonMebleg - tenderNum)}`
                  : formatMoney(change)}
              </div>
            </div>
          </div>

          {/* Auto checkboxes (compact) */}
          <div className="flex flex-wrap items-center gap-3 text-[11px]">
            <label className="flex cursor-pointer items-center gap-1 text-slate-700">
              <input
                type="checkbox"
                checked={autoVergiCek}
                onChange={(e) => setAutoVergiCek(e.target.checked)}
                className="h-3.5 w-3.5 accent-rose-500"
              />
              Vergi çeki
            </label>
            <label className="flex cursor-pointer items-center gap-1 text-slate-700">
              <input
                type="checkbox"
                checked={autoZemanet}
                onChange={(e) => setAutoZemanet(e.target.checked)}
                disabled={!can.printWarranty}
                className="h-3.5 w-3.5 accent-rose-500"
              />
              Zəmanət
            </label>
            <label className="flex cursor-pointer items-center gap-1 text-slate-700">
              <input
                type="checkbox"
                checked={autoDavam}
                onChange={(e) => setAutoDavam(e.target.checked)}
                className="h-3.5 w-3.5 accent-rose-500"
              />
              Davam
            </label>
          </div>

          {minPriceViolation && (
            <div className="flex items-center gap-1.5 rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] text-rose-700">
              <AlertTriangle className="h-3.5 w-3.5" />
              Min qiymət altı sətirlər var
            </div>
          )}

          {/* Spacer pushes buttons down */}
          <div className="flex-1" />

          {/* Action buttons */}
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (cart.length === 0 || confirm("Səbəti boşaldım?"))
                    clearCart();
                }}
                disabled={completing}
                className="h-10 border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              >
                Boşalt
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={parkCurrent}
                disabled={completing || cart.length === 0}
                className="h-10 border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              >
                <Save className="h-3.5 w-3.5" />
                Qaralama
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button
                size="sm"
                onClick={parkCurrent}
                disabled={completing || cart.length === 0}
                className="h-10 bg-rose-500 text-white hover:bg-rose-600"
              >
                Növbətiyə (F11)
              </Button>
              <Button
                size="sm"
                onClick={completePrintNew}
                disabled={completing || cart.length === 0 || insufficient}
                className="h-10 bg-rose-500 text-white hover:bg-rose-600"
              >
                <Printer className="h-3.5 w-3.5" />
                Çap+növ. (F10)
              </Button>
            </div>
            <Button
              size="lg"
              onClick={onComplete}
              disabled={completing || cart.length === 0 || insufficient || !splitOk}
              className="h-14 w-full bg-emerald-500 text-base font-bold text-white shadow-md shadow-emerald-500/30 hover:bg-emerald-600"
            >
              {completing ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <>
                  <CheckCircle2 className="h-5 w-5" />
                  TAMAMLA (F9)
                </>
              )}
            </Button>
          </div>
        </div>
      </aside>

      {/* Mobil: backdrop (ödəniş sheet açıq olanda) */}
      {paymentSheetOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={() => setPaymentSheetOpen(false)}
          aria-hidden
        />
      )}

      {/* Mobil: sabit alt zolaq — CƏMİ + ÖDƏNİŞ (desktop-da gizli) */}
      {!paymentSheetOpen && cart.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 flex items-center gap-3 border-t border-slate-200 bg-white px-4 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-[0_-2px_12px_rgba(0,0,0,0.07)] lg:hidden">
          <div className="flex flex-col leading-tight">
            <span className="text-[11px] text-slate-500">{cart.length} məhsul</span>
            <span className="text-lg font-bold text-slate-900">{formatMoney(sonMebleg)}</span>
          </div>
          <button
            type="button"
            onClick={() => setPaymentSheetOpen(true)}
            className="ml-auto flex h-12 min-w-[55%] items-center justify-center gap-2 rounded-xl bg-rose-600 text-base font-bold text-white shadow-sm transition active:scale-[0.98]"
          >
            ÖDƏNİŞ
          </button>
        </div>
      )}

      {/* Quick view dialog */}
      {quickViewId && (
        <QuickViewDialog
          mehsulId={quickViewId}
          open={!!quickViewId}
          onOpenChange={(v) => {
            if (!v) setQuickViewId(null);
          }}
        />
      )}

      {/* Close-session dialog (wired from header + SessionStrip) */}
      <Dialog open={closeSessionOpen} onOpenChange={setCloseSessionOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Kassa sessiyasını bağla</DialogTitle>
            <DialogDescription>
              Kassadakı faktiki nağdı sayın və daxil edin. Fərq varsa qeyd yazın.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
              <div className="flex items-center justify-between py-0.5">
                <span className="text-slate-500">Açılış qaliği</span>
                <span className="tabular-nums">
                  {formatMoney(kassaInfo.acilis_qaligi)}
                </span>
              </div>
              <div className="flex items-center justify-between py-0.5">
                <span className="text-slate-500">Nağd dövriyyəsi</span>
                <span className="tabular-nums">
                  {formatMoney(kassaInfo.cari_negd)}
                </span>
              </div>
              <div className="my-1.5 h-px bg-slate-200" />
              <div className="flex items-center justify-between py-0.5">
                <span className="font-semibold text-slate-700">
                  Gözlənilən qalıq
                </span>
                <span className="font-semibold tabular-nums">
                  {formatMoney(kassaInfo.acilis_qaligi + kassaInfo.cari_negd)}
                </span>
              </div>
              <div className="flex items-center justify-between py-0.5">
                <span className="text-slate-500">Satış sayı</span>
                <span className="tabular-nums">
                  {kassaInfo.emeliyyatlar_say}
                </span>
              </div>
              <div className="flex items-center justify-between py-0.5">
                <span className="text-slate-500">Cəmi satış</span>
                <span className="tabular-nums">
                  {formatMoney(kassaInfo.cemi_satis)}
                </span>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="close-amt">Faktiki nağd (sayıldı) *</Label>
              <Input
                id="close-amt"
                type="number"
                min={0}
                step="0.01"
                value={closeAmount}
                onChange={(e) => setCloseAmount(e.target.value)}
                disabled={closing}
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="close-qeyd">Qeyd (istəyə bağlı)</Label>
              <textarea
                id="close-qeyd"
                value={closeQeyd}
                onChange={(e) => setCloseQeyd(e.target.value)}
                rows={2}
                maxLength={2000}
                className="flex w-full rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300"
                disabled={closing}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setCloseSessionOpen(false)}
              disabled={closing}
            >
              İmtina
            </Button>
            <Button
              type="button"
              onClick={submitCloseSession}
              disabled={closing}
              className="bg-rose-600 text-white hover:bg-rose-700"
            >
              {closing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Bağla"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Help bubble */}
      <button
        type="button"
        onClick={() => setHelpOpen(true)}
        className="fixed bottom-4 right-4 z-30 hidden h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-lg transition hover:text-rose-700 lg:flex"
        title="Klaviatura qısayolları (F1)"
        aria-label="Klaviatura qısayolları"
      >
        <Keyboard className="h-4 w-4" />
      </button>

      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Keyboard className="h-4 w-4" /> Klaviatura qısayolları
            </DialogTitle>
            <DialogDescription>
              POS-da iş sürətini artırmaq üçün
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1 text-sm">
            <ShortcutRow k="F1" v="Yardım" />
            <ShortcutRow k="F2" v="Müştəri axtarışı" />
            <ShortcutRow k="F3" v="Barkod" />
            <ShortcutRow k="F4" v="Məhsul axtarışı" />
            <ShortcutRow k="F6" v="Endirim" />
            <ShortcutRow k="F7" v="Ödəniş üsulu döngü" />
            <ShortcutRow k="F8" v="Zəmanət QR aç/bağla" />
            <ShortcutRow k="F9" v="TAMAMLA" />
            <ShortcutRow k="F10" v="Çap + növbəti" />
            <ShortcutRow k="F11" v="Növbətiyə park" />
            <ShortcutRow k="Esc" v="Səbəti boşalt" />
            <ShortcutRow k="Enter" v="Axtarış sahəsində 1-ci nəticəni əlavə et" />
          </div>
        </DialogContent>
      </Dialog>

      {/* Parked sales */}
      <Dialog open={parkedOpen} onOpenChange={setParkedOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Inbox className="h-4 w-4" /> Park edilmiş satışlar ({parked.length})
            </DialogTitle>
            <DialogDescription>
              Saxlanılmış səbətlər — 24 saat sonra avtomatik silinir.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] space-y-2 overflow-y-auto">
            {parked.length === 0 ? (
              <div className="py-8 text-center text-sm text-slate-500">
                Park edilmiş satış yoxdur
              </div>
            ) : (
              parked.map((p) => {
                const total = p.cart.reduce(
                  (s, l) => s + l.miqdar * l.qiymet * (1 - l.endirim_faiz / 100),
                  0,
                );
                const ago = Math.floor((Date.now() - p.ts) / 60000);
                return (
                  <div
                    key={p.id}
                    className="flex items-start gap-2 rounded-lg border border-slate-200 p-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">
                          {p.customerName ?? "— Müştəri yox —"}
                        </span>
                        <span className="text-[10px] text-slate-500">
                          {ago < 60
                            ? `${ago} dəq əvvəl`
                            : `${Math.floor(ago / 60)} saat əvvəl`}
                        </span>
                      </div>
                      <div className="mt-0.5 truncate text-xs text-slate-500">
                        {p.cart.length} sətir ·{" "}
                        {p.cart
                          .slice(0, 3)
                          .map((l) => l.ad)
                          .join(", ")}
                        {p.cart.length > 3 && "…"}
                      </div>
                      <div className="mt-1 text-sm font-semibold tabular-nums">
                        {formatMoney(total)}
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col gap-1">
                      <Button
                        size="sm"
                        className="h-7 bg-rose-600 px-2 text-xs text-white hover:bg-rose-700"
                        onClick={() => restoreParked(p)}
                      >
                        Bərpa et
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-xs text-rose-600 hover:bg-rose-50"
                        onClick={() => deleteParked(p.id)}
                      >
                        Sil
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Quick customer */}
      <Dialog open={quickCustomerOpen} onOpenChange={setQuickCustomerOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-4 w-4" /> Yeni müştəri yarat
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="qc-ad">Ad</Label>
              <Input
                id="qc-ad"
                value={qcAd}
                onChange={(e) => setQcAd(e.target.value)}
                autoFocus
                placeholder="Müştərinin tam adı"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="qc-tel">Telefon (istəyə bağlı)</Label>
              <Input
                id="qc-tel"
                value={qcTel}
                onChange={(e) => setQcTel(e.target.value)}
                placeholder="+994 50 ..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setQuickCustomerOpen(false)}
              disabled={qcPending}
            >
              İmtina
            </Button>
            <Button
              onClick={submitQuickCustomer}
              disabled={qcPending}
              className="bg-emerald-600 text-white hover:bg-emerald-700"
            >
              {qcPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Yarat"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Success modal */}
      <Dialog
        open={!!success}
        onOpenChange={(v) => {
          if (!v) actionNewSale();
        }}
      >
        <DialogContent className="sm:max-w-md">
          {success && (
            <>
              <DialogHeader>
                <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
                  <CheckCircle2 className="h-8 w-8 text-emerald-600" />
                </div>
                <DialogTitle className="text-center text-xl">
                  Satış tamamlandı
                </DialogTitle>
                <DialogDescription className="text-center text-2xl font-bold tabular-nums">
                  {success.pos_cek_nomresi}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Satış №</span>
                  <span className="font-mono">{success.nomre}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Müştəri</span>
                  <span>{success.customer_ad ?? "—"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Ödəniş üsulu</span>
                  <span>
                    {
                      PAYMENT_OPTIONS.find((p) => p.value === success.odenis_nov)
                        ?.label
                    }
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Məbləğ</span>
                  <span className="text-lg font-bold tabular-nums text-emerald-700">
                    {formatMoney(success.son_mebleg)}
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-1">
                <Button variant="outline" onClick={actionPrint} className="gap-1.5">
                  <Printer className="h-4 w-4" />
                  Çap et
                </Button>
                <Button
                  variant="outline"
                  onClick={actionVergiCek}
                  disabled={vergiSending || vergiCekSent}
                  className="gap-1.5"
                >
                  {vergiSending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Receipt className="h-4 w-4" />
                  )}
                  {vergiCekSent ? "Göndərildi" : "Vergi çeki"}
                </Button>
                <Button
                  variant="outline"
                  onClick={actionWarranty}
                  disabled={warrantyOpening}
                  className="gap-1.5"
                >
                  {warrantyOpening ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ShieldCheck className="h-4 w-4" />
                  )}
                  Zəmanət QR
                </Button>
                <Button
                  onClick={actionNewSale}
                  className="gap-1.5 bg-emerald-600 font-semibold text-white hover:bg-emerald-700"
                >
                  <PlusCircle className="h-4 w-4" />
                  Yeni satış
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* -------------------------------- Helpers --------------------------------- */

function SessionStrip({
  kassaInfo,
  onClose,
}: {
  kassaInfo: KassaInfo;
  onClose: () => void;
}) {
  const opened = useMemo(() => {
    const d = new Date(kassaInfo.acilis_tarixi);
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yy = String(d.getFullYear()).slice(2);
    const hh = String(d.getHours()).padStart(2, "0");
    const mi = String(d.getMinutes()).padStart(2, "0");
    return `${dd}.${mm}.${yy}, ${hh}:${mi}`;
  }, [kassaInfo.acilis_tarixi]);

  return (
    <div className="flex min-h-9 flex-wrap items-center gap-2 rounded-md border border-rose-100 bg-rose-50 px-2 py-1 text-[12px]">
      <div className="grid h-5 w-5 place-items-center rounded bg-rose-500 text-white">
        <Wallet className="h-3 w-3" />
      </div>
      <span className="font-medium text-slate-900">Aktiv sessiya</span>
      <span className="hidden text-slate-500 sm:inline">
        Açıldı: {opened} · Açılış: {formatMoney(kassaInfo.acilis_qaligi)}
      </span>
      {/* KPI strip: satış sayı + cəmi + nağd/kart/bank/borc */}
      <div className="ml-3 hidden items-center gap-3 text-[11px] text-slate-600 md:flex">
        <span>
          <span className="text-slate-400">Satış:</span>{" "}
          <span className="font-semibold tabular-nums text-slate-900">
            {kassaInfo.emeliyyatlar_say}
          </span>
        </span>
        <span>
          <span className="text-slate-400">Cəmi:</span>{" "}
          <span className="font-semibold tabular-nums text-emerald-700">
            {formatMoney(kassaInfo.cemi_satis)}
          </span>
        </span>
        <span>
          <span className="text-slate-400">Nağd:</span>{" "}
          <span className="font-semibold tabular-nums">
            {formatMoney(kassaInfo.cari_negd)}
          </span>
        </span>
        <span>
          <span className="text-slate-400">Kart:</span>{" "}
          <span className="font-semibold tabular-nums">
            {formatMoney(kassaInfo.cari_kart)}
          </span>
        </span>
        <span>
          <span className="text-slate-400">Bank:</span>{" "}
          <span className="font-semibold tabular-nums">
            {formatMoney(kassaInfo.cari_bank)}
          </span>
        </span>
        {kassaInfo.cari_borc > 0 && (
          <span>
            <span className="text-slate-400">Borc:</span>{" "}
            <span className="font-semibold tabular-nums text-amber-700">
              {formatMoney(kassaInfo.cari_borc)}
            </span>
          </span>
        )}
      </div>
      <button
        type="button"
        onClick={onClose}
        className="ml-auto inline-flex items-center gap-1 text-rose-600 hover:underline"
      >
        <X className="h-3 w-3" />
        Bağla
      </button>
    </div>
  );
}

function Stat({
  label,
  v,
  tone,
}: {
  label: string;
  v: string;
  tone?: string;
}) {
  return (
    <div className="text-right leading-tight">
      <div className="text-[9.5px] uppercase tracking-wider text-slate-500">
        {label}
      </div>
      <div className={cn("tabular-nums font-semibold text-slate-900", tone)}>
        {v}
      </div>
    </div>
  );
}

function NumField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="text-[10px] text-slate-600">
      {label}
      <input
        type="number"
        step="0.01"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-0.5 h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-right text-xs tabular-nums focus:outline-none focus:ring-2 focus:ring-rose-300"
      />
    </label>
  );
}

function AutoCheck({
  label,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px]",
        disabled && "cursor-not-allowed opacity-50",
      )}
    >
      <input
        type="checkbox"
        disabled={disabled}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-3.5 w-3.5 accent-rose-600"
      />
      <span>{label}</span>
    </label>
  );
}

function LineQeydPopover({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen((s) => !s)}
        className={cn(
          "inline-flex h-5 w-5 items-center justify-center rounded text-slate-400 transition hover:bg-amber-100 hover:text-amber-700",
          value && "text-amber-700",
        )}
        title={value ? `Qeyd: ${value}` : "Sətir qeydi"}
      >
        <StickyNote className="h-3 w-3" />
      </button>
      {open && (
        <div className="absolute left-0 top-6 z-30 w-64 rounded-lg border border-slate-200 bg-white p-2 shadow-xl">
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            rows={3}
            placeholder="Sətir qeydi..."
            className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-rose-300"
          />
          <div className="mt-1 flex justify-end">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-[11px] text-rose-700 hover:underline"
            >
              Bağla
            </button>
          </div>
        </div>
      )}
    </span>
  );
}

function Row({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div
      className={cn("flex items-center justify-between text-sm", tone)}
      >
      <span className="text-slate-600">{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
    </div>
  );
}

function ShortcutRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between rounded-md border border-slate-200 px-2 py-1">
      <span className="font-mono text-xs font-semibold">{k}</span>
      <span className="text-xs text-slate-500">{v}</span>
    </div>
  );
}

function KeyHint({ k, l }: { k: string; l: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <kbd className="rounded border border-slate-300 bg-white px-1 py-px font-mono text-[9.5px] font-semibold text-slate-700">
        {k}
      </kbd>
      <span>{l}</span>
    </span>
  );
}

/** Compact line-level discount cell — single input + % / ₼ toggle. */
function EndirimCell({
  faiz,
  mebleg,
  mode,
  onChange,
}: {
  faiz: number;
  mebleg: number;
  mode: "faiz" | "mebleg";
  onChange: (next: { mode: "faiz" | "mebleg"; value: number }) => void;
}) {
  const value = mode === "faiz" ? faiz : mebleg;
  return (
    <div className="inline-flex h-7 items-center gap-0.5">
      <input
        type="number"
        min={0}
        step={mode === "faiz" ? 0.1 : 0.01}
        max={mode === "faiz" ? 100 : undefined}
        value={value || ""}
        placeholder="0"
        onChange={(e) => {
          const v = Math.max(0, Number(e.target.value) || 0);
          onChange({ mode, value: mode === "faiz" ? Math.min(100, v) : v });
        }}
        className={cn(
          "h-7 w-16 rounded-md border bg-white px-1.5 text-right text-xs tabular-nums focus:outline-none focus:ring-2",
          value > 0
            ? "border-amber-300 focus:ring-amber-300"
            : "border-slate-200 focus:ring-rose-300",
        )}
        title="Sətir endirimi"
      />
      <button
        type="button"
        onClick={() => {
          // Toggle mode, but preserve numeric value to "0" so totals don't double-apply.
          onChange({ mode: mode === "faiz" ? "mebleg" : "faiz", value: 0 });
        }}
        className={cn(
          "grid h-6 w-6 place-items-center rounded text-[10px] font-bold transition",
          mode === "faiz"
            ? "bg-amber-500 text-white"
            : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
        )}
        title={mode === "faiz" ? "Faiz — kliklə ₼-yə keç" : "AZN — kliklə %-ə keç"}
      >
        {mode === "faiz" ? <Percent className="h-3 w-3" /> : "₼"}
      </button>
    </div>
  );
}

// Re-export for any callers that still want Eye icon
export const PosIcons = { Eye };
