"use client";

import { useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Upload, Trash2, Loader2, ImageIcon, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { deleteServisFile } from "../actions";

export type ServisFaylItem = {
  id: number;
  fayl_adi: string;
  orijinal_adi: string;
  nov: string | null;
  aciqlama: string | null;
  olcu_bayt: bigint | null;
  mime_tip: string | null;
  yaradildi: Date | null;
};

const KATEQ_OPTIONS = [
  { value: "qebul", label: "Qəbul fotosu" },
  { value: "diaqnostika", label: "Diaqnostika" },
  { value: "temir", label: "Təmir prosesi" },
  { value: "hazir", label: "Hazır məhsul" },
  { value: "imza", label: "Müştəri imzası" },
] as const;

const KATEQ_LABELS: Record<string, string> = Object.fromEntries(
  KATEQ_OPTIONS.map((k) => [k.value, k.label]),
);

export function ServisFayllar({
  servisId,
  fayllar,
}: {
  servisId: string;
  fayllar: ServisFaylItem[];
}) {
  const router = useRouter();
  const [kateq, setKateq] = useState<string>("qebul");
  const [aciqlama, setAciqlama] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [drag, setDrag] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  async function uploadFile(file: File) {
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Fayl 5 MB-dan böyükdür");
      return;
    }
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("kateq", kateq);
    if (aciqlama) fd.append("aciqlama", aciqlama);
    try {
      const res = await fetch(`/api/servis/${servisId}/upload`, {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Xəta");
      toast.success("Fayl yükləndi");
      setAciqlama("");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Yükləmə xətası");
    } finally {
      setUploading(false);
    }
  }

  function onFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    for (const f of Array.from(files)) {
      void uploadFile(f);
    }
  }

  function onRemove(id: number) {
    if (!confirm("Bu fayl silinsin?")) return;
    startTransition(async () => {
      const res = await deleteServisFile(id, servisId);
      if (res.ok) {
        toast.success("Silindi");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  // Qruplaşdır kategoriyalara görə
  const groups = new Map<string, ServisFaylItem[]>();
  for (const opt of KATEQ_OPTIONS) groups.set(opt.value, []);
  groups.set("diger", []);
  for (const f of fayllar) {
    const k = (f.nov ?? "diger").toLowerCase();
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(f);
  }

  return (
    <div className="space-y-4">
      {/* Upload zone */}
      <div className="rounded-md border border-border/60 bg-card/40 p-3">
        <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
          <div className="space-y-1">
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Kateqoriya
            </Label>
            <select
              value={kateq}
              onChange={(e) => setKateq(e.target.value)}
              disabled={uploading}
              className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
            >
              {KATEQ_OPTIONS.map((k) => (
                <option key={k.value} value={k.value}>
                  {k.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Açıqlama (istəyə bağlı)
            </Label>
            <input
              type="text"
              value={aciqlama}
              onChange={(e) => setAciqlama(e.target.value)}
              maxLength={200}
              placeholder="qısa qeyd"
              disabled={uploading}
              className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
            />
          </div>
        </div>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            onFiles(e.dataTransfer.files);
          }}
          className={`mt-3 flex flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed py-6 text-sm transition ${
            drag ? "border-primary bg-primary/5" : "border-border bg-background/40"
          }`}
        >
          {uploading ? (
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          ) : (
            <ImageIcon className="h-5 w-5 text-muted-foreground" />
          )}
          <div className="text-muted-foreground">
            Faylları bura sürüşdürün və ya{" "}
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="text-primary-light underline-offset-2 hover:underline"
              disabled={uploading}
            >
              seçin
            </button>
          </div>
          <div className="text-[10.5px] text-muted-foreground">JPEG · PNG · WebP, maks 5 MB</div>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            onChange={(e) => onFiles(e.target.files)}
            className="hidden"
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
          >
            <Upload className="h-3.5 w-3.5" /> Fayl seç
          </Button>
        </div>
      </div>

      {/* Grid by kateqoriya */}
      <div className="space-y-4">
        {Array.from(groups.entries())
          .filter(([, items]) => items.length > 0)
          .map(([k, items]) => (
            <div key={k}>
              <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <span>{KATEQ_LABELS[k] ?? "Digər"}</span>
                <span className="rounded-full bg-secondary px-1.5 py-0.5 text-[10px] font-medium">
                  {items.length}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                {items.map((f) => (
                  <div
                    key={f.id}
                    className="group relative aspect-square overflow-hidden rounded-md border border-border bg-secondary/40"
                  >
                    <button
                      type="button"
                      onClick={() => setLightbox(f.fayl_adi)}
                      className="block h-full w-full"
                    >
                      <Image
                        src={f.fayl_adi}
                        alt={f.orijinal_adi}
                        width={300}
                        height={300}
                        className="h-full w-full object-cover"
                      />
                    </button>
                    {f.aciqlama && (
                      <div className="pointer-events-none absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-1.5 text-[10px] text-white">
                        {f.aciqlama}
                      </div>
                    )}
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => onRemove(f.id)}
                      className="absolute right-1 top-1 rounded-md bg-black/60 p-1 text-white opacity-0 transition group-hover:opacity-100"
                      title="Sil"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        {fayllar.length === 0 && (
          <p className="text-center text-sm text-muted-foreground">Hələ fayl yoxdur.</p>
        )}
      </div>

      {/* Lightbox */}
      <Dialog open={!!lightbox} onOpenChange={(v) => !v && setLightbox(null)}>
        <DialogContent className="max-w-3xl bg-black/90 p-0">
          {lightbox && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setLightbox(null)}
                className="absolute right-2 top-2 z-10 rounded-md bg-black/60 p-1.5 text-white hover:bg-black/80"
              >
                <X className="h-4 w-4" />
              </button>
              <Image
                src={lightbox}
                alt="preview"
                width={1200}
                height={1200}
                className="h-auto max-h-[85vh] w-full object-contain"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
