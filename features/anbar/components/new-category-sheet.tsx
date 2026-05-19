"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2 } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetClose } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { createKateqoriya } from "../kateqoriya-actions";

type Option = { id: number; ad: string };

export function NewCategorySheet({ flat }: { flat: Option[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [ad, setAd] = useState("");
  const [ustId, setUstId] = useState("");

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData();
    fd.set("ad", ad);
    if (ustId) fd.set("ust_id", ustId);
    startTransition(async () => {
      try {
        await createKateqoriya(fd);
        toast.success("Kateqoriya əlavə olundu");
        setAd("");
        setUstId("");
        setOpen(false);
        router.refresh();
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : "Əlavə olunmadı");
      }
    });
  }

  return (
    <>
      <Button
        type="button"
        size="sm"
        onClick={() => setOpen(true)}
        className="font-semibold text-white"
        style={{ background: "var(--brand-gradient)" }}
      >
        <Plus className="h-4 w-4" /> Yeni kateqoriya
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full max-w-md overflow-y-auto p-0">
          <SheetHeader className="sticky top-0 z-10 border-b border-border bg-background/95 px-5 py-3 backdrop-blur">
            <SheetTitle>Yeni kateqoriya</SheetTitle>
            <SheetClose />
          </SheetHeader>
          <form onSubmit={onSubmit} className="space-y-4 p-5">
            <div className="space-y-1.5">
              <Label htmlFor="cat-ad">
                Kateqoriya adı <span className="text-rose-500">*</span>
              </Label>
              <Input
                id="cat-ad"
                value={ad}
                onChange={(e) => setAd(e.target.value)}
                maxLength={100}
                placeholder="Məs. Elektronika"
                required
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cat-ust">Üst kateqoriya (ixtiyari)</Label>
              <select
                id="cat-ust"
                value={ustId}
                onChange={(e) => setUstId(e.target.value)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Kök (üst yox)</option>
                {flat.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.ad}
                  </option>
                ))}
              </select>
              <p className="text-[10.5px] text-muted-foreground">
                Üst seçməsəniz, kök kateqoriya kimi əlavə olunacaq.
              </p>
            </div>
            <div className="flex justify-end gap-2 border-t border-border pt-3">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
                İmtina
              </Button>
              <Button type="submit" disabled={pending || !ad.trim()}>
                {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Yarat
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>
    </>
  );
}
