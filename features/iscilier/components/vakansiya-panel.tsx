"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2, Trash2, Pencil, ExternalLink, UserPlus, ChevronDown, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDate, formatMoney } from "@/lib/utils";
import { saveVakansiya, deleteVakansiya, saveNamized, deleteNamized } from "../vakansiya-actions";
import type { Vakansiya, Namized } from "../vakansiya-queries";

const VAK_STATUS: Record<string, { label: string; cls: string }> = {
  acig: { label: "Açıq", cls: "border-success/30 text-success" },
  baglandi: { label: "Bağlandı", cls: "border-border text-muted-foreground" },
  dayandirildi: { label: "Dayandırıldı", cls: "border-warning/30 text-warning" },
};

const NAM_STATUS: Record<string, { label: string; cls: string }> = {
  yeni: { label: "Yeni", cls: "border-info/30 text-info" },
  musahibe: { label: "Müsahibə", cls: "border-warning/30 text-warning" },
  teklif: { label: "Təklif", cls: "border-primary/30 text-primary" },
  qebul: { label: "Qəbul", cls: "border-success/30 text-success" },
  redd: { label: "Rədd", cls: "border-danger/30 text-danger" },
};

export function VakansiyaPanel({ vaks, nams }: { vaks: Vakansiya[]; nams: Namized[] }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const namsByVak = new Map<string, Namized[]>();
  for (const n of nams) {
    const arr = namsByVak.get(n.vakansiya_id) ?? [];
    arr.push(n);
    namsByVak.set(n.vakansiya_id, arr);
  }

  function toggle(id: string) {
    const next = new Set(expanded);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpanded(next);
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <NewVakansiyaDialog />
      </div>

      {vaks.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
          <h3 className="font-semibold">Vakansiya yoxdur</h3>
          <p className="mt-1 text-sm text-muted-foreground">Yuxarıdan ilk vakansiyanı yaradın.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {vaks.map((v) => {
            const list = namsByVak.get(v.id) ?? [];
            const isOpen = expanded.has(v.id);
            return (
              <Card key={v.id} className="glass">
                <CardContent className="py-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <button onClick={() => toggle(v.id)} className="flex items-center gap-2 text-left flex-1 min-w-0">
                      {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      <div className="min-w-0">
                        <div className="font-semibold">{v.vezife}</div>
                        <div className="mt-0.5 text-xs text-muted-foreground">
                          {v.sobe} · {formatMoney(v.maas_min)} – {formatMoney(v.maas_max)} · {v.teleb_tecrube_il}+ il təcrübə
                        </div>
                      </div>
                    </button>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={"text-[10px] " + (VAK_STATUS[v.status]?.cls ?? "")}>{VAK_STATUS[v.status]?.label}</Badge>
                      <Badge variant="outline" className="text-[10px]">{list.length} namizəd</Badge>
                      <EditVakansiyaDialog vak={v} />
                      <NewNamizedDialog vakansiya_id={v.id} />
                      <DeleteVakansiyaBtn id={v.id} />
                    </div>
                  </div>
                  {isOpen && (
                    <div className="mt-3 space-y-2 border-t border-border/40 pt-3">
                      {v.telebler && <p className="text-xs text-muted-foreground whitespace-pre-wrap">{v.telebler}</p>}
                      <div className="text-[10px] text-muted-foreground">
                        Yaradan: {v.yaradan_ad ?? "—"} · {formatDate(new Date(v.yaradildi))}
                      </div>
                      {list.length === 0 ? (
                        <div className="text-sm text-muted-foreground italic">Hələ namizəd yoxdur.</div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead className="text-left text-[10.5px] uppercase tracking-wider text-muted-foreground">
                              <tr>
                                <th className="py-1.5">Namizəd</th>
                                <th className="py-1.5">Telefon</th>
                                <th className="py-1.5">Hazırki vəzifə</th>
                                <th className="py-1.5">Müsahibə</th>
                                <th className="py-1.5">CV</th>
                                <th className="py-1.5">Status</th>
                                <th className="py-1.5 w-24"></th>
                              </tr>
                            </thead>
                            <tbody>
                              {list.map((n) => (
                                <tr key={n.id} className="border-t border-border/30">
                                  <td className="py-1.5 font-medium">{n.ad_soyad}</td>
                                  <td className="py-1.5 text-xs">{n.telefon ?? "—"}</td>
                                  <td className="py-1.5 text-xs">{n.hazirki_vezife ?? "—"}</td>
                                  <td className="py-1.5 text-xs">{n.musahibe_tarix ? formatDate(new Date(n.musahibe_tarix)) : "—"}</td>
                                  <td className="py-1.5">
                                    {n.cv_url ? (
                                      <a href={n.cv_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-info">
                                        CV <ExternalLink className="h-3 w-3" />
                                      </a>
                                    ) : "—"}
                                  </td>
                                  <td className="py-1.5">
                                    <Badge variant="outline" className={"text-[10px] " + NAM_STATUS[n.status].cls}>
                                      {NAM_STATUS[n.status].label}
                                    </Badge>
                                  </td>
                                  <td className="py-1.5">
                                    <NamizedActions namized={n} vak={v} />
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function DeleteVakansiyaBtn({ id }: { id: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  function onDel() {
    if (!confirm("Vakansiya və bütün namizədləri silinsin?")) return;
    startTransition(async () => {
      const fd = new FormData();
      fd.set("id", id);
      const res = await deleteVakansiya(fd);
      if (res.ok) toast.success("Silindi");
      else toast.error(res.error);
      router.refresh();
    });
  }
  return (
    <Button size="sm" variant="ghost" onClick={onDel} disabled={pending} className="text-danger">
      <Trash2 className="h-3.5 w-3.5" />
    </Button>
  );
}

function NamizedActions({ namized, vak }: { namized: Namized; vak: Vakansiya }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onDel() {
    if (!confirm("Namizəd silinsin?")) return;
    startTransition(async () => {
      const fd = new FormData();
      fd.set("id", namized.id);
      const res = await deleteNamized(fd);
      if (res.ok) toast.success("Silindi");
      else toast.error(res.error);
      router.refresh();
    });
  }

  function onHire() {
    // Redirect to onboarding-like new employee with prefill
    const params = new URLSearchParams();
    params.set("ad_soyad", namized.ad_soyad);
    if (namized.telefon) params.set("telefon", namized.telefon);
    if (namized.email) params.set("email", namized.email);
    params.set("vezife", vak.vezife);
    params.set("namized_id", namized.id);
    router.push(`/iscilier?${params.toString()}#new-employee`);
  }

  return (
    <div className="flex items-center gap-1">
      <EditNamizedDialog namized={namized} />
      {namized.status === "qebul" && (
        <Button size="sm" variant="outline" onClick={onHire} className="text-xs">
          İşçiyə çevir
        </Button>
      )}
      <Button size="sm" variant="ghost" onClick={onDel} disabled={pending} className="text-danger">
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

function NewVakansiyaDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await saveVakansiya(fd);
      if (res.ok) {
        toast.success("Vakansiya yaradıldı");
        setOpen(false);
        router.refresh();
      } else toast.error(res.error);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="font-semibold text-white" style={{ background: "var(--brand-gradient)" }}>
          <Plus className="h-4 w-4" /> Yeni vakansiya
        </Button>
      </DialogTrigger>
      <DialogContent className="md:max-w-lg">
        <DialogHeader><DialogTitle>Yeni vakansiya</DialogTitle></DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="vezife">Vəzifə *</Label>
              <Input id="vezife" name="vezife" required maxLength={100} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sobe">Şöbə *</Label>
              <Input id="sobe" name="sobe" required maxLength={60} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label htmlFor="maas_min">Maaş min</Label>
              <Input id="maas_min" name="maas_min" type="number" min="0" step="0.01" required defaultValue="0" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="maas_max">Maaş max</Label>
              <Input id="maas_max" name="maas_max" type="number" min="0" step="0.01" required defaultValue="0" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="teleb_tecrube_il">Təcrübə (il)</Label>
              <Input id="teleb_tecrube_il" name="teleb_tecrube_il" type="number" min="0" max="40" required defaultValue="0" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="telebler">Tələblər</Label>
            <textarea
              id="telebler"
              name="telebler"
              maxLength={2000}
              rows={4}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <select name="status" defaultValue="acig" className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm">
              <option value="acig">Açıq</option>
              <option value="dayandirildi">Dayandırıldı</option>
              <option value="baglandi">Bağlandı</option>
            </select>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>İmtina</Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Yarat
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditVakansiyaDialog({ vak }: { vak: Vakansiya }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("id", vak.id);
    startTransition(async () => {
      const res = await saveVakansiya(fd);
      if (res.ok) {
        toast.success("Yenilənildi");
        setOpen(false);
        router.refresh();
      } else toast.error(res.error);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost"><Pencil className="h-3.5 w-3.5" /></Button>
      </DialogTrigger>
      <DialogContent className="md:max-w-lg">
        <DialogHeader><DialogTitle>{vak.vezife}</DialogTitle></DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="vezife">Vəzifə *</Label>
              <Input id="vezife" name="vezife" required maxLength={100} defaultValue={vak.vezife} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sobe">Şöbə *</Label>
              <Input id="sobe" name="sobe" required maxLength={60} defaultValue={vak.sobe} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label htmlFor="maas_min">Maaş min</Label>
              <Input id="maas_min" name="maas_min" type="number" min="0" step="0.01" required defaultValue={vak.maas_min} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="maas_max">Maaş max</Label>
              <Input id="maas_max" name="maas_max" type="number" min="0" step="0.01" required defaultValue={vak.maas_max} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="teleb_tecrube_il">Təcrübə (il)</Label>
              <Input id="teleb_tecrube_il" name="teleb_tecrube_il" type="number" min="0" max="40" required defaultValue={vak.teleb_tecrube_il} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="telebler">Tələblər</Label>
            <textarea id="telebler" name="telebler" maxLength={2000} rows={4} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" defaultValue={vak.telebler} />
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <select name="status" defaultValue={vak.status} className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm">
              <option value="acig">Açıq</option>
              <option value="dayandirildi">Dayandırıldı</option>
              <option value="baglandi">Bağlandı</option>
            </select>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>İmtina</Button>
            <Button type="submit" disabled={pending}>{pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Yadda saxla</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function NewNamizedDialog({ vakansiya_id }: { vakansiya_id: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("vakansiya_id", vakansiya_id);
    startTransition(async () => {
      const res = await saveNamized(fd);
      if (res.ok) {
        toast.success("Namizəd əlavə edildi");
        setOpen(false);
        router.refresh();
      } else toast.error(res.error);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <UserPlus className="h-3.5 w-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="md:max-w-md">
        <DialogHeader><DialogTitle>Yeni namizəd</DialogTitle></DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ad_soyad">Ad Soyad *</Label>
            <Input id="ad_soyad" name="ad_soyad" required maxLength={100} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="telefon">Telefon</Label>
              <Input id="telefon" name="telefon" maxLength={30} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" maxLength={150} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="cv_url">CV link</Label>
            <Input id="cv_url" name="cv_url" maxLength={500} placeholder="https://..." />
          </div>
          <div className="space-y-2">
            <Label htmlFor="hazirki_vezife">Hazırki vəzifə</Label>
            <Input id="hazirki_vezife" name="hazirki_vezife" maxLength={100} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Status</Label>
              <select name="status" defaultValue="yeni" className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm">
                <option value="yeni">Yeni</option>
                <option value="musahibe">Müsahibə</option>
                <option value="teklif">Təklif</option>
                <option value="qebul">Qəbul</option>
                <option value="redd">Rədd</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="musahibe_tarix">Müsahibə tarixi</Label>
              <Input id="musahibe_tarix" name="musahibe_tarix" type="datetime-local" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="qeyd">Qeyd</Label>
            <Input id="qeyd" name="qeyd" maxLength={1000} />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>İmtina</Button>
            <Button type="submit" disabled={pending}>{pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Əlavə et</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditNamizedDialog({ namized }: { namized: Namized }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("id", namized.id);
    fd.set("vakansiya_id", namized.vakansiya_id);
    startTransition(async () => {
      const res = await saveNamized(fd);
      if (res.ok) {
        toast.success("Yenilənildi");
        setOpen(false);
        router.refresh();
      } else toast.error(res.error);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost"><Pencil className="h-3.5 w-3.5" /></Button>
      </DialogTrigger>
      <DialogContent className="md:max-w-md">
        <DialogHeader><DialogTitle>{namized.ad_soyad}</DialogTitle></DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ad_soyad">Ad Soyad *</Label>
            <Input id="ad_soyad" name="ad_soyad" required maxLength={100} defaultValue={namized.ad_soyad} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="telefon">Telefon</Label>
              <Input id="telefon" name="telefon" maxLength={30} defaultValue={namized.telefon ?? ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" maxLength={150} defaultValue={namized.email ?? ""} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="cv_url">CV link</Label>
            <Input id="cv_url" name="cv_url" maxLength={500} defaultValue={namized.cv_url ?? ""} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="hazirki_vezife">Hazırki vəzifə</Label>
            <Input id="hazirki_vezife" name="hazirki_vezife" maxLength={100} defaultValue={namized.hazirki_vezife ?? ""} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Status</Label>
              <select name="status" defaultValue={namized.status} className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm">
                <option value="yeni">Yeni</option>
                <option value="musahibe">Müsahibə</option>
                <option value="teklif">Təklif</option>
                <option value="qebul">Qəbul</option>
                <option value="redd">Rədd</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="musahibe_tarix">Müsahibə tarixi</Label>
              <Input id="musahibe_tarix" name="musahibe_tarix" type="datetime-local" defaultValue={namized.musahibe_tarix ? namized.musahibe_tarix.slice(0, 16) : ""} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="qeyd">Qeyd</Label>
            <Input id="qeyd" name="qeyd" maxLength={1000} defaultValue={namized.qeyd ?? ""} />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>İmtina</Button>
            <Button type="submit" disabled={pending}>{pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Yadda saxla</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
