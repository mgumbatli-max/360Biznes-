"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDownToLine, ArrowUpFromLine, ClipboardCheck, Loader2,
} from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Combobox, type ComboOption } from "@/components/ui/combobox";
import { toast } from "sonner";
import { adjustStock } from "../stock-actions";

type Nov = "medaxil" | "mexaric" | "inventar";

const SEBEB_OPTIONS: Record<Nov, { value: string; label: string }[]> = {
  medaxil: [
    { value: "alış",         label: "Alış (kontragentdən)" },
    { value: "qaytarma",     label: "Müştəri qaytarması" },
    { value: "tapildi",      label: "Tapıldı (sayım fərqi)" },
    { value: "transfer",     label: "Anbara transfer" },
    { value: "baslangic",    label: "Başlanğıc stok" },
    { value: "duzelis",      label: "Düzəliş" },
    { value: "diger",        label: "Digər" },
  ],
  mexaric: [
    { value: "defekt",       label: "Defekt / zədəli" },
    { value: "ogurluq",      label: "Oğurluq / itki" },
    { value: "zerer",        label: "Zərər (xarab oldu)" },
    { value: "numune",       label: "Nümunə / hədiyyə" },
    { value: "sintez",       label: "İstehsalata sərf" },
    { value: "sahibkar",     label: "Sahibkar istifadəsi" },
    { value: "transfer",     label: "Anbardan transfer" },
    { value: "duzelis",      label: "Düzəliş" },
    { value: "diger",        label: "Digər" },
  ],
  inventar: [
    { value: "sayim",        label: "Fiziki sayım nəticəsi" },
    { value: "duzelis",      label: "Hesab xətası düzəlişi" },
    { value: "baslangic",    label: "Başlanğıc balans" },
    { value: "diger",        label: "Digər" },
  ],
};

const META: Record<Nov, { label: string; icon: typeof ArrowDownToLine; color: string; help: string }> = {
  medaxil:  { label: "Mədaxil",          icon: ArrowDownToLine,  color: "bg-success",  help: "Stoka əlavə olunacaq" },
  mexaric:  { label: "Məxaric",          icon: ArrowUpFromLine,  color: "bg-danger",   help: "Stokdan çıxılacaq" },
  inventar: { label: "Sayım düzəlişi",   icon: ClipboardCheck,   color: "bg-warning",  help: "Cari miqdar dəqiq rəqəmlə əvəz olunacaq" },
};

type Product = { id: string; ad: string; kod: string | null; barkod: string | null };
type Anbar = { id: number; ad: string };

export function QuickStockAction({
  nov,
  products,
  anbarlar,
}: {
  nov: Nov;
  products: Product[];
  anbarlar: Anbar[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [mehsulId, setMehsulId] = useState("");
  const [anbarId, setAnbarId] = useState<string>(anbarlar[0]?.id ? String(anbarlar[0].id) : "");
  const [miqdar, setMiqdar] = useState("");
  const [qiymet, setQiymet] = useState("");
  const [sebebKod, setSebebKod] = useState("");
  const [sebebQeyd, setSebebQeyd] = useState("");
  const [cariStok, setCariStok] = useState<number | null>(null);

  const meta = META[nov];
  const Icon = meta.icon;

  // Cari stoku göstər (məhsul + anbar seçildikdə)
  useEffect(() => {
    if (!mehsulId || !anbarId) {
      setCariStok(null);
      return;
    }
    fetch(`/api/anbar/quick-view/${mehsulId}`)
      .then((r) => r.json())
      .then((d) => {
        const a = d.anbarlar?.find((x: { anbar_id: number; miqdar: number }) => x.anbar_id === Number(anbarId));
        setCariStok(a?.miqdar ?? 0);
      })
      .catch(() => setCariStok(null));
  }, [mehsulId, anbarId]);

  function submit() {
    setError(null);
    if (!mehsulId) { setError("Məhsul seçin"); return; }
    if (!anbarId) { setError("Anbar seçin"); return; }
    if (!miqdar || Number(miqdar) <= 0) { setError("Miqdar 0-dan böyük olmalıdır"); return; }
    if (!sebebKod) { setError("Səbəb növü seçin"); return; }

    const label = SEBEB_OPTIONS[nov].find((o) => o.value === sebebKod)?.label ?? sebebKod;
    const sebeb = sebebQeyd ? `${label}: ${sebebQeyd}` : label;

    startTransition(async () => {
      const res = await adjustStock({
        mehsul_id: mehsulId,
        anbar_id: Number(anbarId),
        nov,
        miqdar: Number(miqdar),
        qiymet: Number(qiymet) || 0,
        sebeb,
      });
      if (!res.ok) { setError(res.error); return; }
      toast.success(`${meta.label} qeyd olundu`);
      setOpen(false);
      setMehsulId("");
      setMiqdar("");
      setQiymet("");
      setSebebKod("");
      setSebebQeyd("");
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className={`gap-1.5 font-semibold text-white ${meta.color}`}>
          <Icon className="h-4 w-4" />
          {meta.label}
        </Button>
      </DialogTrigger>
      <DialogContent className="md:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon className="h-4 w-4" />
            {meta.label}
          </DialogTitle>
          <p className="text-xs text-muted-foreground">{meta.help}</p>
        </DialogHeader>
        <div className="space-y-3">
          {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

          <div>
            <Label>Məhsul *</Label>
            <Combobox
              options={products.map<ComboOption>((p) => ({
                value: p.id,
                label: p.ad,
                hint: p.kod ?? p.barkod ?? undefined,
              }))}
              value={mehsulId}
              onChange={setMehsulId}
              placeholder="— seç —"
              searchPlaceholder="🔍 Məhsul axtar (ad, kod, barkod)..."
              emptyText="Məhsul tapılmadı"
              disabled={pending}
            />
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
              {cariStok != null && (
                <p className="mt-1 text-[10px] text-muted-foreground">
                  Cari stok: <span className="font-mono">{cariStok}</span>
                </p>
              )}
            </div>
            <div>
              <Label>Miqdar *</Label>
              <Input
                type="number"
                min={0.001}
                step="0.001"
                value={miqdar}
                onChange={(e) => setMiqdar(e.target.value)}
                disabled={pending}
              />
            </div>
          </div>

          {nov === "medaxil" && (
            <div>
              <Label>Maya qiyməti (vahid)</Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={qiymet}
                onChange={(e) => setQiymet(e.target.value)}
                placeholder="0.00"
                disabled={pending}
              />
            </div>
          )}

          <div>
            <Label>Səbəb növü *</Label>
            <Combobox
              options={SEBEB_OPTIONS[nov].map<ComboOption>((o) => ({ value: o.value, label: o.label }))}
              value={sebebKod}
              onChange={setSebebKod}
              placeholder="— Seçin —"
              searchPlaceholder="🔍 Səbəb axtar..."
              emptyText="Tapılmadı"
              disabled={pending}
            />
          </div>

          <div>
            <Label>Əlavə qeyd</Label>
            <Input
              value={sebebQeyd}
              onChange={(e) => setSebebQeyd(e.target.value)}
              placeholder="Sənəd nömrəsi, açıqlama (mütləq deyil)"
              disabled={pending}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>İmtina</Button>
          <Button onClick={submit} disabled={pending} className={`font-semibold text-white ${meta.color}`}>
            {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <Icon className="h-3.5 w-3.5" />
            Təsdiqlə
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
