"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Combobox, type ComboOption } from "@/components/ui/combobox";
import { toast } from "sonner";
import { saveQuickOperation } from "../actions";

type EntityOpt = { id: string; ad: string };

type Props = {
  hesablar: EntityOpt[];
  iscilier: EntityOpt[];
  kontragentler: EntityOpt[];
};

export type OperationTip = "medaxil" | "mexaric" | "transfer" | "xususi";
export type OperationQrup =
  | "qaime"
  | "xercler"
  | "maas_isci"
  | "transfer"
  | "sahibkar"
  | "duzelis"
  | "borclar";

export type KindMetaEntry = {
  ad: string;
  qrup: OperationQrup;
  tip: OperationTip;
  ihtiyac: {
    hesab?: boolean;
    hesab2?: boolean;
    isci?: boolean;
    kontragent?: boolean;
    sened?: boolean;
    kateqoriya?: boolean;
  };
};

// ── Sadələşdirilmiş 14 əməliyyat növü ──
// (Köhnə 41 növ → tek növlərə birləşdirildi. Kredit_faiz tamamilə silindi.)
export const KIND_META: Record<string, KindMetaEntry> = {
  qaime:           { ad: "Qaimə",                qrup: "qaime",      tip: "medaxil",  ihtiyac: { hesab: true, kontragent: true, sened: true } },
  xercler:         { ad: "Xərclər",              qrup: "xercler",    tip: "mexaric",  ihtiyac: { hesab: true, kateqoriya: true } },
  maas:            { ad: "Əməkhaqqı ödənişi",    qrup: "maas_isci",  tip: "mexaric",  ihtiyac: { hesab: true, isci: true } },
  avans:           { ad: "Avans",                qrup: "maas_isci",  tip: "mexaric",  ihtiyac: { hesab: true, isci: true } },
  bonus:           { ad: "Bonus",                qrup: "maas_isci",  tip: "mexaric",  ihtiyac: { hesab: true, isci: true } },
  cerime:          { ad: "Cərimə",               qrup: "maas_isci",  tip: "medaxil",  ihtiyac: { hesab: true, isci: true } },
  tesisci_pul:     { ad: "Təsisçi pulu",         qrup: "sahibkar",   tip: "transfer", ihtiyac: { hesab: true } },
  tehtl_hesab:     { ad: "Tahtəl hesab",         qrup: "sahibkar",   tip: "transfer", ihtiyac: { hesab: true } },
  transfer:        { ad: "Transfer",             qrup: "transfer",   tip: "transfer", ihtiyac: { hesab: true, hesab2: true } },
  valyuta_mubadile:{ ad: "Valyuta mübadiləsi",   qrup: "transfer",   tip: "transfer", ihtiyac: { hesab: true, hesab2: true } },
  dividend:        { ad: "Dividend",             qrup: "sahibkar",   tip: "mexaric",  ihtiyac: { hesab: true } },
  borc_silinme:    { ad: "Borc silinməsi",       qrup: "borclar",    tip: "xususi",   ihtiyac: { kontragent: true } },
  artirma:         { ad: "Artırma",              qrup: "duzelis",    tip: "medaxil",  ihtiyac: { hesab: true } },
  azaltma:         { ad: "Azaltma",              qrup: "duzelis",    tip: "mexaric",  ihtiyac: { hesab: true } },
  barter:          { ad: "Barter",               qrup: "transfer",   tip: "transfer", ihtiyac: { kontragent: true } },
};

// Xərclər alt kateqoriyaları (Prospect ERP məntiqi)
export const XERC_KATEQORIYALARI = [
  { kod: "magaza",     ad: "Mağaza xərcləri" },
  { kod: "vergi",      ad: "Vergi" },
  { kod: "ofis",       ad: "Ofis" },
  { kod: "edv",        ad: "ƏDV" },
  { kod: "logistika",  ad: "Logistika" },
  { kod: "marketing",  ad: "Marketing" },
  { kod: "bank_komis", ad: "Bank komissiyası" },
  { kod: "gomruk",     ad: "Gömrük" },
  { kod: "diger",      ad: "Digər" },
] as const;

export function QuickOpDialog(props: Props) {
  const sp = useSearchParams();
  const kind = sp.get("new");
  const preKontragent = sp.get("kontragent") ?? "";
  return <QuickOpDialogInner key={`${kind}|${preKontragent}`} {...props} />;
}

