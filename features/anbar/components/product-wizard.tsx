"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Loader2,
  Upload,
  Sparkles,
  Wand2,
  Check,
  ChevronLeft,
  ChevronRight,
  Package,
  Image as ImageIcon,
  DollarSign,
  Boxes,
  Settings2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Combobox, type ComboOption } from "@/components/ui/combobox";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { saveProduct } from "../actions";

type CategoryOpt = { id: number; ad: string };
type BrandOpt = { id: number; ad: string };
type UnitOpt = { id: number; ad: string; qisa_ad?: string | null };

type Props = {
  categories: CategoryOpt[];
  brands: BrandOpt[];
  units?: UnitOpt[];
};

type WizardStep = 1 | 2 | 3 | 4 | 5;

const STEPS: Array<{
  id: WizardStep;
  title: string;
  hint: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 1, title: "Əsas", hint: "Ad, kod, kateqoriya", icon: Package },
  { id: 2, title: "Şəkil", hint: "Foto və təsvir", icon: ImageIcon },
  { id: 3, title: "Qiymət", hint: "Maya və satış", icon: DollarSign },
  { id: 4, title: "Stok", hint: "Limit və texniki", icon: Boxes },
  { id: 5, title: "Əlavə", hint: "Vergi, SEO, icazə", icon: Settings2 },
];

type FormState = {
  // Step 1: Əsas
  ad: string;
  kod: string;
  barkod: string;
  kateqoriya_id: string;
  marka_id: string;
  olcu_id: string;

  // Step 2: Şəkil
  sekil_url: string;
  qisaca_tesvir: string;
  aciqlamaq: string;

  // Step 3: Qiymət
  alish_qiymeti: string;
  satis_qiymeti: string;
  endirimli_qiymet: string;
  min_satis_qiymeti: string;
  topdan_qiymeti: string;
  partnyor_qiymeti: string;
  vip_qiymeti: string;
  komissiya_faiz: string;
  catdirilma_xerci: string;
  diger_xerc: string;

  // Step 4: Stok + Texniki
  kritik_stok: string;
  min_stok: string;
  max_stok: string;
  model: string;
  rang: string;
  istehsalci: string;
  cheki_kg: string;
  hecm_m3: string;
  olculer: string;
  qutu_say: string;

  // Step 5: Əlavə
  zemanet_ay: string;
  serial_lazim: boolean;
  imei_lazim: boolean;
  partiya_lazim: boolean;
  servis_lazim: boolean;
  bron_icaze: boolean;
  rezerv_icaze: boolean;
  konsiq_icaze: boolean;
  valyuta: string;
  edv_status: string;
  edv_daxil: boolean;
  yol_vergisi: boolean;
  seo_acharlar: string;
  etiketsiz: boolean;
  aktiv: boolean;
};

const INITIAL_STATE: FormState = {
  ad: "",
  kod: "",
  barkod: "",
  kateqoriya_id: "",
  marka_id: "",
  olcu_id: "",
  sekil_url: "",
  qisaca_tesvir: "",
  aciqlamaq: "",
  alish_qiymeti: "0",
  satis_qiymeti: "",
  endirimli_qiymet: "0",
  min_satis_qiymeti: "0",
  topdan_qiymeti: "0",
  partnyor_qiymeti: "0",
  vip_qiymeti: "0",
  komissiya_faiz: "0",
  catdirilma_xerci: "0",
  diger_xerc: "0",
  kritik_stok: "0",
  min_stok: "0",
  max_stok: "0",
  model: "",
  rang: "",
  istehsalci: "",
  cheki_kg: "0",
  hecm_m3: "0",
  olculer: "",
  qutu_say: "0",
  zemanet_ay: "0",
  serial_lazim: false,
  imei_lazim: false,
  partiya_lazim: false,
  servis_lazim: false,
  bron_icaze: true,
  rezerv_icaze: true,
  konsiq_icaze: false,
  valyuta: "AZN",
  edv_status: "edv_var",
  edv_daxil: false,
  yol_vergisi: false,
  seo_acharlar: "",
  etiketsiz: false,
  aktiv: true,
};

