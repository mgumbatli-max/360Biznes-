"use client";

import { useState, useTransition } from "react";
import { Send, Loader2, Check } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { broadcastCampaignToTelegram } from "../actions";

export function TelegramBroadcastButton({ campaignId }: { campaignId: string }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [mesaj, setMesaj] = useState("");
  const [sent, setSent] = useState(false);

  function onSend() {
    startTransition(async () => {
      const res = await broadcastCampaignToTelegram({
        campaign_id: campaignId,
        mesaj: mesaj.trim() || undefined,
      });
      if (res.ok) {
        setSent(true);
        toast.success("Telegram-a göndərildi");
      } else {
        toast.error(res.error);
      }
    });
  }

  function close() {
    setOpen(false);
    setTimeout(() => { setMesaj(""); setSent(false); }, 300);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => v ? setOpen(true) : close()}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="text-sky-600 dark:text-sky-400 border-sky-500/30 hover:bg-sky-500/10">
          <Send className="h-3.5 w-3.5" /> Telegram-a göndər
        </Button>
      </DialogTrigger>
      <DialogContent className="md:max-w-lg">
        <DialogHeader>
          <DialogTitle>Telegram broadcast</DialogTitle>
        </DialogHeader>

        {sent ? (
          <div className="space-y-3 py-4 text-center">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-emerald-500/15">
              <Check className="h-7 w-7 text-emerald-500" />
            </div>
            <p className="font-semibold">Göndərildi!</p>
            <p className="text-sm text-muted-foreground">
              Mesaj sahibkar Telegram kanalına/chat-inə uğurla yayımlandı.
            </p>
            <Button onClick={close} className="w-full">Bağla</Button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Bu kampaniyanı şirkət Telegram kanalına / chat-inə yayımla. Müştəri/abunəçilər mesajı dərhal görəcək.
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="mesaj">Xüsusi mesaj (boş saxlasanız avtomatik formatda göndəriləcək)</Label>
              <textarea
                id="mesaj"
                value={mesaj}
                onChange={(e) => setMesaj(e.target.value)}
                rows={5}
                maxLength={2000}
                placeholder="Boş — kampaniya məlumatları HTML formatında avtomatik yığılacaq"
                className="flex w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm"
                disabled={pending}
              />
              <p className="text-[10.5px] text-muted-foreground">
                Telegram <b>HTML</b> dəstəkləyir — <code>&lt;b&gt;</code>, <code>&lt;i&gt;</code>, <code>&lt;a&gt;</code> teqləri istifadə edə bilərsən.
              </p>
            </div>
            <div className="rounded-md border border-sky-500/30 bg-sky-500/5 px-3 py-2 text-[11px] text-muted-foreground">
              💡 Konfiqurasiya: <code>/ayarlar/inteqrasiya</code> → Telegram chat_id qoyulmalıdır.
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={close} disabled={pending}>Ləğv</Button>
              <Button type="button" onClick={onSend} disabled={pending}>
                {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                Göndər
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
