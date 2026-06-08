"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Wand2, Sparkles } from "lucide-react";
import { DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { Combobox, type ComboOption } from "@/components/ui/combobox";
import { saveProduct } from "../actions";
import { MultiImageEditor } from "./multi-image-editor";

type CategoryOpt = { id: number; ad: string };
type BrandOpt = { id: number; ad: string };
type UnitOpt = { id: number; ad: string; qisa_ad?: string | null };

export type ProductDialogProps = {
  categories: CategoryOpt[];
  brands: BrandOpt[];
  units?: UnitOpt[];
  initial?: {
    id: string;
    ad: string;
    kod: string | null;
    barkod: string | null;
    kateqoriya_ad: string | null;
    kateqoriya_id?: number | null;
    marka_ad: string | null;
    marka_id?: number | null;
    olcu_id?: number | null;
    sekil_url?: string | null;
    qisaca_tesvir?: string | null;
    aciqlamaq?: string | null;
    alish_qiymeti: number;
    satis_qiymeti: number;
    endirimli_qiymet?: number | null;
    min_satis_qiymeti?: number;
    topdan_qiymeti?: number;
    partnyor_qiymeti?: number;
    vip_qiymeti?: number;
    komissiya_faiz?: number;
    catdirilma_xerci?: number;
    diger_xerc?: number;
    model?: string | null;
    rang?: string | null;
    istehsalci?: string | null;
    cheki_kg?: number | null;
    hecm_m3?: number | null;
    olculer?: string | null;
    qutu_say?: number | null;
    kritik_stok: number | null;
    min_stok?: number | null;
    max_stok?: number | null;
    zemanet_ay?: number;
    serial_lazim?: boolean;
    imei_lazim?: boolean;
    partiya_lazim?: boolean;
    servis_lazim?: boolean;
    bron_icaze?: boolean;
    rezerv_icaze?: boolean;
    konsiq_icaze?: boolean;
    valyuta?: string | null;
    edv_status?: string | null;
    edv_daxil?: boolean;
    yol_vergisi?: boolean;
    seo_acharlar?: string | null;
    etiketsiz?: boolean;
    aktiv?: boolean;
  };
  trigger?: "new" | "edit";
};

type BodyProps = ProductDialogProps & {
  open: boolean;
  onOpenChange: (next: boolean) => void;
};

export function ProductDialogBody({ categories, brands, units = [], initial, onOpenChange }: BodyProps) {
  const router = useRouter();
  const setOpen = onOpenChange;
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const [kateqId, setKateqId] = useState<string>(initial?.kateqoriya_id ? String(initial.kateqoriya_id) : "");
  const [markaId, setMarkaId] = useState<string>(initial?.marka_id ? String(initial.marka_id) : "");
  const [olcuId, setOlcuId] = useState<string>(initial?.olcu_id ? String(initial.olcu_id) : "");
  const [aciqlamaq, setAciqlamaq] = useState<string>(initial?.aciqlamaq ?? "");
  const [adValue, setAdValue] = useState<string>(initial?.ad ?? "");
  const [generatingImg, setGeneratingImg] = useState(false);
  const [generatingDesc, setGeneratingDesc] = useState(false);

  async function aiGenerateDescription() {
    const ad = adValue.trim();
    if (!ad) {
      toast.error("Məhsul adı boşdur");
      return;
    }
    setGeneratingDesc(true);
    try {
      const markaAd = brands.find((b) => String(b.id) === markaId)?.ad;
      const kateqAd = categories.find((c) => String(c.id) === kateqId)?.ad;
      const r = await fetch("/api/anbar/ai/generate-description", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ad, marka: markaAd, kateqoriya: kateqAd }),
      });
      const j = await r.json();
      if (!r.ok) {
        toast.error(j.error ?? "Generasiya alınmadı");
        return;
      }
      setAciqlamaq(j.text);
      if (j.is_mock) toast.info("AI mock cavabı (ANTHROPIC_API_KEY tələb olunur real generasiya üçün)");
      else toast.success("AI təsvir generasiya etdi");
    } catch {
      toast.error("Generasiya xətası");
    } finally {
      setGeneratingDesc(false);
    }
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    if (initial?.id) fd.set("id", initial.id);
    startTransition(async () => {
      const res = await saveProduct(fd);
      if (!res.ok) {
        setError(res.error);
        toast.error(res.error);
      } else {
        if (res.data?.pending_approval) {
          toast.info(res.data.message ?? "Təsdiqə göndərildi");
        } else {
          toast.success(initial ? "Yeniləndi" : "Yaradıldı");
        }
        setOpen(false);
        router.refresh();
      }
    });
  }

  return (
    <DialogContent className="md:max-w-3xl max-h-[92vh] overflow-hidden p-0 gap-0">
      {/* Modern gradient header */}
      <div
        className="relative border-b border-border/30 px-5 py-4 text-white"
        style={{ background: "var(--brand-gradient)" }}
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.16),transparent_50%)]" />
        <div className="relative z-10">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.14em] opacity-80">
            <Sparkles className="h-3 w-3" />
            {initial ? "Redaktə" : "Yeni məhsul"}
          </div>
          <DialogHeader className="mt-0.5">
            <DialogTitle className="text-lg font-bold text-white">
              {initial ? initial.ad : "Məhsul kataloquna yeni mal əlavə et"}
            </DialogTitle>
          </DialogHeader>
        </div>
      </div>

      {/* Scrollable form body */}
      <form onSubmit={onSubmit} className="flex max-h-[calc(92vh-140px)] flex-col">
        <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Əsas məlumat — birləşmiş yığcam kart */}
          <section className="rounded-lg border border-border/40 bg-card/30 p-3">
            <div className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              <span className="h-4 w-1 rounded-full bg-primary" />
              Əsas məlumat
            </div>
            {/* Sətir 1: Ad (geniş) + Kod */}
            <div className="grid grid-cols-1 gap-2.5 md:grid-cols-3">
              <div className="space-y-1 md:col-span-2">
                <Label htmlFor="ad" className="text-[11px]">Ad *</Label>
                <Input
                  id="ad"
                  name="ad"
                  required
                  maxLength={200}
                  value={adValue}
                  onChange={(e) => setAdValue(e.target.value)}
                  autoFocus
                  disabled={pending}
                  placeholder="məs. iPhone 15 Pro 256GB"
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="kod" className="text-[11px]">Kod / SKU</Label>
                <Input id="kod" name="kod" maxLength={50} defaultValue={initial?.kod ?? ""} disabled={pending} placeholder="APL-IP15P-256" className="h-9 text-sm" />
              </div>
            </div>
            {/* Sətir 2: Barkod + Kateq + Marka + Vahid */}
            <div className="mt-2.5 grid grid-cols-2 gap-2.5 md:grid-cols-4">
              <BarcodeInput defaultValue={initial?.barkod ?? ""} disabled={pending} />
              <div className="space-y-1">
                <Label className="text-[11px]">Kateqoriya</Label>
                <Combobox
                  options={categories.map<ComboOption>((c) => ({ value: String(c.id), label: c.ad }))}
                  value={kateqId}
                  onChange={setKateqId}
                  placeholder="— Seçin —"
                  searchPlaceholder="Axtar..."
                  emptyText="Tapılmadı"
                  disabled={pending}
                />
                <input type="hidden" name="kateqoriya_id" value={kateqId} />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px]">Marka</Label>
                <Combobox
                  options={brands.map<ComboOption>((b) => ({ value: String(b.id), label: b.ad }))}
                  value={markaId}
                  onChange={setMarkaId}
                  placeholder="— Seçin —"
                  searchPlaceholder="Axtar..."
                  emptyText="Tapılmadı"
                  disabled={pending}
                />
                <input type="hidden" name="marka_id" value={markaId} />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px]">Vahid</Label>
                <Combobox
                  options={units.map<ComboOption>((u) => ({ value: String(u.id), label: u.ad, hint: u.qisa_ad ?? undefined }))}
                  value={olcuId}
                  onChange={setOlcuId}
                  placeholder="— Seçin —"
                  searchPlaceholder="Axtar..."
                  emptyText="Tapılmadı"
                  disabled={pending}
                />
                <input type="hidden" name="olcu_id" value={olcuId} />
              </div>
            </div>
          </section>

          {/* Şəkillər */}
          <section className="rounded-lg border border-border/40 bg-card/30 p-3">
            <div className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              <span className="h-4 w-1 rounded-full bg-emerald-500" />
              Şəkillər (max 5)
            </div>
          <MultiImageEditor
            name="sekil_url"
            defaultValue={initial?.sekil_url ?? ""}
            label=""
            aiDisabled={!adValue.trim()}
            aiGenerating={generatingImg}
            onAiGenerate={async () => {
              const prompt = adValue.trim();
              if (!prompt) {
                toast.error("AI üçün məhsul adı tələb olunur");
                return null;
              }
              setGeneratingImg(true);
              try {
                const r = await fetch("/api/anbar/ai/generate-image", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ prompt }),
                });
                const j = await r.json();
                if (!r.ok) {
                  toast.error(j.error ?? "Generasiya alınmadı");
                  return null;
                }
                if (j.is_mock && j.notice) toast.info(j.notice);
                else toast.success("AI şəkil generasiya etdi");
                return j.url as string;
              } catch {
                toast.error("Generasiya xətası");
                return null;
              } finally {
                setGeneratingImg(false);
              }
            }}
          />
          </section>

          {/* Təsvir */}
          <section className="rounded-xl border border-border/40 bg-card/40 p-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                <span className="h-4 w-1 rounded-full bg-violet-500" />
                Təsvir / Açıqlama
              </div>
              <button
                type="button"
                onClick={aiGenerateDescription}
                disabled={pending || generatingDesc || !adValue.trim()}
                className="inline-flex h-7 items-center gap-1 rounded-md border border-primary/30 bg-primary/10 px-2.5 text-[11px] font-semibold text-primary hover:bg-primary/20 disabled:opacity-40"
                title="AI ilə avto doldur"
              >
                {generatingDesc ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wand2 className="h-3 w-3" />}
                AI ilə doldur
              </button>
            </div>
            <textarea
              id="aciqlamaq"
              name="aciqlamaq"
              rows={3}
              maxLength={5000}
              value={aciqlamaq}
              onChange={(e) => setAciqlamaq(e.target.value)}
              placeholder="Texniki xüsusiyyətlər, xüsusi qeydlər..."
              className="flex w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              disabled={pending}
            />
            <div className="mt-3 space-y-1.5">
              <Label htmlFor="qisaca_tesvir" className="text-[11px] text-muted-foreground">Qısaca təsvir (kart üzərində görünür)</Label>
              <Input
                id="qisaca_tesvir"
                name="qisaca_tesvir"
                maxLength={500}
                defaultValue={initial?.qisaca_tesvir ?? ""}
                placeholder="2-3 söz ilə qısa məhsul izahı"
                disabled={pending}
              />
            </div>
          </section>

          {/* Qiymət */}
          <section className="rounded-lg border border-border/40 bg-card/30 p-3">
            <div className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              <span className="h-4 w-1 rounded-full bg-amber-500" />
              Qiymət
            </div>
            <PricingBlock initial={initial} pending={pending} isNew={!initial?.id} />
          </section>

          {/* Texniki xüsusiyyətlər */}
          <Section title="Texniki xüsusiyyətlər" defaultOpen={!!(initial?.model || initial?.rang || initial?.istehsalci || initial?.cheki_kg)}>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="space-y-1">
                <Label htmlFor="model">Model</Label>
                <Input id="model" name="model" maxLength={100} defaultValue={initial?.model ?? ""} placeholder="məs. iPhone 15 Pro" disabled={pending} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="rang">Rəng</Label>
                <Input id="rang" name="rang" maxLength={50} defaultValue={initial?.rang ?? ""} placeholder="məs. Qara" disabled={pending} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="istehsalci">İstehsalçı</Label>
                <Input id="istehsalci" name="istehsalci" maxLength={150} defaultValue={initial?.istehsalci ?? ""} placeholder="Apple Inc" disabled={pending} />
              </div>
              <FieldNumber name="cheki_kg" label="Çəki (kq)" defaultValue={initial?.cheki_kg ?? 0} disabled={pending} />
              <FieldNumber name="hecm_m3" label="Həcm (m³)" defaultValue={initial?.hecm_m3 ?? 0} disabled={pending} />
              <div className="space-y-1">
                <Label htmlFor="olculer">Ölçülər (UxBxH)</Label>
                <Input id="olculer" name="olculer" maxLength={60} defaultValue={initial?.olculer ?? ""} placeholder="məs. 15×8×0.8 sm" disabled={pending} />
              </div>
              <FieldNumber name="qutu_say" label="Qutu say (bir paketdə)" defaultValue={initial?.qutu_say ?? 0} disabled={pending} />
            </div>
          </Section>

          {/* Stok limitləri */}
          <Section title="Stok limitləri" defaultOpen={!!(initial?.kritik_stok || initial?.min_stok || initial?.max_stok)}>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <FieldNumber name="kritik_stok" label="Kritik stok (xəbərdarlıq)" defaultValue={initial?.kritik_stok ?? 0} disabled={pending} />
              <FieldNumber name="min_stok" label="Min stok" defaultValue={initial?.min_stok ?? 0} disabled={pending} />
              <FieldNumber name="max_stok" label="Max stok" defaultValue={initial?.max_stok ?? 0} disabled={pending} />
            </div>
          </Section>

          {/* Zəmanət və izləmə */}
          <Section title="Zəmanət və izləmə" defaultOpen={!!(initial?.zemanet_ay || initial?.serial_lazim || initial?.imei_lazim)}>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <FieldNumber name="zemanet_ay" label="Zəmanət (ay)" defaultValue={initial?.zemanet_ay ?? 0} disabled={pending} />
              <Checkbox name="serial_lazim" label="Serial nömrə lazımdır" defaultChecked={initial?.serial_lazim} disabled={pending} />
              <Checkbox name="imei_lazim" label="IMEI lazımdır" defaultChecked={initial?.imei_lazim} disabled={pending} />
              <Checkbox name="partiya_lazim" label="Partiya nömrəsi lazımdır" defaultChecked={initial?.partiya_lazim} disabled={pending} />
              <Checkbox name="servis_lazim" label="Servis qeydi lazımdır" defaultChecked={initial?.servis_lazim} disabled={pending} />
            </div>
          </Section>

          {/* İcazələr */}
          <Section title="İcazələr" defaultOpen={false}>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <Checkbox name="bron_icaze" label="Bron qoymaq olar" defaultChecked={initial?.bron_icaze ?? true} disabled={pending} />
              <Checkbox name="rezerv_icaze" label="Rezervə qoymaq olar" defaultChecked={initial?.rezerv_icaze ?? true} disabled={pending} />
              <Checkbox name="konsiq_icaze" label="Konsiqnasiya verilə bilər" defaultChecked={initial?.konsiq_icaze} disabled={pending} />
            </div>
          </Section>

          {/* Vergi / valyuta */}
          <Section title="Vergi və valyuta" defaultOpen={false}>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="space-y-1">
                <Label htmlFor="valyuta">Valyuta</Label>
                <select id="valyuta" name="valyuta" defaultValue={initial?.valyuta ?? "AZN"} className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm" disabled={pending}>
                  <option value="AZN">AZN (₼)</option>
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="RUB">RUB (₽)</option>
                  <option value="TRY">TRY (₺)</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="edv_status">ƏDV statusu</Label>
                <select id="edv_status" name="edv_status" defaultValue={initial?.edv_status ?? "edv_var"} className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm" disabled={pending}>
                  <option value="edv_var">ƏDV var (18%)</option>
                  <option value="edv_yox">ƏDV yoxdur</option>
                  <option value="edv_azad">ƏDV-dən azad</option>
                </select>
              </div>
              <div className="flex items-end pb-1.5 gap-3">
                <Checkbox name="edv_daxil" label="Qiymət ƏDV daxil" defaultChecked={initial?.edv_daxil} disabled={pending} />
              </div>
              <Checkbox name="yol_vergisi" label="Yol vergisinə tabe" defaultChecked={initial?.yol_vergisi} disabled={pending} />
            </div>
          </Section>

          {/* SEO / Marketing */}
          <Section title="SEO / Marketing" defaultOpen={false}>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="seo_acharlar">SEO açar sözlər</Label>
                <Input id="seo_acharlar" name="seo_acharlar" maxLength={500} defaultValue={initial?.seo_acharlar ?? ""} placeholder="vergüllə ayrılmış: telefon, iphone, smartphone" disabled={pending} />
              </div>
              <Checkbox name="etiketsiz" label="Etiketsiz məhsul (yalnız POS, vitrində yox)" defaultChecked={initial?.etiketsiz} disabled={pending} />
            </div>
          </Section>

          {/* Status — kompakt */}
          <section className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-2.5">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                name="aktiv"
                value="true"
                defaultChecked={initial?.aktiv ?? true}
                className="h-4 w-4 accent-emerald-600"
                disabled={pending}
              />
              <div className="flex flex-1 items-center gap-2">
                <div className="text-xs font-semibold">Aktivdir</div>
                <span className="text-[10px] text-muted-foreground">
                  · POS-da və satışda görünür
                </span>
              </div>
            </label>
          </section>
        </div>

        {/* Sticky footer */}
        <div className="border-t border-border/40 bg-card/95 px-5 py-3 backdrop-blur">
          <DialogFooter className="gap-2 sm:gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
              İmtina
            </Button>
            <Button
              type="submit"
              disabled={pending}
              className="font-semibold text-white"
              style={{ background: "var(--brand-gradient)" }}
            >
              {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {initial ? "Yenilə" : "Məhsul yarat"}
            </Button>
          </DialogFooter>
        </div>
      </form>
    </DialogContent>
  );
}

