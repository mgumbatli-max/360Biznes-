import type { Metadata } from "next";
import Link from "next/link";
import { Tags, ArrowRight, Sparkles, Calculator } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { QiymetTipiDialog } from "@/features/ayarlar/components/qiymet-tipi-dialog";
import { FORMULA_NOV_OPTIONS, FORMULA_BAZA_OPTIONS } from "@/features/ayarlar/qiymet-formula";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Qiymət tipləri" };

async function getPriceTypes() {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    return prisma.qiymet_novleri.findMany({
      where: { OR: [{ sahibkar_id: sahibkarId }, { sahibkar_id: null }] },
      orderBy: [{ siralama: "asc" }, { id: "asc" }],
    });
  });
}

function formulaLabel(novu: string | null, baza: string | null, faiz: { toNumber(): number } | number | null) {
  if (!novu || novu === "yox") return null;
  const f = Number(faiz ?? 0);
  const opt = FORMULA_NOV_OPTIONS.find((o) => o.value === novu);
  const baseOpt = FORMULA_BAZA_OPTIONS.find((o) => o.value === baza);
  if (novu === "fix") return `Sabit: ${f.toFixed(2)} ₼`;
  const sign = novu === "maya_uzeri" ? "+" : "−";
  return `${baseOpt?.label ?? baza} ${sign} ${f}%`;
}

export default async function QiymetTipiPage() {
  const rows = await getPriceTypes();
  const formulaCount = rows.filter((r) => r.formula_novu && r.formula_novu !== "yox" && r.aktiv).length;

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-secondary text-primary">
            <Tags className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Qiymət tipləri</h1>
            <p className="text-sm text-muted-foreground">
              Pərakəndə, topdan, VIP, partnyor — avto formula ilə qiymət hesablama
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <QiymetTipiDialog />
          <Link
            href="/ayarlar/qiymet"
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-secondary px-3 py-2 text-xs font-medium hover:bg-secondary/70"
          >
            Qiymət siyasəti <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </header>


      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Cəmi tip" value={String(rows.length)} />
        <Stat label="Aktiv" value={String(rows.filter((r) => r.aktiv).length)} tone="emerald" />
        <Stat label="Avto formula" value={String(formulaCount)} tone="primary" />
        <Stat label="Custom (sənin)" value={String(rows.filter((r) => r.sahibkar_id).length)} />
      </div>

      <Card className="glass border-primary/30 bg-primary/5">
        <CardContent className="py-3">
          <div className="flex items-start gap-3">
            <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div className="space-y-1 text-sm">
              <p className="font-semibold">Necə işləyir?</p>
              <ul className="ml-4 list-disc space-y-0.5 text-xs text-muted-foreground">
                <li>Hər qiymət tipinə avto formula təyin edə bilərsiniz (məs: «topdan = maya + 15%»)</li>
                <li>Yeni məhsul yaradılanda və ya maya/pərakəndə dəyişdikdə həmin formulalı qiymət sahələri **avto-doldurulur**</li>
                <li>Manual qiymət daxil etsəniz, formula onu **dəyişməz** (yalnız boş sahələri doldurur)</li>
                <li>Standart kodlar: <code className="rounded bg-secondary px-1 text-[10.5px]">topdan</code>, <code className="rounded bg-secondary px-1 text-[10.5px]">vip</code>, <code className="rounded bg-secondary px-1 text-[10.5px]">partnyor</code>, <code className="rounded bg-secondary px-1 text-[10.5px]">endirim</code> — bunlar məhsul forumlarında avto işləyir</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {rows.length === 0 ? (
        <Card className="glass border-dashed">
          <CardContent className="py-12 text-center">
            <Tags className="mx-auto h-8 w-8 text-muted-foreground/50" />
            <p className="mt-2 text-sm text-muted-foreground">Qiymət tipi yoxdur.</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="glass">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Qiymət tipləri ({rows.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-[10.5px] uppercase tracking-wider text-muted-foreground">
                  <tr className="border-b border-border/40 text-left">
                    <th className="px-3 py-2">Tip</th>
                    <th className="px-3 py-2">Kod</th>
                    <th className="px-3 py-2">Avto formula</th>
                    <th className="px-3 py-2 text-right">Default marja</th>
                    <th className="px-3 py-2 text-right">Min marja</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2 text-right w-12"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((p) => {
                    const formula = formulaLabel(p.formula_novu, p.formula_baza, p.formula_faiz);
                    return (
                      <tr key={p.id} className={cn("border-b border-border/20", !p.aktiv && "opacity-60")}>
                        <td className="px-3 py-2">
                          <span className="inline-flex items-center gap-2">
                            <span className="text-lg">{p.emoji ?? "🏷️"}</span>
                            <div>
                              <div className="font-semibold">{p.ad}</div>
                              {p.tesvir && <div className="text-[11px] text-muted-foreground line-clamp-1">{p.tesvir}</div>}
                            </div>
                          </span>
                        </td>
                        <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{p.kod}</td>
                        <td className="px-3 py-2">
                          {formula ? (
                            <Badge variant="outline" className="gap-1 text-[10.5px] text-primary border-primary/40 bg-primary/5">
                              <Calculator className="h-3 w-3" />
                              {formula}
                            </Badge>
                          ) : (
                            <span className="text-[10.5px] text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {p.default_marja ? `${Number(p.default_marja).toFixed(1)}%` : "—"}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {p.min_marja ? `${Number(p.min_marja).toFixed(1)}%` : "—"}
                        </td>
                        <td className="px-3 py-2">
                          {p.aktiv ? (
                            <Badge variant="outline" className="text-[10px] text-emerald-500 border-emerald-500/40">
                              aktiv
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px]">passiv</Badge>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {p.sahibkar_id ? (
                            <QiymetTipiDialog
                              row={{
                                id: p.id,
                                kod: p.kod,
                                ad: p.ad,
                                tip: p.tip,
                                default_marja: p.default_marja ? String(p.default_marja) : null,
                                min_marja: p.min_marja ? String(p.min_marja) : null,
                                aktiv: p.aktiv,
                                formula_novu: p.formula_novu,
                                formula_baza: p.formula_baza,
                                formula_faiz: p.formula_faiz ? String(p.formula_faiz) : null,
                                yuvarla: p.yuvarla ? String(p.yuvarla) : null,
                                tesvir: p.tesvir,
                              }}
                            />
                          ) : (
                            <span className="text-[10px] text-muted-foreground">sistem</span>
                          )}
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
    </div>
  );
}

function Stat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "primary" | "emerald";
}) {
  const cls = tone === "primary" ? "text-primary" : tone === "emerald" ? "text-emerald-500" : "text-foreground";
  return (
    <div className="glass rounded-xl border border-border/40 px-3 py-2">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`mt-0.5 text-2xl font-bold tabular-nums ${cls}`}>{value}</div>
    </div>
  );
}
