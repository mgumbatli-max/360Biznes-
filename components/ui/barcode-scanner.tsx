"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, X, ScanBarcode, RefreshCw, AlertTriangle, Check } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * Mobil barkod kamera skaner — heç bir 3rd-party library tələb etmir.
 *
 * Browser `BarcodeDetector` API istifadə edir (Chrome Android, Safari iOS 17+).
 * Browser dəstəkləmirsə xəbərdarlıq göstərir və manual input fallback verir.
 *
 * Hadisə axını:
 *  1) Trigger düyməsinə klik → modal açılır, kameraya icazə tələb edir
 *  2) Video stream → BarcodeDetector hər 200ms-də skan edir
 *  3) Barkod tapıldı → onDetected callback çağrılır, modal bağlanır (default)
 *  4) İstifadəçi "Davam et" seçə bilər (continuous mode — çoxlu skan)
 *
 * İstifadə nümunələri:
 *   - POS-da məhsul axtarışı
 *   - Anbar inventar editor-də sayım
 *   - Məhsul detail səhifəsində oxşar tapma
 */

type BarcodeDetectorResult = {
  rawValue: string;
  format: string;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const BarcodeDetectorCtor: any = typeof window !== "undefined" && "BarcodeDetector" in window
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ? (window as any).BarcodeDetector
  : null;

const SUPPORTED_FORMATS = [
  "ean_13",
  "ean_8",
  "code_128",
  "code_39",
  "upc_a",
  "upc_e",
  "qr_code",
  "itf",
  "codabar",
] as const;

export function BarcodeScannerButton({
  onDetected,
  trigger,
  continuous = false,
  label = "Skanla",
}: {
  /** Aşkarlanmış barkodun callback-i. continuous=false halında modal avtomatik bağlanır. */
  onDetected: (barcode: string) => void;
  /** Custom trigger element. Yoxdursa standart Button istifadə olunur. */
  trigger?: React.ReactNode;
  /** Çoxlu skan — modal bağlanmır, hər barkod ayrı callback olur. */
  continuous?: boolean;
  /** Düymə etiketi (default trigger üçün). */
  label?: string;
}) {
  const [open, setOpen] = useState(false);

  function handleDetected(b: string) {
    onDetected(b);
    if (!continuous) setOpen(false);
  }

  return (
    <>
      <span onClick={() => setOpen(true)} className="inline-block cursor-pointer">
        {trigger ?? (
          <Button type="button" variant="outline" size="sm">
            <ScanBarcode className="mr-1 h-4 w-4" />
            {label}
          </Button>
        )}
      </span>
      {open && (
        <Dialog open onOpenChange={(o) => !o && setOpen(false)}>
          <DialogContent className="max-w-md p-0">
            <DialogHeader className="sr-only">
              <DialogTitle>Barkod skaneri</DialogTitle>
            </DialogHeader>
            <ScannerView
              onDetected={handleDetected}
              onClose={() => setOpen(false)}
              continuous={continuous}
            />
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

function ScannerView({
  onDetected,
  onClose,
  continuous,
}: {
  onDetected: (b: string) => void;
  onClose: () => void;
  continuous: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<{ detect(s: ImageBitmapSource): Promise<BarcodeDetectorResult[]> } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [supported, setSupported] = useState<boolean | null>(null);
  const [recent, setRecent] = useState<string[]>([]);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [manualInput, setManualInput] = useState("");

  useEffect(() => {
    if (!BarcodeDetectorCtor) {
      setSupported(false);
      setError("Brauzeriniz barkod aşkarlama API-sini dəstəkləmir. Manual daxil edin.");
      return;
    }
    setSupported(true);
    detectorRef.current = new BarcodeDetectorCtor({ formats: SUPPORTED_FORMATS });

    let active = true;
    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: facingMode },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
        if (!active) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        setScanning(true);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setError(`Kameraya giriş alına bilmir: ${msg}`);
        setSupported(false);
      }
    }
    start();

    return () => {
      active = false;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [facingMode]);

  // Polling: hər 200ms-də frame al və skan et
  useEffect(() => {
    if (!scanning || !detectorRef.current || !videoRef.current) return;
    let stopped = false;
    let lastDetectedAt = 0;
    let lastValue: string | null = null;

    async function tick() {
      if (stopped) return;
      const v = videoRef.current;
      const d = detectorRef.current;
      if (!v || !d || v.readyState < 2) {
        if (!stopped) setTimeout(tick, 200);
        return;
      }
      try {
        const results = await d.detect(v);
        if (results.length > 0) {
          const code = results[0].rawValue.trim();
          if (code) {
            const now = Date.now();
            // Eyni kodu 1 saniyə içində iki dəfə qəbul etmə
            if (code !== lastValue || now - lastDetectedAt > 1000) {
              lastValue = code;
              lastDetectedAt = now;
              setRecent((prev) => [code, ...prev.filter((c) => c !== code)].slice(0, 5));
              // Vibrate (mobil)
              if ("vibrate" in navigator) navigator.vibrate(50);
              onDetected(code);
            }
          }
        }
      } catch {
        // Detector səhvi — sadəcə davam et
      }
      if (!stopped) setTimeout(tick, 200);
    }
    tick();
    return () => {
      stopped = true;
    };
  }, [scanning, onDetected]);

  function flipCamera() {
    setFacingMode((m) => (m === "environment" ? "user" : "environment"));
    streamRef.current?.getTracks().forEach((t) => t.stop());
  }

  return (
    <div className="flex flex-col bg-black">
      {/* Video preview */}
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-black">
        <video
          ref={videoRef}
          className="h-full w-full object-cover"
          playsInline
          muted
        />
        {/* Scan box overlay */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="relative w-3/4 max-w-[280px] aspect-[3/2] rounded-lg">
            <div className="absolute -left-0.5 -top-0.5 h-6 w-6 border-l-4 border-t-4 border-emerald-400 rounded-tl-lg" />
            <div className="absolute -right-0.5 -top-0.5 h-6 w-6 border-r-4 border-t-4 border-emerald-400 rounded-tr-lg" />
            <div className="absolute -bottom-0.5 -left-0.5 h-6 w-6 border-b-4 border-l-4 border-emerald-400 rounded-bl-lg" />
            <div className="absolute -bottom-0.5 -right-0.5 h-6 w-6 border-b-4 border-r-4 border-emerald-400 rounded-br-lg" />
            {/* Laser */}
            <div className="absolute left-2 right-2 top-1/2 h-0.5 -translate-y-1/2 animate-pulse bg-emerald-400/80" />
          </div>
        </div>
        {/* Status badge */}
        <div className="absolute left-2 top-2 flex items-center gap-2">
          {scanning && (
            <Badge className="bg-emerald-500/90 text-white border-0">
              <span className="relative mr-1 inline-flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-200" />
              </span>
              Skan edilir
            </Badge>
          )}
          {!scanning && supported === null && <Badge className="bg-amber-500/90 text-white border-0">Yüklənir…</Badge>}
        </div>
        {/* Close */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-2 top-2 grid h-9 w-9 place-items-center rounded-full bg-black/60 text-white hover:bg-black/80"
          aria-label="Bağla"
        >
          <X className="h-4 w-4" />
        </button>
        {/* Flip camera */}
        {supported !== false && (
          <button
            type="button"
            onClick={flipCamera}
            className="absolute bottom-2 right-2 grid h-9 w-9 place-items-center rounded-full bg-black/60 text-white hover:bg-black/80"
            aria-label="Kameranı dəyiş"
            title="Ön / arxa kamera"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Bottom panel */}
      <div className="space-y-3 bg-background p-4">
        {/* Error */}
        {error && (
          <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <div className="flex-1">
              <div className="font-semibold text-amber-700">{error}</div>
              {supported === false && (
                <div className="mt-0.5 text-amber-600/90">
                  Dəstəklənən brauzerlər: Chrome (Android), Safari iOS 17+.
                  Desktop Safari və Firefox hələ dəstəkləmir — Chrome / Edge istifadə edin.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Recent scans (continuous mode) */}
        {continuous && recent.length > 0 && (
          <div className="space-y-1">
            <div className="text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground">
              Son skanlar
            </div>
            <div className="flex flex-wrap gap-1">
              {recent.map((c, i) => (
                <Badge key={c} variant="outline" className={cn("font-mono text-[10.5px]", i === 0 && "border-emerald-500/40 text-emerald-700")}>
                  {i === 0 && <Check className="mr-0.5 h-2.5 w-2.5" />}
                  {c}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Manual input fallback */}
        <div>
          <div className="text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground">
            {supported === false ? "Manual barkod" : "Yaxud manual daxil et"}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const v = manualInput.trim();
              if (v) {
                onDetected(v);
                setManualInput("");
              }
            }}
            className="mt-1 flex gap-1"
          >
            <input
              type="text"
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              placeholder="EAN-13, kod, və ya barkod..."
              className="h-9 flex-1 rounded-md border border-input bg-background px-3 font-mono text-sm"
              autoFocus={supported === false}
            />
            <Button type="submit" size="sm" disabled={!manualInput.trim()}>
              Əlavə et
            </Button>
          </form>
        </div>

        {!continuous && (
          <p className="text-[10.5px] text-muted-foreground">
            Barkod aşkarlanan kimi modal bağlanacaq. Çoxlu skan üçün <code className="rounded bg-secondary px-1 font-mono">continuous</code> rejimə keç.
          </p>
        )}
      </div>
    </div>
  );
}
