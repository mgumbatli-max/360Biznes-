"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, XCircle } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { changeServisStatus } from "../actions";

const REASONS = [
  { value: "musteri_imtina", label: "Müştəri imtina etdi" },
  { value: "temir_mumkun_deyil", label: "Təmir mümkün deyil" },
  { value: "qiymet_yuksek", label: "Qiymət yüksək" },
  { value: "hisse_tapilmir", label: "Hissə tapılmır" },
  { value: "diger", label: "Digər" },
] as const;

export function RejectReasonDialog({
  servisId,
  trigger,
  onDone,
}: {
  servisId: string;
  trigger?: React.ReactNode;
  onDone?: () => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string>("musteri_imtina");
  const [diger, setDiger] = useState("");
  const [pending, startTransition] = useTransition();

  const isDiger = selected === "diger";
  const canSubmit = selected !== "" && (!isDiger || diger.trim().length > 2);

  function submit() {
    if (!canSubmit) return;
    const label = REASONS.find((r) => r.value === selected)?.label ?? selected;
    const reason = isDiger ? `Səbəb: Digər — ${diger.trim()}` : `Səbəb: ${label}`;
    startTransition(async () => {
      const res = await changeServisStatus(servisId, "redd_edildi", reason);
      if (res.ok) {
        toast.success("Servis rədd edildi");
        setOpen(false);
        setSelected("musteri_imtina");
        setDiger("");
        router.refresh();
        onDone?.();
      } else {
        toast.error(res.error);
      }
    });
  }

  const defaultTrigger = (
    <Button size="sm" variant="outline" className="border-rose-400/40 text-rose-300 hover:bg-rose-500/10">
      <XCircle className="mr-1.5 h-3.5 w-3.5" /> Rədd edildi
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger ?? defaultTrigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">Rədd səbəbini seçin</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <Label className="text-[10.5px] uppercase tracking-wider text-muted-foreground">
            Səbəb *
          </Label>
          <div className="space-y-1.5">
            {REASONS.map((r) => (
              <label
                key={r.value}
                className="flex cursor-pointer items-center gap-2 rounded-md border border-border/40 bg-card/30 px-3 py-2 text-sm hover:bg-secondary/40"
              >
                <input
                  type="radio"
                  name="reject-reason"
                  value={r.value}
                  checked={selected === r.value}
                  onChange={() => setSelected(r.value)}
                  disabled={pending}
                  className="h-3.5 w-3.5 accent-rose-500"
                />
                <span>{r.label}</span>
              </label>
            ))}
          </div>
          {isDiger && (
            <div className="space-y-1.5">
              <Label className="text-[10.5px] uppercase tracking-wider text-muted-foreground">
                Digər səbəb (məcburi)
              </Label>
              <textarea
                value={diger}
                onChange={(e) => setDiger(e.target.value)}
                rows={3}
                maxLength={400}
                placeholder="Səbəbi qısa şəkildə açıqlayın…"
                disabled={pending}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)} disabled={pending}>
            Ləğv
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={submit}
            disabled={pending || !canSubmit}
            className="bg-rose-600 text-white hover:bg-rose-700"
          >
            {pending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <XCircle className="mr-1.5 h-3.5 w-3.5" />}
            Təsdiq et
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