function BarcodeInput({ defaultValue, disabled }: { defaultValue?: string; disabled?: boolean }) {
  const [value, setValue] = useState(defaultValue ?? "");
  function generate() {
    // EAN-13 valid: 12 random digits + check digit
    const base = Array.from({ length: 12 }, () => Math.floor(Math.random() * 10)).join("");
    let sum = 0;
    for (let i = 0; i < 12; i++) sum += Number(base[i]) * (i % 2 === 0 ? 1 : 3);
    const check = (10 - (sum % 10)) % 10;
    setValue(base + check);
  }
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label htmlFor="barkod">Barkod</Label>
        <button
          type="button"
          onClick={generate}
          disabled={disabled}
          className="text-[10.5px] font-semibold text-primary hover:underline disabled:opacity-50"
        >
          ↻ Avto yarat
        </button>
      </div>
      <Input
        id="barkod"
        name="barkod"
        maxLength={100}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="məs. 4768888197392"
        disabled={disabled}
      />
    </div>
  );
}

function FieldNumber({
  name,
  label,
  required,
  defaultValue,
  disabled,
}: {
  name: string;
  label: string;
  required?: boolean;
  defaultValue?: number | null;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name} className="text-xs">
        {label}
      </Label>
      <Input
        id={name}
        name={name}
        type="number"
        min={0}
        step="0.01"
        defaultValue={defaultValue ?? 0}
        required={required}
        disabled={disabled}
        className="h-9"
      />
    </div>
  );
}

