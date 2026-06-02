"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2, Ticket, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { bulkGenerateCoupons } from "../actions";

export function CouponBulkDialog({ campaignId, campaignName }: { campaignId: string; campaignName: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [created, setCreated] = useState<{ count: number; sample: string[] } | null>(null);
  const [prefix, setPrefix] = useState("ENDIRIM");
  const [count, setCount] = useState("50");
  const [maxUses, setMaxUses] = useState("1");
  const [bitme, setBitme] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    startTransition(async () => {
      const res = await bulkGenerateCoupons({
        campaign_id: campaignId,
        prefix: prefix.toUpperCase().replace(/[^A-Z0-9]/g, ""),
        count: Number(count),
        max_uses_per_kod: Number(maxUses),
        bitme: bitme || undefined,
      });
      if (res.ok) {
        setCreated({ count: res.created, sample: res.sample });
        toast.success(`${res.created} kupon yaradıldı`);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  function copyOne(kod: string) {
    navigator.clipboard.writeText(kod).then(() => {
      setCopied(kod);
      setTimeout(() => setCopied(null), 1500);
    });
  }

  function close() {
    setOpen(false);
    setTimeout(() => {
      setCreated(null);
      setPrefix("ENDIRIM");
      setCount("50");
    }, 300);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => v ? setOpen(true) : close()}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Ticket className="h-3.5 w-3.5" /> Toplu kupon yarat
        </Button>
      </DialogTrigger>
      <DialogContent className="md:max-w-md">
        <DialogHeader>
          <DialogTitle>Toplu kupon kod generasiya</DialogTitle>
        </DialogHeader>

        {created ? (
          <div className="space-y-3 py-2">
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 text-center">
              <div className="text-3xl font-bold text-emerald-500">{created.count}</div>
              <div className="text-xs text-muted-foreground">kupon yaradıldı</div>
            </div>
            <div>
              <Label className="text-xs">Nümunə kodlar (5 ədəd)</Label>
              <div className="mt-1.5 space-y-1">
                {created.sample.map((kod) => (
                  <button
                    key={kod}
                    type="button"
                    onClick={() => copyOne(kod)}
                    className="flex w-full items-center justify-between rounded-md border border-border bg-card px-3 py-1.5 text-sm font-mono hover:border-primary/40"
                  >
                    <span>{kod}</span>
                    {copied === kod ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3 text-muted-foreground" />}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-[10.5px] text-muted-foreground">
                Bütün kodları görmək üçün kupon siyahısına bax. CSV ixrac da var.
              </p>
            </div>
            <Button onClick={close} className="w-full">Bağla</Button>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Kampaniya: <strong className="text-foreground">{campaignName}</strong>
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="prefix">Prefiks (yalnız böyük hərf və rəqəm)</Label>
              <Input
                id="prefix"
                value={prefix}
                onChange={(e) => setPrefix(e.target.value.toUpperCase().slice(0, 10))}
                disabled={pending}
                required
                minLength={2}
                maxLength={10}
              />
              <p className="text-[10.5px] text-muted-foreground">Kodlar belə görünəcək: <code className="font-mono">{prefix || "ENDIRIM"}XXXXXX</code></p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="count">Sayı</Label>
                <Input
                  id="count"
                  type="number"
                  min="1"
                  max="2000"
                  value={count}
                  onChange={(e) => setCount(e.target.value)}
                  disabled={pending}
                  required
                />
                <div className="flex gap-1">
                  {[10, 50, 100, 500].map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setCount(String(v))}
                      disabled={pending}
                      className="rounded-md border border-border bg-secondary/40 px-2 py-0.5 text-[10.5px] hover:bg-secondary"
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="maxUses">Hər kod neçə dəfə</Label>
                <Input
                  id="maxUses"
                  type="number"
                  min="1"
                  value={maxUses}
                  onChange={(e) => setMaxUses(e.target.value)}
                  disabled={pending}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bitme">Bitmə tarixi (opsional)</Label>
              <Input id="bitme" type="date" value={bitme} onChange={(e) => setBitme(e.target.value)} disabled={pending} />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={close} disabled={pending}>Ləğv</Button>
              <Button type="submit" disabled={pending}>
                {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                Yarat
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
