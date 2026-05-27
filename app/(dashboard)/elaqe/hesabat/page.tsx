import type { Metadata } from "next";
import Link from "next/link";
import { Crown, Users, MapPin, AlertTriangle, TrendingUp } from "lucide-react";
import { BackButton } from "@/components/ui/back-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getElaqeReport } from "@/features/elaqe/queries";
import { MonthlyNewChart, DebtBucketsChart, StatusPieChart } from "@/features/elaqe/components/report-charts";
import { AutoTagButton } from "@/features/elaqe/components/auto-tag-button";
import { BirthdayRemindersButton } from "@/features/elaqe/components/birthday-reminders-button";
import { formatMoney } from "@/lib/utils";

export const metadata: Metadata = { title: "Əlaqə hesabatı" };
export const dynamic = "force-dynamic";

export default async function HesabatPage() {
  const r = await getElaqeReport();

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Əlaqə hesabatı</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Müştəri analitikası, yeni qeydlər, borc paylanması və coğrafiya.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <AutoTagButton />
          <BirthdayRemindersButton />
          <BackButton fallback="/elaqe" label="Geri" />
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="glass">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Crown className="h-4 w-4 text-warning" /> Top 10 müştəri (LTV)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {r.top_musteri.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Satış yoxdur</p>
            ) : (
              <ol className="divide-y divide-border/30">
                {r.top_musteri.map((m, i) => (
                  <li key={m.id} className="flex items-center justify-between px-3 py-2 text-sm">
                    <Link href={`/elaqe/musteriler/${m.id}`} className="min-w-0 flex-1 truncate hover:text-primary-light">
                      <span className="mr-2 inline-block w-5 text-xs text-muted-foreground">#{i + 1}</span>
                      {m.ad}
                    </Link>
                    <div className="ml-3 text-right">
                      <div className="tabular-nums font-semibold">{formatMoney(m.ltv)}</div>
                      <div className="text-[10.5px] text-muted-foreground">{m.sayi} sifariş</div>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>

        <Card className="glass">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-4 w-4 text-info" /> Yeni müştəri (son 12 ay)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <MonthlyNewChart data={r.yeni_musteri_aylar} />
          </CardContent>
        </Card>

        <Card className="glass">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4 text-warning" /> Borc paylanması (gün)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DebtBucketsChart data={r.borc_buckets} />
            <div className="mt-2 grid grid-cols-4 gap-1 text-[10.5px]">
              {r.borc_buckets.map((b) => (
                <div key={b.label} className="rounded border border-border/40 bg-secondary/30 px-1.5 py-1 text-center">
                  <div className="font-semibold">{b.label}</div>
                  <div className="text-muted-foreground">{b.count} qeyd</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="glass">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4 text-success" /> Aktiv vs Passiv
            </CardTitle>
          </CardHeader>
          <CardContent>
            <StatusPieChart aktiv={r.status_split.aktiv} passiv={r.status_split.passiv} />
            <div className="mt-1 flex items-center justify-center gap-4 text-xs">
              <span><Badge variant="outline" className="text-success">Aktiv</Badge> {r.status_split.aktiv}</span>
              <span><Badge variant="outline">Passiv</Badge> {r.status_split.passiv}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="glass lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <MapPin className="h-4 w-4 text-info" /> Şəhər paylanması
            </CardTitle>
          </CardHeader>
          <CardContent>
            {r.seher_dist.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Şəhər məlumatı yoxdur</p>
            ) : (
              <div className="grid grid-cols-2 gap-1.5 md:grid-cols-5">
                {r.seher_dist.map((s) => (
                  <div key={s.sheher} className="rounded-md border border-border/40 bg-secondary/30 px-2.5 py-1.5">
                    <div className="text-sm font-semibold">{s.sheher}</div>
                    <div className="text-xs text-muted-foreground">{s.count} qeyd</div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