export function ProductWizard({ categories, brands, units = [] }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<WizardStep>(1);
  const [data, setData] = useState<FormState>(INITIAL_STATE);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [uploadingImg, setUploadingImg] = useState(false);
  const [generatingImg, setGeneratingImg] = useState(false);
  const [generatingDesc, setGeneratingDesc] = useState(false);

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setData((prev) => ({ ...prev, [key]: value }));
  }

  function resetWizard() {
    setData(INITIAL_STATE);
    setStep(1);
    setError(null);
  }

  function handleOpenChange(o: boolean) {
    setOpen(o);
    if (!o) {
      // Yalnız dialog tam bağlananda sıfırla
      setTimeout(resetWizard, 200);
    }
  }

  // ===== Step validation =====
  function canProceed(): { ok: boolean; reason?: string } {
    if (step === 1) {
      if (!data.ad.trim() || data.ad.trim().length < 2) {
        return { ok: false, reason: "Məhsul adı ən az 2 simvol olmalıdır" };
      }
    }
    if (step === 3) {
      const satis = Number(data.satis_qiymeti);
      if (!data.satis_qiymeti || Number.isNaN(satis) || satis < 0) {
        return { ok: false, reason: "Pərakəndə satış qiyməti tələb olunur" };
      }
    }
    return { ok: true };
  }

  function handleNext() {
    const v = canProceed();
    if (!v.ok) {
      toast.error(v.reason ?? "Səhv");
      return;
    }
    setError(null);
    if (step < 5) setStep((s) => (s + 1) as WizardStep);
  }

  function handlePrev() {
    if (step > 1) setStep((s) => (s - 1) as WizardStep);
  }

  function handleStepClick(target: WizardStep) {
    if (target <= step) {
      setStep(target);
      return;
    }
    // İrəli atlamaq: yalnız əsas validation keçərsə
    if (!data.ad.trim()) {
      toast.error("Əvvəlcə məhsul adını daxil edin");
      return;
    }
    setStep(target);
  }

  // ===== Submit =====
  function buildFormData(): FormData {
    const fd = new FormData();
    fd.set("ad", data.ad);
    fd.set("kod", data.kod);
    fd.set("barkod", data.barkod);
    if (data.kateqoriya_id) fd.set("kateqoriya_id", data.kateqoriya_id);
    if (data.marka_id) fd.set("marka_id", data.marka_id);
    if (data.olcu_id) fd.set("olcu_id", data.olcu_id);
    fd.set("sekil_url", data.sekil_url);
    fd.set("qisaca_tesvir", data.qisaca_tesvir);
    fd.set("aciqlamaq", data.aciqlamaq);
    fd.set("alish_qiymeti", data.alish_qiymeti);
    fd.set("satis_qiymeti", data.satis_qiymeti);
    fd.set("endirimli_qiymet", data.endirimli_qiymet);
    fd.set("min_satis_qiymeti", data.min_satis_qiymeti);
    fd.set("topdan_qiymeti", data.topdan_qiymeti);
    fd.set("partnyor_qiymeti", data.partnyor_qiymeti);
    fd.set("vip_qiymeti", data.vip_qiymeti);
    fd.set("komissiya_faiz", data.komissiya_faiz);
    fd.set("catdirilma_xerci", data.catdirilma_xerci);
    fd.set("diger_xerc", data.diger_xerc);
    fd.set("kritik_stok", data.kritik_stok);
    fd.set("min_stok", data.min_stok);
    fd.set("max_stok", data.max_stok);
    fd.set("model", data.model);
    fd.set("rang", data.rang);
    fd.set("istehsalci", data.istehsalci);
    fd.set("cheki_kg", data.cheki_kg);
    fd.set("hecm_m3", data.hecm_m3);
    fd.set("olculer", data.olculer);
    fd.set("qutu_say", data.qutu_say);
    fd.set("zemanet_ay", data.zemanet_ay);
    if (data.serial_lazim) fd.set("serial_lazim", "true");
    if (data.imei_lazim) fd.set("imei_lazim", "true");
    if (data.partiya_lazim) fd.set("partiya_lazim", "true");
    if (data.servis_lazim) fd.set("servis_lazim", "true");
    if (data.bron_icaze) fd.set("bron_icaze", "true");
    if (data.rezerv_icaze) fd.set("rezerv_icaze", "true");
    if (data.konsiq_icaze) fd.set("konsiq_icaze", "true");
    fd.set("valyuta", data.valyuta);
    fd.set("edv_status", data.edv_status);
    if (data.edv_daxil) fd.set("edv_daxil", "true");
    if (data.yol_vergisi) fd.set("yol_vergisi", "true");
    fd.set("seo_acharlar", data.seo_acharlar);
    if (data.etiketsiz) fd.set("etiketsiz", "true");
    if (data.aktiv) fd.set("aktiv", "true");
    return fd;
  }

  function handleSubmit() {
    const v = canProceed();
    if (!v.ok) {
      toast.error(v.reason ?? "Səhv");
      return;
    }
    setError(null);
    const fd = buildFormData();
    startTransition(async () => {
      const res = await saveProduct(fd);
      if (!res.ok) {
        setError(res.error);
        toast.error(res.error);
      } else {
        if (res.data?.pending_approval) {
          toast.info(res.data.message ?? "Məhsul təsdiqə göndərildi");
        } else {
          toast.success("Məhsul yaradıldı");
        }
        handleOpenChange(false);
        router.refresh();
      }
    });
  }

  // ===== Image helpers =====
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
      setField("sekil_url", j.url);
      toast.success("Fayl yükləndi");
    } catch {
      toast.error("Yükləmə xətası");
    } finally {
      setUploadingImg(false);
    }
  }

  async function aiGenerateImage() {
    const prompt = data.ad.trim();
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
      setField("sekil_url", j.url);
      if (j.is_mock && j.notice) toast.info(j.notice);
      else toast.success("AI şəkil generasiya etdi");
    } catch {
      toast.error("Generasiya xətası");
    } finally {
      setGeneratingImg(false);
    }
  }

  async function aiGenerateDescription() {
    const ad = data.ad.trim();
    if (!ad) {
      toast.error("Məhsul adı boşdur");
      return;
    }
    setGeneratingDesc(true);
    try {
      const markaAd = brands.find((b) => String(b.id) === data.marka_id)?.ad;
      const kateqAd = categories.find((c) => String(c.id) === data.kateqoriya_id)?.ad;
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
      setField("aciqlamaq", j.text);
      if (j.is_mock) toast.info("AI mock cavabı");
      else toast.success("AI təsvir generasiya etdi");
    } catch {
      toast.error("Generasiya xətası");
    } finally {
      setGeneratingDesc(false);
    }
  }

  function generateBarcode() {
    const base = Array.from({ length: 12 }, () => Math.floor(Math.random() * 10)).join("");
    let sum = 0;
    for (let i = 0; i < 12; i++) sum += Number(base[i]) * (i % 2 === 0 ? 1 : 3);
    const check = (10 - (sum % 10)) % 10;
    setField("barkod", base + check);
  }

  // ===== Render =====
  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          className="font-semibold text-white"
          style={{ background: "var(--brand-gradient)" }}
        >
          <Plus className="h-4 w-4" />
          Yeni məhsul
        </Button>
      </DialogTrigger>
      <DialogContent className="md:max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Yeni məhsul yarat</DialogTitle>
        </DialogHeader>

        <StepIndicator current={step} onClick={handleStepClick} />

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="min-h-[320px] py-2">
          {step === 1 && (
            <Step1
              data={data}
              setField={setField}
              categories={categories}
              brands={brands}
              units={units}
              pending={pending}
              onGenerateBarcode={generateBarcode}
            />
          )}
          {step === 2 && (
            <Step2
              data={data}
              setField={setField}
              pending={pending}
              uploadingImg={uploadingImg}
              generatingImg={generatingImg}
              generatingDesc={generatingDesc}
              onUpload={uploadFile}
              onAiImage={aiGenerateImage}
              onAiDesc={aiGenerateDescription}
            />
          )}
          {step === 3 && <Step3 data={data} setField={setField} pending={pending} />}
          {step === 4 && <Step4 data={data} setField={setField} pending={pending} />}
          {step === 5 && (
            <Step5 data={data} setField={setField} pending={pending} categories={categories} brands={brands} />
          )}
        </div>

        <div className="flex items-center justify-between border-t border-border pt-3">
          <Button type="button" variant="ghost" onClick={handlePrev} disabled={step === 1 || pending}>
            <ChevronLeft className="h-4 w-4" />
            Geri
          </Button>
          <div className="text-xs text-muted-foreground">
            Addım {step} / 5
          </div>
          {step < 5 ? (
            <Button type="button" onClick={handleNext} disabled={pending}>
              İrəli
              <ChevronRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={pending}
              className="font-semibold"
            >
              {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Check className="h-4 w-4" />
              Məhsulu yarat
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ===================== Step Indicator =====================

function StepIndicator({
  current,
  onClick,
}: {
  current: WizardStep;
  onClick: (s: WizardStep) => void;
}) {
  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-2">
      {STEPS.map((s, idx) => {
        const Icon = s.icon;
        const isActive = s.id === current;
        const isDone = s.id < current;
        return (
          <button
            key={s.id}
            type="button"
            onClick={() => onClick(s.id)}
            className={cn(
              "flex flex-1 min-w-[110px] items-center gap-2 rounded-md border px-2.5 py-1.5 text-left transition",
              isActive && "border-primary bg-primary/10",
              isDone && !isActive && "border-emerald-500/40 bg-emerald-500/5",
              !isActive && !isDone && "border-border bg-secondary/30 opacity-70 hover:opacity-100"
            )}
          >
            <div
              className={cn(
                "grid h-7 w-7 shrink-0 place-items-center rounded-full text-[11px] font-bold",
                isActive && "bg-primary text-primary-foreground",
                isDone && !isActive && "bg-emerald-500 text-white",
                !isActive && !isDone && "bg-secondary text-muted-foreground"
              )}
            >
              {isDone ? <Check className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
            </div>
            <div className="min-w-0">
              <div className="text-[11px] font-semibold leading-tight">
                {s.id}. {s.title}
              </div>
              <div className="truncate text-[10px] text-muted-foreground">{s.hint}</div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ===================== Step 1: Əsas =====================

function Step1({
  data,
  setField,
  categories,
  brands,
  units,
  pending,
  onGenerateBarcode,
}: {
  data: FormState;
  setField: <K extends keyof FormState>(k: K, v: FormState[K]) => void;
  categories: CategoryOpt[];
  brands: BrandOpt[];
  units: UnitOpt[];
  pending: boolean;
  onGenerateBarcode: () => void;
}) {
  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Məhsulun əsas məlumatları. <span className="text-foreground">Ad</span> məcburi sahədir.
      </p>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="space-y-1.5 md:col-span-2">
          <Label htmlFor="ad">Ad *</Label>
          <Input
            id="ad"
            value={data.ad}
            onChange={(e) => setField("ad", e.target.value)}
            placeholder="məs. iPhone 15 Pro 256GB"
            maxLength={200}
            autoFocus
            disabled={pending}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="kod">Kod (SKU)</Label>
          <Input
            id="kod"
            value={data.kod}
            onChange={(e) => setField("kod", e.target.value)}
            placeholder="məs. APL-IP15P-256"
            maxLength={50}
            disabled={pending}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="barkod">Barkod</Label>
          <button
            type="button"
            onClick={onGenerateBarcode}
            disabled={pending}
            className="text-[10.5px] font-semibold text-primary hover:underline"
          >
            ↻ Avto yarat (EAN-13)
          </button>
        </div>
        <Input
          id="barkod"
          value={data.barkod}
          onChange={(e) => setField("barkod", e.target.value)}
          placeholder="məs. 4768888197392"
          maxLength={100}
          disabled={pending}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="space-y-1.5">
          <Label>Kateqoriya</Label>
          <Combobox
            options={categories.map<ComboOption>((c) => ({ value: String(c.id), label: c.ad }))}
            value={data.kateqoriya_id}
            onChange={(v) => setField("kateqoriya_id", v)}
            placeholder="— Seçin —"
            searchPlaceholder="Kateqoriya axtar..."
            emptyText="Tapılmadı"
            disabled={pending}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Marka</Label>
          <Combobox
            options={brands.map<ComboOption>((b) => ({ value: String(b.id), label: b.ad }))}
            value={data.marka_id}
            onChange={(v) => setField("marka_id", v)}
            placeholder="— Seçin —"
            searchPlaceholder="Marka axtar..."
            emptyText="Tapılmadı"
            disabled={pending}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Ölçü vahidi</Label>
          <Combobox
            options={units.map<ComboOption>((u) => ({
              value: String(u.id),
              label: u.ad,
              hint: u.qisa_ad ?? undefined,
            }))}
            value={data.olcu_id}
            onChange={(v) => setField("olcu_id", v)}
            placeholder="— Seçin —"
            searchPlaceholder="Vahid axtar..."
            emptyText="Tapılmadı"
            disabled={pending}
          />
        </div>
      </div>
    </div>
  );
}

// ===================== Step 2: Şəkil + Təsvir =====================

function Step2({
  data,
  setField,
  pending,
  uploadingImg,
  generatingImg,
  generatingDesc,
  onUpload,
  onAiImage,
  onAiDesc,
}: {
  data: FormState;
  setField: <K extends keyof FormState>(k: K, v: FormState[K]) => void;
  pending: boolean;
  uploadingImg: boolean;
  generatingImg: boolean;
  generatingDesc: boolean;
  onUpload: (f: File) => void;
  onAiImage: () => void;
  onAiDesc: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Şəkil və təsvir məcburi deyil, lakin satışı artırır. AI köməyi mövcuddur.
      </p>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-[160px_1fr]">
        <div className="space-y-2">
          <Label>Şəkil</Label>
          <div className="relative h-36 w-full overflow-hidden rounded-md border border-border bg-secondary/30">
            {data.sekil_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={data.sekil_url}
                alt=""
                className="h-full w-full object-cover"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = "none";
                }}
              />
            ) : (
              <div className="grid h-full w-full place-items-center text-muted-foreground text-xs">
                Şəkil yoxdur
              </div>
            )}
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="sekil_url">Şəkil URL</Label>
          <Input
            id="sekil_url"
            value={data.sekil_url}
            onChange={(e) => setField("sekil_url", e.target.value)}
            placeholder="https://... və ya /uploads/..."
            disabled={pending}
          />
          <div className="flex flex-wrap gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onUpload(f);
                if (fileInputRef.current) fileInputRef.current.value = "";
              }}
              disabled={pending || uploadingImg}
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={pending || uploadingImg}
            >
              {uploadingImg ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Upload className="h-3.5 w-3.5" />
              )}
              Kompüterdən yüklə
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={onAiImage}
              disabled={pending || generatingImg || !data.ad.trim()}
              title={!data.ad.trim() ? "Əvvəlcə məhsul adını daxil edin" : ""}
            >
              {generatingImg ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
              AI generasiya
            </Button>
            {data.sekil_url && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setField("sekil_url", "")}
                disabled={pending}
              >
                Sil
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="qisaca_tesvir">Qısaca təsvir (kart üzərində görünür)</Label>
        <Input
          id="qisaca_tesvir"
          value={data.qisaca_tesvir}
          onChange={(e) => setField("qisaca_tesvir", e.target.value)}
          placeholder="2-3 söz ilə qısa məhsul izahı"
          maxLength={500}
          disabled={pending}
        />
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="aciqlamaq">Tam təsvir / Açıqlama</Label>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onAiDesc}
            disabled={pending || generatingDesc || !data.ad.trim()}
          >
            {generatingDesc ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Wand2 className="h-3.5 w-3.5" />
            )}
            AI ilə doldur
          </Button>
        </div>
        <textarea
          id="aciqlamaq"
          rows={4}
          value={data.aciqlamaq}
          onChange={(e) => setField("aciqlamaq", e.target.value)}
          placeholder="Texniki xüsusiyyətlər, istifadə qaydaları, üstünlüklər..."
          maxLength={5000}
          disabled={pending}
          className="flex w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
      </div>
    </div>
  );
}

// ===================== Step 3: Qiymət =====================

function Step3({
  data,
  setField,
  pending,
}: {
  data: FormState;
  setField: <K extends keyof FormState>(k: K, v: FormState[K]) => void;
  pending: boolean;
}) {
  const maya = Number(data.alish_qiymeti) || 0;
  const satis = Number(data.satis_qiymeti) || 0;
  const marja = satis > 0 && maya > 0 ? ((satis - maya) / satis) * 100 : null;

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Yalnız <span className="text-foreground">Pərakəndə satış</span> məcburidir. Boş qalan qiymətlər avtomatik hesablanır.
      </p>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <NumField label="Maya (alış)" value={data.alish_qiymeti} onChange={(v) => setField("alish_qiymeti", v)} disabled={pending} />
        <NumField label="Pərakəndə satış *" value={data.satis_qiymeti} onChange={(v) => setField("satis_qiymeti", v)} disabled={pending} required />
        <NumField label="Endirimli qiymət" value={data.endirimli_qiymet} onChange={(v) => setField("endirimli_qiymet", v)} disabled={pending} />
        <NumField label="Minimum satış" value={data.min_satis_qiymeti} onChange={(v) => setField("min_satis_qiymeti", v)} disabled={pending} />
        <NumField label="Topdan" value={data.topdan_qiymeti} onChange={(v) => setField("topdan_qiymeti", v)} disabled={pending} />
        <NumField label="Partnyor" value={data.partnyor_qiymeti} onChange={(v) => setField("partnyor_qiymeti", v)} disabled={pending} />
        <NumField label="VIP" value={data.vip_qiymeti} onChange={(v) => setField("vip_qiymeti", v)} disabled={pending} />
        <NumField label="Komissiya %" value={data.komissiya_faiz} onChange={(v) => setField("komissiya_faiz", v)} disabled={pending} />
        <NumField label="Çatdırılma xərci" value={data.catdirilma_xerci} onChange={(v) => setField("catdirilma_xerci", v)} disabled={pending} />
        <NumField label="Digər xərc" value={data.diger_xerc} onChange={(v) => setField("diger_xerc", v)} disabled={pending} />
      </div>

      {marja !== null && (
        <div
          className={cn(
            "rounded-md border p-3 text-xs",
            marja < 0
              ? "border-rose-500/40 bg-rose-500/5 text-rose-400"
              : marja < 10
                ? "border-amber-500/40 bg-amber-500/5 text-amber-400"
                : "border-emerald-500/40 bg-emerald-500/5 text-emerald-400"
          )}
        >
          📊 Marja: <span className="font-bold">{marja.toFixed(1)}%</span> ({(satis - maya).toFixed(2)} {data.valyuta})
          {marja < 0 && " — diqqət, mayadan aşağı satırsan!"}
          {marja >= 0 && marja < 10 && " — aşağı marja"}
          {marja >= 10 && " — yaxşı marja"}
        </div>
      )}
    </div>
  );
}

