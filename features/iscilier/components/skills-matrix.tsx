"use client";

import Link from "next/link";
import { Filter, TrendingDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { SkillsMatrixData } from "../hr-types";

const LEVEL_COLORS = ["#374151", "#7f1d1d", "#92400e", "#a16207", "#059669", "#047857"];
// 0 (no rating), 1=red, 2=orange-amber, 3=yellow, 4=green, 5=emerald-deep

export function SkillsMatrixView({
  data,
  sobeler,
  activeSobe,
}: {
  data: SkillsMatrixData;
  sobeler: Array<{ ad: string; count: number }>;
  activeSobe?: string;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <Filter className="h-3 w-3" /> Şöbə:
        </span>
        <Link
          href="/iscilier/skills"
          className={`rounded-md border px-2 py-1 text-xs ${
            !activeSobe ? "border-primary/40 bg-primary/10 text-primary-light" : "border-border/40"
          }`}
        >
          Hamısı
        </Link>
        {sobeler.map((s) => (
          <Link
            key={s.ad}
            href={`/iscilier/skills?sobe=${encodeURIComponent(s.ad)}`}
            className={`rounded-md border px-2 py-1 text-xs ${
              activeSobe === s.ad ? "border-primary/40 bg-primary/10 text-primary-light" : "border-border/40"
            }`}
          >
            {s.ad}
          </Link>
        ))}
      </div>

      {data.gaps.length > 0 && (
        <Card className="glass border-warning/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground inline-flex items-center gap-1.5">
              <TrendingDown className="h-3.5 w-3.5 text-warning" /> Bacarıq boşluğu hesabatı
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {data.gaps.map((g) => (
              <Badge
                key={g.skill}
                variant="outline"
                className="border-warning/40 text-warning"
                title={`${g.low} işçi 1 və ya 0 səviyyəsində`}
              >
                {g.skill} (orta {g.avg.toFixed(1)})
              </Badge>
            ))}
          </CardContent>
        </Card>
      )}

      <Card className="glass">
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-xs">
            <thead className="border-b border-border/60 text-left text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="sticky left-0 z-10 bg-card px-3 py-2.5">İşçi</th>
                <th className="px-3 py-2.5">Şöbə</th>
                {data.skills.map((s) => (
                  <th key={s} className="px-2 py-2.5 text-center" title={s}>
                    <span className="block max-w-[60px] truncate">{s}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.employees.length === 0 ? (
                <tr>
                  <td
                    colSpan={2 + data.skills.length}
                    className="py-8 text-center text-muted-foreground"
                  >
                    İşçi tapılmadı
                  </td>
                </tr>
              ) : (
                data.employees.map((e) => (
                  <tr key={e.id} className="border-b border-border/30">
                    <td className="sticky left-0 z-10 bg-card px-3 py-2 font-medium">
                      <Link href={`/iscilier/${e.id}`} className="hover:underline">
                        {e.ad_soyad}
                      </Link>
                      {e.vezife && (
                        <div className="text-[10px] text-muted-foreground">{e.vezife}</div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{e.sobe ?? "—"}</td>
                    {e.levels.map((lv, i) => (
                      <td key={i} className="px-2 py-2 text-center">
                        <span
                          className="inline-flex h-6 w-6 items-center justify-center rounded-md text-[10px] font-semibold text-white"
                          style={{ background: lv === 0 ? "#1f2937" : LEVEL_COLORS[lv] }}
                        >
                          {lv > 0 ? lv : ""}
                        </span>
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
        <span>Səviyyə:</span>
        {LEVEL_COLORS.map((c, i) => (
          <span key={i} className="inline-flex items-center gap-1">
            <span
              className="inline-block h-3 w-3 rounded"
              style={{ background: i === 0 ? "#1f2937" : c }}
            />
            {i === 0 ? "Yox" : i}
          </span>
        ))}
      </div>
    </div>
  );
}
