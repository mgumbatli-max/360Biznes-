import type { Metadata } from "next";
import { Wallet, FileText, Upload, Landmark, CheckCircle2, AlertTriangle, ListChecks } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { KpiCard } from "@/features/dashboard/components/kpi-card";
import { MaliyyeSubNav } from "@/components/maliyye-subnav";
import { BankImportDialog } from "@/features/maliyye/components/bank-import-dialog";
import { BankItemsModal } from "@/features/maliyye/components/bank-items-modal";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Bank cıxarışları" };
export const dynamic = "force-dynamic";

async function getStatements() {
  return withTenant(async () =>
    prisma.bank_cixarislari.findMany({
      orderBy: { yaradildi: "desc" },
      take: 50,
      include: { istifadeciler: { select: { ad_soyad: true } } },
    })
  );
}

export default async function BankPage() {
  const rows = await getStatements();
  const cemiCixaris = rows.length;
  const cemiSatir = rows.reduce((s, r) => s + Number(r.satir_sayi ?? 0), 0);
  const cemiEsl = rows.reduce((s, r) => s + Number(r.eslesh_sayi ?? 0), 0);
  const cemiEslMis = rows.reduce((s, r) => s + Number(r.eslesmemis_sayi ?? 0), 0);
  const ortaPct = cemiSatir > 0 ? (cemiEsl / cemiSatir) * 100 : 0;
  const tamUyg = rows.filter((r) => (r.satir_sayi ?? 0) > 0 && (r.satir_sayi ?? 0) === (r.eslesh_sayi ?? 0)).length;

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Bank çıxarışları</h1>
          <p className="mt-1 text-sm text-muted-foreground">CSV/OFX bank çıxarışları və avtomatik eşləşmə.</p>
        </div>
        <BankImportDialog />
      </header>

      <MaliyyeSubNav active="/maliyye/bank" />

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        <KpiCard icon={Landmark} label="Çıxarış sayı" value={String(cemiCixaris)} />
        <KpiCard icon={ListChecks} label="Cəmi sətir" value={String(cemiSatir)} />
        <KpiCard icon={CheckCircle2} label="Uyğunlaşıb" value={String(cemiEsl)} tone="success" />
        <KpiCard icon={AlertTriangle} label="Qalıq" value={String(cemiEslMis)} tone={cemiEslMis > 0 ? "warning" : "neutral"} />
        <KpiCard icon={CheckCircle2} label="Ortalama uyğunluq" value={`${ortaPct.toFixed(0)}%`} tone={ortaPct >= 80 ? "success" : ortaPct >= 50 ? "warning" : "danger"} />
        <KpiCard icon={CheckCircle2} label="100% tam" value={String(tamUyg)} tone="success" />
      </section>

      {rows.length === 0 ? (
        <Card className="glass border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Upload className="mb-2 h-8 w-8 text-muted-foreground/50" />
            <h3 className="font-semibold">Bank çıxarışı yoxdur</h3>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              Bank çıxarışını CSV formatında yükləmək imkanı tezliklə əlavə olunacaq.
              Çıxarışlar avtomatik kontragent ödənişləri ilə eşləşdiriləcək.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <Card key={r.id} className="glass">
              <CardContent className="space-y-3 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Wallet className="h-4 w-4 text-primary-light" />
                    <div>
                      <div className="font-semibold">{r.bank_adi ?? "Bank"} {r.hesab_nomresi ? `· ${r.hesab_nomresi}` : ""}</div>
                      <div className="text-xs text-muted-foreground">
                        {r.dovr_baslangic ? formatDate(r.dovr_baslangic) : "—"}{" → "}
                        {r.dovr_son ? formatDate(r.dovr_son) : "—"}
                      </div>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-[10px]">
                    <FileText className="h-3 w-3" /> {r.fayl_adi ?? "manual"}
                  </Badge>
                </div>
                <div className="grid grid-cols-4 gap-2 border-t border-border/40 pt-2 text-xs">
                  <Stat label="Sətr" value={r.satir_sayi ?? 0} />
                  <Stat label="Eşləşmə" value={r.eslesh_sayi ?? 0} tone="success" />
                  <Stat label="Manual" value={r.manual_sayi ?? 0} tone="info" />
                  <Stat label="Eşləşməmiş" value={r.eslesmemis_sayi ?? 0} tone={(r.eslesmemis_sayi ?? 0) > 0 ? "warning" : "neutral"} />
                </div>
                <div className="flex justify-end border-t border-border/30 pt-2">
                  <BankItemsModal statementId={r.id} satirSayi={r.satir_sayi ?? 0} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, tone = "neutral" }: { label: string; value: number; tone?: "success" | "info" | "warning" | "neutral" }) {
  const cls = tone === "success" ? "text-success" : tone === "info" ? "text-info" : tone === "warning" ? "text-warning" : "";
  return (
    <div>
      <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`mt-0.5 font-semibold tabular-nums ${cls}`}>{value}</div>
    </div>
  );
}
