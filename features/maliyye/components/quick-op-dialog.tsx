"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Loader2, FileText, Calendar, Wallet, Layers } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Combobox, type ComboOption } from "@/components/ui/combobox";
import { toast } from "sonner";
import { saveQuickOperation, payAllOpenInvoices, applyAdvanceToInvoice } from "../actions";
import { getCustomerOpenInvoicesAction, type OpenInvoice } from "../customer-invoices-action";
import { formatDate, formatMoney } from "@/lib/utils";
import { ContactContextPanel } from "@/features/elaqe/components/contact-context-panel";

type EntityOpt = { id: string; ad: string };
type HesabOpt = EntityOpt & { balans?: number; valyuta?: string; nov?: string };

type Props = {
  hesablar: HesabOpt[];
  iscilier: EntityOpt[];
  kontragentler: EntityOpt[];
};

export type OperationTip = "medaxil" | "mexaric" | "transfer" | "xususi";
export type OperationQrup =
  | "qaime"
  | "xercler"
  | "maas_isci"
  | "transfer"
  | "sahibkar"
  | "duzelis"
  | "borclar";

export type KindMetaEntry = {
  ad: string;
  qrup: OperationQrup;
  tip: OperationTip;
  ihtiyac: {
    hesab?: boolean;
    hesab2?: boolean;
    isci?: boolean;
    kontragent?: boolean;
    sened?: boolean;
    kateqoriya?: boolean;
  };
};

// ── Sadələşdirilmiş 14 əməliyyat növü ──
// (Köhnə 41 növ → tek növlərə birləşdirildi. Kredit_faiz tamamilə silindi.)
export const KIND_META: Record<string, KindMetaEntry> = {
  qaime:           { ad: "Qaimə",                qrup: "qaime",      tip: "medaxil",  ihtiyac: { hesab: true, kontragent: true, sened: true } },
  alis_odenis:     { ad: "Alış ödənişi",         qrup: "qaime",      tip: "mexaric",  ihtiyac: { hesab: true, kontragent: true, sened: true } },
  xercler:         { ad: "Xərclər",              qrup: "xercler",    tip: "mexaric",  ihtiyac: { hesab: true, kateqoriya: true } },
  maas:            { ad: "Əməkhaqqı ödənişi",    qrup: "maas_isci",  tip: "mexaric",  ihtiyac: { hesab: true, isci: true } },
  avans:           { ad: "Avans",                qrup: "maas_isci",  tip: "mexaric",  ihtiyac: { hesab: true, isci: true } },
  bonus:           { ad: "Bonus",                qrup: "maas_isci",  tip: "mexaric",  ihtiyac: { hesab: true, isci: true } },
  cerime:          { ad: "Cərimə",               qrup: "maas_isci",  tip: "medaxil",  ihtiyac: { hesab: true, isci: true } },
  tesisci_pul:     { ad: "Təsisçi pulu",         qrup: "sahibkar",   tip: "transfer", ihtiyac: { hesab: true } },
  tehtl_hesab:     { ad: "Tahtəl hesab",         qrup: "sahibkar",   tip: "transfer", ihtiyac: { hesab: true } },
  transfer:        { ad: "Transfer",             qrup: "transfer",   tip: "transfer", ihtiyac: { hesab: true, hesab2: true } },
  valyuta_mubadile:{ ad: "Valyuta mübadiləsi",   qrup: "transfer",   tip: "transfer", ihtiyac: { hesab: true, hesab2: true } },
  dividend:        { ad: "Dividend",             qrup: "sahibkar",   tip: "mexaric",  ihtiyac: { hesab: true } },
  borc_silinme:    { ad: "Borc silinməsi",       qrup: "borclar",    tip: "xususi",   ihtiyac: { kontragent: true } },
  artirma:         { ad: "Artırma",              qrup: "duzelis",    tip: "medaxil",  ihtiyac: { hesab: true } },
  azaltma:         { ad: "Azaltma",              qrup: "duzelis",    tip: "mexaric",  ihtiyac: { hesab: true } },
  barter:          { ad: "Barter",               qrup: "transfer",   tip: "transfer", ihtiyac: { kontragent: true } },
};

