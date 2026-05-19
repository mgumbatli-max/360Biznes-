"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Loader2, Trash2, MapPin, Building2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { saveFilial, deleteFilial } from "../actions";

type Initial = {
  id: number;
  ad: string;
  kod?: string | null;
  tip?: string | null;
  unvan: string | null;
  telefon: string | null;
  seh_r: string | null;
  rayon?: string | null;
  cavabdeh_id?: string | null;
  ish_baslangic?: string | null;
  ish_son?: string | null;
  qeyd?: string | null;
  aktiv: boolean | null;
};

type CavabdehOption = { id: string; ad_soyad: string; email: string };

type Props = {
  initial?: Initial;
  trigger?: "new" | "edit";
  cavabdehOptions?: CavabdehOption[];
};

const TIP_OPTIONS = [
  { value: "magaza", label: "Mağaza" },
  { value: "anbar", label: "Anbar" },
  { value: "ofis", label: "Ofis" },
  { value: "servis", label: "Servis mərkəzi" },
  { value: "online", label: "Onlayn" },
  { value: "depo", label: "Depo" },
];

export function FilialDialog({ initial, trigger = "new", cavabdehOptions = [] }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [deletePending, setDeletePending] = useState(false);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    if (initial?.id) fd.set("id", String(initial.id));
    startTransition(async () => {
      const res = await saveFilial(fd);
      if (!res.ok) {
        setError(res.error);
        toast.error(res.error);
      } else {
        toast.success(initial ? "Filial yeniləndi" : "Filial yaradıldı");
        setOpen(false);
        router.refresh();
      }
    });
  }

  async function onDelete() {
    if (!initial?.id) return;
    if (!confirm(`«${initial.ad}» filialını silməyi təsdiq edin?`)) return;
    setDeletePending(true);
    const fd = new FormData();
    fd.set("id", String(initial.id));
    const res = await deleteFilial(fd);
    setDeletePending(false);
    if (!res.ok) {
      setError(res.error);
      toast.error(res.error);
    } else {
      toast.success("Filial silindi");
      setOpen(false);
      router.refresh();
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger === "new" ? (
          <Button size="sm" className="font-semibold text-white" style={{ background: "var(--brand-gradient)" }}>
            <Plus className="h-4 w-4" /> Yeni filial
          </Button>
        ) : (
          <Button size="icon-sm" variant="ghost" title="Redaktə et">
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto md:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            {initial ? `Filial: ${initial.ad}` : "Yeni filial"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-5">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Əsas məlumatlar */}
          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Əsas məlumatlar
            </h3>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-[2fr_1fr_1fr]">
              <div className="space-y-1.5">
                <Label htmlFor="ad">Filial adı *</Label>
                <Input id="ad" name="ad" required minLength={2} maxLength={100} defaultValue={initial?.ad} autoFocus disabled={pending} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="kod">Qısa kod</Label>
                <Input id="kod" name="kod" maxLength={20} defaultValue={initial?.kod ?? ""} placeholder="MRK, F1, ANB..." disabled={pending} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tip">Tip</Label>
                <select
                  id="tip"
                  name="tip"
                  defaultValue={initial?.tip ?? "magaza"}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  disabled={pending}
                >
                  {TIP_OPTIONS.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cavabdeh_id">Cavabdeh</Label>
              <select
                id="cavabdeh_id"
                name="cavabdeh_id"
                defaultValue={initial?.cavabdeh_id ?? ""}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                disabled={pending}
              >
                <option value="">— Cavabdeh seçilməyib —</option>
                {cavabdehOptions.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.ad_soyad} ({u.email})
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-muted-foreground">
                Filialın əsas məsulu — hesabatlarda və approval axınında istifadə olunur
              </p>
            </div>
          </section>

          {/* Yer */}
          <section className="space-y-3">
            <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <MapPin className="h-3.5 w-3.5" /> Yer
            </h3>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="seher">Şəhər</Label>
                <Input id="seher" name="seher" maxLength={80} defaultValue={initial?.seh_r ?? ""} disabled={pending} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rayon">Rayon</Label>
                <Input id="rayon" name="rayon" maxLength={80} defaultValue={initial?.rayon ?? ""} disabled={pending} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="unvan">Ünvan</Label>
              <Input id="unvan" name="unvan" maxLength={500} defaultValue={initial?.unvan ?? ""} placeholder="Küçə, bina, mənzil" disabled={pending} />
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="telefon">Telefon</Label>
                <Input id="telefon" name="telefon" type="tel" maxLength={20} defaultValue={initial?.telefon ?? ""} disabled={pending} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ish_baslangic">İş saatı (başlama)</Label>
                <Input id="ish_baslangic" name="ish_baslangic" type="time" defaultValue={initial?.ish_baslangic ?? ""} disabled={pending} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ish_son">İş saatı (bitmə)</Label>
                <Input id="ish_son" name="ish_son" type="time" defaultValue={initial?.ish_son ?? ""} disabled={pending} />
              </div>
            </div>
          </section>

          {/* Qeyd */}
          <section className="space-y-1.5">
            <Label htmlFor="qeyd">Daxili qeyd</Label>
            <textarea
              id="qeyd"
              name="qeyd"
              rows={2}
              maxLength={2000}
              defaultValue={initial?.qeyd ?? ""}
              className="flex w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              disabled={pending}
            />
          </section>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="aktiv"
              value="true"
              defaultChecked={initial?.aktiv ?? true}
              className="h-4 w-4 accent-primary"
              disabled={pending}
            />
            Filial aktivdir
          </label>

          <DialogFooter className="gap-2">
            {initial && (
              <Button
                type="button"
                variant="ghost"
                onClick={onDelete}
                disabled={pending || deletePending}
                className="mr-auto text-rose-500 hover:bg-rose-500/10 hover:text-rose-500"
              >
                {deletePending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                Sil
              </Button>
            )}
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
              İmtina
            </Button>
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
