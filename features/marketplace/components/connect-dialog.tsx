"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { connectMarketplace } from "../actions";

const PLATFORMS = [
  { value: "umico", label: "Umico" },
  { value: "birmarket", label: "Birmarket" },
  { value: "wolt", label: "Wolt" },
  { value: "tap", label: "Tap.az" },
  { value: "lalafo", label: "Lalafo" },
  { value: "diger", label: "Digər" },
];

export function ConnectDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await connectMarketplace(fd);
      if (!res.ok) setError(res.error);
      else {
        toast.success("Marketplace qoşuldu");
        setOpen(false);
        router.refresh();
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="font-semibold text-white" style={{ background: "var(--brand-gradient)" }}>
          <Plus className="h-4 w-4" /> Yeni hesab qoş
        </Button>
      </DialogTrigger>
      <DialogContent className="md:max-w-md">
        <DialogHeader>
          <DialogTitle>Marketplace hesab qoş</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="platform">Platforma *</Label>
              <select
                id="platform"
                name="platform"
                required
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                disabled={pending}
              >
                {PLATFORMS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="komisyon_faiz">Komisyon %</Label>
              <Input id="komisyon_faiz" name="komisyon_faiz" type="number" min={0} max={100} step="0.01" defaultValue={0} disabled={pending} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ad">Hesab adı *</Label>
            <Input id="ad" name="ad" required minLength={2} maxLength={150} placeholder="Mağaza adı və ya hesab adı" autoFocus disabled={pending} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="store_id">Store ID</Label>
            <Input id="store_id" name="store_id" maxLength={100} placeholder="Platformadakı unikal ID" disabled={pending} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="store_url">Mağaza URL-i</Label>
            <Input id="store_url" name="store_url" type="url" placeholder="https://..." disabled={pending} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="api_key">API açarı</Label>
            <Input id="api_key" name="api_key" type="password" maxLength={500} placeholder="Platforma tərəfindən təmin edilir" disabled={pending} />
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>İmtina</Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Qoş
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
