"use client";

import { useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, X, ImageOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { parseSekilUrls } from "@/lib/mehsul/sekil-urls";

/**
 * Məhsul şəkil gallery — detail səhifədə əsas görüntü + thumbnail strip.
 * Tıklasan fullscreen lightbox açılır, klaviatura ilə naviqasiya.
 */

export function ProductImageGallery({
  sekilUrl,
  ad,
  className,
}: {
  sekilUrl: string | null | undefined;
  ad: string;
  className?: string;
}) {
  const urls = parseSekilUrls(sekilUrl);
  const [index, setIndex] = useState(0);
  const [lightbox, setLightbox] = useState(false);

  if (urls.length === 0) {
    return (
      <div className={cn("flex aspect-square items-center justify-center rounded-xl border border-dashed border-border bg-secondary/30", className)}>
        <div className="text-center">
          <ImageOff className="mx-auto h-8 w-8 text-muted-foreground/40" />
          <div className="mt-2 text-xs text-muted-foreground">Şəkil yoxdur</div>
        </div>
      </div>
    );
  }

  const active = urls[index] ?? urls[0];
  const total = urls.length;

  function prev() { setIndex((i) => (i - 1 + total) % total); }
  function next() { setIndex((i) => (i + 1) % total); }

  return (
    <>
      <div className={cn("space-y-2", className)}>
        {/* Əsas şəkil */}
        <div
          className="group relative aspect-square overflow-hidden rounded-xl border border-border bg-secondary/30 cursor-zoom-in"
          onClick={() => setLightbox(true)}
        >
          <Image
            src={active}
            alt={ad}
            fill
            sizes="(max-width: 768px) 100vw, 50vw"
            className="object-contain transition group-hover:scale-105"
            unoptimized
          />
          {total > 1 && (
            <>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); prev(); }}
                className="absolute left-2 top-1/2 -translate-y-1/2 grid h-9 w-9 place-items-center rounded-full bg-black/40 text-white opacity-0 transition group-hover:opacity-100 hover:bg-black/60"
                aria-label="Əvvəlki"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); next(); }}
                className="absolute right-2 top-1/2 -translate-y-1/2 grid h-9 w-9 place-items-center rounded-full bg-black/40 text-white opacity-0 transition group-hover:opacity-100 hover:bg-black/60"
                aria-label="Növbəti"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
              <div className="absolute bottom-2 left-2 rounded-full bg-black/60 px-2 py-0.5 text-[10.5px] font-medium text-white">
                {index + 1} / {total}
              </div>
            </>
          )}
        </div>

        {/* Thumbnail strip */}
        {total > 1 && (
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {urls.map((u, i) => (
              <button
                key={`${u}-${i}`}
                type="button"
                onClick={() => setIndex(i)}
                className={cn(
                  "relative h-14 w-14 shrink-0 overflow-hidden rounded-md border-2 transition",
                  i === index ? "border-primary" : "border-border/40 hover:border-border",
                )}
              >
                <Image
                  src={u}
                  alt={`${ad} ${i + 1}`}
                  fill
                  sizes="56px"
                  className="object-cover"
                  unoptimized
                />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Lightbox */}
      {lightbox && (
        <Lightbox
          urls={urls}
          index={index}
          ad={ad}
          onClose={() => setLightbox(false)}
          onPrev={prev}
          onNext={next}
        />
      )}
    </>
  );
}

function Lightbox({
  urls,
  index,
  ad,
  onClose,
  onPrev,
  onNext,
}: {
  urls: string[];
  index: number;
  ad: string;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm"
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
        if (e.key === "ArrowLeft") onPrev();
        if (e.key === "ArrowRight") onNext();
      }}
      tabIndex={0}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20"
        aria-label="Bağla"
      >
        <X className="h-5 w-5" />
      </button>
      {urls.length > 1 && (
        <>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onPrev(); }}
            className="absolute left-4 grid h-12 w-12 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20"
            aria-label="Əvvəlki"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onNext(); }}
            className="absolute right-4 grid h-12 w-12 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20"
            aria-label="Növbəti"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        </>
      )}
      <div className="relative h-[90vh] w-[90vw]" onClick={(e) => e.stopPropagation()}>
        <Image
          src={urls[index]}
          alt={ad}
          fill
          sizes="90vw"
          className="object-contain"
          unoptimized
        />
      </div>
      {urls.length > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-white/10 px-3 py-1 text-sm font-medium text-white">
          {index + 1} / {urls.length}
        </div>
      )}
    </div>
  );
}
