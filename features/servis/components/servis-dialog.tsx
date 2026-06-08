"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, Loader2, Info, Wallet, Package2, ChevronDown, ChevronRight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Combobox } from "@/components/ui/combobox";
import { toast } from "sonner";
import { createServisRequest } from "../actions";

type Option = { id: string | number; label: string };
type ProductOpt = { id: string; ad: string; kod: string | null; barkod: string | null };
type MusteriOpt = { id: string; ad: string; telefon: string | null };
type HesabOpt = { id: string; ad: string; nov: string | null };
type DefektOpt = { id: number; ad: string; qrup: string | null; default: boolean };

export function ServisDialog({
  filiallar = [],
  texniki = [],
  mehsullar = [],
  musteriler = [],
  hesablar = [],
  defektKateq = [],
}: {
  filiallar?: Option[];
  texniki?: Option[];
  mehsullar?: ProductOpt[];
  musteriler?: MusteriOpt[];
  hesablar?: HesabOpt[];
  defektKateq?: DefektOpt[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // URL parametri `?yeni=1` varsa dialog avtomatik açılır — dashboard
  // Quick Actions "Yeni servis" düyməsindən birbaşa formanı açır.
  useEffect(() => {
    if (searchParams.get("yeni") === "1" || searchParams.get("new") === "1") {
      setOpen(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Product mode: "bizim" (catalog) vs "xarici" (free-form, e.g. iPhone screen, not from our stock)
  const [mode, setMode] = useState<"bizim" | "xarici">("bizim");
  const [mehsulId, setMehsulId] = useState("");
  const [mehsulAd, setMehsulAd] = useState("");
  const [musteriId, setMusteriId] = useState("");
  const [musteriAd, setMusteriAd] = useState("");
  const [musteriTel, setMusteriTel] = useState("");
  const [musteriMebleg, setMusteriMebleg] = useState("");
  const [temirXerci, setTemirXerci] = useState("");
  const [hesabId, setHesabId] = useState("");
  // Komplektasiya — soruşmaq üçün collapsible bölmə
  const [komplektOpen, setKomplektOpen] = useState(false);
  const [komplektItems, setKomplektItems] = useState<Record<string, boolean>>({});
  const [komplektNote, setKomplektNote] = useState("");

  const productOptions = mehsullar.map((m) => ({
    value: m.id,
    label: m.ad,
    hint: m.kod ?? m.barkod ?? undefined,
  }));
  const musteriOptions = musteriler.map((m) => ({
    value: m.id,
    label: m.ad,
    hint: m.telefon ?? undefined,
  }));

  function onSelectProduct(id: string) {
    setMehsulId(id);
    const m = mehsullar.find((x) => x.id === id);
    if (m) setMehsulAd(m.ad);
  }
  function onSelectMusteri(id: string) {
    setMusteriId(id);
    const m = musteriler.find((x) => x.id === id);
    if (m) {
      setMusteriAd(m.ad);
      if (m.telefon) setMusteriTel(m.telefon);
    }
  }
  function resetForm() {
    setMode("bizim");
    setMehsulId("");
    setMehsulAd("");
    setMusteriId("");
    setMusteriAd("");
    setMusteriTel("");
    setMusteriMebleg("");
    setTemirXerci("");
    setHesabId("");
    setKomplektOpen(false);
    setKomplektItems({});
    setKomplektNote("");
    setError(null);
  }

  // Komplektasiya seçimləri — adətən smartfon/elektronika üçün
  const KOMPLEKT_ITEMS = [
    "Qutu",
    "Adaptor (şarj başlığı)",
    "Kabel",
    "Qulaqlıq",
    "SİM iynəsi",
    "Çexol",
    "Ekran qoruyucusu",
    "Pleyer / pult",
    "Sənəd / zəmanət kartı",
  ] as const;

  // Hazır preset-lər
  const PRESETS: { label: string; items: string[] }[] = [
    { label: "Bütün komplekt", items: [...KOMPLEKT_ITEMS] },
    { label: "Yalnız cihaz", items: [] },
    { label: "Qutusuz", items: KOMPLEKT_ITEMS.filter((x) => x !== "Qutu") },
    { label: "Adaptorsuz", items: KOMPLEKT_ITEMS.filter((x) => !x.includes("Adaptor")) },
    { label: "Şarjsız (adaptor + kabel yox)", items: KOMPLEKT_ITEMS.filter((x) => !x.includes("Adaptor") && x !== "Kabel") },
  ];

  function applyPreset(items: string[]) {
    const next: Record<string, boolean> = {};
    for (const k of KOMPLEKT_ITEMS) next[k] = items.includes(k);
    setKomplektItems(next);
  }

  // Cəmi: seçilmiş elementlər + manual qeyd
  const selectedKomplekt = Object.entries(komplektItems).filter(([, v]) => v).map(([k]) => k);
  const komplektSummary = (() => {
    if (selectedKomplekt.length === KOMPLEKT_ITEMS.length) return "Bütün komplekt";
    if (selectedKomplekt.length === 0 && !komplektNote) return "Yalnız cihaz";
    if (selectedKomplekt.length === 0 && komplektNote) return komplektNote;
    return selectedKomplekt.join(", ") + (komplektNote ? ` · ${komplektNote}` : "");
  })();

  const negdHesablar = hesablar.filter((h) => !h.nov || h.nov === "kassa" || h.nov === "nağd");
  const mebleg = Number(musteriMebleg || "0");
  const needsKassa = mebleg > 0;

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);

    if (mode === "bizim") {
      if (!mehsulId) {
        setError("Bizim məhsul rejimində məhsul seçilməlidir");
        return;
      }
      fd.set("mehsul_id", mehsulId);
      fd.set("mehsul_ad", mehsulAd);
    } else {
      fd.set("mehsul_id", "");
    }

    if (musteriId) fd.set("musteri_id", musteriId);
    else fd.delete("musteri_id");

    if (needsKassa && !hesabId) {
      setError("Müştəri məbləğ verirsə kassa seçilməlidir");
      return;
    }
    if (hesabId) fd.set("xidmet_hesab_id", hesabId);

    // Komplektasiya: seçilmiş chip-ləri + manual qeydi birləşdir
    const komplektParts: string[] = [];
    if (selectedKomplekt.length === KOMPLEKT_ITEMS.length) komplektParts.push("Bütün komplekt");
    else if (selectedKomplekt.length > 0) komplektParts.push(selectedKomplekt.join(", "));
    else if (!komplektNote) komplektParts.push("Yalnız cihaz");
    if (komplektNote.trim()) komplektParts.push(komplektNote.trim());
    fd.set("komplektasiya", komplektParts.join(" · "));

    startTransition(async () => {
      const res = await createServisRequest(fd);
      if (!res.ok) setError(res.error);
      else {
        toast.success("Servis sifarişi yaradıldı");
        setOpen(false);
        resetForm();
        if (res.id) router.push(`/servis/${res.id}`);
        else router.refresh();
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
      <DialogTrigger asChild>
        <Button size="sm" className="font-semibold text-white" style={{ background: "var(--brand-gradient)" }}>
          <Plus className="h-4 w-4" /> Yeni servis qəbul
        </Button>
      </DialogTrigger>
      <DialogContent className="p-0 md:max-w-2xl">
        <DialogHeader className="border-b border-border/40 px-5 py-3">
          <DialogTitle className="text-base">Yeni servis qeydi</DialogTitle>
        </DialogHeader>

        <form onSubmit={onSubmit} className="flex max-h-[80vh] flex-col">
          <div className="flex-1 space-y-3 overflow-y-auto px-5 py-3">
            {error && (
              <Alert variant="destructive" className="py-2">
                <AlertDescription className="text-xs">{error}</AlertDescription>
              </Alert>
            )}

            {/* Müştəri ad + telefon */}
            <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  Müştəri ad/soyad *
                </Label>
                <Combobox
                  options={musteriOptions}
                  value={musteriId}
                  onChange={onSelectMusteri}
                  placeholder="Mövcud müştəri seç…"
                  searchPlaceholder="Ad və ya telefon"
                  emptyText="Tapılmadı"
                  disabled={pending}
                />
                <Input
                  name="musteri_ad"
                  required
                  minLength={2}
                  maxLength={200}
                  value={musteriAd}
                  onChange={(e) => setMusteriAd(e.target.value)}
                  placeholder="Ad Soyad"
                  disabled={pending}
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  Telefon *
                </Label>
                <Input
                  name="musteri_telefon"
                  type="tel"
                  required
                  minLength={5}
                  maxLength={30}
                  value={musteriTel}
                  onChange={(e) => setMusteriTel(e.target.value)}
                  placeholder="+994 50 123 45 67"
                  disabled={pending}
                  className="h-9 text-sm"
                />
                <div className="h-9" />
              </div>
            </div>

            {/* Bizdən alınmayıb toggle banner */}
            <label className="flex cursor-pointer items-start gap-2 rounded-md border border-amber-200/60 bg-amber-50 px-3 py-2 text-xs dark:border-amber-500/30 dark:bg-amber-500/10">
              <input
                type="checkbox"
                checked={mode === "xarici"}
                onChange={(e) => setMode(e.target.checked ? "xarici" : "bizim")}
                disabled={pending}
                className="mt-0.5 h-3.5 w-3.5 accent-amber-600"
              />
              <div className="flex-1">
                <div className="font-semibold text-amber-900 dark:text-amber-200">
                  Bizdən alınmayıb / sərbəst yazılır
                </div>
                <div className="text-[11px] text-amber-700/80 dark:text-amber-200/70">
                  Müştərinin gətirdiyi bizdə satılmayan məhsul üçün işarələ. Adi halda stokdan seçilməlidir ki, mehsulun servis tarixçəsinə düşsün.
                </div>
              </div>
            </label>

            {/* Məhsul */}
            {mode === "bizim" ? (
              <div className="space-y-1">
                <Label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  Məhsul (stokdan seç) *
                </Label>
                <Combobox
                  options={productOptions}
                  value={mehsulId}
                  onChange={onSelectProduct}
                  placeholder="məhsul adı, kodu və ya barkodla axtar..."
                  searchPlaceholder="Axtar…"
                  emptyText="Məhsul tapılmadı"
                  disabled={pending}
                />
              </div>
            ) : (
              <div className="space-y-1">
                <Label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  Məhsul adı (sərbəst) *
                </Label>
                <Input
                  name="mehsul_ad"
                  required
                  minLength={2}
                  maxLength={255}
                  placeholder="Müştərinin gətirdiyi məhsul adı"
                  disabled={pending}
                  className="h-9 text-sm"
                />
              </div>
            )}

            {/* Seriya / IMEI + Satış tarixi */}
            <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  Seriya / IMEI
                </Label>
                <Input
                  name="mehsul_seri_nomresi"
                  maxLength={120}
                  placeholder="Sıra nömrəsi"
                  disabled={pending}
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  Satış tarixi
                </Label>
                <Input
                  name="satis_tarixi"
                  type="date"
                  disabled={pending}
                  className="h-9 text-sm"
                />
              </div>
            </div>

            {/* Problem */}
            <div className="space-y-1">
              <Label htmlFor="problem_tesviri" className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Problem təsviri *
              </Label>
              <textarea
                id="problem_tesviri"
                name="problem_tesviri"
                required
                minLength={5}
                rows={3}
                placeholder="Müştəri nə deyir, hansı problem var..."
                disabled={pending}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>

            {/* Daxili qeyd */}
            <div className="space-y-1">
              <Label htmlFor="daxili_qeyd" className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Daxili qeyd (yalnız işçilər)
              </Label>
              <textarea
                id="daxili_qeyd"
                name="daxili_qeyd"
                rows={2}
                placeholder="İçəri üçün qeyd"
                disabled={pending}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>

            {/* Komplektasiya — açıla bilən bölmə */}
            <div className="rounded-md border border-border/60 bg-secondary/20">
              <button
                type="button"
                onClick={() => setKomplektOpen((v) => !v)}
                disabled={pending}
                className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs font-medium hover:bg-secondary/40"
              >
                <span className="flex items-center gap-2">
                  <Package2 className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>Komplektasiya:</span>
                  <span className="font-normal text-muted-foreground">
                    {komplektOpen ? "(seçim üçün açıldı)" : komplektSummary}
                  </span>
                </span>
                {komplektOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              </button>
              {komplektOpen && (
                <div className="space-y-2 border-t border-border/40 px-3 py-2.5">
                  {/* Sürətli preset düymələri */}
                  <div className="flex flex-wrap gap-1">
                    {PRESETS.map((p) => (
                      <button
                        key={p.label}
                        type="button"
                        onClick={() => applyPreset(p.items)}
                        disabled={pending}
                        className="rounded-md border border-border bg-background px-2 py-0.5 text-[10.5px] text-muted-foreground hover:border-primary hover:text-primary"
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                  {/* Chip-li seçimlər */}
                  <div className="grid grid-cols-2 gap-1 md:grid-cols-3">
                    {KOMPLEKT_ITEMS.map((item) => {
                      const on = !!komplektItems[item];
                      return (
                        <button
                          key={item}
                          type="button"
                          onClick={() => setKomplektItems((s) => ({ ...s, [item]: !s[item] }))}
                          disabled={pending}
                          className={`rounded-md border px-2 py-1 text-[11px] transition ${
                            on
                              ? "border-primary bg-primary/15 text-primary"
                              : "border-border bg-background text-muted-foreground hover:bg-secondary"
                          }`}
                        >
                          {on ? "✓ " : ""}
                          {item}
                        </button>
                      );
                    })}
                  </div>
                  <Input
                    value={komplektNote}
                    onChange={(e) => setKomplektNote(e.target.value)}
                    placeholder="Əlavə qeyd: kabel rəngi, qutu vəziyyəti…"
                    maxLength={300}
                    disabled={pending}
                    className="h-8 text-xs"
                  />
                </div>
              )}
            </div>

            {/* Yaşıl info banner */}
            <div className="flex items-start gap-2 rounded-md border border-emerald-200/60 bg-emerald-50 px-3 py-2 text-xs dark:border-emerald-500/30 dark:bg-emerald-500/10">
              <Info className="mt-0.5 h-3.5 w-3.5 text-emerald-700 dark:text-emerald-300" />
              <div className="text-emerald-800 dark:text-emerald-200">
                <span className="font-semibold">Xidmət məbləği (xidmət gəliri):</span> buradakı &ldquo;pulsuzdadır&rdquo; deyil. Məbləğ yazılsa, otomatik satış kimi hesabata da düşəcək (servis cədvərində).
              </div>
            </div>

            {/* Müştəri məbləği + Təmir xərci */}
            <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
              <div className="space-y-1">
                <Label className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  <Wallet className="h-3 w-3" />
                  Müştəridən alınacaq məbləğ ₼
                </Label>
                <Input
                  name="musteriden_alinan"
                  type="number"
                  step="0.01"
                  min="0"
                  value={musteriMebleg}
                  onChange={(e) => setMusteriMebleg(e.target.value)}
                  placeholder="0.00 (boş = pulsuz)"
                  disabled={pending}
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  Təmir xərci (daxili) ₼
                </Label>
                <Input
                  name="temir_xerci"
                  type="number"
                  step="0.01"
                  min="0"
                  value={temirXerci}
                  onChange={(e) => setTemirXerci(e.target.value)}
                  placeholder="0.00"
                  disabled={pending}
                  className="h-9 text-sm"
                />
              </div>
            </div>

            {/* Kassa seçimi (məbləğ > 0 olduqda) */}
            {needsKassa && (
              <div className="space-y-1 rounded-md border border-rose-200/60 bg-rose-50/50 px-3 py-2 dark:border-rose-500/30 dark:bg-rose-500/5">
                <Label className="text-[10px] font-medium uppercase tracking-wider text-rose-700 dark:text-rose-300">
                  Kassa / hesab seçimi * (məbləğ buraya daxil olur)
                </Label>
                <select
                  value={hesabId}
                  onChange={(e) => setHesabId(e.target.value)}
                  disabled={pending}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                >
                  <option value="">— Kassa seçin —</option>
                  {(negdHesablar.length ? negdHesablar : hesablar).map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.ad}
                      {h.nov ? ` (${h.nov})` : ""}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Prioritet/Vəd/Texniki/Filial */}
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              <div className="space-y-1">
                <Label htmlFor="prioritet" className="text-[10px] uppercase text-muted-foreground">Prioritet</Label>
                <select
                  id="prioritet"
                  name="prioritet"
                  defaultValue="orta"
                  disabled={pending}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-xs"
                >
                  <option value="asagi">Aşağı</option>
                  <option value="orta">Orta</option>
                  <option value="yuksek">Yüksək</option>
                  <option value="tecili">Təcili</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="texmini_tehvil" className="text-[10px] uppercase text-muted-foreground">Vəd tarixi</Label>
                <Input
                  id="texmini_tehvil"
                  name="texmini_tehvil"
                  type="date"
                  disabled={pending}
                  className="h-9 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="servis_iscisi_id" className="text-[10px] uppercase text-muted-foreground">Texniki</Label>
                <select
                  id="servis_iscisi_id"
                  name="servis_iscisi_id"
                  disabled={pending}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-xs"
                >
                  <option value="">— Seç —</option>
                  {texniki.map((t) => (
                    <option key={t.id} value={String(t.id)}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="filial_id" className="text-[10px] uppercase text-muted-foreground">Filial</Label>
                <select
                  id="filial_id"
                  name="filial_id"
                  disabled={pending}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-xs"
                >
                  <option value="">— Seç —</option>
                  {filiallar.map((f) => (
                    <option key={f.id} value={String(f.id)}>{f.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Defekt kateqoriyası */}
            {defektKateq.length > 0 && (
              <div className="space-y-1">
                <Label htmlFor="defekt_kateq_id" className="text-[10px] uppercase text-muted-foreground">
                  Defekt kateqoriyası
                </Label>
                <select
                  id="defekt_kateq_id"
                  name="defekt_kateq_id"
                  defaultValue=""
                  disabled={pending}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-xs"
                >
                  <option value="">— Seç —</option>
                  {Object.entries(
                    defektKateq.reduce<Record<string, DefektOpt[]>>((acc, k) => {
                      const g = k.qrup ?? "Digər";
                      (acc[g] ||= []).push(k);
                      return acc;
                    }, {}),
                  ).map(([grup, items]) => (
                    <optgroup key={grup} label={grup}>
                      {items.map((k) => (
                        <option key={k.id} value={k.id}>
                          {k.ad}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
            )}

            {/* Zəmanət var */}
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                name="zemanet_var"
                value="true"
                disabled={pending}
                className="h-3.5 w-3.5 accent-primary"
              />
              <span>Zəmanət var (məhsul zəmanət müddətindədir)</span>
            </label>
          </div>

          <DialogFooter className="border-t border-border/40 px-5 py-3">
            <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)} disabled={pending}>
              Ləğv et
            </Button>
            <Button type="submit" size="sm" disabled={pending}>
              {pending && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
              Yarat
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
