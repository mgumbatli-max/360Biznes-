"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2, Trash2, Pencil, UserPlus, ChevronDown, ChevronRight, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Combobox, type ComboOption } from "@/components/ui/combobox";
import { formatDate, formatMoney } from "@/lib/utils";
import { saveTreninq, deleteTreninq, assignTreninq, updateTreninqQeyd, deleteTreninqQeyd } from "../treninq-actions";
import type { Treninq, TreninqQeyd } from "../treninq-queries";

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  teyin: { label: "Təyin", cls: "border-info/30 text-info" },
  basladi: { label: "Başladı", cls: "border-warning/30 text-warning" },
  tamam: { label: "Tamam", cls: "border-success/30 text-success" },
};

export function TreninqPanel({
  treninqler,
  qeydler,
  employees,
}: {
  treninqler: Treninq[];
  qeydler: TreninqQeyd[];
  employees: Array<{ id: string; ad_soyad: string }>;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    const next = new Set(expanded);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpanded(next);
  }

  const qeydlerByTreninq = new Map<string, TreninqQeyd[]>();
  for (const q of qeydler) {
    const arr = qeydlerByTreninq.get(q.treninq_id) ?? [];
    arr.push(q);
    qeydlerByTreninq.set(q.treninq_id, arr);
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <NewTreninqDialog />
      </div>

      {treninqler.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
          <h3 className="font-semibold">Treninq yoxdur</h3>
        </div>
      ) : (
        <div className="space-y-2">
          {treninqler.map((t) => {
            const list = qeydlerByTreninq.get(t.id) ?? [];
            const isOpen = expanded.has(t.id);
            const tamam = list.filter((q) => q.status === "tamam").length;
            return (
              <Card key={t.id} className="glass">
                <CardContent className="py-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <button onClick={() => toggle(t.id)} className="flex items-center gap-2 text-left flex-1 min-w-0">
                      {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      <div className="min-w-0">
                        <div className="font-semibold">{t.ad}</div>
                        <div className="mt-0.5 text-xs text-muted-foreground">
                          {t.muddet_saat} saat · {formatMoney(t.xerc)} xərc
                          {t.teleb_seviyye && ` · ${t.teleb_seviyye}`}
                        </div>
                      </div>
                    </button>
                    <div className="flex items-center gap-2">
                      {t.mecburi && <Badge variant="outline" className="text-[10px] border-danger/30 text-danger">Məcburi</Badge>}
                      <Badge variant="outline" className="text-[10px]">{tamam}/{list.length}</Badge>
                      <EditTreninqDialog treninq={t} />
                      <AssignDialog treninq={t} employees={employees} />
                      <DeleteTreninqBtn id={t.id} />
                    </div>
                  </div>
                  {isOpen && (
                    <div className="mt-3 space-y-2 border-t border-border/40 pt-3">
                      {t.tesvir && <p className="text-xs text-muted-foreground whitespace-pre-wrap">{t.tesvir}</p>}
                      {list.length === 0 ? (
                        <div className="text-sm text-muted-foreground italic">Hələ heç kim təyin edilməyib.</div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead className="text-left text-[10.5px] uppercase tracking-wider text-muted-foreground">
                              <tr>
                                <th className="py-1.5">İşçi</th>
                                <th className="py-1.5">Təyin</th>
                                <th className="py-1.5">Başladı</th>
                                <th className="py-1.5">Tamamlandı</th>
                                <th className="py-1.5">Sertifikat</th>
                                <th className="py-1.5">Status</th>
                                <th className="py-1.5 w-24"></th>
                              </tr>
                            </thead>
                            <tbody>
                              {list.map((q) => (
                                <tr key={q.id} className="border-t border-border/30">
                                  <td className="py-1.5 font-medium">{q.istifadeci_ad}</td>
                                  <td className="py-1.5 text-xs">{q.teyin_tarix ? formatDate(new Date(q.teyin_tarix)) : "—"}</td>
                                  <td className="py-1.5 text-xs">{q.baslama_tarix ? formatDate(new Date(q.baslama_tarix)) : "—"}</td>
                                  <td className="py-1.5 text-xs">{q.tamam_tarix ? formatDate(new Date(q.tamam_tarix)) : "—"}</td>
                                  <td className="py-1.5">
                                    {q.sertifikat_url ? (
                                      <a href={q.sertifikat_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-info">
                                        Bax <ExternalLink className="h-3 w-3" />
                                      </a>
                                    ) : "—"}
                                  </td>
                                  <td className="py-1.5">
                                    <Badge variant="outline" className={"text-[10px] " + STATUS_LABEL[q.status].cls}>
                                      {STATUS_LABEL[q.status].label}
                                    </Badge>
                                  </td>
                                  <td className="py-1.5">
                                    <QeydActions qeyd={q} />
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

function DeleteTreninqBtn({ id }: { id: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  function onDel() {
    if (!confirm("Treninq və bütün qeydlər silinsin?")) return;
    startTransition(async () => {
      const fd = new FormData();
      fd.set("id", id);
      const res = await deleteTreninq(fd);
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

function QeydActions({ qeyd }: { qeyd: TreninqQeyd }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [openComplete, setOpenComplete] = useState(false);

  function onUpdate(status: "basladi" | "tamam", url?: string) {
    startTransition(async () => {
      const fd = new FormData();
      fd.set("id", qeyd.id);
      fd.set("status", status);
      if (url) fd.set("sertifikat_url", url);
      const res = await updateTreninqQeyd(fd);
      if (res.ok) toast.success("Yenilənildi");
      else toast.error(res.error);
      router.refresh();
    });
  }

  function onDel() {
    if (!confirm("Qeyd silinsin?")) return;
    startTransition(async () => {
      const fd = new FormData();
      fd.set("id", qeyd.id);
      const res = await deleteTreninqQeyd(fd);
      if (res.ok) toast.success("Silindi");
      else toast.error(res.error);
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-1">
      {qeyd.status === "teyin" && (
        <Button size="sm" variant="outline" onClick={() => onUpdate("basladi")} disabled={pending} className="text-xs">
          Başla
        </Button>
      )}
      {qeyd.status === "basladi" && (
        <Dialog open={openComplete} onOpenChange={setOpenComplete}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline" className="text-xs">Tamamla</Button>
          </DialogTrigger>
          <DialogContent className="md:max-w-md">
            <DialogHeader><DialogTitle>Tamamla — {qeyd.istifadeci_ad}</DialogTitle></DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                const url = fd.get("sertifikat_url")?.toString() || undefined;
                onUpdate("tamam", url);
                setOpenComplete(false);
              }}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label htmlFor="sertifikat_url">Sertifikat URL</Label>
                <Input id="sertifikat_url" name="sertifikat_url" maxLength={500} placeholder="https://..." />
              </div>
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setOpenComplete(false)}>İmtina</Button>
                <Button type="submit">Tamamla</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
      <Button size="sm" variant="ghost" onClick={onDel} disabled={pending} className="text-danger">
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

function NewTreninqDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await saveTreninq(fd);
      if (res.ok) {
        toast.success("Treninq yaradıldı");
        setOpen(false);
        router.refresh();
      } else toast.error(res.error);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="font-semibold text-white" style={{ background: "var(--brand-gradient)" }}>
          <Plus className="h-4 w-4" /> Yeni treninq
        </Button>
      </DialogTrigger>
      <DialogContent className="md:max-w-lg">
        <DialogHeader><DialogTitle>Yeni treninq</DialogTitle></DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ad">Ad *</Label>
            <Input id="ad" name="ad" required maxLength={150} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label htmlFor="muddet_saat">Müddət (saat)</Label>
              <Input id="muddet_saat" name="muddet_saat" type="number" min="0" max="2000" required defaultValue="8" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="xerc">Xərc</Label>
              <Input id="xerc" name="xerc" type="number" min="0" step="0.01" required defaultValue="0" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="teleb_seviyye">Səviyyə</Label>
              <Input id="teleb_seviyye" name="teleb_seviyye" maxLength={60} placeholder="Başlanğıc/Orta/Yüksək" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="tesvir">Təsvir</Label>
            <textarea id="tesvir" name="tesvir" maxLength={1000} rows={3} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="mecburi" value="true" />
            Bütün işçilər üçün məcburi
          </label>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>İmtina</Button>
            <Button type="submit" disabled={pending}>{pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Yarat</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditTreninqDialog({ treninq }: { treninq: Treninq }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("id", treninq.id);
    startTransition(async () => {
      const res = await saveTreninq(fd);
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
        <DialogHeader><DialogTitle>{treninq.ad}</DialogTitle></DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ad">Ad *</Label>
            <Input id="ad" name="ad" required maxLength={150} defaultValue={treninq.ad} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label htmlFor="muddet_saat">Müddət (saat)</Label>
              <Input id="muddet_saat" name="muddet_saat" type="number" min="0" max="2000" required defaultValue={treninq.muddet_saat} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="xerc">Xərc</Label>
              <Input id="xerc" name="xerc" type="number" min="0" step="0.01" required defaultValue={treninq.xerc} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="teleb_seviyye">Səviyyə</Label>
              <Input id="teleb_seviyye" name="teleb_seviyye" maxLength={60} defaultValue={treninq.teleb_seviyye} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="tesvir">Təsvir</Label>
            <textarea id="tesvir" name="tesvir" maxLength={1000} rows={3} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" defaultValue={treninq.tesvir} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="mecburi" value="true" defaultChecked={treninq.mecburi} />
            Bütün işçilər üçün məcburi
          </label>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>İmtina</Button>
            <Button type="submit" disabled={pending}>{pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Yadda saxla</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AssignDialog({ treninq, employees }: { treninq: Treninq; employees: Array<{ id: string; ad_soyad: string }> }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [istifadeciId, setIstifadeciId] = useState("");

  function onSubmit() {
    if (!istifadeciId) return;
    startTransition(async () => {
      const fd = new FormData();
      fd.set("treninq_id", treninq.id);
      fd.set("istifadeci_id", istifadeciId);
      const res = await assignTreninq(fd);
      if (res.ok) {
        toast.success("Təyin edildi");
        setOpen(false);
        setIstifadeciId("");
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
      <DialogContent className="md:max-w-sm">
        <DialogHeader><DialogTitle>Treninq təyin et</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="text-sm text-muted-foreground">{treninq.ad}</div>
          <div className="space-y-2">
            <Label>İşçi</Label>
            <Combobox
              options={employees.map<ComboOption>((e) => ({ value: e.id, label: e.ad_soyad }))}
              value={istifadeciId}
              onChange={setIstifadeciId}
              placeholder="— İşçi seçin —"
              searchPlaceholder="Axtar..."
              emptyText="Tapılmadı"
            />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>İmtina</Button>
          <Button type="button" onClick={onSubmit} disabled={pending || !istifadeciId}>
            {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Təyin et
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
