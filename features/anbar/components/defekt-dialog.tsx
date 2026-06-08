"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Combobox, type ComboOption } from "@/components/ui/combobox";
import { toast } from "sonner";
import { recordDefekt, DEFEKT_KATEQORIYALAR } from "../defekt-actions";
import { cn } from "@/lib/utils";

type AnbarOpt = { id: number; ad: string; nov?: string };
type MehsulOpt = { id: string; ad: string; kod: string | null; vahid: string | null };

export function DefektDialog({
  defektAnbarlar,
  menbeAnbarlar,
  mehsullar,
}: {
  defektAnbarlar: AnbarOpt[];
  menbeAnbarlar: AnbarOpt[];
  mehsullar: MehsulOpt[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const [mehsulId, setMehsulId] = useState<string>("");
  const [defektAnbarId, setDefektAnbarId] = useState<string>(
    defektAnbarlar[0] ? String(defektAnbarlar[0].id) : "",
  );
  const [menbeAnbarId, setMenbeAnbarId] = useState<string>("");
  const [kateqoriya, setKateqoriya] = useState<typeof DEFEKT_KATEQORIYALAR[number]["value"]>(
    DEFEKT_KATEQORIYALAR[0].value,
  );
  const [miqdar, setMiqdar] = useState<string>("1");
  const [sebeb, setSebeb] = useState<string>("");

  function reset() {
    setMehsulId("");
    setMenbeAnbarId("");
    setKateqoriya(DEFEKT_KATEQORIYALAR[0].value);
    setMiqdar("1");
    setSebeb("");
    setError(null);
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!mehsulId) {
      setError("Məhsul seçin");
      return;
    }
    if (!defektAnbarId) {
      setError("Defekt anbarı seçin");
      return;
    }
    const m = Number(miqdar);
    if (!m || m <= 0) {
      setError("Miqdar müsbət olmalıdır");
      return;
    }
    if (sebeb.trim().length < 3) {
      setError("Səbəb ən az 3 simvol olmalıdır");
      return;
    }
    startTransition(async () => {
      const res = await recordDefekt({
        mehsul_id: mehsulId,
        defekt_anbar_id: Number(defektAnbarId),
        menbe_anbar_id: menbeAnbarId ? Number(menbeAnbarId) : undefined,
        miqdar: m,
        kateqoriya,
        sebeb: sebeb.trim(),
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      toast.success("Defekt qeyd olundu");
      reset();
      setOpen(false);
      router.refresh();
    });
  }

  const selectedMehsul = mehsullar.find((m) => m.id === mehsulId);

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>
        <Button size="sm" className="font-semibold text-white" style={{ background: "linear-gradient(135deg, #f43f5e, #e11d48)" }}>
          <AlertTriangle className="h-4 w-4" /> Defekt qeydi
        </Button>
      </DialogTrigger>
      <DialogContent className="md:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-rose-500" />
            Yeni defekt qeydi
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

          <div className="space-y-2">
            <Label>Məhsul *</Label>
            <Combobox
              options={mehsullar.map<ComboOption>((m) => ({
                value: m.id,
                label: m.ad,
                hint: m.kod ?? undefined,
              }))}
              value={mehsulId}
              onChange={setMehsulId}
              placeholder="— Məhsul seçin —"
              searchPlaceholder="Məhsul axtar..."
              emptyText="Tapılmadı"
              disabled={pending}
            />
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="menbe_anbar_id">Mənbə anbarı (haradan gəlir)</Label>
              <select
                id="menbe_anbar_id"
                value={menbeAnbarId}
                onChange={(e) => setMenbeAnbarId(e.target.value)}
                disabled={pending}
                className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              >
                <option value="">— Yalnız qeyd (stoka toxunma) —</option>
                {menbeAnbarlar.map((a) => (
                  <option key={a.id} value={a.id}>{a.ad}</option>
                ))}
              </select>
              <p className="text-[10.5px] text-muted-foreground">
                Seçsən mal mənbədən defektə köçürüləcək (stok dəyişir)
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="defekt_anbar_id">Defekt anbarı *</Label>
              <select
                id="defekt_anbar_id"
                value={defektAnbarId}
                onChange={(e) => setDefektAnbarId(e.target.value)}
                disabled={pending}
                required
                className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              >
                {defektAnbarlar.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.ad} {a.nov === "karantın" ? "(karantın)" : "(defekt)"}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="miqdar">Miqdar *</Label>
            <Input
              id="miqdar"
              type="number"
              min={0.001}
              step="0.001"
              value={miqdar}
              onChange={(e) => setMiqdar(e.target.value)}
              disabled={pending}
              required
            />
            {selectedMehsul && (
              <p className="text-[10.5px] text-muted-foreground">
                Vahid: {selectedMehsul.vahid ?? "ədəd"}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Səbəb kateqoriyası *</Label>
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
              {DEFEKT_KATEQORIYALAR.map((k) => (
                <button
                  key={k.value}
                  type="button"
                  onClick={() => setKateqoriya(k.value)}
                  disabled={pending}
                  className={cn(
                    "flex flex-col rounded-md border-2 px-2 py-2 text-left text-[11px] font-semibold transition-all",
                    kateqoriya === k.value
                      ? "border-rose-500 bg-rose-500/10"
                      : "border-border/60 hover:border-border hover:bg-secondary/30",
                  )}
                >
                  <span>{k.label}</span>
                  <span className="text-[9.5px] font-normal text-muted-foreground">{k.desc}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="sebeb">Səbəb detalı *</Label>
            <textarea
              id="sebeb"
              value={sebeb}
              onChange={(e) => setSebeb(e.target.value)}
              rows={3}
              maxLength={2000}
              required
              disabled={pending}
              placeholder="Nə üçün ora getdi? Hadisə nə vaxt baş verdi? Mümkün təfsilatlar..."
              className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Bağla
            </Button>
            <Button
              type="submit"
              disabled={pending}
              style={{ background: "linear-gradient(135deg, #f43f5e, #e11d48)" }}
              className="text-white font-semibold"
            >
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              Qeyd et
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
