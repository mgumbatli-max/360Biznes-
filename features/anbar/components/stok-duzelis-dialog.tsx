"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Wrench, Loader2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Combobox, type ComboOption } from "@/components/ui/combobox";
import { applyStokDuzelis } from "../stok-duzelis-actions";

type AnbarOpt = { id: number; ad: string };
type MehsulOpt = { id: string; ad: string; kod: string | null; barkod: string | null };

type Props = {
  anbarlar: AnbarOpt[];
  mehsullar: MehsulOpt[];
  /** Əgər prefilled — bu məhsul və anbara aiddir */
  prefillMehsulId?: string;
  prefillAnbarId?: number;
  prefillKoheneMiqdar?: number;
  /** Trigger UI fərqli ola bilər */
  triggerLabel?: string;
  triggerVariant?: "default" | "outline" | "ghost";
};

export function StokDuzelisDialog({
  anbarlar,
  mehsullar,
  prefillMehsulId,
  prefillAnbarId,
  prefillKoheneMiqdar,
  triggerLabel = "Stok düzəliş aktı",
  triggerVariant = "outline",
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const [mehsulId, setMehsulId] = useState<string>(prefillMehsulId ?? "");
  const [anbarId, setAnbarId] = useState<string>(prefillAnbarId ? String(prefillAnbarId) : "");
  const [yeniMiqdar, setYeniMiqdar] = useState<string>("");
  const [sebeb, setSebeb] = useState<string>("");

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!mehsulId) { setError("Məhsul seçin"); return; }
    if (!anbarId) { setError("Anbar seçin"); return; }
    if (yeniMiqdar === "") { setError("Yeni miqdar daxil edin"); return; }

    startTransition(async () => {
      const res = await applyStokDuzelis({
        mehsul_id: mehsulId,
        anbar_id: Number(anbarId),
        yeni_miqdar: Number(yeniMiqdar),
        sebeb: sebeb.trim(),
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      toast.success("Stok düzəliş aktı icra edildi");
      setSebeb("");
      setYeniMiqdar("");
      setOpen(false);
      router.refresh();
    });
  }

  const selectedMehsul = mehsullar.find((m) => m.id === mehsulId);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={triggerVariant} size="sm">
          <Wrench className="h-4 w-4" />
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="md:max-w-lg p-0 gap-0 overflow-hidden">
        {/* Hero */}
        <div
          className="border-b border-border/30 px-5 py-3 text-white"
          style={{ background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)" }}
        >
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.14em] opacity-90">
            <AlertTriangle className="h-3 w-3" /> Yalnız icazəli istifadəçi
          </div>
          <DialogHeader className="mt-0.5">
            <DialogTitle className="text-lg font-bold text-white">
              Stok düzəliş aktı
            </DialogTitle>
          </DialogHeader>
        </div>

        <form onSubmit={onSubmit}>
          <div className="space-y-4 px-5 py-4">
            <Alert>
              <AlertDescription className="text-xs">
                Bu funksiya yanlışlıqları təshih etmək üçündür. Real mədaxil
                <strong> Ticarət &gt; Alış</strong>, məxaric <strong>Ticarət &gt; Satış</strong>{" "}
                vasitəsilə olur. Hər düzəliş audit-ə yazılır.
              </AlertDescription>
            </Alert>

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-1.5">
              <Label>Məhsul *</Label>
              <Combobox
                options={mehsullar.map<ComboOption>((m) => ({
                  value: m.id,
                  label: m.ad,
                  hint: m.barkod || m.kod || undefined,
                }))}
                value={mehsulId}
                onChange={setMehsulId}
                placeholder="— Seçin —"
                searchPlaceholder="Ad / barkod / kod..."
                emptyText="Tapılmadı"
                disabled={pending || !!prefillMehsulId}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Anbar *</Label>
              <select
                value={anbarId}
                onChange={(e) => setAnbarId(e.target.value)}
                disabled={pending || !!prefillAnbarId}
                className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              >
                <option value="">— Seçin —</option>
                {anbarlar.map((a) => (
                  <option key={a.id} value={a.id}>{a.ad}</option>
                ))}
              </select>
            </div>

            {prefillKoheneMiqdar !== undefined && (
              <div className="rounded-md bg-secondary/40 px-3 py-2 text-xs">
                Cari (köhnə) miqdar: <strong>{prefillKoheneMiqdar}</strong>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="yeniMiqdar">Yeni miqdar *</Label>
              <Input
                id="yeniMiqdar"
                type="number"
                min={0}
                step="0.001"
                value={yeniMiqdar}
                onChange={(e) => setYeniMiqdar(e.target.value)}
                placeholder="Faktiki anbarda olan say"
                disabled={pending}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="sebeb">Səbəb * (10+ simvol, audit-ə yazılır)</Label>
              <textarea
                id="sebeb"
                value={sebeb}
                onChange={(e) => setSebeb(e.target.value)}
                rows={3}
                maxLength={2000}
                placeholder="məs. 2026-06-06 fiziki sayımda fərq aşkar oldu — sənəddə görünməyən 2 ədəd ehtiyat hissə tapıldı"
                className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                disabled={pending}
                required
              />
            </div>
          </div>

          <DialogFooter className="border-t border-border/40 bg-card/95 px-5 py-3">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
              Ləğv
            </Button>
            <Button
              type="submit"
              disabled={pending}
              className="font-semibold text-white"
              style={{ background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)" }}
            >
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              Aktı icra et
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
