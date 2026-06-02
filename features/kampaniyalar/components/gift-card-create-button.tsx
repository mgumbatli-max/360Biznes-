"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createGiftCard } from "../actions";

export function GiftCardCreateButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [createdKod, setCreatedKod] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [nominal, setNominal] = useState("100");
  const [bitme, setBitme] = useState("");

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await createGiftCard(fd);
      if (res.ok && res.kod) {
        setCreatedKod(res.kod);
        toast.success(`Hədiyyə kartı yaradıldı: ${res.kod}`);
        router.refresh();
      } else if (!res.ok) {
        toast.error(res.error);
      }
    });
  }

  function copy() {
    if (!createdKod) return;
    navigator.clipboard.writeText(createdKod).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function close() {
    setOpen(false);
    setTimeout(() => {
      setCreatedKod(null);
      setNominal("100");
      setBitme("");
    }, 300);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => v ? setOpen(true) : close()}>
      <DialogTrigger asChild>
        <Button size="sm" className="font-semibold text-white" style={{ background: "linear-gradient(135deg, #d946ef, #9333ea)" }}>
          <Plus className="h-4 w-4" /> Yeni hədiyyə kartı
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Yeni hədiyyə kartı</DialogTitle>
        </DialogHeader>

        {createdKod ? (
          <div className="space-y-4 py-2 text-center">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-fuchsia-500 to-purple-600 text-white">
              <Check className="h-8 w-8" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Kart kodu:</p>
              <div className="mt-2 flex items-center justify-center gap-2">
                <code className="rounded-md border border-border bg-card px-4 py-2 font-mono text-lg font-bold">
                  {createdKod}
                </code>
                <Button size="sm" variant="outline" onClick={copy}>
                  {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  {copied ? "Köçürüldü" : "Köçür"}
                </Button>
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">
                Bu kodu müştəriyə verin — POS-da skan edib istifadə edə bilər.
              </p>
            </div>
            <Button onClick={close} className="w-full">Bağla</Button>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="nominal">Nominal məbləğ (₼) *</Label>
              <Input
                id="nominal"
                name="nominal"
                type="number"
                step="0.01"
                min="1"
                value={nominal}
                onChange={(e) => setNominal(e.target.value)}
                required
                disabled={pending}
              />
              <div className="flex gap-1">
                {[50, 100, 200, 500].map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setNominal(String(v))}
                    disabled={pending}
                    className="rounded-md border border-border bg-secondary/40 px-2 py-0.5 text-[11px] font-medium hover:bg-secondary"
                  >
                    {v} ₼
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bitme">Bitmə tarixi (opsional)</Label>
              <Input
                id="bitme"
                name="bitme"
                type="date"
                value={bitme}
                onChange={(e) => setBitme(e.target.value)}
                disabled={pending}
              />
              <p className="text-[10.5px] text-muted-foreground">
                Boş saxlasanız bitmə tarixi olmayacaq
              </p>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={close} disabled={pending}>
                Ləğv
              </Button>
              <Button type="submit" disabled={pending}>
                {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Kart yarat
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