function Section({
  title,
  defaultOpen,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details open={defaultOpen} className="group rounded-xl border border-border/40 bg-card/40 transition-colors hover:border-border/70">
      <summary className="flex cursor-pointer select-none items-center gap-2 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground hover:text-foreground">
        <span className="h-4 w-1 rounded-full bg-slate-400 group-open:bg-primary transition-colors" />
        <span className="flex-1">{title}</span>
        <span className="text-[10px] transition-transform group-open:rotate-180">▼</span>
      </summary>
      <div className="border-t border-border/30 p-4">
        {children}
      </div>
    </details>
  );
}

function Checkbox({
  name,
  label,
  defaultChecked,
  disabled,
}: {
  name: string;
  label: string;
  defaultChecked?: boolean;
  disabled?: boolean;
}) {
  return (
    <label className="inline-flex items-center gap-2 py-1.5 text-sm">
      <input
        type="checkbox"
        name={name}
        value="true"
        defaultChecked={defaultChecked ?? false}
        disabled={disabled}
        className="h-4 w-4 accent-primary"
      />
      {label}
    </label>
  );
}

/**
 * Qiymət bloku — yeni məhsulda maya gizlədilir (alış qaiməsi ilə formalaşır).
 * Pərakəndə satış qiymətindən digər qiymət növləri avtomatik təklif olunur.
 * Default faizlər: Topdan -25%, Partnyor (diler) -30%, VIP -10%.
 */
