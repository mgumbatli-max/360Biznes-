"use client";

import { useState, useRef, useTransition } from "react";
import Image from "next/image";
import { Upload, X, Plus, Image as ImageIcon, Loader2, GripVertical } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { parseSekilUrls, joinSekilUrls, MAX_SEKIL_URLS } from "@/lib/mehsul/sekil-urls";

/**
 * Çoxlu məhsul şəkli editor — wizard və edit dialog-larda istifadə üçün.
 *
 * Hidden input `name="sekil_url"` form ilə göndərilir, dəyər `|` ayrılmış URL list.
 * Drag-drop ilə şəkillərin sırası dəyişdirilir (1-ci əsas şəkil).
 * Upload endpoint: POST /api/anbar/upload-image (mövcud).
 */

export function MultiImageEditor({
  name = "sekil_url",
  defaultValue = "",
  label = "Şəkillər",
}: {
  name?: string;
  defaultValue?: string;
  label?: string;
}) {
  const [urls, setUrls] = useState<string[]>(() => parseSekilUrls(defaultValue));
  const [uploading, startUpload] = useTransition();
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const urlInputRef = useRef<HTMLInputElement>(null);

  function add(u: string) {
    const clean = u.trim();
    if (!clean) return;
    if (urls.includes(clean)) {
      toast.info("Bu şəkil artıq əlavə olunub");
      return;
    }
    if (urls.length >= MAX_SEKIL_URLS) {
      toast.error(`Maksimum ${MAX_SEKIL_URLS} şəkil əlavə edilə bilər`);
      return;
    }
    setUrls((prev) => [...prev, clean]);
  }

  function remove(i: number) {
    setUrls((prev) => prev.filter((_, idx) => idx !== i));
  }

  function move(from: number, to: number) {
    if (from === to) return;
    setUrls((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const remaining = MAX_SEKIL_URLS - urls.length;
    if (remaining <= 0) {
      toast.error(`Maksimum ${MAX_SEKIL_URLS} şəkil`);
      return;
    }
    const list = Array.from(files).slice(0, remaining);

    startUpload(async () => {
      for (const file of list) {
        if (!file.type.startsWith("image/")) {
          toast.error(`"${file.name}" şəkil deyil`);
          continue;
        }
        const fd = new FormData();
        fd.append("file", file);
        try {
          const res = await fetch("/api/anbar/upload-image", { method: "POST", body: fd });
          const data = await res.json();
          if (!res.ok || !data.url) {
            toast.error(data.error ?? `"${file.name}" yüklənmədi`);
            continue;
          }
          // Mümkün olduqca eyni anda set et — closure stale state riski üçün functional update
          setUrls((prev) => {
            if (prev.length >= MAX_SEKIL_URLS) return prev;
            if (prev.includes(data.url)) return prev;
            return [...prev, data.url as string];
          });
        } catch (e) {
          toast.error(`"${file.name}" yüklənmədi: ${e instanceof Error ? e.message : "şəbəkə"}`);
        }
      }
      if (fileInputRef.current) fileInputRef.current.value = "";
    });
  }

  const joined = joinSekilUrls(urls);

  return (
    <div className="space-y-2">
      <input type="hidden" name={name} value={joined} />
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium">
          {label}{" "}
          <span className="text-muted-foreground">({urls.length}/{MAX_SEKIL_URLS})</span>
        </label>
        {urls.length > 0 && (
          <p className="text-[10.5px] text-muted-foreground">
            İlk şəkil əsas hesab olunur — POS, siyahı və marketplace-də göstərilir
          </p>
        )}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {urls.map((u, i) => (
          <div
            key={`${u}-${i}`}
            draggable
            onDragStart={() => setDragIndex(i)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => {
              if (dragIndex != null) move(dragIndex, i);
              setDragIndex(null);
            }}
            className={cn(
              "group relative aspect-square overflow-hidden rounded-lg border bg-secondary/30",
              i === 0 ? "border-primary/40 ring-1 ring-primary/30" : "border-border",
            )}
          >
            <Image
              src={u}
              alt={`Şəkil ${i + 1}`}
              fill
              sizes="120px"
              className="object-cover"
              unoptimized
            />
            {i === 0 && (
              <div className="absolute left-1 top-1 rounded-full bg-primary px-1.5 py-0.5 text-[9px] font-bold text-primary-foreground">
                ƏSAS
              </div>
            )}
            <div className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-black/50 text-[10px] font-bold text-white">
              {i + 1}
            </div>
            <button
              type="button"
              onClick={() => remove(i)}
              className="absolute bottom-1 right-1 grid h-6 w-6 place-items-center rounded-full bg-rose-500 text-white opacity-0 transition group-hover:opacity-100"
              title="Sil"
            >
              <X className="h-3 w-3" />
            </button>
            <div className="absolute bottom-1 left-1 grid h-6 w-6 cursor-grab place-items-center rounded-full bg-black/50 text-white opacity-0 transition group-hover:opacity-100 active:cursor-grabbing">
              <GripVertical className="h-3 w-3" />
            </div>
          </div>
        ))}

        {urls.length < MAX_SEKIL_URLS && (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-border hover:border-primary hover:bg-secondary/30 disabled:opacity-50"
          >
            {uploading ? (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            ) : (
              <>
                <Plus className="h-5 w-5 text-muted-foreground" />
                <span className="text-[10.5px] text-muted-foreground">Şəkil əlavə et</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* File input (hidden) */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="sr-only"
        onChange={(e) => handleFiles(e.target.files)}
      />

      {/* URL əlavə et input + upload button */}
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading || urls.length >= MAX_SEKIL_URLS}
          className="inline-flex h-8 items-center gap-1 rounded-md border border-border bg-background px-2.5 text-xs font-medium hover:bg-secondary disabled:opacity-50"
        >
          {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
          Faylı yüklə
        </button>
        <div className="flex items-center gap-1">
          <input
            ref={urlInputRef}
            type="url"
            placeholder="https://... və ya birbaşa URL yapışdır"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                const v = (e.target as HTMLInputElement).value;
                add(v);
                (e.target as HTMLInputElement).value = "";
              }
            }}
            className="h-8 w-[280px] rounded-md border border-input bg-background px-2 text-xs"
            disabled={urls.length >= MAX_SEKIL_URLS}
          />
          <button
            type="button"
            onClick={() => {
              const v = urlInputRef.current?.value ?? "";
              if (v) {
                add(v);
                if (urlInputRef.current) urlInputRef.current.value = "";
              }
            }}
            disabled={urls.length >= MAX_SEKIL_URLS}
            className="inline-flex h-8 items-center gap-1 rounded-md border border-border bg-background px-2.5 text-xs font-medium hover:bg-secondary disabled:opacity-50"
          >
            <ImageIcon className="h-3.5 w-3.5" />
            URL əlavə et
          </button>
        </div>
      </div>
    </div>
  );
}
