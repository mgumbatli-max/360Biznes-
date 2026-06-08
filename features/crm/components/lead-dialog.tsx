"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { saveLead } from "../actions";
import type { LeadCard } from "../types";

type UserOption = { id: string; ad_soyad: string };
type Props = {
  initial?: LeadCard;
  trigger?: "new" | "edit";
  users?: UserOption[];
  defaultOpen?: boolean;
  onOpenChange?: (v: boolean) => void;
  hideTrigger?: boolean;
};

export function LeadDialog({
  initial,
  trigger = "new",
  users = [],
  defaultOpen,
  onOpenChange,
  hideTrigger,
}: Props) {
  const router = useRouter();
  const [open, setOpenState] = useState(defaultOpen ?? false);
  function setOpen(v: boolean) {
    setOpenState(v);
    onOpenChange?.(v);
  }
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    if (initial?.id) fd.set("id", initial.id);
    startTransition(async () => {
      const res = await saveLead(fd);
      if (!res.ok) {
        setError(res.error);
      } else {
        toast.success(initial ? "Yeniləndi" : "Yaradıldı");
        setOpen(false);
        router.refresh();
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!hideTrigger && (
        <DialogTrigger asChild>
          {trigger === "new" ? (
            <Button size="sm" className="font-semibold text-white" style={{ background: "var(--brand-gradient)" }}>
              <Plus className="h-4 w-4" /> Yeni lead
            </Button>
          ) : (
            <Button size="icon-sm" variant="ghost" title="Redaktə">
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          )}
        </DialogTrigger>
      )}
      <DialogContent className="md:max-w-xl">
        <DialogHeader>
          <DialogTitle>{initial ? "Lead redaktəsi" : "Yeni lead"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

          <div className="space-y-2">
            <Label htmlFor="ad">Ad / Şirkət *</Label>
            <Input id="ad" name="ad" required minLength={2} maxLength={200} defaultValue={initial?.ad} autoFocus disabled={pending} />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="telefon">Telefon</Label>
              <Input id="telefon" name="telefon" type="tel" maxLength={30} defaultValue={initial?.telefon ?? ""} disabled={pending} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" maxLength={150} defaultValue={initial?.email ?? ""} disabled={pending} />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="menbe">Mənbə</Label>
              <select
                id="menbe"
                name="menbe"
                defaultValue={initial?.menbe ?? ""}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                disabled={pending}
              >
                <option value="">—</option>
                <option value="facebook">Facebook</option>
                <option value="instagram">Instagram</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="telegram">Telegram</option>
                <option value="telefon">Telefon</option>
                <option value="magaza">Mağaza (walk-in)</option>
                <option value="vebsayt">Website</option>
                <option value="tovsiye">Tövsiyə</option>
                <option value="reklam">Reklam</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <select
                id="status"
                name="status"
                defaultValue={initial?.status ?? "yeni"}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                disabled={pending}
              >
                <option value="yeni">Yeni</option>
                <option value="elaqe">Əlaqədə</option>
                <option value="muzakire">Müzakirə</option>
                <option value="teklif">Təklif</option>
                <option value="qazandi">Qazanıldı</option>
                <option value="itirdi">İtirildi</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="menecer_id">Məsul</Label>
              <select
                id="menecer_id"
                name="menecer_id"
                defaultValue=""
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                disabled={pending}
              >
                <option value="">—</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.ad_soyad}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="mehsul_maraq">Maraq mövzusu / Məhsul</Label>
            <textarea
              id="mehsul_maraq"
              name="mehsul_maraq"
              rows={2}
              maxLength={2000}
              className="flex w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              disabled={pending}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="budce">Büdcə (AZN)</Label>
              <Input id="budce" name="budce" type="number" min={0} step="0.01" defaultValue={initial?.budce ?? 0} disabled={pending} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ehtimal">Ehtimal (%)</Label>
              <Input
                id="ehtimal"
                name="ehtimal"
                type="number"
                min={0}
                max={100}
                step={5}
                defaultValue={initial?.ehtimal ?? 50}
                disabled={pending}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="novbeti_elaqe">Növbəti əlaqə</Label>
              <Input
                id="novbeti_elaqe"
                name="novbeti_elaqe"
                type="date"
                defaultValue={initial?.novbeti_elaqe ? new Date(initial.novbeti_elaqe).toISOString().slice(0, 10) : ""}
                disabled={pending}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>İmtina</Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {initial ? "Yenilə" : "Yarat"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