// ===================== Step 4: Stok + Texniki =====================

function Step4({
  data,
  setField,
  pending,
}: {
  data: FormState;
  setField: <K extends keyof FormState>(k: K, v: FormState[K]) => void;
  pending: boolean;
}) {
  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Stok limitləri (avtomatik xəbərdarlıq üçün) və texniki xüsusiyyətlər.
      </p>

      <div>
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Stok limitləri
        </div>
        <div className="grid grid-cols-3 gap-3">
          <NumField label="Kritik stok" value={data.kritik_stok} onChange={(v) => setField("kritik_stok", v)} disabled={pending} />
          <NumField label="Min stok" value={data.min_stok} onChange={(v) => setField("min_stok", v)} disabled={pending} />
          <NumField label="Max stok" value={data.max_stok} onChange={(v) => setField("max_stok", v)} disabled={pending} />
        </div>
      </div>

      <div>
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Texniki xüsusiyyətlər
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <TextField label="Model" value={data.model} onChange={(v) => setField("model", v)} placeholder="iPhone 15 Pro" disabled={pending} />
          <TextField label="Rəng" value={data.rang} onChange={(v) => setField("rang", v)} placeholder="Qara" disabled={pending} />
          <TextField label="İstehsalçı" value={data.istehsalci} onChange={(v) => setField("istehsalci", v)} placeholder="Apple Inc" disabled={pending} />
          <NumField label="Çəki (kq)" value={data.cheki_kg} onChange={(v) => setField("cheki_kg", v)} disabled={pending} />
          <NumField label="Həcm (m³)" value={data.hecm_m3} onChange={(v) => setField("hecm_m3", v)} disabled={pending} />
          <TextField label="Ölçülər (UxBxH)" value={data.olculer} onChange={(v) => setField("olculer", v)} placeholder="15×8×0.8 sm" disabled={pending} />
          <NumField label="Qutu say (bir paketdə)" value={data.qutu_say} onChange={(v) => setField("qutu_say", v)} disabled={pending} />
        </div>
      </div>
    </div>
  );
}

