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
import { createBron } from "../actions";

type Opt = { id: string | number; ad: string; telefon?: string | null; barkod?: string | null };

export function BronDialog({
  products,
  customers,
  warehouses,
}: {
  products: Opt[];
  customers: Opt[];
  warehouses: Opt[];
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [mehsulId, setMehsulId] = useState("");
  const [anbarId, setAnbarId] = useState("");
  const [musteriId, setMusteriId] = useState("");

  // ?yeni=1 ilə gəldikdə dialoqu avtomatik aç
  useEffect(() => {
    if (sp.get("yeni") === "1" && !open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOpen(true);
      const next = new URLSearchParams(sp.toString());
      next.delete("yeni");
      router.replace(`/anbar/bron${next.toString() ? `?${next.toString()}` : ""}`, { scroll: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sp]);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await createBron(fd);
      if (!res.ok) setError(res.error);
      else {
        toast.success("Bron yaradıldı");
        setOpen(false);
        router.refresh();
      }
    });
  }

  // Mount zamanı bir dəfə hesablanır — render boyu sabit qalır (useState init lazy).
  const [defaultBitme] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 10);
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="font-semibold text-white" style={{ background: "var(--brand-gradient)" }}>
          <Plus className="h-4 w-4" /> Yeni bron
        </Button>
      </DialogTrigger>
      <DialogContent className="md:max-w-lg">
        <DialogHeader>
          <DialogTitle>Yeni bron</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-3">
          {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

          <div>
            <Label>Məhsul *</Label>
            <Combobox
              options={products.map<ComboOption>((p) => ({
                value: String(p.id),
                label: p.ad,
                hint: p.barkod ?? undefined,
              }))}
              value={mehsulId}
              onChange={setMehsulId}
              placeholder="— seç —"
              searchPlaceholder="🔍 Məhsul axtar (ad, barkod)..."
              emptyText="Məhsul tapılmadı"
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
              <Label>Anbar</Label>
              <Combobox
                options={warehouses.map<ComboOption>((a) => ({ value: String(a.id), label: a.ad }))}
                value={anbarId}
                onChange={setAnbarId}
                placeholder="—"
                searchPlaceholder="🔍 Anbar axtar..."
                emptyText="Anbar tapılmadı"
                disabled={pending}
              />
              <input type="hidden" name="anbar_id" value={anbarId} />
            </div>
          </div>

          <div>
            <Label>Müştəri</Label>
            <Combobox
              options={customers.map<ComboOption>((c) => ({
                value: String(c.id),
                label: c.ad,
                hint: c.telefon ?? undefined,
              }))}
              value={musteriId}
              onChange={setMusteriId}
              placeholder="— və ya boş ad yaz —"
              searchPlaceholder="🔍 Müştəri axtar (ad, telefon)..."
              emptyText="Müştəri tapılmadı"
              disabled={pending}
            />
            <input type="hidden" name="musteri_id" value={musteriId} />
            <Input name="musteri_ad" placeholder="və ya ad yaz" className="mt-1.5" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Telefon</Label>
              <Input name="musteri_telefon" placeholder="+994 xx xxx xx xx" />
            </div>
            <div>
              <Label>Bitir</Label>
              <Input type="date" name="bitme_tarixi" defaultValue={defaultBitme} />
            </div>
          </div>

          <div>
            <Label>Qeyd</Label>
            <Input name="qeyd" placeholder="Əlavə qeyd" />
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
