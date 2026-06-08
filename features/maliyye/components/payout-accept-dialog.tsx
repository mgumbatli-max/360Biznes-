"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, CheckCircle2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { markPayoutReceived } from "../actions";

type AccountOption = { id: string; ad: string; nov: string };

type Props = {
  payoutId: string;
  platforma: string;
  gozlenen: number;
  defaultHesabId: string | null;
  accountOptions: AccountOption[];
};

export function PayoutAcceptDialog({ payoutId, platforma, gozlenen, defaultHesabId, accountOptions }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [faktiki, setFaktiki] = useState<string>(gozlenen.toFixed(2));
  const [hesabId, setHesabId] = useState<string>(defaultHesabId ?? accountOptions[0]?.id ?? "");
  const [tarix, setTarix] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [qeyd, setQeyd] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Yalnız bank/kart/marketplace hesabları (nağd kassa payout-a uyğun deyil)
  const allowed = accountOptions.filter((a) => ["bank", "kart", "marketplace", "pos"].includes(a.nov));

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!hesabId) {
      setError("Hesab seçilməlidir");
      return;
    }
    const fakt = Number(faktiki);
    if (!Number.isFinite(fakt) || fakt < 0) {
      setError("Faktiki məbləğ düzgün deyil");
      return;
    }
    startTransition(async () => {
      const fd = new FormData();
      fd.set("payout_id", payoutId);
      fd.set("hesab_id", hesabId);
      fd.set("faktiki_mebleg", String(fakt));
      fd.set("tarix", tarix);
      if (qeyd.trim()) fd.set("qeyd", qeyd.trim());
      const res = await markPayoutReceived(fd);
      if (!res.ok) {
        setError(res.error ?? "Xəta");
        toast.error(res.error ?? "Xəta");
        return;
      }
      const ferq = fakt - gozlenen;
      toast.success(
        ferq === 0
          ? `${platforma} payout qəbul edildi`
          : `${platforma} payout qəbul edildi — fərq ${ferq.toFixed(2)} ₼`,
      );
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1">
          <CheckCircle2 className="h-3 w-3" /> Qəbul et
        </Button>
      </DialogTrigger>
      <DialogContent className="md:max-w-md">
        <DialogHeader>
          <DialogTitle>Payout qəbul et — {platforma}</DialogTitle>
          <DialogDescription className="text-xs">
            Gözlənən məbləğ: <strong>{gozlenen.toFixed(2)} ₼</strong>
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-3">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="hesab">Bank/kart hesabı *</Label>
            <select
              id="hesab"
              value={hesabId}
              onChange={(e) => setHesabId(e.target.value)}
              required
              disabled={pending}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="">— Hesab seçin —</option>
              {allowed.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.ad} ({a.nov})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="faktiki">Faktiki məbləğ ₼ *</Label>
              <input
                id="faktiki"
                type="number"
                step="0.01"
                min="0"
                value={faktiki}
                onChange={(e) => setFaktiki(e.target.value)}
                required
                disabled={pending}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring tabular-nums"
              />
              {Number(faktiki) !== gozlenen && Number.isFinite(Number(faktiki)) && (
                <p className="text-[10.5px] text-amber-600">
                  Fərq: {(Number(faktiki) - gozlenen).toFixed(2)} ₼
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tarix">Tarix *</Label>
              <input
                id="tarix"
                type="date"
                value={tarix}
                onChange={(e) => setTarix(e.target.value)}
                required
                disabled={pending}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="qeyd">Qeyd (opsional)</Label>
            <textarea
              id="qeyd"
              value={qeyd}
              onChange={(e) => setQeyd(e.target.value)}
              rows={2}
              maxLength={500}
              disabled={pending}
              className="flex w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
              İmtina
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Qəbul et
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
