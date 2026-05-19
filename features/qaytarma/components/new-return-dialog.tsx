"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { formatMoney } from "@/lib/utils";
import { createReturn } from "../actions";

type Opt = { id: number | string; ad: string };
type MehsulOpt = { id: string; ad: string; kod: string | null; satis_qiymeti: number };

type Line = {
  uid: string;
  mehsul_id: string;
  miqdar: number;
  vahid_qiymet: number;
};

export function NewReturnDialog({
  anbarlar,
  musteriler,
  mehsullar,
}: {
  anbarlar: Opt[];
  musteriler: Opt[];
  mehsullar: MehsulOpt[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const [nov, setNov] = useState<"musteri" | "techizatci">("musteri");
  const [anbarId, setAnbarId] = useState<number>(Number(anbarlar[0]?.id ?? 0));
  const [kontragentId, setKontragentId] = useState<string>("");
  const [sebeb, setSebeb] = useState("");
  const [qeyd, setQeyd] = useState("");
  const [lines, setLines] = useState<Line[]>([]);

  function addLine() {
    setLines((p) => [
      ...p,
      {
        uid: Math.random().toString(36).slice(2, 10),
        mehsul_id: "",
        miqdar: 1,
        vahid_qiymet: 0,
      },
    ]);
  }

  function setLine(uid: string, patch: Partial<Line>) {
    setLines((p) => p.map((l) => (l.uid === uid ? { ...l, ...patch } : l)));
  }

  function removeLine(uid: string) {
    setLines((p) => p.filter((l) => l.uid !== uid));
  }

  function reset() {
    setNov("musteri");
    setAnbarId(Number(anbarlar[0]?.id ?? 0));
    setKontragentId("");
    setSebeb("");
    setQeyd("");
    setLines([]);
    setError(null);
  }

  const umumi = lines.reduce((s, l) => s + l.miqdar * l.vahid_qiymet, 0);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (sebeb.trim().length < 3) {
      setError("Səbəb tələb olunur (ən azı 3 simvol)");
      return;
    }
    const validLines = lines.filter((l) => l.mehsul_id && l.miqdar > 0);
    if (validLines.length === 0) {
      setError("Ən az 1 məhsul sətri əlavə edin");
      return;
    }
    startTransition(async () => {
      const res = await createReturn({
        nov,
        anbar_id: anbarId,
        kontragent_id: kontragentId || null,
        sebeb: sebeb.trim(),
        qeyd: qeyd.trim() || null,
        lines: validLines.map((l) => ({
          mehsul_id: l.mehsul_id,
          miqdar: l.miqdar,
          vahid_qiymet: l.vahid_qiymet,
        })),
      });
      if (!res.ok) {
        setError(res.error);
        toast.error(res.error);
        return;
      }
      toast.success(`Qaytarma yaradıldı: ${res.data?.nomre ?? ""}`);
      setOpen(false);
      reset();
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        <Button size="sm" className="font-semibold text-white" style={{ background: "var(--brand-gradient)" }}>
          <Plus className="h-3.5 w-3.5" /> Yeni qaytarma
        </Button>
      </DialogTrigger>
      <DialogContent className="md:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Yeni qaytarma</DialogTitle>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-3">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <Label>Növ *</Label>
              <select
                value={nov}
                onChange={(e) => setNov(e.target.value as "musteri" | "techizatci")}
                disabled={pending}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="musteri">Müştəri qaytarması</option>
                <option value="techizatci">Təchizatçıya qaytarma</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label>Anbar *</Label>
              <select
                value={anbarId}
                onChange={(e) => setAnbarId(Number(e.target.value))}
                disabled={pending}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {anbarlar.map((a) => (
                  <option key={a.id} value={String(a.id)}>{a.ad}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label>Kontragent</Label>
              <select
                value={kontragentId}
                onChange={(e) => setKontragentId(e.target.value)}
                disabled={pending}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">—</option>
                {musteriler.map((m) => (
                  <option key={m.id} value={String(m.id)}>{m.ad}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label>Səbəb *</Label>
              <textarea
                value={sebeb}
                onChange={(e) => setSebeb(e.target.value)}
                rows={2}
                maxLength={2000}
                placeholder="Niyə qaytarılır? (defekt, səhv, müştəri istəmir...)"
                className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                disabled={pending}
              />
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label>Qeyd</Label>
              <Input
                value={qeyd}
                onChange={(e) => setQeyd(e.target.value)}
                placeholder="Əlavə qeyd (istəyə bağlı)"
                disabled={pending}
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Məhsullar *</Label>
              <Button type="button" size="sm" variant="outline" onClick={addLine} disabled={pending}>
                <Plus className="h-3.5 w-3.5" /> Sətir
              </Button>
            </div>
            {lines.length === 0 ? (
              <div className="rounded-md border border-dashed border-border/60 py-4 text-center text-xs text-muted-foreground">
                Sətir yoxdur — yuxarıdan əlavə edin
              </div>
            ) : (
              <div className="max-h-60 overflow-y-auto rounded-md border border-border">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-secondary/40 text-xs">
                    <tr>
                      <th className="px-2 py-1 text-left">Məhsul</th>
                      <th className="px-2 py-1 text-right">Miqdar</th>
                      <th className="px-2 py-1 text-right">Qiymət</th>
                      <th className="px-2 py-1 text-right">Cəm</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((l) => {
                      const cemi = l.miqdar * l.vahid_qiymet;
                      return (
                        <tr key={l.uid} className="border-t border-border/40">
                          <td className="px-2 py-1">
                            <select
                              value={l.mehsul_id}
                              onChange={(e) => {
                                const m = mehsullar.find((x) => x.id === e.target.value);
                                setLine(l.uid, {
                                  mehsul_id: e.target.value,
                                  vahid_qiymet: m?.satis_qiymeti ?? l.vahid_qiymet,
                                });
                              }}
                              disabled={pending}
                              className="h-7 w-full rounded border border-border bg-background px-1.5 text-xs"
                            >
                              <option value="">— məhsul seçin —</option>
                              {mehsullar.map((m) => (
                                <option key={m.id} value={m.id}>
                                  {m.ad}{m.kod ? ` (${m.kod})` : ""}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="px-2 py-1">
                            <Input
                              type="number"
                              step="0.001"
                              min={0.001}
                              value={l.miqdar}
                              onChange={(e) => setLine(l.uid, { miqdar: Math.max(0, Number(e.target.value) || 0) })}
                              className="h-7 w-20 text-right"
                              disabled={pending}
                            />
                          </td>
                          <td className="px-2 py-1">
                            <Input
                              type="number"
                              step="0.01"
                              min={0}
                              value={l.vahid_qiymet}
                              onChange={(e) => setLine(l.uid, { vahid_qiymet: Math.max(0, Number(e.target.value) || 0) })}
                              className="h-7 w-24 text-right"
                              disabled={pending}
                            />
                          </td>
                          <td className="px-2 py-1 text-right text-xs font-medium tabular-nums">{formatMoney(cemi)}</td>
                          <td className="px-2 py-1">
                            <button
                              type="button"
                              onClick={() => removeLine(l.uid)}
                              className="text-muted-foreground hover:text-danger"
                              disabled={pending}
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {lines.length > 0 && (
              <div className="flex items-center justify-end gap-2 text-sm">
                <span className="text-muted-foreground">Yekun:</span>
                <span className="font-bold tabular-nums">{formatMoney(umumi)}</span>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
              İmtina
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Yarat
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
