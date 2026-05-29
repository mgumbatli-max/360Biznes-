"use client";

import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Layers,
  Info,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Wand2,
  Settings2,
} from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "@/lib/toast";
import { formatMoney } from "@/lib/utils";
import {
  saveMehsulKanalQiymet,
  bulkApplyMethodToAllChannels,
} from "../actions";
import { computeChannelPrice, computeNetReturn, FORMULA_META, type KanalQiymetFormula } from "../types";
import type { MehsulKanalQiymetRow } from "../queries";

type Props = {
  mehsulId: string;
  baza: number;
  minBaza: number;
  initial: MehsulKanalQiymetRow[];
};

const FORMULAS: KanalQiymetFormula[] = ["baza", "auto_komissiya", "auto_net", "manual", "gizli"];

export function MehsulKanalQiymetTable({ mehsulId, baza, minBaza, initial }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [bulkPending, startBulkTransition] = useTransition();

  // hər kanal üçün lokal draft (manual qiyməti dəyişərkən)
  const [drafts, setDrafts] = useState<Record<string, string>>(() => {
    const m: Record<string, string> = {};
    for (const r of initial) {
      if (r.manual_qiymet !== null) m[r.kanal] = String(r.manual_qiymet);
    }
    return m;
  });

  if (initial.length === 0) {
    return (
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Hələ satış kanalı qurulmayıb. Əvvəl{" "}
          <Link href="/ayarlar/kanallar" className="font-semibold text-primary underline">
            Ayarlar → Satış kanalları
          </Link>{" "}
          bölməsində kanalları əlavə edin (Mağaza, Wolt, Birmarket və s.).
        </AlertDescription>
      </Alert>
    );
  }

  function changeFormula(kanal: string, next: KanalQiymetFormula) {
    const row = initial.find((r) => r.kanal === kanal);
    if (!row) return;
    startTransition(async () => {
      const cached = computeChannelPrice({
        baza,
        formula: next,
        manual: next === "manual" ? Number(drafts[kanal] ?? row.manual_qiymet ?? baza) : null,
        komissiya_faiz: row.komissiya?.komissiya_faiz,
        sabit_komissiya: row.komissiya?.sabit_komissiya,
        catdirilma: row.komissiya?.catdirilma,
        bank_xerc: row.komissiya?.bank_xerc,
      });
      const res = await saveMehsulKanalQiymet({
        mehsul_id: mehsulId,
        kanal,
        formula: next,
        manual_qiymet: next === "manual" ? Number(drafts[kanal] ?? row.manual_qiymet ?? baza) : undefined,
        cached_qiymet: cached,
      });
      if (res.ok) {
        toast.success("Yeniləndi");
        router.refresh();
      } else toast.error(res.error);
    });
  }

  function commitManual(kanal: string) {
    const row = initial.find((r) => r.kanal === kanal);
    if (!row) return;
    const v = Number((drafts[kanal] ?? "").replace(",", "."));
    if (!Number.isFinite(v) || v < 0) {
      toast.error("Yanlış rəqəm");
      return;
    }
    startTransition(async () => {
      const res = await saveMehsulKanalQiymet({
        mehsul_id: mehsulId,
        kanal,
        formula: "manual",
        manual_qiymet: v,
      });
      if (res.ok) {
        toast.success("Yeniləndi");
        router.refresh();
      } else toast.error(res.error);
    });
  }

  function bulkApply(formula: "baza" | "auto_komissiya" | "auto_net") {
    if (
      !confirm(
        `Bütün kanallar üçün "${FORMULA_META[formula].label}" metoduna keçirilsin? Mövcud manual qiymətlər siləcəkdir.`,
      )
    )
      return;
    startBulkTransition(async () => {
      const res = await bulkApplyMethodToAllChannels({ mehsul_id: mehsulId, formula });
      if (res.ok) {
        toast.success(`${res.data?.count ?? 0} kanal yeniləndi`);
        router.refresh();
      } else toast.error(res.error);
    });
  }

  const totals = useMemo(() => {
    const min = Math.min(...initial.map((r) => r.effective_qiymet));
    const max = Math.max(...initial.map((r) => r.effective_qiymet));
    return { min, max };
  }, [initial]);

  return (
    <Card className="glass">
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 pb-3">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <Layers className="h-4 w-4 text-primary" />
            Kanal qiymətləri
          </CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            Baza qiymət: <strong>{formatMoney(baza)}</strong>
            {minBaza > 0 && (
              <>
                {" "}· Min satış: <strong>{formatMoney(minBaza)}</strong>
              </>
            )}
            {" "}· Aralıq: <strong>{formatMoney(totals.min)} … {formatMoney(totals.max)}</strong>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <span className="text-[10.5px] text-muted-foreground mr-1">Hamısına tətbiq et:</span>
          <Button size="sm" variant="outline" onClick={() => bulkApply("baza")} disabled={bulkPending}>
            Baza
          </Button>
          <Button size="sm" variant="outline" onClick={() => bulkApply("auto_komissiya")} disabled={bulkPending}>
            <Wand2 className="h-3 w-3" /> + Komissiya
          </Button>
          <Button size="sm" variant="outline" onClick={() => bulkApply("auto_net")} disabled={bulkPending}>
            <Wand2 className="h-3 w-3" /> Net qoru
          </Button>
          {bulkPending && <Loader2 className="ml-1 h-3 w-3 animate-spin" />}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary/30 text-[10.5px] uppercase tracking-wider text-muted-foreground">
              <tr className="text-left">
                <th className="px-3 py-2 font-medium">Kanal</th>
                <th className="px-3 py-2 font-medium">Komis.</th>
                <th className="px-3 py-2 font-medium">Metod</th>
                <th className="px-3 py-2 text-right font-medium">Qiymət</th>
                <th className="px-3 py-2 text-right font-medium">Net qazanc</th>
                <th className="px-3 py-2 text-right font-medium">Marja</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {initial.map((r) => {
                const meta = FORMULA_META[r.formula];
                const isHidden = r.formula === "gizli";
                const marja = baza > 0 ? ((r.net_qazanc - baza) / baza) * 100 : 0;
                const isLoss = !isHidden && r.net_qazanc < baza - 0.001;
                const belowMin = !isHidden && minBaza > 0 && r.effective_qiymet < minBaza - 0.001;
                return (
                  <tr key={r.kanal} className={`hover:bg-secondary/20 ${isHidden ? "opacity-60" : ""}`}>
                    <td className="px-3 py-2.5">
                      <code className="rounded bg-secondary/60 px-1.5 py-0.5 text-xs font-mono">
                        {r.kanal}
                      </code>
                      {isHidden && (
                        <Badge variant="outline" className="ml-1 border-rose-400/40 text-[9px] text-rose-500">
                          gizli
                        </Badge>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground tabular-nums">
                      {r.komissiya?.komissiya_faiz ?? 0}%
                      {r.komissiya?.sabit_komissiya ? ` + ${r.komissiya.sabit_komissiya}₼` : ""}
                    </td>
                    <td className="px-3 py-2.5">
                      <select
                        value={r.formula}
                        onChange={(e) => changeFormula(r.kanal, e.target.value as KanalQiymetFormula)}
                        disabled={pending}
                        className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                      >
                        {FORMULAS.map((f) => (
                          <option key={f} value={f}>{FORMULA_META[f].label}</option>
                        ))}
                      </select>
                      <p className="mt-0.5 text-[10px] text-muted-foreground">
                        {meta.desc}
                      </p>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      {isHidden ? (
                        <span className="text-xs text-muted-foreground">—</span>
                      ) : r.formula === "manual" ? (
                        <div className="inline-flex items-center gap-1">
                          <Input
                            type="number"
                            inputMode="decimal"
                            value={drafts[r.kanal] ?? String(r.manual_qiymet ?? "")}
                            onChange={(e) =>
                              setDrafts((d) => ({ ...d, [r.kanal]: e.target.value }))
                            }
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                commitManual(r.kanal);
                              }
                            }}
                            onBlur={() => commitManual(r.kanal)}
                            min={0}
                            step={0.01}
                            disabled={pending}
                            className="h-8 w-24 text-right text-sm tabular-nums"
                          />
                          <span className="text-xs text-muted-foreground">₼</span>
                        </div>
                      ) : (
                        <span className="font-semibold tabular-nums">
                          {formatMoney(r.effective_qiymet)}
                        </span>
                      )}
                    </td>
                    <td className={`px-3 py-2.5 text-right text-sm tabular-nums ${isHidden ? "text-muted-foreground" : isLoss ? "text-rose-600" : "text-emerald-600"}`}>
                      {isHidden ? "—" : formatMoney(r.net_qazanc)}
                      {!isHidden && (isLoss ? (
                        <AlertTriangle className="ml-1 inline h-3 w-3" />
                      ) : (
                        <CheckCircle2 className="ml-1 inline h-3 w-3" />
                      ))}
                    </td>
                    <td className={`px-3 py-2.5 text-right text-xs tabular-nums ${isHidden ? "text-muted-foreground" : marja < 0 ? "text-rose-600" : marja > 5 ? "text-emerald-600" : "text-amber-600"}`}>
                      {isHidden ? "—" : <>{marja >= 0 ? "+" : ""}{marja.toFixed(1)}%</>}
                      {belowMin && (
                        <Badge variant="outline" className="ml-1 border-rose-400/40 text-[9px] text-rose-500">
                          Min altda
                        </Badge>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="border-t border-border/30 bg-card/30 px-3 py-2 text-[10.5px] text-muted-foreground flex items-center gap-2">
          <Settings2 className="h-3 w-3" />
          Komissiya/xərc dəyişdirmək üçün:{" "}
          <Link href="/ayarlar/kanallar" className="font-semibold text-primary hover:underline">
            Ayarlar → Satış kanalları
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
