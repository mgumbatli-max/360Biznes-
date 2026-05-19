"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Save, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { updatePrices } from "../actions";
import type { QiymetRow } from "../queries";

type Field = keyof Omit<QiymetRow, "id" | "ad" | "kod">;

const FIELDS: { key: Field; label: string; emoji: string }[] = [
  { key: "satis_qiymeti",      label: "Satış",     emoji: "💰" },
  { key: "endirimli_qiymet",   label: "Endirim",   emoji: "🎁" },
  { key: "min_satis_qiymeti",  label: "Min",       emoji: "📉" },
  { key: "topdan_qiymeti",     label: "Topdan",    emoji: "📦" },
  { key: "partnyor_qiymeti",   label: "Partnyor",  emoji: "🤝" },
  { key: "vip_qiymeti",        label: "VIP",       emoji: "⭐" },
];

function marja(qiymet: number, maya: number): { pct: number; cls: string } {
  if (!maya || !qiymet) return { pct: 0, cls: "text-muted-foreground" };
  const pct = ((qiymet - maya) / maya) * 100;
  const cls = pct < 0 ? "text-danger" : pct < 10 ? "text-warning" : "text-success";
  return { pct, cls };
}

export function PriceRow({ row }: { row: QiymetRow }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [values, setValues] = useState<Record<Field, number | null>>({
    alish_qiymeti: row.alish_qiymeti,
    satis_qiymeti: row.satis_qiymeti,
    endirimli_qiymet: row.endirimli_qiymet,
    min_satis_qiymeti: row.min_satis_qiymeti,
    topdan_qiymeti: row.topdan_qiymeti,
    partnyor_qiymeti: row.partnyor_qiymeti,
    vip_qiymeti: row.vip_qiymeti,
  });
  const [dirty, setDirty] = useState(false);

  function set(k: Field, v: string) {
    const num = v === "" ? null : Number(v);
    setValues((p) => ({ ...p, [k]: Number.isFinite(num as number) ? num : null }));
    setDirty(true);
  }

  function save() {
    startTransition(async () => {
      const r = await updatePrices({
        id: row.id,
        alish_qiymeti: values.alish_qiymeti ?? 0,
        satis_qiymeti: values.satis_qiymeti ?? 0,
        endirimli_qiymet: values.endirimli_qiymet ?? null,
        min_satis_qiymeti: values.min_satis_qiymeti ?? 0,
        topdan_qiymeti: values.topdan_qiymeti ?? 0,
        partnyor_qiymeti: values.partnyor_qiymeti ?? 0,
        vip_qiymeti: values.vip_qiymeti ?? 0,
      });
      if (r.ok) {
        toast.success("Qiymət yeniləndi");
        setDirty(false);
        router.refresh();
      } else {
        toast.error(r.error);
      }
    });
  }

  const maya = values.alish_qiymeti ?? 0;

  return (
    <tr className={`border-b border-border/30 ${dirty ? "bg-warning/5" : ""}`}>
      <td className="px-3 py-2.5">
        <Link href={`/anbar/mehsullar/${row.id}`} className="block font-semibold text-sm hover:text-primary">
          {row.ad}
        </Link>
        {row.kod && <div className="text-[10.5px] font-mono text-muted-foreground">{row.kod}</div>}
      </td>
      <td className="px-2 py-2.5">
        <input
          type="number"
          step="0.01"
          min={0}
          value={values.alish_qiymeti ?? ""}
          onChange={(e) => set("alish_qiymeti", e.target.value)}
          className="h-8 w-24 rounded-md border border-border bg-background px-2 text-right text-sm font-bold tabular-nums text-primary"
        />
      </td>
      {FIELDS.map((f) => {
        const val = values[f.key];
        const m = marja(Number(val ?? 0), maya);
        return (
          <td key={f.key} className="px-1 py-2.5">
            <div className="flex flex-col">
              <div className="flex items-center justify-between text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                <span>{f.emoji} {f.label}</span>
              </div>
              <input
                type="number"
                step="0.01"
                min={0}
                value={val ?? ""}
                onChange={(e) => set(f.key, e.target.value)}
                className="mt-0.5 h-8 w-full rounded-md border border-border bg-secondary/40 px-2 text-right text-sm font-bold tabular-nums"
              />
              {val && maya > 0 && (
                <div className={`text-right text-[10px] font-semibold ${m.cls}`}>
                  {m.pct >= 0 ? "+" : ""}{m.pct.toFixed(1)}%
                </div>
              )}
            </div>
          </td>
        );
      })}
      <td className="px-2 py-2.5 text-right">
        <Button size="sm" disabled={!dirty || pending} onClick={save} className="font-semibold text-white" style={{ background: dirty ? "var(--brand-gradient)" : undefined }}>
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
        </Button>
      </td>
    </tr>
  );
}
