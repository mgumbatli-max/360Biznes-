import type { Metadata } from "next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PiggyBank, AlertTriangle, TrendingUp } from "lucide-react";
import { MaliyyeSubNav } from "@/components/maliyye-subnav";
import { getExpenseBudgetReport } from "@/features/maliyye/xerc-budce";
import { getExpenseCategories } from "@/features/maliyye/queries";
import { BudgetInput } from "@/features/maliyye/components/budget-input";
import { formatMoney, formatNumber } from "@/lib/utils";

export const metadata: Metadata = { title: "Xərc büdcəsi" };

function Bar({ pct, over }: { pct: number; over: boolean }) {
  const w = Math.min(100, Math.max(0, pct));
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
      <div className={`h-full rounded-full ${over ? "bg-rose-500" : pct >= 85 ? "bg-amber-500" : "bg-emerald-500"}`} style={{ width: `${w}%` }} />
    </div>
  );
}

export default async function XercBudcePage() {
  const { requireMaliyyePerm } = await import("@/features/maliyye/access-guard");
  await requireMaliyyePerm("xerc.idare");

  const [rep, cats] = await Promise.all([getExpenseBudgetReport(), getExpenseCategories()]);
  // Büdcəsi/xərci olmayan kateqoriyalar da göstərilsin ki, büdcə təyin oluna bilsin
  const shownIds = new Set(rep.setirler.map((r) => r.kateqoriya_id));
  const extraCats = cats.filter((c) => !shownIds.has(c.id)).map((c) => ({
    kateqoriya_id: c.id, ad: c.ad, reng: c.reng ?? null, budce: 0, faktiki: 0, qaliq: 0, faiz: 0, proyeksiya: 0, asib: false, proyeksiya_asir: false,
  }));
  const allRows = [...rep.setirler, ...extraCats];
  const umumiFaiz = rep.budce_cemi > 0 ? Math.round((rep.faktiki_cemi / rep.budce_cemi) * 100) : 0;

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight"><PiggyBank className="h-6 w-6 text-primary" /> Xərc büdcəsi</h1>
        <p className="mt-1 text-sm text-muted-foreground">Hər kateqoriyaya aylıq büdcə təyin edin — bu ay faktiki xərc büdcə ilə müqayisə olunur, aşım və ay-sonu proqnozu göstərilir.</p>
      </header>

      <MaliyyeSubNav active="/maliyye/budce" />

      {/* Xülasə */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card><CardContent className="py-4">
          <div className="text-xs text-muted-foreground">Ümumi büdcə / faktiki</div>
          <div className="mt-1 text-xl font-bold tabular-nums">{formatMoney(rep.faktiki_cemi)} <span className="text-sm font-normal text-muted-foreground">/ {formatMoney(rep.budce_cemi)}</span></div>
          {rep.budce_cemi > 0 && <div className="mt-2"><Bar pct={umumiFaiz} over={rep.faktiki_cemi > rep.budce_cemi} /></div>}
          <div className="mt-1 text-[11px] text-muted-foreground">{rep.budce_cemi > 0 ? `${umumiFaiz}% istifadə` : "büdcə təyin olunmayıb"}</div>
        </CardContent></Card>
        <Card className={rep.asan_kateqoriya_say > 0 ? "border-rose-300 bg-rose-50/50" : ""}><CardContent className="py-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><AlertTriangle className="h-4 w-4" /> Büdcəni aşan</div>
          <div className={`mt-1 text-xl font-bold tabular-nums ${rep.asan_kateqoriya_say > 0 ? "text-rose-600" : ""}`}>{formatNumber(rep.asan_kateqoriya_say)}</div>
          <div className="text-[11px] text-muted-foreground">kateqoriya limiti keçib</div>
        </CardContent></Card>
        <Card><CardContent className="py-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><TrendingUp className="h-4 w-4" /> Ay-sonu proqnozu (cəmi)</div>
          <div className="mt-1 text-xl font-bold tabular-nums">{formatMoney(rep.setirler.reduce((s, r) => s + r.proyeksiya, 0))}</div>
          <div className="text-[11px] text-muted-foreground">{rep.bugun_gun}/{rep.ay_gun_say} gün</div>
        </CardContent></Card>
      </div>

      {/* Kateqoriya cədvəli */}
      <Card>
        <CardHeader><CardTitle className="text-base">Kateqoriya üzrə büdcə</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {allRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Xərc kateqoriyası yoxdur. Əvvəl Ayarlar → Xərc kateqoriyaları bölməsindən yaradın.</p>
          ) : allRows.map((r) => (
            <div key={r.kateqoriya_id} className="rounded-lg border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-[140px]">
                  {r.reng && <span className="h-3 w-3 rounded-full" style={{ backgroundColor: r.reng }} />}
                  <span className="font-medium">{r.ad}</span>
                  {r.asib && <Badge variant="outline" className="border-rose-300 text-rose-600 text-[10px]">aşıb</Badge>}
                  {!r.asib && r.proyeksiya_asir && <Badge variant="outline" className="border-amber-300 text-amber-600 text-[10px]">proqnoz aşır</Badge>}
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right text-sm">
                    <div className="tabular-nums font-semibold">{formatMoney(r.faktiki)}</div>
                    <div className="text-[11px] text-muted-foreground">bu ay faktiki</div>
                  </div>
                  <BudgetInput kateqoriyaId={r.kateqoriya_id} initial={r.budce} />
                </div>
              </div>
              {r.budce > 0 && (
                <div className="mt-2">
                  <Bar pct={r.faiz} over={r.asib} />
                  <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
                    <span>{r.faiz}% · qalıq {formatMoney(r.qaliq)}</span>
                    <span>proqnoz: {formatMoney(r.proyeksiya)}</span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
