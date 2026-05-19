"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Combobox, type ComboOption } from "@/components/ui/combobox";
import { toast } from "sonner";
import { createKons } from "../actions";

type Opt = { id: string; ad: string };

export function KonsDialog({
  kontragents,
  products,
}: {
  kontragents: Opt[];
  products: Opt[];
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [kontragentId, setKontragentId] = useState("");
  const [mehsulId, setMehsulId] = useState("");

  // ?yeni=1 ilə gəldikdə dialoqu avtomatik aç
  useEffect(() => {
    if (sp.get("yeni") === "1" && !open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOpen(true);
      const next = new URLSearchParams(sp.toString());
      next.delete("yeni");
      router.replace(`/anbar/konsiqnasiya${next.toString() ? `?${next.toString()}` : ""}`, { scroll: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sp]);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await createKons(fd);
      if (!res.ok) setError(res.error);
      else {
        toast.success("Konsiqnasiya yaradıldı");
        setOpen(false);
        router.refresh();
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="font-semibold text-white" style={{ background: "var(--brand-gradient)" }}>
          <Plus className="h-4 w-4" /> Yeni
        </Button>
      </DialogTrigger>
      <DialogContent className="md:max-w-md">
        <DialogHeader>
          <DialogTitle>Yeni konsiqnasiya</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-3">
          {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>İstiqamət *</Label>
              <select name="istiqamet" required className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
                <option value="verilen">↗ Verilən (bizdən qarşı tərəfə)</option>
                <option value="alinan">↙ Alınan (qarşı tərəfdən bizə)</option>
              </select>
            </div>
            <div>
              <Label>Qarşı tərəf *</Label>
              <Combobox
                options={kontragents.map<ComboOption>((k) => ({ value: String(k.id), label: k.ad }))}
                value={kontragentId}
                onChange={setKontragentId}
                placeholder="— seç —"
                searchPlaceholder="🔍 Qarşı tərəf axtar..."
                emptyText="Tapılmadı"
                disabled={pending}
              />
              <input type="hidden" name="kontragent_id" value={kontragentId} required />
            </div>
          </div>

          <div>
            <Label>Məhsul *</Label>
            <Combobox
              options={products.map<ComboOption>((p) => ({ value: String(p.id), label: p.ad }))}
              value={mehsulId}
              onChange={setMehsulId}
              placeholder="— seç —"
              searchPlaceholder="🔍 Məhsul axtar..."
              emptyText="Tapılmadı"
              disabled={pending}
            />
            <input type="hidden" name="mehsul_id" value={mehsulId} required />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Say *</Label>
              <Input type="number" name="sayi" min={1} step={1} defaultValue={1} required />
            </div>
            <div>
              <Label>Qiymət</Label>
              <Input type="number" name="qiymet" min={0} step={0.01} />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>Ləğv</Button>
            <Button type="submit" disabled={pending} className="font-semibold text-white" style={{ background: "var(--brand-gradient)" }}>
              {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Yarat
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
