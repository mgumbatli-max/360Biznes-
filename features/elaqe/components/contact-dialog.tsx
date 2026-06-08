"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, Loader2, Pencil } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { saveContact } from "../actions";
import type { ContactRow } from "../queries";

type Manager = { id: string; ad_soyad: string };

type Props = {
  defaultNov: "musteri" | "techizatci";
  initial?: Partial<ContactRow> & { id?: string };
  trigger?: "new" | "edit";
  managers?: Manager[];
};

export function ContactDialog({ defaultNov, initial, trigger = "new", managers = [] }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // URL parametri `?yeni=1` varsa dialog avtomatik açılır — dashboard
  // Quick Actions "Yeni müştəri" düyməsindən birbaşa formanı açır.
  useEffect(() => {
    if (trigger !== "new") return;
    if (searchParams.get("yeni") === "1" || searchParams.get("new") === "1") {
      setOpen(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    if (initial?.id) fd.set("id", initial.id);
    startTransition(async () => {
      const res = await saveContact(fd);
      if (!res.ok) {
        setError(res.error);
      } else {
        toast.success(initial ? "Yeniləndi" : "Yaradıldı");
        setOpen(false);
        router.refresh();
      }
    });
  }

  const label = defaultNov === "musteri" ? "müştəri" : "təchizatçı";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger === "new" ? (
          <Button size="sm" className="font-semibold text-white" style={{ background: "var(--brand-gradient)" }}>
            <Plus className="h-4 w-4" />
            Yeni {label}
          </Button>
        ) : (
          <Button size="icon-sm" variant="ghost" title="Redaktə">
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="md:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{initial?.id ? `Redaktə et: ${initial.ad}` : `Yeni ${label}`}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-3">
          {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

          <Tabs defaultValue="esas">
            <TabsList className="w-full">
              <TabsTrigger value="esas">Əsas</TabsTrigger>
              <TabsTrigger value="elaqe">Əlaqə</TabsTrigger>
              <TabsTrigger value="maliyye">Maliyyə</TabsTrigger>
              <TabsTrigger value="qeyd">Qeyd</TabsTrigger>
            </TabsList>

            <TabsContent value="esas" forceMount className="space-y-3 pt-2 data-[state=inactive]:hidden">
              <div className="space-y-1.5">
                <Label htmlFor="ad">Ad / Şirkət *</Label>
                <Input id="ad" name="ad" required minLength={2} maxLength={200} defaultValue={initial?.ad} autoFocus disabled={pending} />
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="nov">Tip</Label>
                  <select
                    id="nov"
                    name="nov"
                    defaultValue={initial?.nov ?? defaultNov}
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                    disabled={pending}
                  >
                    <option value="musteri">Müştəri</option>
                    <option value="techizatci">Təchizatçı</option>
                    <option value="her_ikisi">Hər ikisi</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="sirket_adi">Şirkət adı (tam)</Label>
                  <Input id="sirket_adi" name="sirket_adi" maxLength={200} defaultValue={initial?.sirket_adi ?? ""} disabled={pending} />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="voen">VÖEN</Label>
                  <Input id="voen" name="voen" maxLength={20} defaultValue={initial?.voen ?? ""} disabled={pending} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="fin_kod">FİN</Label>
                  <Input id="fin_kod" name="fin_kod" maxLength={20} defaultValue={initial?.fin_kod ?? ""} disabled={pending} />
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="aktiv" value="true" defaultChecked={initial?.aktiv ?? true} className="h-4 w-4 accent-primary" disabled={pending} />
                Aktivdir
              </label>
            </TabsContent>

            <TabsContent value="elaqe" forceMount className="space-y-3 pt-2 data-[state=inactive]:hidden">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="telefon">Telefon</Label>
                  <Input id="telefon" name="telefon" type="tel" maxLength={20} defaultValue={initial?.telefon ?? ""} placeholder="+994 ..." disabled={pending} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="telefon2">Telefon 2</Label>
                  <Input id="telefon2" name="telefon2" type="tel" maxLength={30} defaultValue="" disabled={pending} />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="whatsapp">WhatsApp</Label>
                  <Input id="whatsapp" name="whatsapp" type="tel" maxLength={30} defaultValue="" disabled={pending} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" name="email" type="email" maxLength={150} defaultValue={initial?.email ?? ""} disabled={pending} />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="unvan">Ünvan</Label>
                <Input id="unvan" name="unvan" maxLength={500} defaultValue={initial?.unvan ?? ""} disabled={pending} />
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="sheher">Şəhər</Label>
                  <Input id="sheher" name="sheher" maxLength={100} defaultValue={initial?.sheher ?? ""} disabled={pending} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="olke">Ölkə</Label>
                  <Input id="olke" name="olke" maxLength={100} defaultValue="Azərbaycan" disabled={pending} />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="maliyye" forceMount className="space-y-3 pt-2 data-[state=inactive]:hidden">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="qiymet_tipi">Qiymət tipi</Label>
                  <select
                    id="qiymet_tipi"
                    name="qiymet_tipi"
                    defaultValue={initial?.qiymet_tipi ?? "adi"}
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                    disabled={pending}
                  >
                    <option value="adi">Adi</option>
                    <option value="perakende">Pərakəndə</option>
                    <option value="topdan">Topdan</option>
                    <option value="partnyor">Partnyor</option>
                    <option value="vip">VIP</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="borc_limiti">Borc limiti (AZN)</Label>
                  <Input
                    id="borc_limiti"
                    name="borc_limiti"
                    type="number"
                    step="any"
                    min="0"
                    defaultValue={
                      initial?.borc_limiti !== null && initial?.borc_limiti !== undefined
                        ? String(initial.borc_limiti)
                        : ""
                    }
                    placeholder="boş = limitsiz"
                    disabled={pending}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="menecer_id">Məsul menecer</Label>
                <select
                  id="menecer_id"
                  name="menecer_id"
                  defaultValue=""
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                  disabled={pending}
                >
                  <option value="">— seçilməyib —</option>
                  {managers.map((m) => (
                    <option key={m.id} value={m.id}>{m.ad_soyad}</option>
                  ))}
                </select>
              </div>
            </TabsContent>

            <TabsContent value="qeyd" forceMount className="space-y-3 pt-2 data-[state=inactive]:hidden">
              <div className="space-y-1.5">
                <Label htmlFor="qeyd">Qeyd</Label>
                <textarea
                  id="qeyd"
                  name="qeyd"
                  rows={6}
                  maxLength={2000}
                  defaultValue=""
                  className="flex w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  disabled={pending}
                />
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>İmtina</Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {initial?.id ? "Yenilə" : "Yarat"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
