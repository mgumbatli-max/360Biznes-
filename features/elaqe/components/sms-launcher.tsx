"use client";

import { useState, useTransition } from "react";
import { MessageSquare, Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { sendContactSms } from "../actions";

const TEMPLATES = [
  {
    id: "tehlukesiz",
    title: "Təhlükəsiz salamlama",
    text: "Salam {{ad}}, sizinlə əlaqə saxlamaq istəyirik. Münasib vaxtınız varmı?",
  },
  {
    id: "borc",
    title: "Borc xəbərdarlıq",
    text: "Hörmətli {{ad}}, hesabınızda qalıq borc yaranıb. Zəhmət olmasa nə zaman ödəyə biləcəyinizi bildirin.",
  },
  {
    id: "follow",
    title: "Follow-up",
    text: "Salam {{ad}}, son danışdığımız təklif barədə qərarınızı öyrənmək istəyirik.",
  },
  {
    id: "tesekkur",
    title: "Təşəkkür",
    text: "Hörmətli {{ad}}, bizimlə işbirliyiniz üçün təşəkkür edirik. Müştəri loyalıq proqramına üzv ola bilərsiniz.",
  },
  {
    id: "kampaniya",
    title: "Kampaniya",
    text: "Salam {{ad}}, bu həftə xüsusi endirim kampaniyamız var. Filialımıza dəvət edirik!",
  },
  {
    id: "servis",
    title: "Servis bitdi",
    text: "Hörmətli {{ad}}, sifarişiniz hazırdır, müştəri xidmətindən götürə bilərsiniz.",
  },
];

export function SmsLauncher({
  kontragentId,
  kontragentAd,
  telefon,
  size = "sm",
}: {
  kontragentId: string;
  kontragentAd: string;
  telefon: string | null;
  size?: "sm" | "xs";
}) {
  const [open, setOpen] = useState(false);
  const [chosen, setChosen] = useState<string>(TEMPLATES[0].id);
  const [text, setText] = useState(TEMPLATES[0].text);
  const [pending, startTransition] = useTransition();

  function applyTemplate(id: string) {
    const t = TEMPLATES.find((x) => x.id === id);
    if (!t) return;
    setChosen(id);
    setText(t.text.replace(/\{\{ad\}\}/g, kontragentAd));
  }

  function onSend() {
    if (!telefon) {
      toast.error("Telefon yoxdur");
      return;
    }
    if (!text.trim()) {
      toast.error("Mətn boşdur");
      return;
    }
    startTransition(async () => {
      const res = await sendContactSms(kontragentId, text);
      if (res.ok) {
        toast.success("SMS qeyd edildi (mock send)");
        setOpen(false);
      } else toast.error(res.error);
    });
  }

  if (!telefon) return null;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) {
          // initialize with substituted name
          setText(TEMPLATES[0].text.replace(/\{\{ad\}\}/g, kontragentAd));
          setChosen(TEMPLATES[0].id);
        }
      }}
    >
      <DialogTrigger asChild>
        {size === "xs" ? (
          <Button size="icon-sm" variant="ghost" title="SMS göndər">
            <MessageSquare className="h-3.5 w-3.5" />
          </Button>
        ) : (
          <Button size="sm" variant="outline" className="h-6 gap-1 px-1.5 text-[10.5px]">
            <MessageSquare className="h-3 w-3" /> SMS
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>SMS göndər — {kontragentAd}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label className="text-xs">Şablon seç</Label>
            <div className="mt-1 flex flex-wrap gap-1">
              {TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => applyTemplate(t.id)}
                  className={`rounded-full border px-2.5 py-1 text-[10.5px] transition ${
                    chosen === t.id ? "border-primary/40 bg-primary/10" : "border-border/40 hover:bg-secondary/30"
                  }`}
                >
                  {t.title}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label htmlFor="sms-text" className="text-xs">Mətn</Label>
            <textarea
              id="sms-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={4}
              className="mt-1 flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
            <div className="mt-1 text-[10.5px] text-muted-foreground">
              {text.length} simvol · {telefon} nömrəsinə göndəriləcək
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            Bağla
          </Button>
          <Button onClick={onSend} disabled={pending || !text.trim()}>
            {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            Göndər
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
