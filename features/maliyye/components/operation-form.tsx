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
import { saveQuickOperation } from "../actions";
import { KIND_META, XERC_KATEQORIYALARI } from "./quick-op-dialog";

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
  { kod: "qaime",            label: "Qaimə",              Icon: FileText },
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
              </div>
            )}

            {need.sened && (
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
