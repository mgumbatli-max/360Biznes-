"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Wrench, Loader2, ArrowUp, ArrowDown, ClipboardCheck } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { Combobox, type ComboOption } from "@/components/ui/combobox";
import { adjustStock } from "../stock-actions";

type AnbarOpt = { id: number; ad: string };

type Props = {
  mehsulId: string;
  mehsulAd: string;
  anbarlar: AnbarOpt[];
  currentStock?: number;
  trigger?: React.ReactNode;
  initialNov?: "medaxil" | "mexaric" | "inventar";
  initialAnbarId?: number;
};

const NOV_OPTIONS = [
  { value: "medaxil" as const, label: "Mədaxil (giriş)", icon: ArrowDown, tone: "success" },
  { value: "mexaric" as const, label: "Məxaric (çıxış)", icon: ArrowUp, tone: "danger" },
  { value: "inventar" as const, label: "İnventar (dəqiq say)", icon: ClipboardCheck, tone: "info" },
];

const SEBEB_OPTIONS: Record<"medaxil" | "mexaric" | "inventar", { value: string; label: string }[]> = {
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

export function StockAdjustDialog({ mehsulId, mehsulAd, anbarlar, currentStock, trigger, initialNov, initialAnbarId }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [nov, setNov] = useState<"medaxil" | "mexaric" | "inventar">(initialNov ?? "medaxil");
  const [anbarId, setAnbarId] = useState(initialAnbarId ?? anbarlar[0]?.id ?? 0);
  const [miqdar, setMiqdar] = useState("");
  const [qiymet, setQiymet] = useState("");
  const [sebebKod, setSebebKod] = useState("");
  const [sebebQeyd, setSebebQeyd] = useState("");
  const sebeb = sebebKod
    ? `${SEBEB_OPTIONS[nov].find((o) => o.value === sebebKod)?.label ?? sebebKod}${sebebQeyd ? `: ${sebebQeyd}` : ""}`
    : sebebQeyd;

  function onSubmit() {
    setError(null);
    if (!sebebKod) {
      setError("Səbəb növü seçin");
      return;
    }
    if (!sebeb.trim() || sebeb.trim().length < 2) {
      setError("Səbəb tələb olunur (ən az 2 simvol)");
      return;
    }
    startTransition(async () => {
      const res = await adjustStock({
        mehsul_id: mehsulId,
        anbar_id: anbarId,
        nov,
        miqdar: Number(miqdar) || 0,
        qiymet: Number(qiymet) || 0,
        sebeb: sebeb.trim(),
      });
      if (!res.ok) {
        setError(res.error);
      } else {
        if (res.pending_approval) {
          toast.warning(res.message ?? "Təsdiq mərkəzinə göndərildi", { duration: 6000 });
        } else {
          toast.success("Stok yeniləndi");
        }
        setOpen(false);
        setMiqdar("");
        setQiymet("");
        setSebebKod("");
        setSebebQeyd("");
        router.refresh();
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="icon-sm" variant="ghost" title="Stok düzəliş">
            <Wrench className="h-3.5 w-3.5" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="md:max-w-md">
        <DialogHeader>
          <DialogTitle>Stok düzəliş</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

          <div className="rounded-md border border-border/40 bg-secondary/30 px-3 py-2 text-sm">
            <div className="font-medium">{mehsulAd}</div>
            {currentStock !== undefined && (
              <div className="mt-0.5 text-xs text-muted-foreground">
                Cari stok (cəm): <span className="font-mono">{currentStock}</span>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Əməliyyat növü</Label>
            <div className="grid grid-cols-3 gap-1.5">
              {NOV_OPTIONS.map((opt) => {
                const active = nov === opt.value;
                const Icon = opt.icon;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setNov(opt.value)}
                    disabled={pending}
                    className={cn(
                      "flex flex-col items-center gap-1 rounded-md border px-2 py-2 text-[10.5px] font-medium transition",
                      active
                        ? "border-primary/40 bg-primary/15 text-primary-light"
                        : "border-border text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {opt.label.split(" ")[0]}
                  </button>
                );
              })}
            </div>
            <p className="text-[10.5px] text-muted-foreground">
              {nov === "inventar"
                ? "Cari miqdar bu rəqəmlə əvəz olunacaq"
                : nov === "medaxil"
                ? "Stoka əlavə olunacaq"
                : "Stokdan çıxılacaq"}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Anbar *</Label>
              <Combobox
                options={anbarlar.map<ComboOption>((a) => ({ value: String(a.id), label: a.ad }))}
                value={String(anbarId)}
                onChange={(v) => setAnbarId(Number(v))}
                placeholder="— seç —"
                searchPlaceholder="🔍 Anbar axtar..."
                emptyText="Anbar tapılmadı"
                disabled={pending}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="miqdar">Miqdar *</Label>
              <Input id="miqdar" type="number" min={0.001} step="0.001" value={miqdar} onChange={(e) => setMiqdar(e.target.value)} disabled={pending} required />
            </div>
          </div>

          {nov === "medaxil" && (
            <div className="space-y-2">
              <Label htmlFor="qiymet">Maya qiyməti (vahid)</Label>
              <Input id="qiymet" type="number" min={0} step="0.01" value={qiymet} onChange={(e) => setQiymet(e.target.value)} disabled={pending} />
            </div>
          )}

          <div className="space-y-2">
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
          <div className="space-y-2">
            <Label htmlFor="sebeb">Əlavə qeyd (mütləq deyil)</Label>
            <Input
              id="sebeb_qeyd"
              maxLength={500}
              value={sebebQeyd}
              onChange={(e) => setSebebQeyd(e.target.value)}
              placeholder="Sənəd nömrəsi, açıqlama..."
              disabled={pending}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>İmtina</Button>
            <Button type="button" onClick={onSubmit} disabled={pending || !miqdar || !sebebKod}>
              {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Yadda saxla
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
