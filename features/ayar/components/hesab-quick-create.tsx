"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Plus, Wallet, Banknote, CreditCard } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { createFilialHesab } from "../actions";

const HESAB_NOV = [
  { value: "negd", label: "Nağd kassa", icon: Banknote, color: "text-emerald-500 border-emerald-500/40 bg-emerald-500/10" },
  { value: "bank", label: "Bank hesabı", icon: Wallet, color: "text-primary border-primary/40 bg-primary/10" },
  { value: "kart", label: "Kart hesabı", icon: CreditCard, color: "text-violet-500 border-violet-500/40 bg-violet-500/10" },
];

const VALYUTA_LIST = ["AZN", "USD", "EUR", "RUB", "TRY"];

export function HesabQuickCreate({ filialId }: { filialId: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [nov, setNov] = useState<"negd" | "bank" | "kart">("negd");

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    fd.set("filial_id", String(filialId));
    fd.set("nov", nov);
    startTransition(async () => {
      const res = await createFilialHesab(fd);
      if (!res.ok) {
        setError(res.error);
        toast.error(res.error);
      } else {
        toast.success("Hesab yaradıldı — maliyyə bölməsində görünür");
        setOpen(false);
        setNov("negd");
        router.refresh();
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary hover:bg-primary/15"
        >
          <Plus className="h-3 w-3" /> Hesab
        </button>
      </DialogTrigger>
      <DialogContent className="md:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-primary" /> Yeni maliyyə hesabı (bu filiala bağlı)
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-3">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-1.5">
            <Label>Hesab tipi *</Label>
            <div className="grid grid-cols-3 gap-2">
              {HESAB_NOV.map((h) => {
                const Icon = h.icon;
                const active = nov === h.value;
                return (
                  <button
                    key={h.value}
                    type="button"
                    onClick={() => setNov(h.value as "negd" | "bank" | "kart")}
                    className={cn(
                      "flex flex-col items-center gap-1 rounded-lg border p-3 text-xs font-semibold transition",
                      active ? h.color : "border-border bg-secondary/40 text-muted-foreground hover:bg-secondary/70"
                    )}
                  >
                    <Icon className="h-5 w-5" />
                    {h.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-[2fr_1fr]">
            <div className="space-y-1.5">
              <Label htmlFor="hes_ad">Hesab adı *</Label>
              <Input id="hes_ad" name="ad" required minLength={2} maxLength={100} disabled={pending} placeholder={nov === "negd" ? "Əsas kassa" : nov === "bank" ? "Kapital Hesab" : "Visa Gold"} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="hes_val">Valyuta</Label>
              <select id="hes_val" name="valyuta" defaultValue="AZN" className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" disabled={pending}>
                {VALYUTA_LIST.map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </div>
          </div>

          {nov === "bank" && (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_2fr]">
              <div className="space-y-1.5">
                <Label htmlFor="hes_bank">Bank adı</Label>
                <Input id="hes_bank" name="bank_adi" maxLength={150} disabled={pending} placeholder="Kapital Bank" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="hes_iban">IBAN</Label>
                <Input id="hes_iban" name="iban" maxLength={50} disabled={pending} placeholder="AZ77NABZ..." className="font-mono uppercase" />
              </div>
            </div>
          )}

          {nov === "kart" && (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-[2fr_1fr]">
              <div className="space-y-1.5">
                <Label htmlFor="hes_bank2">Bank adı</Label>
                <Input id="hes_bank2" name="bank_adi" maxLength={150} disabled={pending} placeholder="Kapital Bank" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="hes_son4">Kart son 4 rəqəm</Label>
                <Input id="hes_son4" name="kart_son4" maxLength={4} disabled={pending} placeholder="1234" className="font-mono" />
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="hes_qaliq">İlkin balans (₼)</Label>
            <Input id="hes_qaliq" name="qaliq" type="number" step="0.01" defaultValue="0" disabled={pending} />
            <p className="text-[11px] text-muted-foreground">
              Bu məbləğ «opening balance» kassa orderi kimi yazılır və hesabatlarda görünür
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="hes_qeyd">Qeyd</Label>
            <Input id="hes_qeyd" name="qeyd" maxLength={500} disabled={pending} />
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
              İmtina
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Yarat
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
