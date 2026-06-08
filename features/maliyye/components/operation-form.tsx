"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Loader2,
  FileText,
  ShoppingBag,
  BadgeDollarSign,
  HandHelping,
  Gift,
  AlertOctagon,
  Crown,
  ScrollText,
  ArrowRightLeft,
  Repeat2,
  Diamond,
  PackageMinus,
  PiggyBank,
  Wallet,
  Upload,
  X,
  TrendingUp,
  AlertTriangle,
  Calendar,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Combobox, type ComboOption } from "@/components/ui/combobox";
import { toast } from "sonner";
import { formatMoney } from "@/lib/utils";
import { saveQuickOperation, payAllOpenInvoices, applyAdvanceToInvoice, paySupplierAllOpen, paySupplierInvoice } from "../actions";
import { KIND_META, XERC_KATEQORIYALARI } from "./quick-op-dialog";
import { getCustomerOpenInvoicesAction, type OpenInvoice } from "../customer-invoices-action";
import { getSupplierOpenPurchasesAction, type OpenPurchase } from "../supplier-invoices-action";
import { Layers } from "lucide-react";
import { ContactContextPanel } from "@/features/elaqe/components/contact-context-panel";

type EntityOpt = { id: string; ad: string };

type Props = {
  initialTip: string;
  hesablar: EntityOpt[];
  iscilier: EntityOpt[];
  kontragentler: EntityOpt[];
  /** Called after successful save instead of navigating away (used when embedded in a Sheet). */
  onSaved?: () => void;
};

const TAB_ORDER: { kod: string; label: string; Icon: LucideIcon }[] = [
  { kod: "qaime",            label: "Qaimə (müştəri)",    Icon: FileText },
  { kod: "alis_odenis",      label: "Alış ödənişi",       Icon: ShoppingBag },
  { kod: "xercler",          label: "Xərclər",            Icon: ShoppingBag },
  { kod: "maas",             label: "Əməkhaqqı ödənişi",  Icon: BadgeDollarSign },
  { kod: "avans",            label: "Avans",              Icon: HandHelping },
  { kod: "bonus",            label: "Bonus",              Icon: Gift },
  { kod: "cerime",           label: "Cərimə",             Icon: AlertOctagon },
  { kod: "tesisci_pul",      label: "Təsisçi pulu",       Icon: Crown },
  { kod: "tehtl_hesab",      label: "Tahtəl hesab",       Icon: ScrollText },
  { kod: "transfer",         label: "Transfer",           Icon: ArrowRightLeft },
  { kod: "valyuta_mubadile", label: "Valyuta mübadiləsi", Icon: Repeat2 },
  { kod: "dividend",         label: "Dividend",           Icon: Diamond },
  { kod: "borc_silinme",     label: "Borc silinməsi",     Icon: PackageMinus },
  { kod: "artirma",          label: "Artırma",            Icon: PiggyBank },
  { kod: "azaltma",          label: "Azaltma",            Icon: Wallet },
  { kod: "barter",           label: "Barter",             Icon: Repeat2 },
];

const XERC_MERKEZLERI = [
  { kod: "bash_ofis", ad: "Baş ofis" },
  { kod: "filial",    ad: "Filial" },
];

