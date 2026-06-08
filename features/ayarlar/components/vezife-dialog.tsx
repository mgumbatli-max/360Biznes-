"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Loader2 } from "lucide-react";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { createVezife, updateVezife } from "@/features/iscilier/vezife-actions";

type Props = {
  initial?: { id: number; ad: string };
};

export function VezifeDialog({ initial }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [ad, setAd] = useState(initial?.ad ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = initial
        ? await updateVezife(initial.id, ad)
        : await createVezife(ad);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      toast.success(initial ? "Yeniləndi" : "Əlavə olundu");
      if (!initial) setAd("");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {initial ? (
          <Button size="icon-sm" variant="ghost" title="Redaktə">
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        ) : (
          <Button size="sm" className="font-semibold text-white" style={{ background: "var(--brand-gradient)" }}>
            <Plus className="h-4 w-4" /> Yeni vəzifə
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="md:max-w-md">
        <DialogHeader>
          <DialogTitle>{initial ? `Redaktə: ${initial.ad}` : "Yeni vəzifə"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="space-y-2">
            <Label htmlFor="ad">Vəzifə adı *</Label>
            <Input
              id="ad"
              value={ad}
              onChange={(e) => setAd(e.target.value)}
              required
              minLength={2}
              maxLength={150}
              placeholder="Satıcı, Mühasib, Anbardar..."
              autoFocus
              disabled={pending}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Bağla
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              {initial ? "Yenilə" : "Əlavə et"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
