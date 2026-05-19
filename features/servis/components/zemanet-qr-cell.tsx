"use client";

import { useState } from "react";
import { QrCode, Printer, ExternalLink, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

/**
 * Renders a tiny QR thumb. Click opens a large preview dialog.
 * Uses Google Chart QR API (public, no deps).
 */
export function ZemanetQrCell({
  unikalKod,
  qrToken,
  musteriAd,
  mehsulAd,
}: {
  unikalKod: string;
  qrToken: string;
  musteriAd?: string | null;
  mehsulAd?: string | null;
}) {
  const [open, setOpen] = useState(false);
  // The QR payload is the public URL to verify warranty
  const url = typeof window !== "undefined"
    ? `${window.location.origin}/zemanet/${qrToken}`
    : `/zemanet/${qrToken}`;
  const small = `https://api.qrserver.com/v1/create-qr-code/?size=32x32&margin=0&data=${encodeURIComponent(url)}`;
  const big = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=8&data=${encodeURIComponent(url)}`;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-background transition hover:border-primary/30"
        title="QR ön-bax"
      >
        <img src={small} alt={`QR ${unikalKod}`} width={28} height={28} className="rounded-sm" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <QrCode className="h-4 w-4" /> Zəmanət QR — {unikalKod}
            </DialogTitle>
          </DialogHeader>

          <div className="flex flex-col items-center gap-3 py-2">
            <img src={big} alt={`QR ${unikalKod}`} width={240} height={240} className="rounded-md border border-border" />
            <div className="w-full space-y-1 text-center">
              <div className="font-mono text-sm font-semibold">{unikalKod}</div>
              {musteriAd && <div className="text-xs text-muted-foreground">{musteriAd}</div>}
              {mehsulAd && <div className="text-xs text-muted-foreground">{mehsulAd}</div>}
              <div className="break-all font-mono text-[10px] text-muted-foreground">{url}</div>
            </div>
            <div className="flex w-full justify-center gap-2 pt-1">
              <Button size="sm" variant="outline" onClick={() => window.print()}>
                <Printer className="h-3.5 w-3.5" /> Çap et
              </Button>
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-8 items-center gap-1.5 rounded-md border border-input px-3 text-sm hover:bg-secondary"
              >
                <ExternalLink className="h-3.5 w-3.5" /> Public view
              </a>
              <Button size="sm" variant="outline" onClick={() => setOpen(false)}>
                <X className="h-3.5 w-3.5" /> Bağla
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
