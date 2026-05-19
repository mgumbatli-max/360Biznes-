"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Combobox, type ComboOption } from "@/components/ui/combobox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { saveEmployee } from "../actions";
import type { EmployeeRow, FilialOpt, RoleOpt } from "../types";

type Props = {
  roles: RoleOpt[];
  filiallar?: FilialOpt[];
  initial?: EmployeeRow;
  trigger?: "new" | "edit";
};

export function EmployeeDialog({ roles, filiallar = [], initial, trigger = "new" }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [rolId, setRolId] = useState<string>(String(initial?.rol_id ?? 3));
  const [filialId, setFilialId] = useState<string>(
    initial?.default_filial_id ? String(initial.default_filial_id) : "",
  );

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    if (initial?.id) fd.set("id", initial.id);
    startTransition(async () => {
      const res = await saveEmployee(fd);
      if (!res.ok) {
        setError(res.error);
      } else {
        toast.success(initial ? "Yeniləndi" : "Yaradıldı");
        setOpen(false);
        router.refresh();
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger === "new" ? (
          <Button size="sm" className="font-semibold text-white" style={{ background: "var(--brand-gradient)" }}>
            <Plus className="h-4 w-4" /> Yeni işçi
          </Button>
        ) : (
          <Button size="icon-sm" variant="ghost" title="Redaktə">
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="md:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{initial ? `Redaktə: ${initial.ad_soyad}` : "Yeni işçi"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

          <Tabs defaultValue="sexsi" className="w-full">
            <TabsList className="w-full">
              <TabsTrigger value="sexsi">Şəxsi</TabsTrigger>
              <TabsTrigger value="is">İş</TabsTrigger>
              <TabsTrigger value="sistem">Sistem</TabsTrigger>
              <TabsTrigger value="bank">Bank</TabsTrigger>
            </TabsList>

            <TabsContent value="sexsi" className="space-y-4 pt-3">
              <div className="space-y-2">
                <Label htmlFor="ad_soyad">Ad Soyad *</Label>
                <Input id="ad_soyad" name="ad_soyad" required minLength={2} maxLength={100} defaultValue={initial?.ad_soyad} autoFocus disabled={pending} />
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="fin_kod">FİN kod</Label>
                  <Input id="fin_kod" name="fin_kod" maxLength={20} defaultValue={initial?.fin_kod ?? ""} disabled={pending} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dogum_tarixi">Doğum tarixi</Label>
                  <Input
                    id="dogum_tarixi"
                    name="dogum_tarixi"
                    type="date"
                    defaultValue={initial?.dogum_tarixi ? new Date(initial.dogum_tarixi).toISOString().slice(0, 10) : ""}
                    disabled={pending}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="unvan">Ünvan</Label>
                <Input id="unvan" name="unvan" maxLength={500} defaultValue={initial?.unvan ?? ""} disabled={pending} />
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="telefon">Telefon</Label>
                  <Input id="telefon" name="telefon" type="tel" maxLength={20} defaultValue={initial?.telefon ?? ""} disabled={pending} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input id="email" name="email" type="email" required maxLength={150} defaultValue={initial?.email} disabled={pending} />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="is" className="space-y-4 pt-3">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="vezife">Vəzifə</Label>
                  <Input id="vezife" name="vezife" maxLength={100} defaultValue={initial?.vezife ?? ""} placeholder="Satıcı, Mühasib, ..." disabled={pending} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="default_filial_id">Filial</Label>
                  <Combobox
                    options={[{ value: "", label: "— Filial seçin —" }, ...filiallar.map<ComboOption>((f) => ({ value: String(f.id), label: f.ad }))]}
                    value={filialId}
                    onChange={setFilialId}
                    placeholder="— Filial seçin —"
                    searchPlaceholder="Filial axtar..."
                    emptyText="Tapılmadı"
                    disabled={pending}
                  />
                  {filialId && <input type="hidden" name="default_filial_id" value={filialId} />}
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="ise_baslama">İşə başlama</Label>
                  <Input
                    id="ise_baslama"
                    name="ise_baslama"
                    type="date"
                    defaultValue={initial?.ise_baslama ? new Date(initial.ise_baslama).toISOString().slice(0, 10) : ""}
                    disabled={pending}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="aylik_maas">Aylıq maaş (AZN)</Label>
                  <Input
                    id="aylik_maas"
                    name="aylik_maas"
                    type="number"
                    min={0}
                    step="0.01"
                    defaultValue={initial?.aylik_maas ?? 0}
                    disabled={pending}
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="sistem" className="space-y-4 pt-3">
              <div className="space-y-2">
                <Label htmlFor="rol_id">Rol *</Label>
                <Combobox
                  options={roles.map<ComboOption>((r) => ({ value: String(r.id), label: r.ad }))}
                  value={rolId}
                  onChange={setRolId}
                  placeholder="— Seçin —"
                  searchPlaceholder="Rol axtar..."
                  emptyText="Tapılmadı"
                  disabled={pending}
                />
                <input type="hidden" name="rol_id" value={rolId} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sifre">{initial ? "Yeni şifrə (boş buraxsanız dəyişmir)" : "Şifrə *"}</Label>
                <Input
                  id="sifre"
                  name="sifre"
                  type="password"
                  minLength={6}
                  maxLength={100}
                  required={!initial}
                  disabled={pending}
                  placeholder={initial ? "Dəyişmək üçün yeni şifrə daxil edin" : "Ən az 6 simvol"}
                />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="aktiv"
                  value="true"
                  defaultChecked={initial?.aktiv ?? true}
                  className="h-4 w-4 accent-primary"
                  disabled={pending}
                />
                Aktivdir (sistemə daxil ola bilər)
              </label>
            </TabsContent>

            <TabsContent value="bank" className="space-y-4 pt-3">
              <div className="space-y-2">
                <Label htmlFor="bank_ad">Bank</Label>
                <Input id="bank_ad" name="bank_ad" maxLength={100} defaultValue={initial?.bank_ad ?? ""} placeholder="Kapital Bank, AGBank, ..." disabled={pending} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bank_hesab">IBAN / Hesab nömrəsi</Label>
                <Input id="bank_hesab" name="bank_hesab" maxLength={40} defaultValue={initial?.bank_hesab ?? ""} placeholder="AZ00 NABZ 0000 0000 0000 0000 0000" disabled={pending} />
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>İmtina</Button>
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
