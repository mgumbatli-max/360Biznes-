"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Package, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Combobox } from "@/components/ui/combobox";
import { addEhtiyatHisse, deleteEhtiyatHisse } from "../actions";
import { formatMoney } from "@/lib/utils";

type ProductOpt = { id: string; ad: string; kod: string | null; barkod: string | null };
type EhtiyatRow = {
  id: string;
  mehsul_id: string | null;
  mehsul_ad: string;
  mehsul_kod: string | null;
  miqdar: number;
  qiymet: number;
  yaradildi: Date | null;
};

export function EhtiyatHisseTab({
  servisId,
  hisseler,
  mehsullar,
}: {
  servisId: string;
  hisseler: EhtiyatRow[];
  mehsullar: ProductOpt[];
}) {
  const router = useRouter();
  const [mehsul_id, setMehsulId] = useState<string>("");
  const [miqdar, setMiqdar] = useState(1);
  const [qiymet, setQiymet] = useState(0);
  const [pending, startTransition] = useTransition();

  const cem = hisseler.reduce((s, h) => s + h.qiymet * h.miqdar, 0);

  function submit() {
    if (!mehsul_id || miqdar <= 0) {
      toast.error("Məhsul və miqdar tələb olunur");
      return;
    }
    const fd = new FormData();
    fd.append("id", servisId);
    fd.append("mehsul_id", mehsul_id);
    fd.append("miqdar", String(miqdar));
    fd.append("qiymet", String(qiymet));
    startTransition(async () => {
      const res = await addEhtiyatHisse(fd);
      if (res.ok) {
        toast.success("Hissə əlavə olundu, stok azaldı");
        setMehsulId("");
        setMiqdar(1);
        setQiymet(0);
        router.refresh();
      } else toast.error(res.error);
    });
  }

  function remove(hereketId: string) {
    if (!confirm("Bu hissə silinsin?")) return;
    const fd = new FormData();
    fd.append("servis_id", servisId);
    fd.append("hereket_id", hereketId);
    startTransition(async () => {
      const res = await deleteEhtiyatHisse(fd);
      if (res.ok) {
        toast.success("Silindi");
        router.refresh();
      } else toast.error(res.error);
    });
  }

  const opts = mehsullar.map((m) => ({
    value: m.id,
    label: `${m.ad}${m.kod ? ` · ${m.kod}` : ""}`,
  }));

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-border/40 bg-card/30 p-3">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <div className="space-y-1.5 md:col-span-2">
            <Label className="text-xs">Məhsul</Label>
            <Combobox
              options={opts}
              value={mehsul_id}
              onChange={setMehsulId}
              placeholder="Məhsul seç…"
              searchPlaceholder="Axtar…"
              emptyText="Məhsul tapılmadı"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Miqdar</Label>
            <Input
              type="number"
              min={1}
              step={1}
              value={miqdar}
              onChange={(e) => setMiqdar(Math.max(1, Number(e.target.value || 0)))}
              disabled={pending}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Vahid qiymət</Label>
            <Input
              type="number"
              min={0}
              step="0.01"
              value={qiymet}
              onChange={(e) => setQiymet(Math.max(0, Number(e.target.value || 0)))}
              disabled={pending}
            />
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <div className="text-xs text-muted-foreground">
            Cəm:{" "}
            <span className="font-semibold tabular-nums text-foreground">
              {formatMoney(miqdar * qiymet)}
            </span>
          </div>
          <Button size="sm" onClick={submit} disabled={pending || !mehsul_id}>
            {pending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Plus className="mr-1.5 h-3.5 w-3.5" />}
            Hissəni əlavə et
          </Button>
        </div>
      </div>

      {hisseler.length === 0 ? (
        <div className="flex flex-col items-center gap-1 rounded-md border border-dashed border-border/60 py-8 text-center text-xs text-muted-foreground">
          <Package className="h-4 w-4" />
          <span>Bu servisə hələ ehtiyat hissə əlavə edilməyib.</span>
        </div>
      ) : (
        <div className="rounded-md border border-border/40">
          <table className="w-full text-sm">
            <thead className="border-b border-border/40 text-left text-[10.5px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Məhsul</th>
                <th className="px-3 py-2 text-right">Miqdar</th>
                <th className="px-3 py-2 text-right">Qiymət</th>
                <th className="px-3 py-2 text-right">Cəm</th>
                <th className="px-3 py-2 text-right" />
              </tr>
            </thead>
            <tbody>
              {hisseler.map((h) => (
                <tr key={h.id} className="border-b border-border/20 hover:bg-secondary/30">
                  <td className="px-3 py-2">
                    <div className="font-medium">{h.mehsul_ad}</div>
                    {h.mehsul_kod && <div className="font-mono text-[11px] text-muted-foreground">{h.mehsul_kod}</div>}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{h.miqdar}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatMoney(h.qiymet)}</td>
                  <td className="px-3 py-2 text-right tabular-nums font-semibold">
                    {formatMoney(h.qiymet * h.miqdar)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => remove(h.id)}
                      disabled={pending}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition hover:bg-rose-500/10 hover:text-rose-400"
                      title="Sil"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
              <tr className="bg-secondary/20">
                <td colSpan={3} className="px-3 py-2 text-right text-xs text-muted-foreground">
                  Cəmi
                </td>
                <td className="px-3 py-2 text-right font-bold tabular-nums">{formatMoney(cem)}</td>
                <td />
              </tr>
            </tbody>
          </table>
        </div>
      )}

      <p className="text-[10.5px] text-muted-foreground">
        Hissələr <code className="rounded bg-secondary/40 px-1">anbar_hereketleri</code> cədvəlinə{" "}
        <code className="rounded bg-secondary/40 px-1">servis_mexaric</code> kimi yazılır, stok azalır.
      </p>
    </div>
  );
}
