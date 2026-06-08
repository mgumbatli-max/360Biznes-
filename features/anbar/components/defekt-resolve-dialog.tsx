"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, CheckCircle2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { resolveDefekt } from "../defekt-actions";

type Props = {
  defektId: string;
  miqdar: number;
  mehsulAd: string;
  defektAnbarAd: string;
  anbarOptions: Array<{ id: number; ad: string; nov?: string | null }>;
};

export function DefektResolveDialog({ defektId, miqdar, mehsulAd, defektAnbarAd, anbarOptions }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [qerar, setQerar] = useState<"silindi" | "qaytarildi" | "satilibdi">("qaytarildi");
  const [hedefAnbarId, setHedefAnbarId] = useState<string>(
    anbarOptions.find((a) => a.nov === "standart")?.id?.toString() ?? "",
  );
  const [qeyd, setQeyd] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Yalnız standart/servis anbarları geri qaytarma hədəfi ola bilər
  const targetAnbars = anbarOptions.filter((a) => !a.nov || a.nov === "standart" || a.nov === "servis");

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await resolveDefekt({
        id: defektId,
        qerar,
        hedef_anbar_id: qerar === "qaytarildi" && hedefAnbarId ? Number(hedefAnbarId) : undefined,
        qeyd: qeyd.trim() || undefined,
      });
      if (!res.ok) {
        setError(res.error);
        toast.error(res.error);
      } else {
        toast.success("Defekt qeydi həll edildi");
        setOpen(false);
        router.refresh();
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1">
          <CheckCircle2 className="h-3 w-3" /> Həll et
        </Button>
      </DialogTrigger>
      <DialogContent className="md:max-w-md">
        <DialogHeader>
          <DialogTitle>Defekt qeydini həll et</DialogTitle>
          <DialogDescription className="text-xs">
            <strong>{mehsulAd}</strong> — {miqdar} ədəd, anbar: {defektAnbarAd}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-3">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-1.5">
            <Label>Qərar *</Label>
            <div className="grid grid-cols-3 gap-1.5">
              {(["qaytarildi", "satilibdi", "silindi"] as const).map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => setQerar(q)}
                  className={`rounded-md border px-2 py-1.5 text-xs font-medium transition-colors ${
                    qerar === q ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-secondary"
                  }`}
                  disabled={pending}
                >
                  {q === "qaytarildi" && "Geri qaytarıldı"}
                  {q === "satilibdi" && "Endirimlə satıldı"}
                  {q === "silindi" && "Silindi (zərər)"}
                </button>
              ))}
            </div>
            <p className="text-[10.5px] text-muted-foreground">
              {qerar === "qaytarildi" && "Mal defekt anbardan çıxır → seçilən standart anbara qayıdır"}
              {qerar === "satilibdi" && "Mal defekt anbardan çıxır (satış sənədi ayrıca yarat)"}
              {qerar === "silindi" && "Mal defekt anbardan çıxır (zərər kimi)"}
            </p>
          </div>

          {qerar === "qaytarildi" && (
            <div className="space-y-1.5">
              <Label htmlFor="hedef_anbar">Hədəf anbar *</Label>
              <select
                id="hedef_anbar"
                value={hedefAnbarId}
                onChange={(e) => setHedefAnbarId(e.target.value)}
                required
                disabled={pending}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="">— Anbar seçin —</option>
                {targetAnbars.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.ad} {a.nov && a.nov !== "standart" && `(${a.nov})`}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="qeyd">Əlavə qeyd</Label>
            <textarea
              id="qeyd"
              value={qeyd}
              onChange={(e) => setQeyd(e.target.value)}
              rows={2}
              maxLength={500}
              disabled={pending}
              placeholder="Opsional"
              className="flex w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
              İmtina
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Təsdiqlə
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
