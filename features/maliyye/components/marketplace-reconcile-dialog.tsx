"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarRange, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { startMarketplaceReconciliation } from "../actions";

const PLATFORMS = [
  { value: "bolt",      label: "Bolt Food" },
  { value: "wolt",      label: "Wolt" },
  { value: "yango",     label: "Yango Deli" },
  { value: "tap_az",    label: "Tap.az" },
  { value: "progo",     label: "ProGo" },
  { value: "umico",     label: "Umico" },
  { value: "trendyol",  label: "Trendyol" },
  { value: "amazon",    label: "Amazon" },
];

function todayStr() { return new Date().toISOString().slice(0, 10); }
function monthStartStr() {
  const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10);
}

export function MarketplaceReconcileDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [platforma, setPlatforma] = useState("bolt");

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await startMarketplaceReconciliation(fd);
      if (res.ok) {
        toast.success("Yeni dövr açıldı");
        setOpen(false);
        router.refresh();
      } else {
        toast.error(res.error || "Xəta baş verdi");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          className="font-semibold text-white"
          style={{ background: "var(--brand-gradient)" }}
          data-marketplace-reconcile-trigger="1"
        >
          <CalendarRange className="h-4 w-4" /> Yeni dövr
        </Button>
      </DialogTrigger>
      <DialogContent className="md:max-w-md">
        <DialogHeader>
          <DialogTitle>Yeni marketplace dövrü</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="platforma">Platforma *</Label>
            <select
              id="platforma"
              name="platforma"
              required
              value={platforma}
              onChange={(e) => setPlatforma(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
              disabled={pending}
            >
              {PLATFORMS.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="from">Başlanğıc *</Label>
              <Input id="from" name="from" type="date" required defaultValue={monthStartStr()} disabled={pending} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="to">Son *</Label>
              <Input id="to" name="to" type="date" required defaultValue={todayStr()} disabled={pending} />
            </div>
          </div>
          <p className="rounded-md border border-info/20 bg-info/5 px-3 py-2 text-xs text-muted-foreground">
            Sistem seçilmiş dövrdə platforma satışlarını avtomatik toplayır, brüt / komissiya / net hesablayır və yeni hesabat qeydi yaradır.
          </p>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>İmtina</Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Hesablamağa başla
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
