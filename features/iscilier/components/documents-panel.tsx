"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileText, Trash2, Plus, ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { formatDate } from "@/lib/utils";
import { useMounted } from "@/lib/hooks/use-mounted";
import { addEmployeeDocument, deleteEmployeeDocument } from "../documents-actions";
import type { EmployeeDocument } from "../documents-queries";

const CATEGORIES = [
  { value: "shexsiyyet", label: "Şəxsiyyət vəsiqəsi" },
  { value: "kontrakt", label: "Kontrakt" },
  { value: "diplom", label: "Diplom / sertifikat" },
  { value: "tibbi", label: "Tibbi sənəd" },
  { value: "banka", label: "Bank arayışı" },
  { value: "vergi", label: "Vergi məlumatı" },
  { value: "diger", label: "Digər" },
];

export function DocumentsPanel({
  istifadeciId,
  documents,
}: {
  istifadeciId: string;
  documents: EmployeeDocument[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [delPending, startDelTransition] = useTransition();
  const mounted = useMounted();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    fd.set("istifadeci_id", istifadeciId);
    startTransition(async () => {
      const res = await addEmployeeDocument(fd);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      toast.success("Sənəd əlavə olundu");
      setOpen(false);
      router.refresh();
    });
  }

  function onDelete(id: number) {
    if (!confirm("Sənədi silmək istəyirsiniz?")) return;
    startDelTransition(async () => {
      const fd = new FormData();
      fd.set("id", String(id));
      fd.set("istifadeci_id", istifadeciId);
      const res = await deleteEmployeeDocument(fd);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Silindi");
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {documents.length} sənəd
        </div>
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus className="h-3.5 w-3.5" /> Yeni sənəd
        </Button>
      </div>

      {documents.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-12 text-center">
          <FileText className="mb-2 h-7 w-7 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">Hələ sənəd əlavə olunmayıb</p>
        </div>
      ) : (
        <Card className="glass">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border/60 text-left text-[10.5px] uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2.5">Ad</th>
                    <th className="px-3 py-2.5">Kateqoriya</th>
                    <th className="px-3 py-2.5">Bitir</th>
                    <th className="px-3 py-2.5">Yükləndi</th>
                    <th className="px-3 py-2.5 text-right"></th>
                  </tr>
                </thead>
                <tbody>
                  {documents.map((d) => {
                    const expired = mounted && d.bitme_tarixi && new Date(d.bitme_tarixi) < new Date();
                    return (
                      <tr key={d.id} className="border-b border-border/30">
                        <td className="px-3 py-2 text-xs">
                          <div className="font-medium">{d.ad}</div>
                          {d.qeyd && <div className="text-[10.5px] text-muted-foreground">{d.qeyd}</div>}
                        </td>
                        <td className="px-3 py-2 text-xs">
                          <Badge variant="outline" className="text-[10px]">
                            {CATEGORIES.find((c) => c.value === d.kateqoriya)?.label ?? d.kateqoriya}
                          </Badge>
                        </td>
                        <td className="px-3 py-2 text-xs">
                          {d.bitme_tarixi ? (
                            <span className={expired ? "text-danger" : ""}>{formatDate(d.bitme_tarixi)}</span>
                          ) : "—"}
                        </td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">
                          {d.yaradildi ? formatDate(d.yaradildi) : "—"}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <a
                              href={d.fayl_url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground"
                              title="Aç"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                            <button
                              type="button"
                              onClick={() => onDelete(d.id)}
                              disabled={delPending}
                              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-danger"
                              title="Sil"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Yeni sənəd</DialogTitle>
          </DialogHeader>
          <form onSubmit={onSubmit} className="space-y-4">
            {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
            <div className="space-y-2">
              <Label htmlFor="d_kategoriya">Kateqoriya *</Label>
              <select
                id="d_kategoriya"
                name="kateqoriya"
                className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                required
                defaultValue="shexsiyyet"
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="d_ad">Sənəd adı *</Label>
              <Input id="d_ad" name="ad" required minLength={1} maxLength={200} placeholder="Şəxsiyyət vəsiqəsi (skan)" autoFocus />
            </div>
            <div className="space-y-2">
              <Label htmlFor="d_url">Fayl URL *</Label>
              <Input id="d_url" name="fayl_url" required minLength={1} maxLength={500} placeholder="https://..." />
              <p className="text-[10.5px] text-muted-foreground">
                Faylı əvvəlcə storage-a yükləyib URL-i bura yapışdırın.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="d_nov">Növ</Label>
                <Input id="d_nov" name="fayl_nov" maxLength={50} placeholder="pdf, jpg, ..." />
              </div>
              <div className="space-y-2">
                <Label htmlFor="d_bitme">Bitir tarixi</Label>
                <Input id="d_bitme" name="bitme_tarixi" type="date" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="d_qeyd">Qeyd</Label>
              <Input id="d_qeyd" name="qeyd" maxLength={2000} />
            </div>

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>İmtina</Button>
              <Button type="submit" disabled={pending}>
                {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Yarat
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function DocumentsPanelHeader({ icon }: { icon: React.ComponentType<{ className?: string }> }) {
  const Icon = icon;
  return (
    <CardHeader className="pb-2">
      <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground inline-flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5" /> Sənədlər
      </CardTitle>
    </CardHeader>
  );
}
