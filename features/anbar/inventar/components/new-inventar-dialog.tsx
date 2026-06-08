"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2, ClipboardCheck, Filter, Target } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Combobox, type ComboOption } from "@/components/ui/combobox";
import { toast } from "sonner";
import { isEmbedded, closePageModal } from "@/lib/embed-mode";
import { createInventar } from "../actions";

type Option = { id: number; ad: string };
type ProductOption = { id: string; ad: string };

type Props = {
  anbarlar: Option[];
  kateqoriyalar?: Option[];
  markalar?: Option[];
  mehsullar?: ProductOption[];
};

type Tip = "tam" | "secimli" | "nokte";

const TIP_INFO: Record<Tip, { label: string; desc: string; icon: typeof ClipboardCheck }> = {
  tam:     { label: "Tam sayım",      desc: "Anbarın bütün aktiv məhsulları snapshot edilir", icon: ClipboardCheck },
  secimli: { label: "Seçimli sayım",  desc: "Yalnız seçilmiş kateqoriya / marka",             icon: Filter },
  nokte:   { label: "Nöqtə sayım",    desc: "Yalnız əl ilə seçilmiş məhsullar",               icon: Target },
};

export function NewInventarDialog({ anbarlar, kateqoriyalar = [], markalar = [], mehsullar = [] }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const todayStr = new Date().toISOString().slice(0, 10);
  const [anbarId, setAnbarId] = useState<string>(anbarlar[0] ? String(anbarlar[0].id) : "");
  const [tarix, setTarix] = useState<string>(todayStr);
  const [tip, setTip] = useState<Tip>("tam");
  const [kateqoriyaId, setKateqoriyaId] = useState("");
  const [markaId, setMarkaId] = useState("");
  const [pickedIds, setPickedIds] = useState<string[]>([]);

  // Auto-open when launched inside PageModal so user lands directly in the form.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (isEmbedded()) setOpen(true);
  }, []);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    if (tip === "nokte") fd.set("mehsul_ids", pickedIds.join(","));
    startTransition(async () => {
      const r = await createInventar(fd);
      if (!r.ok) setError(r.error);
      else {
        toast.success("Sayım başladıldı");
        setOpen(false);
        if (isEmbedded()) {
          closePageModal();
        } else if (r.data?.id) {
          router.push(`/anbar/inventar/${r.data.id}`);
        } else {
          router.refresh();
        }
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="font-semibold text-white" style={{ background: "var(--brand-gradient)" }}>
          <Plus className="h-4 w-4" /> Yeni sayım
        </Button>
      </DialogTrigger>
      <DialogContent className="md:max-w-lg">
        <DialogHeader>
          <DialogTitle>Yeni sayım başlat</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-3">
          {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

          {/* Sayım növü seçimi */}
          <div>
            <Label>Sayım növü *</Label>
            <input type="hidden" name="tip" value={tip} />
            <div className="mt-1 grid grid-cols-1 gap-2 sm:grid-cols-3">
              {(Object.keys(TIP_INFO) as Tip[]).map((t) => {
                const info = TIP_INFO[t];
                const Icon = info.icon;
                const on = tip === t;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTip(t)}
                    className={`flex flex-col items-start gap-1 rounded-lg border p-2.5 text-left transition ${
                      on
                        ? "border-primary bg-primary/5"
                        : "border-border bg-card hover:border-primary/40"
                    }`}
                  >
                    <div className={`flex items-center gap-1.5 ${on ? "text-primary" : "text-muted-foreground"}`}>
                      <Icon className="h-3.5 w-3.5" />
                      <span className="text-xs font-semibold">{info.label}</span>
                    </div>
                    <span className="text-[10px] leading-tight text-muted-foreground">{info.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Anbar *</Label>
              <Combobox
                options={anbarlar.map<ComboOption>((a) => ({ value: String(a.id), label: a.ad }))}
                value={anbarId}
                onChange={setAnbarId}
                placeholder="— seç —"
                searchPlaceholder="🔍 Anbar axtar..."
                emptyText="Anbar tapılmadı"
                disabled={pending}
              />
              <input type="hidden" name="anbar_id" value={anbarId} required />
            </div>
            <div>
              <Label>Tarix</Label>
              <Input
                type="date"
                name="tarix"
                value={tarix}
                max={todayStr}
                onChange={(e) => setTarix(e.target.value)}
                className={tarix !== todayStr ? "border-amber-500/60 ring-1 ring-amber-500/20" : ""}
              />
              {tarix !== todayStr && (
                <p className="mt-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400">
                  ⚠ Köhnə tarix — «tarix.geri» icazəsi tələb olunur
                </p>
              )}
            </div>
          </div>

          {tip === "secimli" && (
            <div className="grid grid-cols-2 gap-3 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
              <div>
                <Label>Kateqoriya</Label>
                <Combobox
                  options={[{ value: "", label: "— Hamı —" }, ...kateqoriyalar.map<ComboOption>((k) => ({ value: String(k.id), label: k.ad }))]}
                  value={kateqoriyaId}
                  onChange={setKateqoriyaId}
                  placeholder="Bütün kateqoriyalar"
                  searchPlaceholder="🔍 Kateqoriya..."
                  emptyText="Tapılmadı"
                  disabled={pending}
                />
                <input type="hidden" name="kateqoriya_id" value={kateqoriyaId} />
              </div>
              <div>
                <Label>Marka</Label>
                <Combobox
                  options={[{ value: "", label: "— Hamı —" }, ...markalar.map<ComboOption>((m) => ({ value: String(m.id), label: m.ad }))]}
                  value={markaId}
                  onChange={setMarkaId}
                  placeholder="Bütün markalar"
                  searchPlaceholder="🔍 Marka..."
                  emptyText="Tapılmadı"
                  disabled={pending}
                />
                <input type="hidden" name="marka_id" value={markaId} />
              </div>
              <div className="col-span-2 text-[10.5px] text-muted-foreground">
                Heç biri seçilməsə — anbarın hamı sayılacaq (Tam sayım kimi).
              </div>
            </div>
          )}

          {tip === "nokte" && (
            <div className="rounded-lg border border-violet-500/20 bg-violet-500/5 p-3">
              <Label className="mb-1 block">Sayılacaq məhsullar *</Label>
              <Combobox
                options={mehsullar.map<ComboOption>((m) => ({ value: m.id, label: m.ad }))}
                value=""
                onChange={(v) => {
                  if (v && !pickedIds.includes(v)) setPickedIds((p) => [...p, v]);
                }}
                placeholder="Məhsul axtar və əlavə et"
                searchPlaceholder="🔍 Məhsul..."
                emptyText="Tapılmadı"
                disabled={pending}
              />
              {pickedIds.length > 0 && (
                <div className="mt-2 flex max-h-32 flex-wrap gap-1 overflow-y-auto">
                  {pickedIds.map((id) => {
                    const m = mehsullar.find((x) => x.id === id);
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setPickedIds((p) => p.filter((x) => x !== id))}
                        className="inline-flex items-center gap-1 rounded-full border border-violet-500/30 bg-violet-500/10 px-2 py-0.5 text-[10.5px] text-violet-700 hover:bg-violet-500/20 dark:text-violet-300"
                      >
                        {m?.ad ?? id} ×
                      </button>
                    );
                  })}
                </div>
              )}
              <div className="mt-1 text-[10.5px] text-muted-foreground">
                {pickedIds.length} məhsul seçildi
              </div>
            </div>
          )}

          <div>
            <Label>Qeyd</Label>
            <Input name="qeyd" placeholder="Sayım səbəbi və ya əlavə qeyd" />
          </div>

          <div className="rounded-md bg-info/10 p-3 text-xs text-info">
            Sayım yaradılandan sonra məhsulların sistemdə olan miqdarı snapshot edilir. Faktiki miqdarları daxil edib «Tamamla» düyməsi ilə stok düzəldə bilərsiniz.
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>İmtina</Button>
            <Button type="submit" disabled={pending || (tip === "nokte" && pickedIds.length === 0)} className="font-semibold text-white" style={{ background: "var(--brand-gradient)" }}>
              {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Başlat
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
