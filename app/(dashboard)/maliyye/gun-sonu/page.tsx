import type { Metadata } from "next";
import {
  Moon,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  Coins,
  History,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KpiCard } from "@/features/dashboard/components/kpi-card";
import { MaliyyeSubNav } from "@/components/maliyye-subnav";
import { CloseGunSonuButton } from "@/features/maliyye/components/close-gun-sonu-button";
import { getGunSonuToday, getGunSonuHistory, getGunSonuChecks } from "@/features/maliyye/gun-sonu-queries";
import { formatMoney, formatDate } from "@/lib/utils";
import { AlertTriangle, CheckCircle, AlertCircle as AlertCircleIcon, ChevronRight } from "lucide-react";
import Link from "next/link";

export const metadata: Metadata = { title: "Gün sonu" };

export default async function GunSonuPage() {
  const [today, history, checks] = await Promise.all([
    getGunSonuToday(),
    getGunSonuHistory(30),
    getGunSonuChecks(),
  ]);
  const problemSay = checks.filter((c) => c.status !== "ok").length;

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Gün sonu</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Cari günün satış, xərc, kassa vəziyyəti və günün bağlanması.
          </p>
        </div>
        <CloseGunSonuButton disabled={today.baglanmis_var} />
      </header>

      <MaliyyeSubNav active="/maliyye/gun-sonu" />

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard icon={TrendingUp} label="Satış cəmi" value={formatMoney(today.satish_cem)} tone="success" />
        <KpiCard icon={TrendingDown} label="Xərc cəmi" value={formatMoney(today.xerc_cem)} tone="warning" />
        <KpiCard icon={Coins} label="Net" value={formatMoney(today.net)} tone={today.net >= 0 ? "success" : "danger"} />
        <KpiCard
          icon={Moon}
          label="Açıq kassa"
          value={String(today.kassa_acig_say)}
          subline={formatMoney(today.kassa_acilis_cem)}
        />
      </section>

      {/* Bağlamadan əvvəl yoxlama (checklist) */}
      {!today.baglanmis_var && (
        <Card className="glass" data-section="gun-sonu-checklist">
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-base">
              <span className="flex items-center gap-2">
                <AlertCircleIcon className="h-4 w-4 text-warning" />
                Bağlamadan əvvəl yoxlama
              </span>
              {problemSay === 0 ? (
                <Badge variant="outline" className="border-success/30 bg-success/10 text-success text-[10px]">
                  Bütün yoxlamalar OK
                </Badge>
              ) : (
                <Badge variant="outline" className="border-warning/30 bg-warning/10 text-warning text-[10px]">
                  {problemSay} diqqət lazımdır
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {checks.map((c) => {
              const Icon = c.status === "ok" ? CheckCircle : c.status === "warn" ? AlertTriangle : AlertCircleIcon;
              const cls = c.status === "ok"
                ? "text-success border-success/20 bg-success/5"
                : c.status === "warn"
                  ? "text-warning border-warning/20 bg-warning/5"
                  : "text-danger border-danger/20 bg-danger/5";
              return (
                <div
                  key={c.key}
                  data-check-row={c.key}
                  data-check-status={c.status}
                  className={`flex items-start justify-between gap-3 rounded-lg border px-3 py-2 ${cls}`}
                >
                  <div className="flex items-start gap-2.5">
                    <Icon className="mt-0.5 h-4 w-4 shrink-0" />
                    <div>
                      <div className="text-xs font-semibold">{c.baslıq}</div>
                      <div className="mt-0.5 text-[11px] text-muted-foreground">{c.detay}</div>
                    </div>
                  </div>
                  {c.fix_href && c.fix_label && (
                    <Link
                      href={c.fix_href}
                      className="inline-flex h-7 shrink-0 items-center gap-0.5 rounded-md border border-current/30 bg-background px-2 text-[10.5px] font-semibold hover:bg-secondary"
                    >
                      Düzəlt <ChevronRight className="h-3 w-3" />
                    </Link>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {today.baglanmis_var ? (
        <Card className="glass">
          <CardContent className="flex items-center gap-3 py-5">
            <CheckCircle2 className="h-6 w-6 text-success" />
            <div>
              <h3 className="font-semibold">Bu gün bağlanıb</h3>
              <p className="text-xs text-muted-foreground">
                Tarix: {today.tarix}. Bütün açıq sənədlər status olaraq dəyişdirildi.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="glass">
          <CardContent className="space-y-2 py-5">
            <h3 className="font-semibold">Bu günü bağlamamısınız</h3>
            <p className="text-sm text-muted-foreground">
              Yuxarıdakı &laquo;Günü bağla&raquo; düyməsi ilə cari günün xülasəsini yaddaşa salın.
              Kassa açıqdırsa, snapshot götürülüb tarixçəyə yazılacaq.
            </p>
          </CardContent>
        </Card>
      )}

      <Card className="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="h-4 w-4" /> Son 30 günün bağlamaları
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border/60 text-left text-[10.5px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-3 py-2.5">Tarix</th>
                  <th className="px-3 py-2.5">Filial</th>
                  <th className="px-3 py-2.5">Status</th>
                  <th className="px-3 py-2.5 text-right">Satış</th>
                  <th className="px-3 py-2.5 text-right">Xərc</th>
                  <th className="px-3 py-2.5 text-right">Mənfəət</th>
                  <th className="px-3 py-2.5 text-right">Kassa qaliq</th>
                  <th className="px-3 py-2.5">Bağlayan</th>
                  <th className="px-3 py-2.5">Bağlanma vaxtı</th>
                </tr>
              </thead>
              <tbody>
                {history.length === 0 && (
                  <tr>
                    <td colSpan={9} className="py-10 text-center text-sm text-muted-foreground">
                      Hələ heç bir gün bağlanmayıb
                    </td>
                  </tr>
                )}
                {history.map((r) => (
                  <tr key={r.id} className="border-b border-border/30">
                    <td className="px-3 py-2.5 text-xs">{formatDate(r.tarix)}</td>
                    <td className="px-3 py-2.5 text-xs">{r.filial_ad ?? <span className="text-muted-foreground">—</span>}</td>
                    <td className="px-3 py-2.5">
                      {r.status === "bagli" ? (
                        <Badge variant="outline" className="border-success/30 bg-success/10 text-success text-[10px]">Bağlı</Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px]">Açıq</Badge>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-success">{formatMoney(r.satish_cem)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-danger">{formatMoney(r.xerc_cem)}</td>
                    <td className={`px-3 py-2.5 text-right tabular-nums font-semibold ${r.menfeet >= 0 ? "text-success" : "text-danger"}`}>
                      {formatMoney(r.menfeet)}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-xs">{formatMoney(r.kassa_qaliq)}</td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">{r.baglayan_ad ?? "—"}</td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">
                      {r.bagh_tarix ? formatDate(r.bagh_tarix, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
