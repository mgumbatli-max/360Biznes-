"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2, Pencil } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { saveBrand } from "../actions";

type Props = {
  initial?: { id: number; ad: string; qeyd: string | null; aktiv?: boolean; logo_url?: string | null };
  trigger?: "new" | "edit";
};

export function BrandDialog({ initial, trigger = "new" }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    if (initial?.id) fd.set("id", String(initial.id));
    startTransition(async () => {
      const res = await saveBrand(fd);
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
      <DialogTrigger asChild>
        {trigger === "new" ? (
          <Button size="sm" className="font-semibold text-white" style={{ background: "var(--brand-gradient)" }}>
            <Plus className="h-4 w-4" />
            Yeni marka
          </Button>
        ) : (
          <Button size="icon-sm" variant="ghost" title="Redaktə">
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="md:max-w-md">
        <DialogHeader>
          <DialogTitle>{initial ? "Markanı redaktə et" : "Yeni marka"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="space-y-2">
            <Label htmlFor="ad">Ad *</Label>
            <Input id="ad" name="ad" required maxLength={100} defaultValue={initial?.ad} autoFocus disabled={pending} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="logo_url">Logo URL</Label>
            <Input id="logo_url" name="logo_url" type="url" maxLength={500} defaultValue={initial?.logo_url ?? ""} placeholder="https://..." disabled={pending} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="qeyd">Qeyd</Label>
            <textarea
              id="qeyd"
              name="qeyd"
              rows={3}
              maxLength={2000}
              defaultValue={initial?.qeyd ?? ""}
              className="flex w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              disabled={pending}
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="aktiv" value="true" defaultChecked={initial?.aktiv ?? true} className="h-4 w-4 accent-primary" disabled={pending} />
            Aktivdir
          </label>
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