// ===================== Step 5: Əlavə + Yoxla =====================

function Step5({
  data,
  setField,
  pending,
  categories,
  brands,
}: {
  data: FormState;
  setField: <K extends keyof FormState>(k: K, v: FormState[K]) => void;
  pending: boolean;
  categories: CategoryOpt[];
  brands: BrandOpt[];
}) {
  const kateqAd = categories.find((c) => String(c.id) === data.kateqoriya_id)?.ad;
  const markaAd = brands.find((b) => String(b.id) === data.marka_id)?.ad;

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Vergi, valyuta, izləmə və icazə parametrləri. Sonda yoxlama.
      </p>

      <div>
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Vergi və valyuta
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="space-y-1">
            <Label htmlFor="valyuta">Valyuta</Label>
            <select
              id="valyuta"
              value={data.valyuta}
              onChange={(e) => setField("valyuta", e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
              disabled={pending}
            >
              <option value="AZN">AZN (₼)</option>
              <option value="USD">USD ($)</option>
              <option value="EUR">EUR (€)</option>
              <option value="RUB">RUB (₽)</option>
              <option value="TRY">TRY (₺)</option>
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="edv_status">ƏDV statusu</Label>
            <select
              id="edv_status"
              value={data.edv_status}
              onChange={(e) => setField("edv_status", e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
              disabled={pending}
            >
              <option value="edv_var">ƏDV var (18%)</option>
              <option value="edv_yox">ƏDV yoxdur</option>
              <option value="edv_azad">ƏDV-dən azad</option>
            </select>
          </div>
          <div className="flex flex-col gap-1.5 pt-5">
            <CheckRow label="ƏDV qiymətə daxildir" checked={data.edv_daxil} onChange={(v) => setField("edv_daxil", v)} disabled={pending} />
            <CheckRow label="Yol vergisinə tabe" checked={data.yol_vergisi} onChange={(v) => setField("yol_vergisi", v)} disabled={pending} />
          </div>
        </div>
      </div>

      <div>
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Zəmanət və izləmə
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <NumField label="Zəmanət (ay)" value={data.zemanet_ay} onChange={(v) => setField("zemanet_ay", v)} disabled={pending} />
          <CheckRow label="Serial nömrə lazımdır" checked={data.serial_lazim} onChange={(v) => setField("serial_lazim", v)} disabled={pending} />
          <CheckRow label="IMEI lazımdır" checked={data.imei_lazim} onChange={(v) => setField("imei_lazim", v)} disabled={pending} />
          <CheckRow label="Partiya nömrəsi lazımdır" checked={data.partiya_lazim} onChange={(v) => setField("partiya_lazim", v)} disabled={pending} />
          <CheckRow label="Servis qeydi lazımdır" checked={data.servis_lazim} onChange={(v) => setField("servis_lazim", v)} disabled={pending} />
        </div>
      </div>

      <div>
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          İcazələr
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <CheckRow label="Bron qoymaq olar" checked={data.bron_icaze} onChange={(v) => setField("bron_icaze", v)} disabled={pending} />
          <CheckRow label="Rezervə qoymaq olar" checked={data.rezerv_icaze} onChange={(v) => setField("rezerv_icaze", v)} disabled={pending} />
          <CheckRow label="Konsiqnasiya verilə bilər" checked={data.konsiq_icaze} onChange={(v) => setField("konsiq_icaze", v)} disabled={pending} />
        </div>
      </div>

      <div>
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          SEO / Marketing
        </div>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="seo_acharlar">SEO açar sözlər</Label>
            <Input
              id="seo_acharlar"
              value={data.seo_acharlar}
              onChange={(e) => setField("seo_acharlar", e.target.value)}
              placeholder="telefon, iphone, smartphone (vergüllə)"
              maxLength={500}
              disabled={pending}
            />
          </div>
          <CheckRow label="Etiketsiz məhsul (yalnız POS, vitrində yox)" checked={data.etiketsiz} onChange={(v) => setField("etiketsiz", v)} disabled={pending} />
          <CheckRow label="Aktivdir (POS və satışda görünür)" checked={data.aktiv} onChange={(v) => setField("aktiv", v)} disabled={pending} />
        </div>
      </div>

      <div className="rounded-md border border-primary/30 bg-primary/5 p-3">
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-primary">
          ✓ Yoxlama
        </div>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
          <dt className="text-muted-foreground">Ad:</dt>
          <dd className="font-medium">{data.ad || "—"}</dd>
          <dt className="text-muted-foreground">Kateqoriya / Marka:</dt>
          <dd className="font-medium">{kateqAd || "—"} / {markaAd || "—"}</dd>
          <dt className="text-muted-foreground">Maya / Satış:</dt>
          <dd className="font-medium">
            {Number(data.alish_qiymeti).toFixed(2)} / {Number(data.satis_qiymeti).toFixed(2)} {data.valyuta}
          </dd>
          <dt className="text-muted-foreground">Şəkil:</dt>
          <dd className="font-medium">{data.sekil_url ? "✓ var" : "yoxdur"}</dd>
          <dt className="text-muted-foreground">Stok limit:</dt>
          <dd className="font-medium">
            min {data.min_stok} / max {data.max_stok} / kritik {data.kritik_stok}
          </dd>
          <dt className="text-muted-foreground">Status:</dt>
          <dd className="font-medium">{data.aktiv ? "✓ Aktiv" : "Passiv"}</dd>
        </dl>
      </div>
    </div>
  );
}

// ===================== Helper Field Components =====================

function NumField({
  label,
  value,
  onChange,
  disabled,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  required?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Input
        type="number"
        min={0}
        step="0.01"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        required={required}
        className="h-9"
      />
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="h-9"
      />
    </div>
  );
}

function CheckRow({
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
    <label className="inline-flex items-center gap-2 py-1 text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        className="h-4 w-4 accent-primary"
      />
      {label}
    </label>
  );
}
