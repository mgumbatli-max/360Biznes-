"use client";

import { useState, useTransition } from "react";
import { Loader2, Save, Shield } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { saveRoleAllowedTiers } from "../qiymet-icaze-actions";
import { ALL_TIERS, TIER_LABELS, type TierKey } from "../qiymet-icaze-types";

type Row = { rolId: number; ad: string; sistem: boolean; tiers: TierKey[] };

export function QiymetIcazeClient({ initial }: { initial: Row[] }) {
  const [rows, setRows] = useState<Row[]>(initial);
  const [pending, startSave] = useTransition();
  const [pendingId, setPendingId] = useState<number | null>(null);

  function toggleTier(rolId: number, tier: TierKey) {
    setRows((prev) =>
      prev.map((r) =>
        r.rolId === rolId
          ? {
              ...r,
              tiers: r.tiers.includes(tier)
                ? r.tiers.filter((t) => t !== tier)
                : [...r.tiers, tier],
            }
          : r,
      ),
    );
  }

  function saveRow(row: Row) {
    setPendingId(row.rolId);
    startSave(async () => {
      const res = await saveRoleAllowedTiers(row.rolId, row.tiers);
      if (res.ok) {
        toast.success(`${row.ad}: yadda saxlanıldı`);
      } else {
        toast.error(res.error);
      }
      setPendingId(null);
    });
  }

  return (
    <div className="space-y-3">
      <Card className="glass">
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/40 text-left text-xs">
                <th className="px-3 py-2 font-semibold">Rol</th>
                {ALL_TIERS.map((t) => (
                  <th key={t} className="px-3 py-2 text-center font-semibold">
                    {TIER_LABELS[t]}
                  </th>
                ))}
                <th className="px-3 py-2 text-right font-semibold">Saxla</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.rolId} className="border-b border-border/40 last:border-0">
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <Shield className="h-3.5 w-3.5 text-primary-light" />
                      <span className="font-medium capitalize">{r.ad}</span>
                      {r.sistem && <Badge variant="outline" className="text-[10px]">sistem</Badge>}
                    </div>
                  </td>
                  {ALL_TIERS.map((t) => (
                    <td key={t} className="px-3 py-2 text-center">
                      <input
                        type="checkbox"
                        className="h-4 w-4 cursor-pointer accent-primary"
                        checked={r.tiers.includes(t)}
                        onChange={() => toggleTier(r.rolId, t)}
                        aria-label={`${r.ad} - ${TIER_LABELS[t]}`}
                      />
                    </td>
                  ))}
                  <td className="px-3 py-2 text-right">
                    <Button
                      size="sm"
                      onClick={() => saveRow(r)}
                      disabled={pending && pendingId === r.rolId}
                      className="gap-1"
                    >
                      {pending && pendingId === r.rolId ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Save className="h-3.5 w-3.5" />
                      )}
                      Saxla
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
      <div className="rounded-md border border-border/40 bg-secondary/20 p-3 text-xs text-muted-foreground">
        <strong className="font-semibold">Qeyd:</strong> Bu matrix POS-da satıcının
        məhsul sətrində qiymət-növləri popoverinin hansı qiymət tiplərini göstərəcəyini
        idarə edir. Müştəri-üzü cek-də heç bir dəyişiklik baş vermir; yalnız satıcı bu
        məlumatı görür və klikləyərək seçə bilər.
      </div>
    </div>
  );
}
