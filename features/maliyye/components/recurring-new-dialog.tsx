"use client";

import { useState, useTransition } from "react";
import { Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Combobox, type ComboOption } from "@/components/ui/combobox";
import { createRecurringRule } from "../recurring-rules-actions";
import { useRouter } from "next/navigation";

type EntityOpt = { id: string; ad: string };

const TYPE_OPTIONS: { kod: string; ad: string; y_n: "daxil" | "mexaric" }[] = [
  { kod: "qaime",          ad: "Qaimə (gəlir)",           y_n: "daxil" },
  { kod: "xercler",        ad: "Xərc",                    y_n: "mexaric" },
  { kod: "maas",           ad: "Əməkhaqqı",               y_n: "mexaric" },
  { kod: "bonus",          ad: "Bonus",                   y_n: "mexaric" },
  { kod: "alis_odenis",    ad: "Alış ödənişi",            y_n: "mexaric" },
  { kod: "marketplace_payout", ad: "Marketplace payout",  y_n: "daxil" },
  { kod: "vergi",          ad: "Vergi",                   y_n: "mexaric" },
];

const TEZLIK_OPTIONS = [
  { kod: "gunluk",   ad: "Günlük" },
  { kod: "heftelik", ad: "Həftəlik" },
  { kod: "ayliq",    ad: "Aylıq" },
  { kod: "illik",    ad: "İllik" },
];

