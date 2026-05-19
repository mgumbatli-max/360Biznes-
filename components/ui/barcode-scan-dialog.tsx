"use client";

import { useState } from "react";
import { Maximize2, Printer } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Barcode } from "./barcode";
import { CopyButton } from "./copy-button";

type Props = {
  value: string;
  /** Məhsul adı tooltip və dialog başlığı üçün */
  productName?: string;
  /** Trigger şəklini özünüz ötürün; default — kompakt skaner ikonu. */
  trigger?: React.ReactNode;
};

/**
 * Barkodu kompdan skan etmək üçün dialog — böyük ölçüdə açır.
 * Skaner barkodu monitor ekranından oxuya bilər.
 *
 * Birgə fasilələr:
 *   • Çap düyməsi — A4-da tək barkod çapı (etiket-cap dolayı olmadan)
 *   • Copy — barkod mətnini kopyalayır
 */
export function BarcodeScanDialog({ value, productName, trigger }: Props) {
  const [open, setOpen] = useState(false);

  function print() {
    const w = window.open("", "_blank", "width=600,height=400");
    if (!w) return;
    w.document.write(`
      <!doctype html>
      <html>
        <head>
          <title>${productName ?? value}</title>
          <style>
            body { margin: 0; padding: 20mm; font-family: ui-monospace, monospace; }
            .barcode { text-align: center; }
            .name { font-size: 12pt; margin-bottom: 8px; font-family: sans-serif; }
            .code { font-size: 10pt; margin-top: 4px; letter-spacing: 0.1em; }
            @media print { @page { size: A4; margin: 10mm; } }
          </style>
        </head>
        <body>
          <div class="barcode">
            ${productName ? `<div class="name">${productName}</div>` : ""}
            <div id="bc"></div>
            <div class="code">${value}</div>
          </div>
          <script>
            window.onload = () => { window.print(); setTimeout(() => window.close(), 200); };
          </script>
        </body>
      </html>
    `);
    w.document.close();
    // Barkodu inject etmək üçün svg yazıyıq — pure-HTML strategiyası
    setTimeout(() => {
      try {
        const svg = document.getElementById(`scan-barcode-${value}`)?.innerHTML;
        if (svg && w.document.getElementById("bc")) {
          w.document.getElementById("bc")!.innerHTML = svg;
        }
      } catch {
        /* ignored */
      }
    }, 50);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <button
            type="button"
            className="inline-flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-secondary hover:text-foreground"
            title="Skan üçün böyüt"
            aria-label="Barkodu böyüdüb skan üçün aç"
          >
            <Maximize2 className="h-3 w-3" />
          </button>
        )}
      </DialogTrigger>
      <DialogContent className="md:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <Maximize2 className="h-3.5 w-3.5 text-primary" />
            Barkodu skan üçün böyüt
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {productName && (
            <div className="text-center">
              <div className="text-base font-semibold">{productName}</div>
            </div>
          )}

          <div className="flex justify-center rounded-xl bg-white p-6">
            <div id={`scan-barcode-${value}`}>
              <Barcode value={value} scale={2.5} height={80} showText />
            </div>
          </div>

          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <span className="font-mono">{value}</span>
            <CopyButton value={value} title="Mətni kopyala" size="xs" />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 text-[11px] text-muted-foreground">
            <span>
              💡 Skaneri monitorun qarşısına gətirin — barkod oxunacaq. Skan olunmursa, böyüt
              düyməsi ilə ölçünü artırın.
            </span>
            <button
              type="button"
              onClick={print}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-secondary px-2.5 py-1 text-xs font-semibold hover:bg-secondary/70"
            >
              <Printer className="h-3 w-3" /> A4 çap
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