function QuickOpDialogInner({ hesablar, iscilier, kontragentler }: Props) {
  const router = useRouter();
  const sp = useSearchParams();
  const pathname = usePathname();
  const kind = sp.get("new");
  const meta = kind ? KIND_META[kind] : null;
  const preKontragent = sp.get("kontragent") ?? "";

  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [hesabId, setHesabId] = useState<string>("");
  const [hesab2Id, setHesab2Id] = useState<string>("");
  const [isciId, setIsciId] = useState<string>("");
  const [kontragentId, setKontragentId] = useState<string>(preKontragent);

  function close() {
    const params = new URLSearchParams(sp.toString());
    params.delete("new");
    params.delete("kontragent");
    router.push(`${pathname}${params.toString() ? `?${params.toString()}` : ""}`);
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    if (!fd.get("type_kod") && kind) fd.set("type_kod", kind);
    startTransition(async () => {
      const res = await saveQuickOperation(fd);
      if (!res.ok) {
        setError(res.error);
      } else {
        toast.success("Əməliyyat qeydə alındı");
        close();
        router.refresh();
      }
    });
  }

  if (!kind || !meta) return null;
  const need = meta.ihtiyac;
  const isTransfer = meta.tip === "transfer";

  return (
    <Dialog open onOpenChange={(o) => !o && close()}>
      <DialogContent className="md:max-w-md">
        <DialogHeader>
          <DialogTitle>{meta.ad}</DialogTitle>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <input type="hidden" name="type_kod" value={kind} />

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="mebleg">Məbləğ *</Label>
              <Input id="mebleg" name="mebleg" type="number" min={0.01} step="0.01" required disabled={pending} autoFocus />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tarix">Tarix *</Label>
              <Input id="tarix" name="tarix" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} disabled={pending} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="valyuta">Valyuta</Label>
              <select id="valyuta" name="valyuta" defaultValue="AZN" disabled={pending}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm">
                <option value="AZN">AZN</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="TRY">TRY</option>
                <option value="RUB">RUB</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="mezenne">Məzənnə (AZN-ə)</Label>
              <Input id="mezenne" name="mezenne" type="number" step="0.0001" defaultValue="1" disabled={pending} />
            </div>
          </div>

          {need.kateqoriya && (
            <div className="space-y-2">
              <Label htmlFor="xerc_kateqoriya">Xərc kateqoriyası *</Label>
              <select
                id="xerc_kateqoriya"
                name="xerc_kateqoriya"
                defaultValue="diger"
                disabled={pending}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
              >
                {XERC_KATEQORIYALARI.map((k) => (
                  <option key={k.kod} value={k.kod}>{k.ad}</option>
                ))}
              </select>
            </div>
          )}

          {need.hesab && (
            <div className="space-y-2">
              <Label>Hesab / kassa {isTransfer ? "(mənbə)" : ""} *</Label>
              <Combobox
                options={hesablar.map<ComboOption>((h) => ({ value: h.id, label: h.ad }))}
                value={hesabId}
                onChange={setHesabId}
                placeholder="— Seçin —"
                searchPlaceholder="Hesab axtar..."
                emptyText="Tapılmadı"
                disabled={pending}
              />
              <input type="hidden" name="hesab_id" value={hesabId} />
            </div>
          )}

          {need.hesab2 && (
            <>
              <div className="space-y-2">
                <Label>Hədəf hesab *</Label>
                <Combobox
                  options={hesablar.map<ComboOption>((h) => ({ value: h.id, label: h.ad }))}
                  value={hesab2Id}
                  onChange={setHesab2Id}
                  placeholder="— Seçin —"
                  searchPlaceholder="Hesab axtar..."
                  emptyText="Tapılmadı"
                  disabled={pending}
                />
                <input type="hidden" name="hesab_id2" value={hesab2Id} />
              </div>
              {kind === "valyuta_mubadile" && (
                <div className="space-y-2">
                  <Label htmlFor="meblegh2">Hədəf məbləğ (alınan valyutada) *</Label>
                  <Input id="meblegh2" name="meblegh2" type="number" min={0.01} step="0.01" disabled={pending} />
                </div>
              )}
            </>
          )}

          {need.isci && (
            <div className="space-y-2">
              <Label>İşçi *</Label>
              <Combobox
                options={iscilier.map<ComboOption>((i) => ({ value: i.id, label: i.ad }))}
                value={isciId}
                onChange={setIsciId}
                placeholder="— Seçin —"
                searchPlaceholder="İşçi axtar..."
                emptyText="Tapılmadı"
                disabled={pending}
              />
              <input type="hidden" name="isci_id" value={isciId} />
            </div>
          )}

          {need.kontragent && (
            <div className="space-y-2">
              <Label>Kontragent *</Label>
              <Combobox
                options={kontragentler.map<ComboOption>((c) => ({ value: c.id, label: c.ad }))}
                value={kontragentId}
                onChange={setKontragentId}
                placeholder="— Seçin —"
                searchPlaceholder="Kontragent axtar..."
                emptyText="Tapılmadı"
                disabled={pending}
              />
              <input type="hidden" name="kontragent_id" value={kontragentId} />
            </div>
          )}

          {need.sened && (
            <div className="space-y-2">
              <Label htmlFor="sened_nomresi">Sənəd nömrəsi</Label>
              <Input id="sened_nomresi" name="sened_nomresi" maxLength={50} disabled={pending} />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="qeyd">Qeyd</Label>
            <Input id="qeyd" name="qeyd" disabled={pending} />
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={close} disabled={pending}>İmtina</Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Qeyd et
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
