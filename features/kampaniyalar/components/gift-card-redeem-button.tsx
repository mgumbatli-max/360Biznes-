"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Wallet, Loader2, Check, Search } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatMoney } from "@/lib/utils";
import { redeemGiftCard, checkGiftCardBalance } from "../actions";

export function GiftCardRedeemButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [kod, setKod] = useState("");
  const [mebleg, setMebleg] = useState("");
  const [balans, setBalans] = useState<number | null>(null);
  const [done, setDone] = useState<{ applied: number; qaliq: number } | null>(null);

  function check() {
    const k = kod.trim().toUpperCase();
    if (!k) return;
    startTransition(async () => {
      const res = await checkGiftCardBalance(k);
      if (res.ok) {
        setBalans(res.qaliq);
        if (!res.aktiv) toast.warning("Kart deaktivdir");
        else if (res.qaliq <= 0) toast.warning("Kartın qalığı yoxdur");
      } else {
        setBalans(null);
        toast.error(res.error);
      }
    });
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const amt = Number(mebleg);
    if (!(amt > 0)) { toast.error("Məbləğ müsbət olmalıdır"); return; }
    startTransition(async () => {
      const res = await redeemGiftCard({ kart_kod: kod.trim().toUpperCase(), mebleg: amt });
      // revalidatePath server-də ata bilər, amma effekt commit olub — balansı yenidən yoxla
      const chk = await checkGiftCardBalance(kod.trim().toUpperCase());
      if (res.ok) {
        setDone({ applied: res.applied, qaliq: res.qaliq_yeni });
        toast.success(`${formatMoney(res.applied)} istifadə edildi`);
        router.refresh();
      } else if (chk.ok) {
        // artefakt halı: server-effekt var, balansdan tətbiq olunanı çıxar
        const applied = balans != null ? Math.max(0, balans - chk.qaliq) : 0;
        setDone({ applied, qaliq: chk.qaliq });
        toast.success(`${formatMoney(applied)} istifadə edildi`);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  function close() {
    setOpen(false);
    setTimeout(() => { setKod(""); setMebleg(""); setBalans(null); setDone(null); }, 300);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : close())}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="font-semibold">
          <Wallet className="h-4 w-4" /> Kart istifadə et
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Hədiyyə kartı / mağaza krediti istifadə et</DialogTitle>
        </DialogHeader>

        {done ? (
          <div className="space-y-4 py-2 text-center">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white">
              <Check className="h-8 w-8" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">İstifadə olunan məbləğ:</p>
              <div className="mt-1 text-2xl font-bold tabular-nums text-emerald-600">{formatMoney(done.applied)}</div>
              <p className="mt-2 text-sm">Yeni qalıq: <b className="tabular-nums">{formatMoney(done.qaliq)}</b></p>
            </div>
            <Button onClick={close} className="w-full">Bağla</Button>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="gc-kod">Kart kodu *</Label>
              <div className="flex gap-2">
                <Input
                  id="gc-kod"
                  value={kod}
                  onChange={(e) => { setKod(e.target.value.toUpperCase()); setBalans(null); }}
                  placeholder="GC…"
                  className="font-mono"
                  required
                  disabled={pending}
                />
                <Button type="button" variant="outline" size="sm" onClick={check} disabled={pending || !kod.trim()}>
                  {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
                  Yoxla
                </Button>
              </div>
              {balans != null && (
                <p className="text-xs text-muted-foreground">
                  Mövcud qalıq: <b className="tabular-nums text-fuchsia-500">{formatMoney(balans)}</b>
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="gc-mebleg">İstifadə məbləği (₼) *</Label>
              <Input
                id="gc-mebleg"
                type="number"
                step="0.01"
                min="0.01"
                value={mebleg}
                onChange={(e) => setMebleg(e.target.value)}
                placeholder={balans != null ? String(balans) : "0.00"}
                required
                disabled={pending}
              />
              {balans != null && balans > 0 && (
                <button
                  type="button"
                  onClick={() => setMebleg(String(balans))}
                  disabled={pending}
                  className="rounded-md border border-border bg-secondary/40 px-2 py-0.5 text-[11px] font-medium hover:bg-secondary"
                >
                  Hamısı ({formatMoney(balans)})
                </button>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={close} disabled={pending}>Ləğv</Button>
              <Button type="submit" disabled={pending}>
                {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                İstifadə et
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
