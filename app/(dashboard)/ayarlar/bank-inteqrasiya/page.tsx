import type { Metadata } from "next";
import { Landmark, ShieldCheck, CheckCircle2, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BankReconUploader } from "@/features/bank/components/recon-uploader";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Bank inteqrasiya" };

async function getHistory() {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    return prisma.bank_cixarislari.findMany({
      where: { sahibkar_id: sahibkarId },
      orderBy: { yaradildi: "desc" },
      take: 50,
    });
  });
}

function fmtDate(d: Date | null) {
  if (!d) return "—";
  return formatDate(d, { dateStyle: "short", timeStyle: "short" });
}

export default async function Page() {
  const history = await getHistory();

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <header className="flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-lg bg-secondary text-primary">
          <Landmark className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Bank inteqrasiya</h1>
          <p className="text-sm text-muted-foreground">
            Bank çıxarışı yüklə → satış kodu ilə match → borcu avto bağla
          </p>
        </div>
      </header>


      <Card className="glass">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Excel çıxarış yükləməsi</CardTitle>
        </CardHeader>
        <CardContent>
          <BankReconUploader />
        </CardContent>
      </Card>

      <Card className="glass">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Əvvəlki yükləmələr ({history.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {history.length === 0 ? (
            <div className="px-3 py-10 text-center text-sm text-muted-foreground">
              Hələ heç bir çıxarış yüklənməyib
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-[10.5px] uppercase tracking-wider text-muted-foreground">
                  <tr className="border-b border-border/40 text-left">
                    <th className="px-3 py-2">Tarix</th>
                    <th className="px-3 py-2">Fayl</th>
                    <th className="px-3 py-2 text-right">Cəmi sətir</th>
                    <th className="px-3 py-2 text-right">Eşlənmiş</th>
                    <th className="px-3 py-2 text-right">Manual</th>
                    <th className="px-3 py-2 text-right">Eşlənmədi</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((h) => (
                    <tr key={h.id} className="border-b border-border/20">
                      <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">
                        {fmtDate(h.yaradildi)}
                      </td>
                      <td className="px-3 py-2 text-xs">{h.fayl_adi ?? "—"}</td>
                      <td className="px-3 py-2 text-right text-xs tabular-nums">{h.satir_sayi ?? 0}</td>
                      <td className="px-3 py-2 text-right text-xs tabular-nums text-emerald-600">
                        {h.eslesh_sayi ?? 0}
                      </td>
                      <td className="px-3 py-2 text-right text-xs tabular-nums">{h.manual_sayi ?? 0}</td>
                      <td className="px-3 py-2 text-right text-xs tabular-nums text-amber-500">
                        {h.eslesmemis_sayi ?? 0}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="glass border-emerald-500/30">
        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />
            <div className="space-y-1 text-sm">
              <p className="font-semibold">Match qaydaları (prioritet ilə)</p>
              <ul className="ml-4 list-disc space-y-0.5 text-muted-foreground">
                <li>
                  <span className="text-foreground">Qaimə nömrəsi</span> — manual qoyduğunuz kod (Birmarket, Wolt, POS terminal ID)
                </li>
                <li>
                  <span className="text-foreground">Sistem nömrəsi</span> — satışın avto-yaranan unikal kodu
                </li>
                <li>
                  <span className="text-foreground">Çek nömrəsi</span> — POS-da vurulan çekin nömrəsi
                </li>
              </ul>
              <p className="mt-2 text-xs text-muted-foreground">
                <CheckCircle2 className="inline h-3 w-3 text-emerald-500" /> Match olsa borcun ödəniş kateqoriyası avto-yenilənir
                — qismi və ya tam ödəniş hesablanır.
              </p>
              <p className="text-xs text-muted-foreground">
                <AlertTriangle className="inline h-3 w-3 text-amber-500" /> Tapılmayan kodlar üçün operator manual təsdiq edir
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
