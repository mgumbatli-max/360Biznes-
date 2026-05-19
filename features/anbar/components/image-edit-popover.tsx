"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ImagePlus,
  Loader2,
  Check,
  Trash2,
  Upload,
  Sparkles,
  Link as LinkIcon,
  Computer,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { updateProductImage } from "../image-actions";

type Tab = "url" | "file" | "ai";

export function ImageEditPopover({
  mehsulId,
  currentUrl,
  /** Product name → used as AI prompt seed */
  productName,
  label,
  onSuccess,
}: {
  mehsulId: string;
  currentUrl: string | null;
  productName?: string;
  label?: string;
  onSuccess?: () => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("url");
  const [url, setUrl] = useState(currentUrl ?? "");
  const [prompt, setPrompt] = useState(productName ?? "");
  const [pending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function save(newUrl: string | null) {
    startTransition(async () => {
      const r = await updateProductImage(mehsulId, newUrl);
      if (r.ok) {
        toast.success(newUrl ? "Şəkil yeniləndi" : "Şəkil silindi");
        setOpen(false);
        onSuccess?.();
        router.refresh();
      } else {
        toast.error(r.error);
      }
    });
  }

  async function pickAndUpload(file: File) {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await fetch("/api/anbar/upload-image", { method: "POST", body: fd });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        toast.error(j.error ?? "Yükləmə alınmadı");
        return;
      }
      const { url: uploadedUrl } = await r.json();
      setUrl(uploadedUrl);
      toast.success("Fayl yükləndi. Yadda saxla düyməsi ilə təsdiqlə.");
    } catch (e) {
      console.error(e);
      toast.error("Yükləmə xətası");
    } finally {
      setUploading(false);
    }
  }

  async function generateAI() {
    const p = prompt.trim();
    if (!p) {
      toast.error("Generasiya üçün məhsul adı və ya təsvir lazımdır");
      return;
    }
    setGenerating(true);
    try {
      const r = await fetch("/api/anbar/ai/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: p }),
      });
      if (!r.ok) {
        toast.error("Generasiya alınmadı");
        return;
      }
      const { url: aiUrl, is_mock, notice } = await r.json();
      setUrl(aiUrl);
      if (is_mock && notice) toast.info(notice);
      else toast.success("AI şəkil generasiya etdi. Yadda saxla düyməsi ilə təsdiqlə.");
    } catch (e) {
      console.error(e);
      toast.error("Generasiya xətası");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1.5">
          <ImagePlus className="h-3.5 w-3.5" />
          {label ?? (currentUrl ? "Şəkli dəyiş" : "Şəkil əlavə et")}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-3" align="end">
        <div className="space-y-3">
          {/* Tabs */}
          <div className="grid grid-cols-3 gap-0.5 rounded-md border border-border bg-secondary/40 p-0.5">
            <TabButton active={tab === "url"} onClick={() => setTab("url")} icon={LinkIcon} label="URL" />
            <TabButton active={tab === "file"} onClick={() => setTab("file")} icon={Computer} label="Kompüter" />
            <TabButton active={tab === "ai"} onClick={() => setTab("ai")} icon={Sparkles} label="AI" />
          </div>

          {tab === "url" && (
            <div>
              <label className="mb-1 block text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground">
                Şəkil URL
              </label>
              <Input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://... və ya /uploads/..."
                disabled={pending}
              />
            </div>
          )}

          {tab === "file" && (
            <div>
              <label className="mb-1 block text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground">
                Kompüterdən fayl seç
              </label>
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const f = e.dataTransfer.files?.[0];
                  if (f) pickAndUpload(f);
                }}
                onClick={() => fileRef.current?.click()}
                className="flex cursor-pointer flex-col items-center gap-1.5 rounded-md border-2 border-dashed border-border bg-secondary/30 p-4 text-center transition hover:border-primary/30"
              >
                {uploading ? (
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                ) : (
                  <Upload className="h-6 w-6 text-muted-foreground" />
                )}
                <div className="text-xs font-medium">
                  {uploading ? "Yüklənir..." : "Faylı bura sürüşdür və ya kliklə"}
                </div>
                <div className="text-[10px] text-muted-foreground">JPEG, PNG, WebP, GIF · max 5 MB</div>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) pickAndUpload(f);
                }}
              />
            </div>
          )}

          {tab === "ai" && (
            <div>
              <label className="mb-1 block text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground">
                AI üçün təsvir
              </label>
              <Input
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="məs. iPhone 15 Pro Max telefon"
                disabled={generating}
              />
              <Button
                type="button"
                size="sm"
                onClick={generateAI}
                disabled={generating || !prompt.trim()}
                className="mt-2 w-full font-semibold text-white"
                style={{ background: "var(--brand-gradient)" }}
              >
                {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                AI ilə generasiya et
              </Button>
              <p className="mt-1.5 text-[10px] text-muted-foreground">
                OPENAI_API_KEY varsa DALL-E 3 işlədilir, yoxsa Unsplash placeholder qaytarılır.
              </p>
            </div>
          )}

          {/* Preview */}
          {url && (
            <div className="rounded-md border border-border bg-secondary/30 p-2">
              <div className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">Önbaxış</div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt="Önbaxış"
                className="mx-auto h-32 w-full object-contain"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = "none";
                }}
              />
            </div>
          )}

          <div className="flex gap-1.5">
            {currentUrl && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={pending}
                onClick={() => save(null)}
                className="text-danger hover:text-danger"
                title="Şəkili sil"
              >
                <Trash2 className="h-3.5 w-3.5" /> Sil
              </Button>
            )}
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={pending}
              className="flex-1"
            >
              İmtina
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => save(url || null)}
              disabled={pending || (!url && !currentUrl)}
              className="flex-1 font-semibold text-white"
              style={{ background: "var(--brand-gradient)" }}
            >
              {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              Yadda saxla
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function TabButton({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex h-7 items-center justify-center gap-1 rounded text-xs font-semibold transition ${
        active ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
      }`}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}