function PricingBlock({
  initial,
  pending,
  isNew,
}: {
  initial?: ProductDialogProps["initial"];
  pending: boolean;
  isNew: boolean;
}) {
  const [satis, setSatis] = useState<number>(initial?.satis_qiymeti ?? 0);
  const [endirimli, setEndirimli] = useState<number>(initial?.endirimli_qiymet ?? 0);
  const [minSatis, setMinSatis] = useState<number>(initial?.min_satis_qiymeti ?? 0);
  const [topdan, setTopdan] = useState<number>(initial?.topdan_qiymeti ?? 0);
  const [partnyor, setPartnyor] = useState<number>(initial?.partnyor_qiymeti ?? 0);
  const [vip, setVip] = useState<number>(initial?.vip_qiymeti ?? 0);
  const [alish, setAlish] = useState<number>(initial?.alish_qiymeti ?? 0);

  const [suggesting, setSuggesting] = useState(false);
  async function autoSuggest() {
    if (!(satis > 0)) {
      toast.error("Əvvəlcə pərakəndə satış qiymətini daxil edin");
      return;
    }
    setSuggesting(true);
    try {
      // Ayarlar > Qiymət siyasətindəki qaydaları yüklə
      const { getActivePriceRules } = await import("../price-suggestion-action");
      const { applyPriceRule } = await import("../price-suggestion-utils");
      const { rules, isDefault } = await getActivePriceRules();
      // Ad uyğunluğuna görə qaydanı tap (Azərbaycan dili insensitiv)
      const findRule = (...names: string[]) => {
        const lower = names.map((n) => n.toLowerCase());
        return rules.find((r) => lower.some((n) => r.ad.toLowerCase().includes(n)));
      };
      const topdanRule = findRule("topdan");
      const dilerRule = findRule("diler", "partnyor");
      const vipRule = findRule("vip");
      const minRule = findRule("min");

      if (topdanRule) setTopdan(applyPriceRule(satis, topdanRule));
      else setTopdan(Math.round(satis * 0.75 * 100) / 100);

      if (dilerRule) setPartnyor(applyPriceRule(satis, dilerRule));
      else setPartnyor(Math.round(satis * 0.70 * 100) / 100);

      if (vipRule) setVip(applyPriceRule(satis, vipRule));
      else setVip(Math.round(satis * 0.90 * 100) / 100);

      if (!minSatis || minSatis === 0) {
        if (minRule) setMinSatis(applyPriceRule(satis, minRule));
        else setMinSatis(Math.round(satis * 0.65 * 100) / 100);
      }
      toast.success(
        isDefault
          ? "Sistem default faizləri tətbiq edildi (Ayarlar > Qiymət siyasətində dəyişə bilərsiniz)"
          : "Ayarlardakı qiymət qaydaları tətbiq edildi",
      );
    } catch (e) {
      console.error("[autoSuggest]", e);
      // Fallback hardcoded
      setTopdan(Math.round(satis * 0.75 * 100) / 100);
      setPartnyor(Math.round(satis * 0.70 * 100) / 100);
      setVip(Math.round(satis * 0.90 * 100) / 100);
      if (!minSatis || minSatis === 0) {
        setMinSatis(Math.round(satis * 0.65 * 100) / 100);
      }
      toast.success("Qiymətlər avtomatik təklif edildi");
    } finally {
      setSuggesting(false);
    }
  }

  const r = (n: number) => Number.isFinite(n) ? n : 0;

  return (
    <div className="rounded-md border border-border bg-secondary/30 p-3">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Qiymətlər (AZN)
        </div>
        <button
          type="button"
          onClick={autoSuggest}
          disabled={pending || suggesting || !(satis > 0)}
          className="inline-flex h-7 items-center gap-1 rounded-lg bg-gradient-to-b from-primary/20 to-primary/10 px-2.5 text-[10.5px] font-semibold text-primary ring-1 ring-inset ring-primary/30 shadow-sm transition-all duration-200 hover:from-primary/30 hover:to-primary/20 hover:-translate-y-px disabled:opacity-50"
          title="Ayarlar > Qiymət siyasətinə görə digər qiymətləri hesabla"
        >
          {suggesting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
          Avtomatik təklif
        </button>
      </div>
      {isNew && (
        <div className="mb-3 rounded-md border border-info/20 bg-info/5 px-3 py-1.5 text-[11px] text-muted-foreground">
          <span className="font-semibold text-foreground">Maya (alış qiyməti)</span> — yeni məhsulda
          məcburi deyil. Maya alış qaiməsi ilə formalaşır. Lazım olsa məhsul detalında, ya da alış
          əməliyyatında dəqiqləşdiriləcək.
        </div>
      )}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {!isNew && (
          <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground">Maya (son alış qiyməti)</Label>
            <div className="flex h-9 items-center gap-2 rounded-md border border-input bg-muted/40 px-3 text-sm">
              <span className="font-semibold tabular-nums">
                {alish > 0 ? alish.toFixed(2) : "—"} ₼
              </span>
              <span className="text-[10px] text-muted-foreground">read-only</span>
            </div>
            <p className="text-[10px] text-muted-foreground leading-tight">
              Alış qaiməsi ilə avtomatik yenilənir.
            </p>
            {/* Maya forma submit-ində mövcud dəyər kimi göndərilir (manual dəyişdirilməz) */}
            <input type="hidden" name="alish_qiymeti" value={r(alish)} />
          </div>
        )}
        {isNew && <input type="hidden" name="alish_qiymeti" value={r(alish)} />}
        <NumberInput
          name="satis_qiymeti"
          label="Pərakəndə satış *"
          value={satis}
          onChange={setSatis}
          disabled={pending}
          required
        />
        <NumberInput
          name="endirimli_qiymet"
          label="Endirimli qiymət"
          value={endirimli}
          onChange={setEndirimli}
          disabled={pending}
        />
        <NumberInput
          name="min_satis_qiymeti"
          label="Minimum satış"
          value={minSatis}
          onChange={setMinSatis}
          disabled={pending}
        />
        <NumberInput
          name="topdan_qiymeti"
          label="Topdan"
          value={topdan}
          onChange={setTopdan}
          disabled={pending}
        />
        <NumberInput
          name="partnyor_qiymeti"
          label="Diler / Partnyor"
          value={partnyor}
          onChange={setPartnyor}
          disabled={pending}
        />
        <NumberInput
          name="vip_qiymeti"
          label="VIP"
          value={vip}
          onChange={setVip}
          disabled={pending}
        />
        <FieldNumber name="komissiya_faiz" label="Komissiya %" defaultValue={initial?.komissiya_faiz ?? 0} disabled={pending} />
        <FieldNumber name="catdirilma_xerci" label="Çatdırılma xərci" defaultValue={initial?.catdirilma_xerci ?? 0} disabled={pending} />
        <FieldNumber name="diger_xerc" label="Digər xərc" defaultValue={initial?.diger_xerc ?? 0} disabled={pending} />
      </div>
    </div>
  );
}

function NumberInput({
  name,
  label,
  value,
  onChange,
  disabled,
  required,
}: {
  name: string;
  label: string;
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
  required?: boolean;
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={name}>{label}</Label>
      <Input
        id={name}
        name={name}
        type="number"
        step="0.01"
        min="0"
        value={Number.isFinite(value) ? value : 0}
        onChange={(e) => onChange(Number(e.target.value))}
        disabled={disabled}
        required={required}
      />
    </div>
  );
}
