"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2, Coins } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createLoyaltyCard, adjustLoyaltyBalans } from "../actions";

type Props =
  | { kontragentId: string; hasCard: false; kartId?: never; balans?: never }
  | { kontragentId: string; hasCard: true; kartId: string; balans: number };

export function CustomerLoyaltyActions(props: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (!props.hasCard) {
    return (
      <Button
        size="sm"
        onClick={() => {
          startTransition(async () => {
            const res = await createLoyaltyCard(props.kontragentId);
            if (res.ok) {
              toast.success(`Kart yaradıldı: ${res.kart_kod}`);
              router.refresh();
            } else toast.error(res.error);
          });
        }}
        disabled={pending}
        className="font-semibold text-white"
        style={{ background: "linear-gradient(135deg, #f59e0b, #ea580c)" }}
      >
        {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
        Kart aç
      </Button>
    );
  }

  return <AdjustBalansDialog kartId={props.kartId} balans={props.balans} onDone={() => router.refresh()} />;
}

function AdjustBalansDialog({ kartId, balans, onDone }: { kartId: string; balans: number; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [mebleg, setMebleg] = useState("");
  const [qeyd, setQeyd] = useState("");
  const [tip, setTip] = useState<"artir" | "azalt">("artir");

  function submit() {
    const num = Number(mebleg);
    if (!Number.isFinite(num) || num <= 0) return toast.error("Düzgün məbləğ daxil et");
    const signed = tip === "artir" ? num : -num;
    if (tip === "azalt" && num > balans) return toast.error(`Balans yalnız ${balans} ₼-dir, daha çox sərf oluna bilməz`);
    startTransition(async () => {
      const res = await adjustLoyaltyBalans(kartId, signed, qeyd.trim() || (tip === "artir" ? "Manuel bonus" : "Manuel sərf"));
      if (res.ok) {
        toast.success(tip === "artir" ? `${num} ₼ bonus əlavə olundu` : `${num} ₼ bonus sərf olundu`);
        setOpen(false);
        setMebleg(""); setQeyd("");
        onDone();
      } else toast.error(res.error);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Coins className="h-3 w-3" /> Balans dəyiş
        </Button>
      </DialogTrigger>
      <DialogContent className="md:max-w-sm">
        <DialogHeader>
          <DialogTitle>Bonus balansını dəyiş</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Cari balans: <b className="text-foreground tabular-nums">{balans} ₼</b>
          </p>
          <div className="inline-flex w-full rounded-md border border-border p-0.5 bg-secondary/40">
            <button
              type="button"
              onClick={() => setTip("artir")}
              disabled={pending}
              className={`flex-1 rounded-sm px-3 py-1 text-xs font-semibold transition ${tip === "artir" ? "bg-emerald-500 text-white" : "text-muted-foreground"}`}
            >
              + Artır
            </button>
            <button
              type="button"
              onClick={() => setTip("azalt")}
              disabled={pending}
              className={`flex-1 rounded-sm px-3 py-1 text-xs font-semibold transition ${tip === "azalt" ? "bg-rose-500 text-white" : "text-muted-foreground"}`}
            >
              − Azalt
            </button>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mebleg">Məbləğ (₼)</Label>
            <Input id="mebleg" type="number" min="0" step="0.01" value={mebleg} onChange={(e) => setMebleg(e.target.value)} disabled={pending} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="qeyd">Səbəb (opsional)</Label>
            <Input id="qeyd" value={qeyd} onChange={(e) => setQeyd(e.target.value)} placeholder="məs. Doğum günü bonusu" disabled={pending} />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>Ləğv</Button>
          <Button onClick={submit} disabled={pending}>
            {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Təsdiq
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
