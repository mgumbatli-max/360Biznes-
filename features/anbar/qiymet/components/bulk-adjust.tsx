"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Zap, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { bulkAdjustPercent } from "../actions";

const FIELD_OPTS: Array<{ value: "alish_qiymeti" | "satis_qiymeti" | "endirimli_qiymet" | "min_satis_qiymeti" | "topdan_qiymeti" | "partnyor_qiymeti" | "vip_qiymeti"; label: string }> = [
  { value: "satis_qiymeti",      label: "Satış" },
  { value: "endirimli_qiymet",   label: "Endirim" },
  { value: "min_satis_qiymeti",  label: "Min satış" },
  { value: "topdan_qiymeti",     label: "Topdan" },
  { value: "partnyor_qiymeti",   label: "Partnyor" },
  { value: "vip_qiymeti",        label: "VIP" },
  { value: "alish_qiymeti",      label: "Alış (maya)" },
];

export function BulkAdjust() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [field, setField] = useState<typeof FIELD_OPTS[number]["value"]>("satis_qiymeti");
  const [percent, setPercent] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit() {
    const p = Number(percent);
    if (!Number.isFinite(p) || p < -100 || p > 1000) {
      setError("Faiz −100 ilə 1000 arasında olmalıdır");
      return;
    }
    if (!window.confirm(`Bütün aktiv məhsulların "${FIELD_OPTS.find((f) => f.value === field)?.label}" qiyməti ${p}% dəyişəcək. Davam edək?`)) return;
    setError(null);
    startTransition(async () => {
      const r = await bulkAdjustPercent({ field, percent: p });
      if (r.ok) {
        toast.success("Qiymətlər yeniləndi");
        setOpen(false);
        setPercent("");
        router.refresh();
      } else {
        toast.error(r.error);
        setError(r.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Zap className="h-3.5 w-3.5" /> Toplu faiz dəyişikliyi
        </Button>
      </DialogTrigger>
      <DialogContent className="md:max-w-md">
        <DialogHeader>
          <DialogTitle>Toplu qiymət dəyişikliyi</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
          <div>
            <Label>Qiymət növü</Label>
            <select value={field} onChange={(e) => setField(e.target.value as typeof field)} className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
              {FIELD_OPTS.map((f) => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </select>
          </div>
          <div>
            <Label>Faiz dəyişikliyi (%)</Label>
            <Input type="number" min={-100} max={1000} step="0.1" value={percent} onChange={(e) => setPercent(e.target.value)} placeholder="məs. 10 (10% artır) və ya -5 (5% azalt)" />
            <p className="mt-1 text-[10.5px] text-muted-foreground">
              Mənfi rəqəm endirim, müsbət rəqəm artırma. Hesab: yeni = köhnə × (1 + faiz/100)
            </p>
          </div>
          <Alert>
            <AlertDescription className="text-xs">
              Bu əməliyyat bütün aktiv məhsulları əhatə edir və ləğv edilə bilməz.
            </AlertDescription>
          </Alert>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>İmtina</Button>
          <Button onClick={submit} disabled={pending || !percent} className="font-semibold text-white" style={{ background: "var(--brand-gradient)" }}>
            {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Tətbiq et
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