export function RecurringNewDialog({
  hesablar,
  kontragentler,
  iscilier,
}: {
  hesablar: EntityOpt[];
  kontragentler: EntityOpt[];
  iscilier: EntityOpt[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const [ad, setAd] = useState("");
  const [typeKod, setTypeKod] = useState("xercler");
  const [mebleg, setMebleg] = useState("");
  const [tezlik, setTezlik] = useState("ayliq");
  const [hesabId, setHesabId] = useState("");
  const [kontragentId, setKontragentId] = useState("");
  const [isciId, setIsciId] = useState("");
  const [baslama, setBaslama] = useState(new Date().toISOString().slice(0, 10));
  const [sonTarix, setSonTarix] = useState("");
  const [qeyd, setQeyd] = useState("");
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setAd(""); setMebleg(""); setTezlik("ayliq"); setHesabId("");
    setKontragentId(""); setIsciId(""); setBaslama(new Date().toISOString().slice(0, 10));
    setSonTarix(""); setQeyd(""); setError(null);
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const selectedType = TYPE_OPTIONS.find((t) => t.kod === typeKod);
    if (!selectedType) { setError("Tip seçin"); return; }
    if (!ad.trim() || ad.trim().length < 2) { setError("Ad ən azı 2 simvol"); return; }
    if (!mebleg || Number(mebleg) <= 0) { setError("Məbləğ düzgün deyil"); return; }

    startTransition(async () => {
      const fd = new FormData();
      fd.set("ad", ad);
      fd.set("type_kod", typeKod);
      fd.set("y_n", selectedType.y_n);
      fd.set("mebleg", mebleg);
      fd.set("tezlik", tezlik);
      if (hesabId) fd.set("hesab_id", hesabId);
      if (kontragentId) fd.set("kontragent_id", kontragentId);
      if (isciId) fd.set("isci_id", isciId);
      fd.set("baslama", baslama);
      if (sonTarix) fd.set("son_tarix", sonTarix);
      if (qeyd) fd.set("qeyd", qeyd);

      const r = await createRecurringRule(fd);
      if (r.ok) {
        toast.success("Təkrar qayda yaradıldı");
        reset();
        setOpen(false);
        router.refresh();
      } else {
        setError(r.error);
        toast.error(r.error);
      }
    });
  }

  const showIsci = ["maas", "bonus"].includes(typeKod);
  const showKontragent = ["qaime", "alis_odenis", "marketplace_payout"].includes(typeKod);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Plus className="h-3.5 w-3.5" />
          Yeni qayda
        </Button>
      </DialogTrigger>
      <DialogContent className="md:max-w-md">
        <DialogHeader>
          <DialogTitle>Yeni təkrar qayda</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-3">
          {error && (
            <div className="rounded-md border border-rose-500/40 bg-rose-50 p-2 text-xs text-rose-700">{error}</div>
          )}
          <div>
            <Label className="text-xs">Qayda adı</Label>
            <Input
              value={ad}
              onChange={(e) => setAd(e.target.value)}
              placeholder="məs. Ofis icarəsi"
              maxLength={200}
              disabled={pending}
              className="h-9"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Tip</Label>
              <select
                value={typeKod}
                onChange={(e) => setTypeKod(e.target.value)}
                disabled={pending}
                className="h-9 w-full rounded-md border border-input bg-background px-2 text-xs"
              >
                {TYPE_OPTIONS.map((t) => (
                  <option key={t.kod} value={t.kod}>{t.ad}</option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-xs">Tezlik</Label>
              <select
                value={tezlik}
                onChange={(e) => setTezlik(e.target.value)}
                disabled={pending}
                className="h-9 w-full rounded-md border border-input bg-background px-2 text-xs"
              >
                {TEZLIK_OPTIONS.map((t) => (
                  <option key={t.kod} value={t.kod}>{t.ad}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <Label className="text-xs">Məbləğ (AZN)</Label>
            <Input
              type="number"
              min={0}
              step={0.01}
              value={mebleg}
              onChange={(e) => setMebleg(e.target.value)}
              disabled={pending}
              className="h-9 tabular-nums"
            />
          </div>
          {hesablar.length > 0 && (
            <div>
              <Label className="text-xs">Hesab / kassa</Label>
              <Combobox
                options={[{ value: "", label: "— Seçilməyib —" }, ...hesablar.map<ComboOption>((h) => ({ value: h.id, label: h.ad }))]}
                value={hesabId}
                onChange={setHesabId}
                placeholder="— Hesab seç —"
                searchPlaceholder="Hesab axtar..."
                emptyText="Tapılmadı"
                disabled={pending}
              />
            </div>
          )}
          {showKontragent && kontragentler.length > 0 && (
            <div>
              <Label className="text-xs">Kontragent</Label>
              <Combobox
                options={[{ value: "", label: "— Seçilməyib —" }, ...kontragentler.map<ComboOption>((k) => ({ value: k.id, label: k.ad }))]}
                value={kontragentId}
                onChange={setKontragentId}
                placeholder="— Kontragent seç —"
                searchPlaceholder="Kontragent axtar..."
                emptyText="Tapılmadı"
                disabled={pending}
              />
            </div>
          )}
          {showIsci && iscilier.length > 0 && (
            <div>
              <Label className="text-xs">İşçi</Label>
              <Combobox
                options={[{ value: "", label: "— Seçilməyib —" }, ...iscilier.map<ComboOption>((i) => ({ value: i.id, label: i.ad }))]}
                value={isciId}
                onChange={setIsciId}
                placeholder="— İşçi seç —"
                searchPlaceholder="İşçi axtar..."
                emptyText="Tapılmadı"
                disabled={pending}
              />
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Başlama tarixi</Label>
              <Input
                type="date"
                value={baslama}
                onChange={(e) => setBaslama(e.target.value)}
                disabled={pending}
                className="h-9"
              />
            </div>
            <div>
              <Label className="text-xs">Bitmə (opsional)</Label>
              <Input
                type="date"
                value={sonTarix}
                onChange={(e) => setSonTarix(e.target.value)}
                disabled={pending}
                className="h-9"
              />
            </div>
          </div>
          <div>
            <Label className="text-xs">Qeyd</Label>
            <Input
              value={qeyd}
              onChange={(e) => setQeyd(e.target.value)}
              maxLength={2000}
              disabled={pending}
              className="h-9"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
              İmtina
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Yarat
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
