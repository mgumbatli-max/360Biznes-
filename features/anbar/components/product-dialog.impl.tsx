"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Upload, Sparkles, Wand2 } from "lucide-react";
import { DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { Combobox, type ComboOption } from "@/components/ui/combobox";
import { saveProduct } from "../actions";

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
  const [sekilUrl, setSekilUrl] = useState<string>(initial?.sekil_url ?? "");
  const [aciqlamaq, setAciqlamaq] = useState<string>(initial?.aciqlamaq ?? "");
  const [adValue, setAdValue] = useState<string>(initial?.ad ?? "");
  const [uploadingImg, setUploadingImg] = useState(false);
  const [generatingImg, setGeneratingImg] = useState(false);
  const [generatingDesc, setGeneratingDesc] = useState(false);

  async function uploadFile(file: File) {
    setUploadingImg(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await fetch("/api/anbar/upload-image", { method: "POST", body: fd });
      const j = await r.json();
      if (!r.ok) {
        toast.error(j.error ?? "Yükləmə alınmadı");
        return;
      }
      setSekilUrl(j.url);
      toast.success("Fayl yükləndi");
    } catch {
      toast.error("Yükləmə xətası");
    } finally {
      setUploadingImg(false);
    }
  }

  async function aiGenerateImage() {
    const prompt = adValue.trim();
    if (!prompt) {
      toast.error("AI üçün məhsul adı tələb olunur");
      return;
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
        return;
      }
      setSekilUrl(j.url);
      if (j.is_mock && j.notice) toast.info(j.notice);
      else toast.success("AI şəkil generasiya etdi");
    } catch {
      toast.error("Generasiya xətası");
    } finally {
      setGeneratingImg(false);
    }
  }

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
    <DialogContent className="md:max-w-2xl max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>{initial ? "Məhsulu redaktə et" : "Yeni məhsul"}</DialogTitle>
      </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="ad">Ad *</Label>
              <Input
                id="ad"
                name="ad"
                required
                maxLength={200}
                value={adValue}
                onChange={(e) => setAdValue(e.target.value)}
                autoFocus
                disabled={pending}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="kod">Kod</Label>
              <Input id="kod" name="kod" maxLength={50} defaultValue={initial?.kod ?? ""} disabled={pending} />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <BarcodeInput defaultValue={initial?.barkod ?? ""} disabled={pending} />
            <div className="space-y-2">
              <Label>Kateqoriya</Label>
              <Combobox
                options={categories.map<ComboOption>((c) => ({ value: String(c.id), label: c.ad }))}
                value={kateqId}
                onChange={setKateqId}
                placeholder="— Seçin —"
                searchPlaceholder="🔍 Kateqoriya axtar..."
                emptyText="Kateqoriya tapılmadı"
                disabled={pending}
              />
              <input type="hidden" name="kateqoriya_id" value={kateqId} />
            </div>
            <div className="space-y-2">
              <Label>Marka</Label>
              <Combobox
                options={brands.map<ComboOption>((b) => ({ value: String(b.id), label: b.ad }))}
                value={markaId}
                onChange={setMarkaId}
                placeholder="— Seçin —"
                searchPlaceholder="🔍 Marka axtar..."
                emptyText="Marka tapılmadı"
                disabled={pending}
              />
              <input type="hidden" name="marka_id" value={markaId} />
            </div>
            <div className="space-y-2">
              <Label>Ölçü vahidi</Label>
              <Combobox
                options={units.map<ComboOption>((u) => ({ value: String(u.id), label: u.ad, hint: u.qisa_ad ?? undefined }))}
                value={olcuId}
                onChange={setOlcuId}
                placeholder="— Seçin —"
                searchPlaceholder="🔍 Vahid axtar..."
                emptyText="Vahid tapılmadı"
                disabled={pending}
              />
              <input type="hidden" name="olcu_id" value={olcuId} />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-[120px_1fr]">
            {/* Image preview + actions */}
            <div className="space-y-2">
              <Label>Şəkil</Label>
              <div className="relative h-24 w-full overflow-hidden rounded-md border border-border bg-secondary/30">
                {sekilUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img loading="lazy" decoding="async" src={sekilUrl} alt="" className="h-full w-full object-cover" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                ) : (
                  <div className="grid h-full w-full place-items-center text-muted-foreground text-[10px]">yoxdur</div>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="sekil_url">
                Şəkil URL{" "}
                <span className="text-[10px] font-normal text-muted-foreground">
                  · çoxlu üçün <code className="rounded bg-secondary px-1 font-mono">|</code> ilə ayır
                </span>
              </Label>
              <Input
                id="sekil_url"
                value={sekilUrl}
                onChange={(e) => setSekilUrl(e.target.value)}
                placeholder="https://...jpg | https://...jpg | https://...jpg"
                disabled={pending}
              />
              <input type="hidden" name="sekil_url" value={sekilUrl} />
              {sekilUrl.includes("|") && (
                <p className="text-[10.5px] text-emerald-600">
                  ✓ {sekilUrl.split("|").filter((s) => s.trim()).length} şəkil tapıldı — ilk şəkil əsas
                </p>
              )}
              <div className="flex flex-wrap gap-1.5">
                <label className="inline-flex h-7 items-center gap-1 rounded-md border border-border bg-secondary/40 px-2.5 text-[11px] font-semibold cursor-pointer hover:bg-secondary">
                  {uploadingImg ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                  Kompüterdən yüklə
                  <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) uploadFile(f);
                    e.currentTarget.value = "";
                  }} disabled={pending || uploadingImg} />
                </label>
                <button
                  type="button"
                  onClick={aiGenerateImage}
                  disabled={pending || generatingImg || !adValue.trim()}
                  className="inline-flex h-7 items-center gap-1 rounded-md border border-primary/30 bg-primary/10 px-2.5 text-[11px] font-semibold text-primary-light hover:bg-primary/20 disabled:opacity-40"
                >
                  {generatingImg ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                  AI generasiya
                </button>
                {sekilUrl && (
                  <button
                    type="button"
                    onClick={() => setSekilUrl("")}
                    disabled={pending}
                    className="inline-flex h-7 items-center gap-1 rounded-md border border-border px-2.5 text-[11px] text-muted-foreground hover:text-danger"
                  >
                    Sil
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="aciqlamaq">Təsvir / Açıqlama</Label>
              <button
                type="button"
                onClick={aiGenerateDescription}
                disabled={pending || generatingDesc || !adValue.trim()}
                className="inline-flex h-7 items-center gap-1 rounded-md border border-primary/30 bg-primary/10 px-2.5 text-[11px] font-semibold text-primary-light hover:bg-primary/20 disabled:opacity-40"
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
              placeholder="Texniki xüsusiyyətlər, xüsusi qeydlər... və ya yuxarıdakı 'AI ilə doldur' düyməsi ilə avto generasiya"
              className="flex w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              disabled={pending}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="qisaca_tesvir">Qısaca təsvir (kart üzərində)</Label>
            <Input
              id="qisaca_tesvir"
              name="qisaca_tesvir"
              maxLength={500}
              defaultValue={initial?.qisaca_tesvir ?? ""}
              placeholder="2-3 söz ilə qısa məhsul izahı"
              disabled={pending}
            />
          </div>

          <div className="rounded-md border border-border bg-secondary/30 p-3">
            <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Qiymətlər (AZN)
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              <FieldNumber name="alish_qiymeti" label="Maya (alış)" defaultValue={initial?.alish_qiymeti} disabled={pending} />
              <FieldNumber name="satis_qiymeti" label="Pərakəndə satış *" required defaultValue={initial?.satis_qiymeti} disabled={pending} />
              <FieldNumber name="endirimli_qiymet" label="Endirimli qiymət" defaultValue={initial?.endirimli_qiymet ?? 0} disabled={pending} />
              <FieldNumber name="min_satis_qiymeti" label="Minimum satış" defaultValue={initial?.min_satis_qiymeti ?? 0} disabled={pending} />
              <FieldNumber name="topdan_qiymeti" label="Topdan" defaultValue={initial?.topdan_qiymeti ?? 0} disabled={pending} />
              <FieldNumber name="partnyor_qiymeti" label="Partnyor" defaultValue={initial?.partnyor_qiymeti ?? 0} disabled={pending} />
              <FieldNumber name="vip_qiymeti" label="VIP" defaultValue={initial?.vip_qiymeti ?? 0} disabled={pending} />
              <FieldNumber name="komissiya_faiz" label="Komissiya %" defaultValue={initial?.komissiya_faiz ?? 0} disabled={pending} />
              <FieldNumber name="catdirilma_xerci" label="Çatdırılma xərci" defaultValue={initial?.catdirilma_xerci ?? 0} disabled={pending} />
              <FieldNumber name="diger_xerc" label="Digər xərc" defaultValue={initial?.diger_xerc ?? 0} disabled={pending} />
            </div>
          </div>

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

          <div className="flex items-end pb-2">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="aktiv" value="true" defaultChecked={initial?.aktiv ?? true} className="h-4 w-4 accent-primary" disabled={pending} />
              Aktivdir (POS və satışda görünür)
            </label>
          </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
            İmtina
          </Button>
          <Button type="submit" disabled={pending}>
            {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {initial ? "Yenilə" : "Yarat"}
          </Button>
        </DialogFooter>
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
    <details open={defaultOpen} className="rounded-md border border-border bg-secondary/20">
      <summary className="cursor-pointer select-none px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:bg-secondary/40">
        {title}
      </summary>
      <div className="border-t border-border/40 p-3">
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
