"use client";

import { useState } from "react";
import { Share2, Copy, Check, MessageSquare, QrCode } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

/**
 * Müştəriyə tracking link göndər modal.
 * Token = zəmanət qr_token (varsa) və ya servis id-nin son 8 simvolu.
 */
export function MusteriShareButton({
  servisId,
  servisNomre,
  musteriAd,
  musteriTelefon,
  qrToken,
}: {
  servisId: string;
  servisNomre: string;
  musteriAd: string;
  musteriTelefon: string;
  qrToken: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const token = qrToken ?? servisId.slice(-8);
  const url =
    typeof window !== "undefined"
      ? `${window.location.origin}/servis-track/${token}`
      : `/servis-track/${token}`;
  const qrBig = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=4&data=${encodeURIComponent(url)}`;

  function copyLink() {
    void navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      toast.success("Link kopyalandı");
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function sendSms() {
    // Mock: gerçəyində /api/sms endpoint çağırardı
    const msg = `Hörmətli ${musteriAd}, servis sifarişinizi (${servisNomre}) bu link ilə izləyin: ${url}`;
    toast.success(`SMS göndərildi (mock): ${musteriTelefon}`);
    console.log("[mock-sms]", { tel: musteriTelefon, msg });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Share2 className="h-3.5 w-3.5" /> Müştəriyə link
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <QrCode className="h-4 w-4" /> Servis izləmə linki
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center gap-3 py-2">
          <img
            src={qrBig}
            alt="QR"
            width={220}
            height={220}
            className="rounded-md border border-border"
          />
          <div className="w-full space-y-1 text-center">
            <div className="text-xs text-muted-foreground">{musteriAd}</div>
            <div className="break-all rounded-md border border-border bg-secondary/40 px-2 py-1.5 font-mono text-[11px]">
              {url}
            </div>
          </div>
          <div className="flex w-full gap-2 pt-1">
            <Button type="button" variant="outline" size="sm" onClick={copyLink} className="flex-1">
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Kopyalandı" : "Linki kopyala"}
            </Button>
            <Button type="button" size="sm" onClick={sendSms} className="flex-1">
              <MessageSquare className="h-3.5 w-3.5" /> SMS göndər
            </Button>
          </div>
          <p className="pt-2 text-center text-[10.5px] text-muted-foreground">
            Müştəri bu linkdən servisin cari statusunu və vəd tarixini görə bilər.
            Daxili qeydlər və əməkdaş kommentariyaları gizlədilir.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
