"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Loader2, Image as ImageIcon, Sparkles, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { updateLineField, deleteLine } from "../proposal-actions";

type Line = {
  id: number;
  mehsul_id: string | null;
  mehsul_adi: string;
  mehsul_kod: string | null;
  marka: string | null;
  kateqoriya: string | null;
  vahid: string | null;
  miqdar: { toNumber(): number } | number;
  teyinat: string | null;
  bazar_qiymeti: { toNumber(): number } | number | null;
  son_alish_qiymeti: { toNumber(): number } | number | null;
  teklif_qiymeti: { toNumber(): number } | number | null;
  satis_qiymeti: { toNumber(): number } | number | null;
  techizatci_id: string | null;
  techizatci_ad: string | null;
  shekil_url: string | null;
  yeni_mehsul: boolean;
  servis_mehsulu: boolean;
  qeyd: string | null;
  ai_analiz: string | null;
  mehsul: { id: string; ad: string; kod: string | null } | null;
  techizatci: { id: string; ad: string } | null;
};

function toNum(v: { toNumber(): number } | number | null | undefined): number {
  if (v == null) return 0;
  if (typeof v === "number") return v;
  return v.toNumber();
}

export function LineRowEditor({ line, index, readOnly }: { line: Line; index: number; readOnly: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function setField(field: string, value: string) {
    const fd = new FormData();
    fd.set("id", String(line.id));
    fd.set("field", field);
    fd.set("value", value);
    startTransition(async () => {
      const res = await updateLineField(fd);
      if (!res.ok) toast.error(res.error);
      else router.refresh();
    });
  }

  async function onDelete() {
    if (!confirm(`«${line.mehsul_adi}» sətrini silmək istəyirsiniz?`)) return;
    const fd = new FormData();
    fd.set("id", String(line.id));
    const res = await deleteLine(fd);
    if (!res.ok) toast.error(res.error);
    else {
      toast.success("Silindi");
      router.refresh();
    }
  }

  const miqdar = toNum(line.miqdar);
  const teklifQ = toNum(line.teklif_qiymeti);
  const sonAlish = toNum(line.son_alish_qiymeti);
  const satisQ = toNum(line.satis_qiymeti);
  const cəmi = miqdar * teklifQ;
  const mənfeet = (satisQ - teklifQ) * miqdar;
  const isOverpriced = teklifQ > 0 && sonAlish > 0 && teklifQ > sonAlish * 1.15;

  return (
    <tr className={cn("border-b border-border/20", pending && "opacity-60")}>
      <td className="px-2 py-2 text-xs text-muted-foreground tabular-nums">{index}</td>
      <td className="px-2 py-2">
        {line.shekil_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={line.shekil_url} alt="" className="h-10 w-10 rounded-md object-cover" />
        ) : (
          <div className="grid h-10 w-10 place-items-center rounded-md bg-secondary text-muted-foreground/40">
            <ImageIcon className="h-4 w-4" />
          </div>
        )}
      </td>
      <td className="px-2 py-2 max-w-xs">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-semibold">{line.mehsul_adi}</span>
          {line.yeni_mehsul && <Badge variant="outline" className="text-[9px] text-amber-500 border-amber-500/40">Yeni</Badge>}
          {line.servis_mehsulu && <Badge variant="outline" className="text-[9px] text-violet-500 border-violet-500/40">Servis</Badge>}
          {line.ai_analiz && (
            <span title={line.ai_analiz}>
              <Sparkles className="h-3 w-3 text-amber-500" />
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-x-2 text-[11px] text-muted-foreground">
          {line.mehsul_kod && <span className="font-mono">{line.mehsul_kod}</span>}
          {line.marka && <span>· {line.marka}</span>}
          {line.kateqoriya && <span>· {line.kateqoriya}</span>}
        </div>
        {line.teyinat && (
          <div className="mt-0.5 line-clamp-1 text-[11px] italic text-muted-foreground">{line.teyinat}</div>
        )}
      </td>
      <td className="px-2 py-2">
        <EditableNumber value={miqdar} onChange={(v) => setField("miqdar", v)} disabled={readOnly || pending} />
      </td>
      <td className="px-2 py-2">
        <EditableNumber value={toNum(line.bazar_qiymeti)} onChange={(v) => setField("bazar_qiymeti", v)} disabled={readOnly || pending} />
      </td>
      <td className="px-2 py-2 text-right text-xs tabular-nums text-muted-foreground">
        {sonAlish > 0 ? sonAlish.toFixed(2) : "—"}
      </td>
      <td className="px-2 py-2">
        <div className="flex items-center gap-1 justify-end">
          {isOverpriced && (
            <span title="Son alışdan 15% bahadır">
              <AlertTriangle className="h-3 w-3 text-amber-500" />
            </span>
          )}
          <EditableNumber value={teklifQ} onChange={(v) => setField("teklif_qiymeti", v)} disabled={readOnly || pending} />
        </div>
      </td>
      <td className="px-2 py-2">
        <EditableNumber value={satisQ} onChange={(v) => setField("satis_qiymeti", v)} disabled={readOnly || pending} />
      </td>
      <td className="px-2 py-2 text-right text-xs font-semibold tabular-nums">{cəmi.toFixed(2)} ₼</td>
      <td className={cn("px-2 py-2 text-right text-xs font-semibold tabular-nums", mənfeet < 0 ? "text-rose-500" : "text-emerald-600")}>
        {mənfeet.toFixed(2)} ₼
      </td>
      <td className="px-2 py-2 max-w-[120px] truncate text-xs text-muted-foreground">
        {line.techizatci?.ad ?? line.techizatci_ad ?? "—"}
      </td>
      <td className="px-2 py-2">
        {!readOnly && (
          <button
            type="button"
            onClick={onDelete}
            disabled={pending}
            className="rounded p-1 text-muted-foreground hover:bg-rose-500/10 hover:text-rose-500"
          >
            {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
          </button>
        )}
      </td>
    </tr>
  );
}

function EditableNumber({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const [text, setText] = useState(value === 0 ? "" : String(value));
  if (disabled) {
    return <div className="text-right text-xs tabular-nums">{value > 0 ? value.toFixed(2) : "—"}</div>;
  }
  return (
    <Input
      type="number"
      step="0.01"
      min="0"
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={(e) => {
        const v = e.target.value;
        if (Number(v) !== value) onChange(v);
      }}
      className="h-7 w-full text-right text-xs tabular-nums"
    />
  );
}
