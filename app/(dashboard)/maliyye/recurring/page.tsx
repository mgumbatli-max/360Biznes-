import type { Metadata } from "next";
import { Calendar, Play, Pause, ListChecks, Repeat2 } from "lucide-react";
import { MaliyyeSubNav } from "@/components/maliyye-subnav";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getRecurringRules, getNewRecurringRules } from "@/features/maliyye/extended-queries";
import { getQuickRefs } from "@/features/maliyye/queries";
import { formatDate, formatMoney } from "@/lib/utils";
import { RecurringActions, RunRecurringButton } from "@/features/maliyye/components/recurring-actions";
import { RecurringNewDialog } from "@/features/maliyye/components/recurring-new-dialog";
import { NewRecurringActions } from "@/features/maliyye/components/new-recurring-actions";

export const metadata: Metadata = { title: "Təkrarlanan əməliyyatlar" };

const TEZLIK_LABEL: Record<string, string> = {
  weekly: "Həftəlik",
  monthly: "Aylıq",
  bi_monthly: "Hər 2 ay",
  quarterly: "Rüblük",
  yearly: "İllik",
};

export default async function MaliyyeRecurringPage() {
  const { requireMaliyyePerm } = await import("@/features/maliyye/access-guard");
  await requireMaliyyePerm("maliyye.recurring");

  const [rows, newRules, refs] = await Promise.all([
    getRecurringRules(),
    getNewRecurringRules(),
    getQuickRefs(),
  ]);
  const aktiv = rows.filter((r) => r.status === "aktiv").length;

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Təkrarlanan əməliyyatlar</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Avtomatik təkrar olunan maliyyə qaydaları. Cron / əl ilə işə salına bilər.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <RecurringNewDialog
            hesablar={refs.hesablar}
            kontragentler={refs.kontragentler}
            iscilier={refs.iscilier}
          />
          <RunRecurringButton />
        </div>
      </header>

      <MaliyyeSubNav active="/maliyye/recurring" />

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card className="glass">
          <CardContent className="space-y-1 py-4">
            <div className="flex items-center gap-1.5 text-[10.5px] uppercase tracking-wider text-muted-foreground">
              <Repeat2 className="h-3.5 w-3.5" /> Bütün qaydalar
            </div>
            <div className="text-2xl font-bold tabular-nums">{rows.length}</div>
          </CardContent>
        </Card>
        <Card className="glass">
          <CardContent className="space-y-1 py-4">
            <div className="flex items-center gap-1.5 text-[10.5px] uppercase tracking-wider text-muted-foreground">
              <Play className="h-3.5 w-3.5" /> Aktiv
            </div>
            <div className="text-2xl font-bold tabular-nums text-success">{aktiv}</div>
          </CardContent>
        </Card>
        <Card className="glass">
          <CardContent className="space-y-1 py-4">
            <div className="flex items-center gap-1.5 text-[10.5px] uppercase tracking-wider text-muted-foreground">
              <Pause className="h-3.5 w-3.5" /> Söndürülmüş
            </div>
            <div className="text-2xl font-bold tabular-nums text-muted-foreground">
              {rows.length - aktiv}
            </div>
          </CardContent>
        </Card>
        <Card className="glass">
          <CardContent className="space-y-1 py-4">
            <div className="flex items-center gap-1.5 text-[10.5px] uppercase tracking-wider text-muted-foreground">
              <ListChecks className="h-3.5 w-3.5" /> Yaradılan
            </div>
            <div className="text-2xl font-bold tabular-nums">
              {rows.reduce((s, r) => s + r.yaradilan_say, 0)}
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Yeni dedicated cədvəldən qaydalar */}
      {newRules.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground">Yeni qaydalar ({newRules.length})</h2>
          {newRules.map((r) => (
            <Card key={r.id} className="glass">
              <CardContent className="flex flex-wrap items-start justify-between gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{r.ad}</span>
                    <Badge variant="outline" className="text-[10px]">
                      {r.type_kod}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={
                        r.aktiv
                          ? "border-success/30 bg-success/10 text-success text-[10px]"
                          : "border-muted text-muted-foreground text-[10px]"
                      }
                    >
                      {r.aktiv ? "Aktiv" : "Söndürülmüş"}
                    </Badge>
                    <Badge variant="outline" className="text-[10px]">
                      {r.tezlik}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={
                        r.y_n === "daxil"
                          ? "border-success/30 bg-success/10 text-success text-[10px]"
                          : "border-rose-500/30 bg-rose-500/10 text-rose-700 text-[10px]"
                      }
                    >
                      {r.y_n === "daxil" ? "Gəlir" : "Xərc"}
                    </Badge>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span className="font-bold tabular-nums">{formatMoney(r.mebleg)}</span>
                    {r.hesab_ad && <span>· Hesab: {r.hesab_ad}</span>}
                    {r.kontragent_ad && <span>· Kontragent: {r.kontragent_ad}</span>}
                    {r.isci_ad && <span>· İşçi: {r.isci_ad}</span>}
                    {r.sonraki_icra && <span>· Növbəti: {formatDate(r.sonraki_icra)}</span>}
                    {r.son_tarix && <span>· Bitir: {formatDate(r.son_tarix)}</span>}
                  </div>
                </div>
                <NewRecurringActions id={r.id} aktiv={r.aktiv} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {rows.length === 0 && newRules.length === 0 ? (
        <Card className="glass">
          <CardContent className="flex flex-col items-center justify-center gap-2 py-16 text-center">
            <Calendar className="h-8 w-8 text-muted-foreground/60" />
            <h3 className="font-semibold">Təkrarlanan qayda yoxdur</h3>
            <p className="max-w-md text-sm text-muted-foreground">
              Əməliyyat yaradarkən &ldquo;Təkrarlansın?&rdquo; seçimini aktiv edin və qayda buraya gələcək.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <Card key={r.id} className="glass">
              <CardContent className="flex flex-wrap items-start justify-between gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{r.tip_ad}</span>
                    <Badge
                      variant="outline"
                      className={
                        r.status === "aktiv"
                          ? "border-success/30 bg-success/10 text-success text-[10px]"
                          : "border-muted text-muted-foreground text-[10px]"
                      }
                    >
                      {r.status === "aktiv" ? "Aktiv" : "Söndürülmüş"}
                    </Badge>
                    <Badge variant="outline" className="text-[10px]">
                      {TEZLIK_LABEL[r.tezlik] ?? r.tezlik ?? "—"}
                    </Badge>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span className="font-mono tabular-nums">
                      {formatMoney(r.mebleg, r.valyuta)}
                    </span>
                    {r.hesab_ad && <span>· Hesab: {r.hesab_ad}</span>}
                    {r.kontragent_ad && <span>· Kontragent: {r.kontragent_ad}</span>}
                    {r.son_tarix && <span>· Bitir: {r.son_tarix}</span>}
                    {r.say && <span>· Limit: {r.say}</span>}
                    <span>· Yaradılan: {r.yaradilan_say}</span>
                    {r.yaradildi && <span>· {formatDate(r.yaradildi)}</span>}
                  </div>
                </div>
                <RecurringActions id={r.id} status={r.status} tezlik={r.tezlik || "monthly"} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
