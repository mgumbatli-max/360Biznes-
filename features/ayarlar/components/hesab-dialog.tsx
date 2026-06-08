"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Loader2, Wallet, Landmark, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { saveMaliyyeHesab } from "@/features/ayarlar/hesab-actions";
import { cn } from "@/lib/utils";

type Filial = { id: number; ad: string };
type Hesab = {
  id: string;
  ad: string;
  nov: string;
  valyuta: string | null;
  bank_adi: string | null;
  iban: string | null;
  kart_son4: string | null;
  pos_kodu: string | null;
  filial_id: number | null;
  qeyd: string | null;
  aktiv: boolean | null;
};

const NOV_OPTIONS: Array<{ value: "negd" | "bank" | "kart"; label: string; icon: React.ComponentType<{ className?: string }>; cls: string }> = [
  { value: "negd", label: "Nağd kassa", icon: Wallet, cls: "text-emerald-600" },
  { value: "bank", label: "Bank hesabı", icon: Landmark, cls: "text-primary" },
  { value: "kart", label: "Bank kartı", icon: CreditCard, cls: "text-violet-500" },
];

export function HesabDialog({ filiallar = [], hesab }: { filiallar?: Filial[]; hesab?: Hesab }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [nov, setNov] = useState<"negd" | "bank" | "kart">((hesab?.nov as "negd" | "bank" | "kart") ?? "negd");

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    fd.set("nov", nov);
    startTransition(async () => {
      const res = await saveMaliyyeHesab(fd);
      if (!res.ok) {
        setError(res.error);
      } else {
        toast.success(hesab ? "Yeniləndi" : "Hesab yaradıldı");
        setOpen(false);
        router.refresh();
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {hesab ? (
          <Button variant="ghost" size="icon-sm" title="Redaktə">
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        ) : (
          <Button size="sm" className="font-semibold text-white" style={{ background: "var(--brand-gradient)" }}>
            <Plus className="h-4 w-4" /> Yeni hesab
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="md:max-w-lg">
        <DialogHeader>
          <DialogTitle>{hesab ? `Redaktə: ${hesab.ad}` : "Yeni maliyyə hesabı"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
          {hesab && <input type="hidden" name="id" value={hesab.id} />}

          {/* Növ seçimi — 3 kart şəklində */}
          <div className="space-y-1.5">
            <Label>Növ *</Label>
            <div className="grid grid-cols-3 gap-2">
              {NOV_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                const active = nov === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setNov(opt.value)}
                    disabled={pending}
                    className={cn(
                      "flex flex-col items-center gap-1 rounded-lg border-2 px-2 py-3 text-xs font-semibold transition-all",
                      active
                        ? "border-primary bg-primary/10 shadow-sm"
                        : "border-border/60 hover:border-border hover:bg-secondary/30",
                    )}
                  >
                    <Icon className={cn("h-4 w-4", active && opt.cls)} />
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ad">Hesab adı *</Label>
            <Input id="ad" name="ad" required minLength={2} maxLength={100} defaultValue={hesab?.ad ?? ""} placeholder="Əsas kassa, Kapital Bank, Birbank..." autoFocus disabled={pending} />
          </div>

          {nov === "bank" && (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="bank_adi">Bank adı</Label>
                <Input id="bank_adi" name="bank_adi" maxLength={100} defaultValue={hesab?.bank_adi ?? ""} placeholder="Kapital, ABB, Pasha..." disabled={pending} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="iban">IBAN</Label>
                <Input id="iban" name="iban" maxLength={50} defaultValue={hesab?.iban ?? ""} placeholder="AZ..." disabled={pending} />
              </div>
            </div>
          )}

          {nov === "kart" && (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="bank_adi">Kart bankı</Label>
                <Input id="bank_adi" name="bank_adi" maxLength={100} defaultValue={hesab?.bank_adi ?? ""} placeholder="Birbank, Pasha..." disabled={pending} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="kart_son4">Son 4 rəqəm</Label>
                <Input id="kart_son4" name="kart_son4" maxLength={4} inputMode="numeric" pattern="\d{4}" defaultValue={hesab?.kart_son4 ?? ""} placeholder="1234" disabled={pending} />
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label htmlFor="pos_kodu">POS kodu (opsional)</Label>
                <Input id="pos_kodu" name="pos_kodu" maxLength={50} defaultValue={hesab?.pos_kodu ?? ""} placeholder="POS terminal qoşulması üçün" disabled={pending} />
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="valyuta">Valyuta</Label>
              <select id="valyuta" name="valyuta" defaultValue={hesab?.valyuta ?? "AZN"} disabled={pending} className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm">
                <option value="AZN">AZN</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="RUB">RUB</option>
                <option value="TRY">TRY</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="filial_id">Filial</Label>
              <select id="filial_id" name="filial_id" defaultValue={hesab?.filial_id ?? ""} disabled={pending} className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm">
                <option value="">— Bütün filiallar —</option>
                {filiallar.map((f) => (
                  <option key={f.id} value={f.id}>{f.ad}</option>
                ))}
              </select>
            </div>
          </div>

          {!hesab && (
            <div className="space-y-1.5">
              <Label htmlFor="acilis_qaligi">Açılış qalığı</Label>
              <Input id="acilis_qaligi" name="acilis_qaligi" type="number" min={0} step="0.01" defaultValue={0} placeholder="0.00" disabled={pending} />
              <p className="text-[10.5px] text-muted-foreground">
                Sıfırdan başlayarsa boş saxla. Mövcud balans varsa daxil et.
              </p>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="qeyd">Qeyd</Label>
            <textarea id="qeyd" name="qeyd" maxLength={500} defaultValue={hesab?.qeyd ?? ""} rows={2} className="w-full rounded-md border border-input bg-transparent px-3 py-1.5 text-sm" disabled={pending} />
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="aktiv" defaultChecked={hesab ? hesab.aktiv !== false : true} className="h-4 w-4 accent-primary" disabled={pending} />
            Aktivdir (əməliyyatlarda istifadə olunsun)
          </label>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Bağla
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              {hesab ? "Yenilə" : "Hesab yarat"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