export function OperationForm({ initialTip, hesablar, iscilier, kontragentler, onSaved }: Props) {
  const router = useRouter();
  const sp = useSearchParams();

  const [tip, setTip] = useState(initialTip in KIND_META ? initialTip : "qaime");
  const meta = KIND_META[tip];

  // form state
  const [mebleg, setMebleg] = useState<string>("");
  const [tarix, setTarix] = useState(new Date().toISOString().slice(0, 10));
  const [valyuta, setValyuta] = useState("AZN");
  const [mezenne, setMezenne] = useState("1");
  const [meblegh2, setMeblegh2] = useState("");
  const [hesabId, setHesabId] = useState("");
  const [hesab2Id, setHesab2Id] = useState("");
  const [isciId, setIsciId] = useState("");
  const [kontragentId, setKontragentId] = useState(sp.get("kontragent") ?? "");
  const [senedNomresi, setSenedNomresi] = useState("");
  const [qeyd, setQeyd] = useState("");
  const [xercKat, setXercKat] = useState("diger");
  const [xercMerkez, setXercMerkez] = useState("bash_ofis");

  // Real-time balance preview
  const [balance, setBalance] = useState<{ ad: string; valyuta: string; balans: number } | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);

  // File attachments (queued in memory; uploaded after submit when operation id is known)
  const [files, setFiles] = useState<File[]>([]);

  // ── Qaimə tipi üçün — müştəri açıq sənədləri
  const [customerInvoices, setCustomerInvoices] = useState<OpenInvoice[]>([]);
  const [customerAvans, setCustomerAvans] = useState<number>(0);
  const [customerTotalOpen, setCustomerTotalOpen] = useState<number>(0);
  const [selectedQaimeId, setSelectedQaimeId] = useState<string>("");
  const [payMode, setPayMode] = useState<"specific" | "fifo" | "advance">("fifo");
  const [loadingInvoices, setLoadingInvoices] = useState(false);

  // ── Alış ödənişi (təchizatçı) üçün — açıq alış sənədləri
  const [supplierPurchases, setSupplierPurchases] = useState<OpenPurchase[]>([]);
  const [supplierTotalOpen, setSupplierTotalOpen] = useState<number>(0);
  const [selectedAlishId, setSelectedAlishId] = useState<string>("");
  const [loadingPurchases, setLoadingPurchases] = useState(false);

  // Recurring controls
  const [recurOn, setRecurOn] = useState(false);
  const [recurTezlik, setRecurTezlik] = useState("monthly");
  const [recurSay, setRecurSay] = useState<string>("");
  const [recurSonTarix, setRecurSonTarix] = useState<string>("");

  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Reset state when tip changes
  useEffect(() => {
    setError(null);
  }, [tip]);

  // Qaimə tipi + müştəri seçilibsə açıq sənədləri yüklə
  useEffect(() => {
    if (tip !== "qaime" || !kontragentId) {
      setCustomerInvoices([]);
      setCustomerAvans(0);
      setCustomerTotalOpen(0);
      setSelectedQaimeId("");
      return;
    }
    let cancelled = false;
    setLoadingInvoices(true);
    getCustomerOpenInvoicesAction(kontragentId)
      .then((data) => {
        if (cancelled) return;
        setCustomerInvoices(data.invoices);
        setCustomerAvans(data.avans);
        setCustomerTotalOpen(data.cemi_qaliq);
        if (data.invoices.length > 0) {
          setSelectedQaimeId(data.invoices[0].id);
        } else {
          setSelectedQaimeId("");
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingInvoices(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tip, kontragentId]);

  // Alış ödənişi tipi + təchizatçı seçilibsə açıq alış sənədləri
  useEffect(() => {
    if (tip !== "alis_odenis" || !kontragentId) {
      setSupplierPurchases([]);
      setSupplierTotalOpen(0);
      setSelectedAlishId("");
      return;
    }
    let cancelled = false;
    setLoadingPurchases(true);
    getSupplierOpenPurchasesAction(kontragentId)
      .then((data) => {
        if (cancelled) return;
        setSupplierPurchases(data.invoices);
        setSupplierTotalOpen(data.cemi_qaliq);
        if (data.invoices.length > 0) {
          setSelectedAlishId(data.invoices[0].id);
        } else {
          setSelectedAlishId("");
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingPurchases(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tip, kontragentId]);

  // Live balance fetch when account changes
  useEffect(() => {
    if (!hesabId) {
      setBalance(null);
      return;
    }
    let cancelled = false;
    setBalanceLoading(true);
    fetch(`/api/maliyye/balance?hesab_id=${encodeURIComponent(hesabId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled) return;
        if (data && typeof data.balans === "number") {
          setBalance(data);
        } else {
          setBalance(null);
        }
      })
      .catch(() => {
        if (!cancelled) setBalance(null);
      })
      .finally(() => {
        if (!cancelled) setBalanceLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [hesabId]);

  const need = meta?.ihtiyac ?? {};

  const hesabOptions = useMemo<ComboOption[]>(
    () => hesablar.map((h) => ({ value: h.id, label: h.ad })),
    [hesablar],
  );
  const isciOptions = useMemo<ComboOption[]>(
    () => iscilier.map((i) => ({ value: i.id, label: i.ad })),
    [iscilier],
  );
  const kontragentOptions = useMemo<ComboOption[]>(
    () => kontragentler.map((k) => ({ value: k.id, label: k.ad })),
    [kontragentler],
  );

  function selectTip(kod: string) {
    setTip(kod);
    const params = new URLSearchParams(sp.toString());
    params.set("tip", kod);
    router.replace(`/maliyye/emeliyyat/yeni?${params.toString()}`);
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const fd = new FormData();
    fd.set("type_kod", tip);
    fd.set("mebleg", mebleg);
    fd.set("tarix", tarix);
    fd.set("valyuta", valyuta);
    fd.set("mezenne", mezenne);
    if (need.hesab) fd.set("hesab_id", hesabId);
    if (need.hesab2) fd.set("hesab_id2", hesab2Id);
    if (tip === "valyuta_mubadile") fd.set("meblegh2", meblegh2);
    if (need.isci) fd.set("isci_id", isciId);
    if (need.kontragent) fd.set("kontragent_id", kontragentId);
    if (need.sened) fd.set("sened_nomresi", senedNomresi);
    if (need.kateqoriya) fd.set("xerc_kateqoriya", xercKat);
    fd.set("xerc_merkez", xercMerkez);
    fd.set("qeyd", qeyd);
    if (recurOn) {
      fd.set("recur_tezlik", recurTezlik);
      if (recurSay) fd.set("recur_say", recurSay);
      if (recurSonTarix) fd.set("recur_son_tarix", recurSonTarix);
    }

    startTransition(async () => {
      // Alış ödənişi tipində — təchizatçı paterni
      if (tip === "alis_odenis" && kontragentId) {
        if (payMode === "fifo" && supplierPurchases.length > 0) {
          const fifoFd = new FormData();
          fifoFd.set("techizatci_id", kontragentId);
          fifoFd.set("mebleg", mebleg);
          if (hesabId) fifoFd.set("hesab_id", hesabId);
          if (qeyd) fifoFd.set("qeyd", qeyd);
          const r = await paySupplierAllOpen(fifoFd);
          if (!r.ok) { setError(r.error); toast.error(r.error); return; }
          toast.success(`${r.closed} alış sənədi tam, ${r.partial} qismən bağlandı`);
          if (onSaved) onSaved(); else router.push("/maliyye/emeliyyat");
          return;
        }
        // specific mode
        if (selectedAlishId) {
          const sf = new FormData();
          sf.set("techizatci_id", kontragentId);
          sf.set("alish_id", selectedAlishId);
          sf.set("mebleg", mebleg);
          if (hesabId) sf.set("hesab_id", hesabId);
          if (qeyd) sf.set("qeyd", qeyd);
          const r = await paySupplierInvoice(sf);
          if (!r.ok) { setError(r.error); toast.error(r.error); return; }
          toast.success(r.message ?? "Ödəniş edildi");
          if (onSaved) onSaved(); else router.push("/maliyye/emeliyyat");
          return;
        }
      }

      // Qaimə tipində ödəniş rejiminə görə fərqli action çağırılır
      if (tip === "qaime" && kontragentId) {
        if (payMode === "advance") {
          if (!selectedQaimeId) {
            setError("Avans tətbiqi üçün sənəd seçin");
            toast.error("Avans tətbiqi üçün sənəd seçin");
            return;
          }
          const advFd = new FormData();
          advFd.set("musteri_id", kontragentId);
          advFd.set("qaime_id", selectedQaimeId);
          advFd.set("mebleg", mebleg);
          const r = await applyAdvanceToInvoice(advFd);
          if (!r.ok) { setError(r.error); toast.error(r.error); return; }
          toast.success(r.message ?? "Avans tətbiq edildi");
          if (onSaved) onSaved(); else router.push("/maliyye/emeliyyat");
          return;
        }
        if (payMode === "fifo" && customerInvoices.length > 0) {
          const fifoFd = new FormData();
          fifoFd.set("musteri_id", kontragentId);
          fifoFd.set("mebleg", mebleg);
          if (hesabId) fifoFd.set("hesab_id", hesabId);
          if (qeyd) fifoFd.set("qeyd", qeyd);
          const r = await payAllOpenInvoices(fifoFd);
          if (!r.ok) { setError(r.error); toast.error(r.error); return; }
          toast.success(
            `${r.closed} sənəd tam, ${r.partial} qismən bağlandı` +
            (r.toAdvance > 0 ? ` · ${r.toAdvance.toFixed(2)} ₼ avans` : ""),
          );
          if (onSaved) onSaved(); else router.push("/maliyye/emeliyyat");
          return;
        }
        // specific mode — seçilmiş sənədə bağla
        if (selectedQaimeId) {
          fd.set("satis_id", selectedQaimeId);
        }
      }

      const res = await saveQuickOperation(fd);
      if (!res.ok) {
        setError(res.error);
        toast.error(res.error);
        return;
      }
      // Upload pending attachments — best effort
      if (files.length > 0 && res.id) {
        for (const f of files) {
          try {
            const uf = new FormData();
            uf.set("file", f);
            uf.set("ad", f.name);
            const r = await fetch(`/api/maliyye/operation/${res.id}/sened/upload`, {
              method: "POST",
              body: uf,
            });
            if (!r.ok) {
              const j = await r.json().catch(() => ({ error: "Sənəd yüklənmədi" }));
              toast.error(`Sənəd: ${j.error ?? "Xəta"}`);
            }
          } catch (err) {
            console.error(err);
            toast.error("Sənəd yüklənmədi");
          }
        }
      }
      toast.success("Əməliyyat qeydə alındı");
      if (onSaved) {
        onSaved();
      } else {
        router.push("/maliyye/emeliyyat");
      }
    });
  }

  // Balance preview math
  const meblegNum = Number(mebleg) || 0;
  const isInflow = meta?.tip === "medaxil";
  const isOutflow = meta?.tip === "mexaric";
  const isTransferType = meta?.tip === "transfer";
  const afterBalance = balance
    ? isInflow
      ? balance.balans + meblegNum
      : isOutflow
        ? balance.balans - meblegNum
        : isTransferType
          ? balance.balans - meblegNum
          : balance.balans
    : null;
  const balanceWarn = afterBalance !== null && afterBalance < 0;

  if (!meta) {
    return (
      <Alert variant="destructive">
        <AlertDescription>Naməlum əməliyyat növü: {tip}</AlertDescription>
      </Alert>
    );
  }

  const isTransfer = meta.tip === "transfer";

  return (
    <div className="space-y-4">
      {/* Üst tab strip (Prospect ERP üslubu) */}
      <div className="rounded-xl border border-border bg-secondary/40 p-1">
        <div className="flex gap-0.5 overflow-x-auto scrollbar-thin">
          {TAB_ORDER.map((t) => {
            const isOn = t.kod === tip;
            return (
              <button
                key={t.kod}
                type="button"
                onClick={() => selectTip(t.kod)}
                className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-xs font-semibold transition ${
                  isOn
                    ? "bg-background text-primary shadow-sm"
                    : "text-muted-foreground hover:bg-background/60 hover:text-foreground"
                }`}
              >
                <t.Icon className="h-3.5 w-3.5" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <Card className="glass">
        <CardContent className="py-5">
          <form onSubmit={onSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="tarix">Tarix *</Label>
                <Input
                  id="tarix"
                  type="date"
                  value={tarix}
                  onChange={(e) => setTarix(e.target.value)}
                  required
                  disabled={pending}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="xerc_merkez">Xərc mərkəzi</Label>
                <select
                  id="xerc_merkez"
                  value={xercMerkez}
                  onChange={(e) => setXercMerkez(e.target.value)}
                  disabled={pending}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                >
                  {XERC_MERKEZLERI.map((m) => (
                    <option key={m.kod} value={m.kod}>{m.ad}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="valyuta">Valyuta</Label>
                <select
                  id="valyuta"
                  value={valyuta}
                  onChange={(e) => setValyuta(e.target.value)}
                  disabled={pending}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                >
                  <option value="AZN">AZN</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="TRY">TRY</option>
                  <option value="RUB">RUB</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="mebleg">Məbləğ *</Label>
                <Input
                  id="mebleg"
                  type="number"
                  min={0.01}
                  step="0.01"
                  value={mebleg}
                  onChange={(e) => setMebleg(e.target.value)}
                  required
                  disabled={pending}
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mezenne">Məzənnə (AZN-ə)</Label>
                <Input
                  id="mezenne"
                  type="number"
                  step="0.0001"
                  value={mezenne}
                  onChange={(e) => setMezenne(e.target.value)}
                  disabled={pending || valyuta === "AZN"}
                />
              </div>
              {tip === "valyuta_mubadile" && (
                <div className="space-y-2">
                  <Label htmlFor="meblegh2">Hədəf məbləğ (alınan valyutada) *</Label>
                  <Input
                    id="meblegh2"
                    type="number"
                    min={0.01}
                    step="0.01"
                    value={meblegh2}
                    onChange={(e) => setMeblegh2(e.target.value)}
                    disabled={pending}
                  />
                </div>
              )}
            </div>

            {need.kateqoriya && (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="xerc_kateqoriya">Əməliyyatın kateqoriyası *</Label>
                  <select
                    id="xerc_kateqoriya"
                    value={xercKat}
                    onChange={(e) => setXercKat(e.target.value)}
                    disabled={pending}
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                  >
                    {XERC_KATEQORIYALARI.map((k) => (
                      <option key={k.kod} value={k.kod}>{k.ad}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {need.hesab && (
              <div className="space-y-2">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Hesab / kassa {isTransfer ? "(mənbə)" : ""} *</Label>
                    <Combobox
                      options={hesabOptions}
                      value={hesabId}
                      onChange={setHesabId}
                      placeholder="— Seçin —"
                      searchPlaceholder="Hesab axtar..."
                      emptyText="Tapılmadı"
                      disabled={pending}
                    />
                  </div>
                  {need.hesab2 && (
                    <div className="space-y-2">
                      <Label>Hədəf hesab *</Label>
                      <Combobox
                        options={hesabOptions}
                        value={hesab2Id}
                        onChange={setHesab2Id}
                        placeholder="— Seçin —"
                        searchPlaceholder="Hesab axtar..."
                        emptyText="Tapılmadı"
                        disabled={pending}
                      />
                    </div>
                  )}
                </div>
                {/* Real-time balans önizləməsi */}
                {hesabId && (
                  <div
                    className={`rounded-lg border p-3 text-xs ${
                      balanceWarn
                        ? "border-danger/40 bg-danger/10"
                        : "border-border bg-secondary/30"
                    }`}
                    data-testid="balance-preview"
                  >
                    <div className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
                      <TrendingUp className="h-3 w-3" /> Hesab balansı (real-time)
                    </div>
                    {balanceLoading ? (
                      <div className="mt-1 flex items-center gap-1 text-muted-foreground">
                        <Loader2 className="h-3 w-3 animate-spin" /> Yüklənir...
                      </div>
                    ) : balance ? (
                      <div className="mt-1 grid grid-cols-2 gap-2">
                        <div>
                          <div className="text-[10.5px] text-muted-foreground">Cari balans</div>
                          <div className="font-semibold tabular-nums">
                            {formatMoney(balance.balans, balance.valyuta)}
                          </div>
                        </div>
                        {meblegNum > 0 && afterBalance !== null && (
                          <div>
                            <div className="text-[10.5px] text-muted-foreground">
                              Bu əməliyyatdan sonra
                            </div>
                            <div
                              className={`font-semibold tabular-nums ${
                                balanceWarn ? "text-danger" : ""
                              }`}
                            >
                              {formatMoney(afterBalance, balance.valyuta)}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="mt-1 text-muted-foreground">Balans tapılmadı</div>
                    )}
                    {balanceWarn && (
                      <div className="mt-2 flex items-center gap-1 rounded border border-danger/30 bg-danger/5 px-2 py-1 text-[11px] text-danger">
                        <AlertTriangle className="h-3 w-3" /> Balans çatışmır
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {need.isci && (
              <div className="space-y-2">
                <Label>Əməkdaş *</Label>
                <Combobox
                  options={isciOptions}
                  value={isciId}
                  onChange={setIsciId}
                  placeholder="— Seçin —"
                  searchPlaceholder="İşçi axtar..."
                  emptyText="Tapılmadı"
                  disabled={pending}
                />
              </div>
            )}

            {need.kontragent && (
              <div className="space-y-2">
                <Label>Kontragent *</Label>
                <Combobox
                  options={kontragentOptions}
                  value={kontragentId}
                  onChange={setKontragentId}
                  placeholder="— Seçin —"
                  searchPlaceholder="Kontragent axtar..."
                  emptyText="Tapılmadı"
                  disabled={pending}
                />
                {kontragentId && (
                  <ContactContextPanel
                    kontragentId={kontragentId}
                    side={tip === "alis_odenis" ? "supplier" : "customer"}
                    compact
                  />
                )}
              </div>
            )}

            {/* Qaimə tipi + müştəri seçilibsə — açıq sənədlər + ödəniş üsulu */}
            {tip === "qaime" && kontragentId && (
              <div className="space-y-2 rounded-lg border border-sky-300 bg-sky-50/60 p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-sky-700">
                    <FileText className="h-3.5 w-3.5" />
                    Müştərinin açıq qaimələri
                  </div>
                  <div className="text-[10.5px] text-sky-700">
                    Cəmi qalıq: <span className="font-bold tabular-nums">{formatMoney(customerTotalOpen)}</span>
                    {customerAvans > 0 && (
                      <span className="ml-2">· Avans: <span className="font-bold tabular-nums">{formatMoney(customerAvans)}</span></span>
                    )}
                  </div>
                </div>

                {loadingInvoices ? (
                  <div className="py-4 text-center text-xs text-muted-foreground">
                    <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                  </div>
                ) : customerInvoices.length === 0 ? (
                  <div className="rounded-md border border-dashed border-sky-300 bg-background/60 py-3 text-center text-xs text-muted-foreground">
                    Bu müştərinin açıq qaiməsi yoxdur
                    {customerAvans > 0 && " — avansdan tətbiq edə bilərsiniz"}
                  </div>
                ) : (
                  <>
                    {/* Mode pills */}
                    <div className="flex flex-wrap gap-1">
                      <button
                        type="button"
                        onClick={() => setPayMode("fifo")}
                        className={`inline-flex h-7 items-center gap-1 rounded-full border px-2.5 text-[11px] font-medium transition ${
                          payMode === "fifo"
                            ? "border-emerald-500 bg-emerald-100 text-emerald-700"
                            : "border-border bg-card text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <Layers className="h-3 w-3" />
                        Ardıcıl bağla (FIFO)
                      </button>
                      <button
                        type="button"
                        onClick={() => setPayMode("specific")}
                        className={`inline-flex h-7 items-center gap-1 rounded-full border px-2.5 text-[11px] font-medium transition ${
                          payMode === "specific"
                            ? "border-primary bg-primary/15 text-primary-light"
                            : "border-border bg-card text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <FileText className="h-3 w-3" />
                        Konkret qaiməyə
                      </button>
                      {customerAvans > 0 && (
                        <button
                          type="button"
                          onClick={() => setPayMode("advance")}
                          className={`inline-flex h-7 items-center gap-1 rounded-full border px-2.5 text-[11px] font-medium transition ${
                            payMode === "advance"
                              ? "border-amber-500 bg-amber-100 text-amber-700"
                              : "border-border bg-card text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          <Wallet className="h-3 w-3" />
                          Avansdan
                        </button>
                      )}
                    </div>

                    {/* Sənəd siyahısı */}
                    <div className="max-h-64 space-y-1 overflow-auto rounded-md border border-border bg-background/50 p-1">
                      {customerInvoices.map((inv) => {
                        const isSelected = selectedQaimeId === inv.id;
                        const isFifo = payMode === "fifo";
                        const ageTone =
                          inv.gun >= 90 ? "text-rose-600" :
                          inv.gun >= 30 ? "text-amber-600" :
                          "text-muted-foreground";
                        return (
                          <label
                            key={inv.id}
                            className={`flex cursor-pointer items-center justify-between gap-2 rounded-md border px-2 py-2 text-xs transition ${
                              isFifo
                                ? "border-emerald-200 bg-emerald-50/50 cursor-default"
                                : isSelected
                                  ? "border-primary bg-primary/10"
                                  : "border-border bg-card hover:border-primary"
                            }`}
                            onClick={() => {
                              if (!isFifo) {
                                setSelectedQaimeId(inv.id);
                                // Məbləğ avtomatik sənədin qalıqı qədər dolur
                                setMebleg(String(inv.qalig));
                              }
                            }}
                          >
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              {!isFifo && (
                                <input
                                  type="radio"
                                  checked={isSelected}
                                  onChange={() => {
                                    setSelectedQaimeId(inv.id);
                                    setMebleg(String(inv.qalig));
                                  }}
                                  className="accent-primary"
                                />
                              )}
                              <div className="min-w-0 flex-1">
                                <div className="font-mono font-semibold truncate">#{inv.nomre}</div>
                                <div className={`text-[10px] inline-flex items-center gap-1 ${ageTone}`}>
                                  <Calendar className="h-2.5 w-2.5" />
                                  {new Date(inv.tarix).toLocaleDateString("az-AZ")}
                                  {inv.gun > 0 && ` · ${inv.gun} gün`}
                                </div>
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <div className="font-bold tabular-nums text-rose-600">{formatMoney(inv.qalig)}</div>
                              {inv.odenilmis > 0 && (
                                <div className="text-[10px] text-muted-foreground">
                                  {formatMoney(inv.odenilmis)} / {formatMoney(inv.son_mebleg)}
                                </div>
                              )}
                            </div>
                          </label>
                        );
                      })}
                    </div>

                    <p className="text-[10px] text-sky-700/80">
                      ⓘ {payMode === "fifo"
                        ? "Ödəniş ən köhnə qaimədən başlayaraq sıraya tətbiq olunur. Artıq məbləğ avansa keçir."
                        : payMode === "advance"
                          ? "Müştərinin avansından seçilmiş qaiməyə tətbiq olunur. Kassa hərəkəti yoxdur."
                          : "Yalnız seçilmiş qaiməyə tətbiq olunur. Qaiməni klikləyəndə məbləğ qalıq qədər avtomatik dolur."}
                    </p>
                  </>
                )}
              </div>
            )}

            {/* Alış ödənişi tipi + təchizatçı seçilibsə — açıq alış sənədləri */}
            {tip === "alis_odenis" && kontragentId && (
              <div className="space-y-2 rounded-lg border border-amber-300 bg-amber-50/60 p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-700">
                    <ShoppingBag className="h-3.5 w-3.5" />
                    Açıq alış sənədləri (təchizatçıya borc)
                  </div>
                  <div className="text-[10.5px] text-amber-700">
                    Cəmi qalıq: <span className="font-bold tabular-nums">{formatMoney(supplierTotalOpen)}</span>
                  </div>
                </div>

                {loadingPurchases ? (
                  <div className="py-4 text-center text-xs text-muted-foreground">
                    <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                  </div>
                ) : supplierPurchases.length === 0 ? (
                  <div className="rounded-md border border-dashed border-amber-300 bg-background/60 py-3 text-center text-xs text-muted-foreground">
                    Bu təchizatçının açıq alış sənədi yoxdur
                  </div>
                ) : (
                  <>
                    <div className="flex flex-wrap gap-1">
                      <button
                        type="button"
                        onClick={() => setPayMode("fifo")}
                        className={`inline-flex h-7 items-center gap-1 rounded-full border px-2.5 text-[11px] font-medium transition ${
                          payMode === "fifo"
                            ? "border-emerald-500 bg-emerald-100 text-emerald-700"
                            : "border-border bg-card text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <Layers className="h-3 w-3" />
                        Ardıcıl bağla (FIFO)
                      </button>
                      <button
                        type="button"
                        onClick={() => setPayMode("specific")}
                        className={`inline-flex h-7 items-center gap-1 rounded-full border px-2.5 text-[11px] font-medium transition ${
                          payMode === "specific"
                            ? "border-primary bg-primary/15 text-primary-light"
                            : "border-border bg-card text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <FileText className="h-3 w-3" />
                        Konkret sənədə
                      </button>
                    </div>

                    <div className="max-h-64 space-y-1 overflow-auto rounded-md border border-border bg-background/50 p-1">
                      {supplierPurchases.map((p) => {
                        const isSelected = selectedAlishId === p.id;
                        const isFifo = payMode === "fifo";
                        const ageTone =
                          p.gun >= 90 ? "text-rose-600" :
                          p.gun >= 30 ? "text-amber-600" :
                          "text-muted-foreground";
                        return (
                          <label
                            key={p.id}
                            className={`flex cursor-pointer items-center justify-between gap-2 rounded-md border px-2 py-2 text-xs transition ${
                              isFifo
                                ? "border-emerald-200 bg-emerald-50/50 cursor-default"
                                : isSelected
                                  ? "border-primary bg-primary/10"
                                  : "border-border bg-card hover:border-primary"
                            }`}
                            onClick={() => {
                              if (!isFifo) {
                                setSelectedAlishId(p.id);
                                setMebleg(String(p.qalig));
                              }
                            }}
                          >
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              {!isFifo && (
                                <input
                                  type="radio"
                                  checked={isSelected}
                                  onChange={() => {
                                    setSelectedAlishId(p.id);
                                    setMebleg(String(p.qalig));
                                  }}
                                  className="accent-primary"
                                />
                              )}
                              <div className="min-w-0 flex-1">
                                <div className="font-mono font-semibold truncate">#{p.nomre}</div>
                                <div className={`text-[10px] inline-flex items-center gap-1 ${ageTone}`}>
                                  <Calendar className="h-2.5 w-2.5" />
                                  {new Date(p.tarix).toLocaleDateString("az-AZ")}
                                  {p.gun > 0 && ` · ${p.gun} gün`}
                                  {p.qaime_nomre && ` · qaimə: ${p.qaime_nomre}`}
                                </div>
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <div className="font-bold tabular-nums text-rose-600">{formatMoney(p.qalig)}</div>
                              {p.odenilmis > 0 && (
                                <div className="text-[10px] text-muted-foreground">
                                  {formatMoney(p.odenilmis)} / {formatMoney(p.umumi_mebleg)}
                                </div>
                              )}
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            )}

            {need.sened && tip !== "qaime" && tip !== "alis_odenis" && (
              <div className="space-y-2">
                <Label htmlFor="sened_nomresi">Sənəd nömrəsi</Label>
                <Input
                  id="sened_nomresi"
                  value={senedNomresi}
                  onChange={(e) => setSenedNomresi(e.target.value)}
                  maxLength={50}
                  disabled={pending}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="qeyd">Əlavə məlumat</Label>
              <Input
                id="qeyd"
                value={qeyd}
                onChange={(e) => setQeyd(e.target.value)}
                disabled={pending}
              />
            </div>

            {/* Sənəd əlavə et — fayl seçici */}
            <div className="space-y-2">
              <Label>Sənəd əlavə et</Label>
              <div className="rounded-lg border border-dashed border-border bg-secondary/20 p-3">
                <label
                  htmlFor="sened_files"
                  className="flex cursor-pointer flex-col items-center gap-1 py-3 text-xs text-muted-foreground hover:text-foreground"
                >
                  <Upload className="h-5 w-5" />
                  <span>Faktura, qaimə, çek (JPG / PNG / PDF, max 5 MB)</span>
                  <input
                    id="sened_files"
                    type="file"
                    multiple
                    accept="image/jpeg,image/png,image/webp,application/pdf"
                    className="hidden"
                    disabled={pending}
                    onChange={(e) => {
                      const list = Array.from(e.target.files ?? []);
                      const valid = list.filter((f) => f.size <= 5 * 1024 * 1024);
                      if (valid.length !== list.length) {
                        toast.error("Bəzi fayllar 5 MB-dan böyükdür");
                      }
                      setFiles((prev) => [...prev, ...valid]);
                      e.target.value = "";
                    }}
                  />
                </label>
                {files.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {files.map((f, idx) => (
                      <li
                        key={`${f.name}-${idx}`}
                        className="flex items-center justify-between rounded border border-border bg-background px-2 py-1 text-xs"
                      >
                        <span className="truncate">{f.name} ({(f.size / 1024).toFixed(0)} KB)</span>
                        <button
                          type="button"
                          className="text-muted-foreground hover:text-danger"
                          onClick={() => setFiles((prev) => prev.filter((_, i) => i !== idx))}
                          disabled={pending}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {/* Təkrarlanan əməliyyat */}
            <div className="rounded-lg border border-border bg-card/40 p-3">
              <label className="flex items-center gap-2 text-sm font-semibold">
                <input
                  type="checkbox"
                  checked={recurOn}
                  onChange={(e) => setRecurOn(e.target.checked)}
                  disabled={pending}
                  className="h-4 w-4 rounded border-border"
                />
                <Calendar className="h-4 w-4 text-primary-light" />
                Təkrarlansın?
              </label>
              {recurOn && (
                <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
                  <div className="space-y-1">
                    <Label htmlFor="recur_tezlik" className="text-xs">Tezlik</Label>
                    <select
                      id="recur_tezlik"
                      value={recurTezlik}
                      onChange={(e) => setRecurTezlik(e.target.value)}
                      disabled={pending}
                      className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                    >
                      <option value="weekly">Həftəlik</option>
                      <option value="monthly">Aylıq</option>
                      <option value="bi_monthly">Hər 2 ay</option>
                      <option value="quarterly">Rüblük</option>
                      <option value="yearly">İllik</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="recur_say" className="text-xs">Təkrar sayı (istəyə bağlı)</Label>
                    <Input
                      id="recur_say"
                      type="number"
                      min={1}
                      value={recurSay}
                      onChange={(e) => setRecurSay(e.target.value)}
                      disabled={pending}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="recur_son_tarix" className="text-xs">Bitmə tarixi (istəyə bağlı)</Label>
                    <Input
                      id="recur_son_tarix"
                      type="date"
                      value={recurSonTarix}
                      onChange={(e) => setRecurSonTarix(e.target.value)}
                      disabled={pending}
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => router.push("/maliyye/emeliyyat")}
                disabled={pending}
              >
                İmtina
              </Button>
              <Button type="submit" disabled={pending}>
                {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Qeyd et
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