// Xərclər alt kateqoriyaları (Prospect ERP məntiqi)
export const XERC_KATEQORIYALARI = [
  { kod: "magaza",     ad: "Mağaza xərcləri" },
  { kod: "vergi",      ad: "Vergi" },
  { kod: "ofis",       ad: "Ofis" },
  { kod: "edv",        ad: "ƏDV" },
  { kod: "logistika",  ad: "Logistika" },
  { kod: "marketing",  ad: "Marketing" },
  { kod: "bank_komis", ad: "Bank komissiyası" },
  { kod: "gomruk",     ad: "Gömrük" },
  { kod: "diger",      ad: "Digər" },
] as const;

export function QuickOpDialog(props: Props) {
  const sp = useSearchParams();
  const kind = sp.get("new");
  const preKontragent = sp.get("kontragent") ?? "";
  return <QuickOpDialogInner key={`${kind}|${preKontragent}`} {...props} />;
}

function QuickOpDialogInner({ hesablar, iscilier, kontragentler }: Props) {
  const router = useRouter();
  const sp = useSearchParams();
  const pathname = usePathname();
  const kind = sp.get("new");
  const meta = kind ? KIND_META[kind] : null;
  const preKontragent = sp.get("kontragent") ?? "";

  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [hesabId, setHesabId] = useState<string>("");
  const [hesab2Id, setHesab2Id] = useState<string>("");
  const [isciId, setIsciId] = useState<string>("");
  const [kontragentId, setKontragentId] = useState<string>(preKontragent);

  // Açıq sənədlər (yalnız "qaime" tipinə görə)
  const [customerInvoices, setCustomerInvoices] = useState<OpenInvoice[]>([]);
  const [customerAvans, setCustomerAvans] = useState<number>(0);
  const [customerTotalOpen, setCustomerTotalOpen] = useState<number>(0);
  const [selectedQaimeId, setSelectedQaimeId] = useState<string>("");
  // Mode: "specific" (tək sənədə) | "fifo" (ardıcıl bağla) | "advance" (avansdan)
  const [payMode, setPayMode] = useState<"specific" | "fifo" | "advance">("fifo");
  const [loadingInvoices, setLoadingInvoices] = useState(false);

  // Kontragent dəyişdikdə qaime tipi üçün açıq sənədləri yüklə
  useEffect(() => {
    if (kind !== "qaime" || !kontragentId) {
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
        // Default: ən köhnə sənədi seç
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
  }, [kind, kontragentId]);

  function close() {
    const params = new URLSearchParams(sp.toString());
    params.delete("new");
    params.delete("kontragent");
    router.push(`${pathname}${params.toString() ? `?${params.toString()}` : ""}`);
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    if (!fd.get("type_kod") && kind) fd.set("type_kod", kind);

    // Qaimə tipində xüsusi rejimlər
    if (kind === "qaime" && kontragentId) {
      startTransition(async () => {
        if (payMode === "advance") {
          // Avansdan tətbiq
          if (!selectedQaimeId) {
            setError("Sənəd seçilməyib");
            return;
          }
          const advFd = new FormData();
          advFd.set("musteri_id", kontragentId);
          advFd.set("qaime_id", selectedQaimeId);
          advFd.set("mebleg", String(fd.get("mebleg") ?? "0"));
          const res = await applyAdvanceToInvoice(advFd);
          if (!res.ok) { setError(res.error); return; }
          toast.success(res.message ?? "Avans tətbiq edildi");
          close();
          router.refresh();
          return;
        }
        if (payMode === "fifo") {
          // Bütün açıq sənədləri ardıcıl bağla
          const allFd = new FormData();
          allFd.set("musteri_id", kontragentId);
          allFd.set("mebleg", String(fd.get("mebleg") ?? "0"));
          if (hesabId) allFd.set("hesab_id", hesabId);
          const q = fd.get("qeyd");
          if (q) allFd.set("qeyd", String(q));
          const res = await payAllOpenInvoices(allFd);
          if (!res.ok) { setError(res.error); return; }
          toast.success(
            `${res.closed} sənəd tam, ${res.partial} qismən bağlandı` +
            (res.toAdvance > 0 ? ` · ${res.toAdvance.toFixed(2)} ₼ avans` : "")
          );
          close();
          router.refresh();
          return;
        }
        // payMode === "specific"
        if (selectedQaimeId) {
          fd.set("satis_id", selectedQaimeId);
        }
        const res = await saveQuickOperation(fd);
        if (!res.ok) { setError(res.error); return; }
        toast.success(res.message ?? "Əməliyyat qeydə alındı");
        close();
        router.refresh();
      });
      return;
    }

    // Digər tiplər — köhnə davranış
    startTransition(async () => {
      const res = await saveQuickOperation(fd);
      if (!res.ok) {
        setError(res.error);
      } else {
        toast.success("Əməliyyat qeydə alındı");
        close();
        router.refresh();
      }
    });
  }

  if (!kind || !meta) return null;
  const need = meta.ihtiyac;
  const isTransfer = meta.tip === "transfer";

  return (
    <Dialog open onOpenChange={(o) => !o && close()}>
      <DialogContent className="md:max-w-md">
        <DialogHeader>
          <DialogTitle>{meta.ad}</DialogTitle>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <input type="hidden" name="type_kod" value={kind} />

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="mebleg">Məbləğ *</Label>
              <Input id="mebleg" name="mebleg" type="number" min={0.01} step="0.01" required disabled={pending} autoFocus />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tarix">Tarix *</Label>
              <Input id="tarix" name="tarix" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} disabled={pending} suppressHydrationWarning />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="valyuta">Valyuta</Label>
              <select id="valyuta" name="valyuta" defaultValue="AZN" disabled={pending}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm">
                <option value="AZN">AZN</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="TRY">TRY</option>
                <option value="RUB">RUB</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="mezenne">Məzənnə (AZN-ə)</Label>
              <Input id="mezenne" name="mezenne" type="number" step="0.0001" defaultValue="1" disabled={pending} />
            </div>
          </div>

          {need.kateqoriya && (
            <div className="space-y-2">
              <Label htmlFor="xerc_kateqoriya">Xərc kateqoriyası *</Label>
              <select
                id="xerc_kateqoriya"
                name="xerc_kateqoriya"
                defaultValue="diger"
                disabled={pending}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
              >
                {XERC_KATEQORIYALARI.map((k) => (
                  <option key={k.kod} value={k.kod}>{k.ad}</option>
                ))}
              </select>
            </div>
          )}

          {need.hesab && (
            <div className="space-y-2">
              <Label>Hesab / kassa {isTransfer ? "(mənbə)" : ""} *</Label>
              <Combobox
                options={hesablar.map<ComboOption>((h) => ({
                  value: h.id,
                  label: h.balans != null ? `${h.ad}  ·  ${formatMoney(h.balans)} ${h.valyuta ?? "AZN"}` : h.ad,
                }))}
                value={hesabId}
                onChange={setHesabId}
                placeholder="— Seçin —"
                searchPlaceholder="Hesab axtar..."
                emptyText="Tapılmadı"
                disabled={pending}
              />
              <input type="hidden" name="hesab_id" value={hesabId} />
              {hesabId && (() => {
                const sel = hesablar.find((h) => h.id === hesabId);
                if (!sel || sel.balans == null) return null;
                return (
                  <div className={`text-[10.5px] ${sel.balans < 0 ? "text-rose-600" : "text-emerald-600"}`}>
                    Cari balans: <span className="font-bold tabular-nums">{formatMoney(sel.balans)}</span> {sel.valyuta ?? "AZN"}
                  </div>
                );
              })()}
            </div>
          )}

          {need.hesab2 && (
            <>
              <div className="space-y-2">
                <Label>Hədəf hesab *</Label>
                <Combobox
                  options={hesablar.map<ComboOption>((h) => ({ value: h.id, label: h.ad }))}
                  value={hesab2Id}
                  onChange={setHesab2Id}
                  placeholder="— Seçin —"
                  searchPlaceholder="Hesab axtar..."
                  emptyText="Tapılmadı"
                  disabled={pending}
                />
                <input type="hidden" name="hesab_id2" value={hesab2Id} />
              </div>
              {kind === "valyuta_mubadile" && (
                <div className="space-y-2">
                  <Label htmlFor="meblegh2">Hədəf məbləğ (alınan valyutada) *</Label>
                  <Input id="meblegh2" name="meblegh2" type="number" min={0.01} step="0.01" disabled={pending} />
                </div>
              )}
            </>
          )}

          {need.isci && (
            <div className="space-y-2">
              <Label>İşçi *</Label>
              <Combobox
                options={iscilier.map<ComboOption>((i) => ({ value: i.id, label: i.ad }))}
                value={isciId}
                onChange={setIsciId}
                placeholder="— Seçin —"
                searchPlaceholder="İşçi axtar..."
                emptyText="Tapılmadı"
                disabled={pending}
              />
              <input type="hidden" name="isci_id" value={isciId} />
            </div>
          )}

          {need.kontragent && (
            <div className="space-y-2">
              <Label>Kontragent *</Label>
              <Combobox
                options={kontragentler.map<ComboOption>((c) => ({ value: c.id, label: c.ad }))}
                value={kontragentId}
                onChange={setKontragentId}
                placeholder="— Seçin —"
                searchPlaceholder="Kontragent axtar..."
                emptyText="Tapılmadı"
                disabled={pending}
              />
              <input type="hidden" name="kontragent_id" value={kontragentId} />
              {kontragentId && (
                <ContactContextPanel
                  kontragentId={kontragentId}
                  side="customer"
                  compact
                />
              )}
            </div>
          )}

          {/* Qaimə tipi + müştəri seçilibsə — açıq sənədlər və ödəniş üsulu */}
          {kind === "qaime" && kontragentId && (
            <div className="rounded-lg border border-sky-200 bg-sky-50/50 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-sky-700">
                  <FileText className="h-3.5 w-3.5" />
                  Açıq sənədlər
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
                <div className="py-4 text-center text-xs text-muted-foreground">
                  {customerAvans > 0 ? "Açıq sənəd yox. Avansı qaiməyə tətbiq edə bilərsiniz." : "Açıq nisyə sənədi yoxdur"}
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
                      Konkret sənəd
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
                  <div className="max-h-48 space-y-1 overflow-auto">
                    {customerInvoices.map((inv) => {
                      const isSelected = selectedQaimeId === inv.id;
                      const isFifo = payMode === "fifo";
                      const tone = inv.gun >= 90 ? "border-rose-400 bg-rose-50" : inv.gun >= 30 ? "border-amber-400 bg-amber-50" : "border-border bg-background";
                      return (
                        <label
                          key={inv.id}
                          className={`flex cursor-pointer items-center justify-between gap-2 rounded-md border px-2 py-1.5 text-xs transition ${
                            isFifo
                              ? "border-emerald-200 bg-emerald-50/50 cursor-default"
                              : isSelected
                                ? "border-primary bg-primary/10"
                                : tone + " hover:border-primary"
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            {!isFifo && (
                              <input
                                type="radio"
                                checked={isSelected}
                                onChange={() => setSelectedQaimeId(inv.id)}
                                disabled={isFifo}
                                className="accent-primary"
                              />
                            )}
                            <div className="min-w-0 flex-1">
                              <div className="font-mono font-medium truncate">#{inv.nomre}</div>
                              <div className="text-[10px] text-muted-foreground inline-flex items-center gap-1">
                                <Calendar className="h-2.5 w-2.5" />
                                {formatDate(inv.tarix)}
                                {inv.gun > 0 && ` · ${inv.gun} gün`}
                              </div>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="font-semibold tabular-nums text-rose-600">{formatMoney(inv.qalig)}</div>
                            {inv.odenilmis > 0 && (
                              <div className="text-[10px] text-muted-foreground">{formatMoney(inv.odenilmis)} / {formatMoney(inv.son_mebleg)}</div>
                            )}
                          </div>
                        </label>
                      );
                    })}
                  </div>

                  <p className="text-[10px] text-sky-700/80">
                    ⓘ {payMode === "fifo"
                      ? "Ödəniş ən köhnə sənəddən başlayaraq sırayla tətbiq olunur. Artıq məbləğ avansa keçir."
                      : payMode === "advance"
                        ? "Avansdan seçilmiş sənədə tətbiq olunur. Kassa hərəkəti yoxdur."
                        : "Yalnız seçilmiş sənədə tətbiq olunur. Artıq məbləğ avansa keçir."}
                  </p>
                </>
              )}
            </div>
          )}

          {need.sened && (
            <div className="space-y-2">
              <Label htmlFor="sened_nomresi">Sənəd nömrəsi</Label>
              <Input id="sened_nomresi" name="sened_nomresi" maxLength={50} disabled={pending} />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="qeyd">Qeyd</Label>
            <Input id="qeyd" name="qeyd" disabled={pending} />
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={close} disabled={pending}>İmtina</Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Qeyd et
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
