"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2, HandCoins } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Combobox, type ComboOption } from "@/components/ui/combobox";
import { toast } from "sonner";
import { receivePartialPayment } from "../actions";
import { formatMoney, formatDate } from "@/lib/utils";

type HesabOpt = { id: string; ad: string };
type OpenSale = {
  id: string;
  nomre: string;
  tarix: Date | string;
  qalig: number;
};

type Props = {
  musteriId: string;
  ad: string;
  borc: number;
  hesablar: HesabOpt[];
  openSales: OpenSale[];
  /** "button" = full gradient button, "icon" = compact icon */
  variant?: "icon" | "button" | "gradient";
  /** Optional preselected qaime id */
  defaultQaimeId?: string;
};

export function NisyePaymentQuick({
  musteriId,
  ad,
  borc,
  hesablar,
  openSales,
  variant = "button",
  defaultQaimeId,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const sortedSales = [...openSales].sort((a, b) => {
    const ta = new Date(a.tarix).getTime();
    const tb = new Date(b.tarix).getTime();
    return ta - tb;
  });
  const defaultId = defaultQaimeId ?? sortedSales[0]?.id ?? "";

  const [qaimeId, setQaimeId] = useState<string>(defaultId);
  const [hesabId, setHesabId] = useState<string>(hesablar[0]?.id ?? "");
  const [mebleg, setMebleg] = useState<string>(() => {
    const start = sortedSales[0]?.qalig ?? borc;
    return start > 0 ? start.toFixed(2) : borc.toFixed(2);
  });
  const [fullPay, setFullPay] = useState<boolean>(false);

  // When user picks a different qaime, prefill the amount with its remaining balance
  useEffect(() => {
    const found = sortedSales.find((s) => s.id === qaimeId);
    if (found) {
      setMebleg(found.qalig.toFixed(2));
      setFullPay(false);
    } else if (qaimeId === "") {
      setMebleg(borc.toFixed(2));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qaimeId]);

  // Toggle full debt payment
  useEffect(() => {
    if (fullPay) setMebleg(borc.toFixed(2));
  }, [fullPay, borc]);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    fd.set("musteri_id", musteriId);
    if (qaimeId) fd.set("qaime_id", qaimeId);
    if (hesabId) fd.set("hesab_id", hesabId);
    startTransition(async () => {
      const res = await receivePartialPayment(fd);
      if (!res.ok) setError(res.error);
      else {
        toast.success("Ödəniş qəbul edildi");
        setOpen(false);
        router.refresh();
      }
    });
  }

  const trigger =
    variant === "gradient" ? (
      <Button
        size="sm"
        className="gap-1.5 font-semibold text-white"
        style={{ background: "var(--brand-gradient)" }}
      >
        <HandCoins className="h-3.5 w-3.5" /> Borcdan al
      </Button>
    ) : variant === "icon" ? (
      <Button
        size="icon-sm"
        variant="ghost"
        title="Ödəniş al"
        className="text-success hover:text-success"
      >
        <HandCoins className="h-3.5 w-3.5" />
      </Button>
    ) : (
      <Button size="sm" variant="outline" className="gap-1.5">
        <HandCoins className="h-3.5 w-3.5" /> Ödəniş al
      </Button>
    );

  const saleOptions: ComboOption[] = sortedSales.map((s) => ({
    value: s.id,
    label: `${s.nomre} · ${formatMoney(s.qalig)}`,
    hint: typeof s.tarix === "string" ? s.tarix.slice(0, 10) : formatDate(s.tarix),
  }));
  const hesabOptions: ComboOption[] = hesablar.map((h) => ({ value: h.id, label: h.ad }));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="md:max-w-md">
        <DialogHeader>
          <DialogTitle>Borcdan ödəniş al — {ad}</DialogTitle>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-3">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="rounded-md bg-warning/10 px-3 py-2 text-xs">
            Borc balansı:{" "}
            <span className="font-semibold text-warning">{formatMoney(borc)}</span>
            {sortedSales.length > 0 && (
              <span className="ml-2 text-muted-foreground">
                · {sortedSales.length} açıq qaimə
              </span>
            )}
          </div>

          {sortedSales.length > 0 && (
            <div className="space-y-1.5">
              <Label>Hansı qaiməyə bağlanır</Label>
              <Combobox
                options={[{ value: "", label: "— Ümumi borc (qaimə seçmə) —" }, ...saleOptions]}
                value={qaimeId}
                onChange={setQaimeId}
                placeholder="— Ən köhnə qaimə —"
                searchPlaceholder="🔍 Qaimə axtar..."
                emptyText="Tapılmadı"
                disabled={pending}
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="mebleg">Məbləğ (AZN) *</Label>
            <Input
              id="mebleg"
              name="mebleg"
              type="number"
              step="0.01"
              min="0.01"
              max={borc}
              required
              value={mebleg}
              onChange={(e) => setMebleg(e.target.value)}
              disabled={pending}
              autoFocus
            />
            <label className="flex items-center gap-1.5 text-[10.5px] text-muted-foreground">
              <input
                type="checkbox"
                checked={fullPay}
                onChange={(e) => setFullPay(e.target.checked)}
                disabled={pending}
              />
              Borcu tam yox et ({formatMoney(borc)})
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Hesab / kassa</Label>
              <Combobox
                options={hesabOptions}
                value={hesabId}
                onChange={setHesabId}
                placeholder="— Seçin —"
                searchPlaceholder="🔍 Axtar..."
                emptyText="Tapılmadı"
                disabled={pending}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="odenis_nov">Ödəniş üsulu</Label>
              <select
                id="odenis_nov"
                name="odenis_nov"
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                defaultValue="negd"
                disabled={pending}
              >
                <option value="negd">Nağd</option>
                <option value="kart">Kart</option>
                <option value="kecirme">Bank köçürmə</option>
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="qeyd">Qeyd (istəyə bağlı)</Label>
            <Input id="qeyd" name="qeyd" maxLength={500} disabled={pending} />
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
              İmtina
            </Button>
            <Button type="submit" disabled={pending || !mebleg || Number(mebleg) <= 0}>
              {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Ödəniş al
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
