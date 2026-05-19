"use client";

import { useState, useTransition } from "react";
import { Bell, Loader2, Send } from "lucide-react";
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
import { formatMoney } from "@/lib/utils";

const TEMPLATES = [
  {
    id: "soft",
    title: "Yumşaq xatırlatma",
    text: "Salam {{ad}}, sizdə {{borc}} qalıq borc var. Münasib vaxtda ödəməyi unutmayın, təşəkkürlər.",
  },
  {
    id: "standart",
    title: "Standart xəbərdarlıq",
    text: "Hörmətli {{ad}}, hesabınızda {{borc}} borc qalmışdır. Zəhmət olmasa ödəniş tarixini bildirin.",
  },
  {
    id: "kesin",
    title: "Sərt xatırlatma",
    text: "Hörmətli {{ad}}, {{borc}} borcunuz {{gun}} gündən artıqdır. Xahiş edirik, ən qısa zamanda əlaqə saxlayın.",
  },
];

export function BorcSmsDialog({
  kontragentId,
  ad,
  telefon,
  borc,
  yasGun,
}: {
  kontragentId: string;
  ad: string;
  telefon: string | null;
  borc: number;
  yasGun: number | null;
}) {
  const [open, setOpen] = useState(false);
  const [chosen, setChosen] = useState(TEMPLATES[0].id);
  const [text, setText] = useState("");
  const [pending, startTransition] = useTransition();

  function applyTemplate(id: string) {
    const t = TEMPLATES.find((x) => x.id === id);
    if (!t) return;
    setChosen(id);
    setText(
      t.text
        .replace(/\{\{ad\}\}/g, ad)
        .replace(/\{\{borc\}\}/g, formatMoney(borc))
        .replace(/\{\{gun\}\}/g, String(yasGun ?? 0))
    );
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

  if (!telefon) {
    return (
      <Button
        size="icon-sm"
        variant="ghost"
        disabled
        title="Telefon yoxdur"
        className="text-muted-foreground/50"
      >
        <Bell className="h-3.5 w-3.5" />
      </Button>
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) applyTemplate(TEMPLATES[0].id);
      }}
    >
      <DialogTrigger asChild>
        <Button
          size="icon-sm"
          variant="ghost"
          title="SMS ilə xatırlat"
          className="text-warning hover:text-warning"
        >
          <Bell className="h-3.5 w-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Borc xatırlatma SMS — {ad}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="rounded-md border border-border/60 bg-card/40 p-2 text-[11px]">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Borc:</span>
              <span className="font-semibold tabular-nums text-warning">{formatMoney(borc)}</span>
            </div>
            {yasGun !== null && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Yaş:</span>
                <span className="tabular-nums">{yasGun} gün</span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Telefon:</span>
              <span className="font-mono">{telefon}</span>
            </div>
          </div>

          <div>
            <Label className="text-xs">Şablon</Label>
            <div className="mt-1 flex flex-wrap gap-1">
              {TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => applyTemplate(t.id)}
                  className={`rounded-full border px-2.5 py-1 text-[10.5px] transition ${
                    chosen === t.id
                      ? "border-primary/40 bg-primary/10"
                      : "border-border/40 hover:bg-secondary/30"
                  }`}
                >
                  {t.title}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label htmlFor="borc-sms-text" className="text-xs">Preview / Mətn</Label>
            <textarea
              id="borc-sms-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={4}
              className="mt-1 flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
            <div className="mt-1 text-[10.5px] text-muted-foreground">
              {text.length} simvol · mock göndəriş (jurnal qeyd olunur)
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
