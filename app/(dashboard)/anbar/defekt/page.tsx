import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, Package, User, Calendar, FileText } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { formatDate, formatNumber, cn } from "@/lib/utils";
import { DEFEKT_KATEQORIYALAR } from "@/features/anbar/defekt-actions";
import { DefektDialog } from "@/features/anbar/components/defekt-dialog";
import { DefektResolveDialog } from "@/features/anbar/components/defekt-resolve-dialog";

export const metadata: Metadata = { title: "Defekt qeydləri" };

const KATEQORIYA_LABEL: Record<string, { label: string; cls: string }> = {
  zedeli: { label: "Zədələnmiş", cls: "border-rose-500/40 text-rose-600 bg-rose-500/10" },
  muddet_kecib: { label: "Vaxtı keçib", cls: "border-amber-500/40 text-amber-600 bg-amber-500/10" },
  istehsal_qusuru: { label: "İstehsal qüsuru", cls: "border-violet-500/40 text-violet-600 bg-violet-500/10" },
  yanlis_idxal: { label: "Yanlış idxal", cls: "border-sky-500/40 text-sky-600 bg-sky-500/10" },
  ogurluq: { label: "Oğurluq / itki", cls: "border-rose-500/40 text-rose-700 bg-rose-500/10" },
  test_acilis: { label: "Test üçün açılmış", cls: "border-indigo-500/40 text-indigo-600 bg-indigo-500/10" },
  musteri_qaytarmasi: { label: "Müştəri qaytarması", cls: "border-orange-500/40 text-orange-600 bg-orange-500/10" },
  diger: { label: "Digər", cls: "border-slate-500/40 text-slate-600 bg-slate-500/10" },
};

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  aktiv: { label: "Aktiv", cls: "border-amber-500/40 text-amber-700 bg-amber-500/10" },
  silindi: { label: "Silindi", cls: "border-rose-500/40 text-rose-700 bg-rose-500/10" },
  qaytarildi: { label: "Geri qaytarıldı", cls: "border-emerald-500/40 text-emerald-700 bg-emerald-500/10" },
  satilibdi: { label: "Endirimlə satıldı", cls: "border-sky-500/40 text-sky-700 bg-sky-500/10" },
};

async function getData() {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const [qeydler, defektAnbarlar, butunAnbarlar, mehsullar] = await Promise.all([
      prisma.defekt_qeydleri.findMany({
        where: { sahibkar_id: sahibkarId },
        orderBy: { yaradildi: "desc" },
        take: 200,
        include: {
          anbarlar: { select: { ad: true, nov: true } },
          mehsullar: { select: { ad: true, kod: true, olcu_vahidleri: { select: { ad: true, qisa_ad: true } } } },
          istifadeciler: { select: { ad_soyad: true } },
        },
      }),
      prisma.anbarlar.findMany({
        where: { sahibkar_id: sahibkarId, nov: { in: ["defekt", "karantın"] }, aktiv: true },
        select: { id: true, ad: true, nov: true },
        orderBy: { ad: "asc" },
      }),
      prisma.anbarlar.findMany({
        where: { sahibkar_id: sahibkarId, aktiv: true },
        select: { id: true, ad: true, nov: true },
        orderBy: { ad: "asc" },
      }),
      prisma.mehsullar.findMany({
        where: { sahibkar_id: sahibkarId, aktiv: true },
        select: { id: true, ad: true, kod: true, olcu_vahidleri: { select: { ad: true, qisa_ad: true } } },
        orderBy: { ad: "asc" },
        take: 5000,
      }),
    ]);
    return { qeydler, defektAnbarlar, butunAnbarlar, mehsullar };
  });
}

export default async function DefektPage() {
  const { requireAnbarPerm } = await import("@/features/anbar/access-guard");
  await requireAnbarPerm("stok.duzelis");

  const { qeydler, defektAnbarlar, butunAnbarlar, mehsullar } = await getData();

  const aktivSay = qeydler.filter((q) => q.status === "aktiv").length;
  const toplamMiqdar = qeydler
    .filter((q) => q.status === "aktiv")
    .reduce((s, q) => s + Number(q.miqdar), 0);

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-rose-500/10">
            <AlertTriangle className="h-5 w-5 text-rose-600 dark:text-rose-400" />
          </span>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Defekt qeydləri</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Zədəli, vaxtı keçmiş və yararsız malların qeydiyyatı · {qeydler.length} qeyd · {aktivSay} aktiv
            </p>
          </div>
        </div>
        {defektAnbarlar.length > 0 ? (
          <DefektDialog
            defektAnbarlar={defektAnbarlar}
            menbeAnbarlar={butunAnbarlar.filter((a) => a.nov === "standart")}
            mehsullar={mehsullar.map((m) => ({
              id: m.id, ad: m.ad, kod: m.kod,
              vahid: m.olcu_vahidleri?.qisa_ad ?? m.olcu_vahidleri?.ad ?? null,
            }))}
          />
        ) : (
          <Link
            href="/ayarlar/anbar"
            className="inline-flex items-center gap-1 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-500/20"
          >
            <AlertTriangle className="h-3.5 w-3.5" /> Əvvəlcə defekt anbarı yarat
          </Link>
        )}
      </header>

      {defektAnbarlar.length === 0 && (
        <Card className="border-amber-500/40 bg-amber-500/5">
          <CardContent className="flex flex-wrap items-center gap-3 py-3">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            <div className="min-w-0 flex-1 text-sm">
              <p className="font-semibold">Defekt anbarı tapılmadı</p>
              <p className="text-xs text-muted-foreground">
                Əvvəlcə <strong>Ayarlar &gt; Anbar</strong> bölməsindən yeni anbar yarat və növünü <em>«Defekt / yararsız»</em> seç.
              </p>
            </div>
            <Link href="/ayarlar/anbar">
              <Button size="sm">Anbar ayarları</Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      {qeydler.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Aktiv qeydlər" value={String(aktivSay)} tone="amber" />
          <Stat label="Toplam miqdar" value={formatNumber(toplamMiqdar, 1)} tone="rose" />
          <Stat label="Həll edilmiş" value={String(qeydler.length - aktivSay)} tone="emerald" />
          <Stat label="Defekt anbar say" value={String(defektAnbarlar.length)} tone="slate" />
        </div>
      )}

      {qeydler.length === 0 ? (
        <Card className="glass border-dashed">
          <CardContent className="py-12 text-center">
            <AlertTriangle className="mx-auto h-8 w-8 text-muted-foreground/40" />
            <p className="mt-2 text-sm text-muted-foreground">
              Hələ defekt qeydi yoxdur
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="glass">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-secondary/40 text-left text-[10.5px] uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2.5">Tarix</th>
                    <th className="px-3 py-2.5">Məhsul</th>
                    <th className="px-3 py-2.5">Anbar</th>
                    <th className="px-3 py-2.5 text-right">Miqdar</th>
                    <th className="px-3 py-2.5">Kateqoriya</th>
                    <th className="px-3 py-2.5">Səbəb</th>
                    <th className="px-3 py-2.5">Qeyd edən</th>
                    <th className="px-3 py-2.5">Status</th>
                    <th className="px-3 py-2.5 text-right">Əməliyyat</th>
                  </tr>
                </thead>
                <tbody>
                  {qeydler.map((q) => {
                    const kat = KATEQORIYA_LABEL[q.kateqoriya] ?? KATEQORIYA_LABEL.diger;
                    const st = STATUS_LABEL[q.status] ?? STATUS_LABEL.aktiv;
                    return (
                      <tr
                        key={q.id}
                        className={cn(
                          "border-b border-border/30 transition-colors hover:bg-secondary/20",
                          q.status !== "aktiv" && "opacity-60",
                        )}
                      >
                        <td className="px-3 py-2.5 text-xs">
                          <div className="font-medium">{formatDate(q.yaradildi)}</div>
                          <div className="text-[10px] text-muted-foreground">
                            {formatDate(q.yaradildi, { hour: "2-digit", minute: "2-digit" })}
                          </div>
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="font-medium">{q.mehsullar.ad}</div>
                          {q.mehsullar.kod && (
                            <div className="text-[10px] font-mono text-muted-foreground">{q.mehsullar.kod}</div>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-xs">
                          <span className="inline-flex items-center gap-1">
                            <Package className="h-3 w-3 text-muted-foreground" />
                            {q.anbarlar.ad}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-right text-sm tabular-nums font-semibold">
                          {formatNumber(Number(q.miqdar), 2)}
                          <span className="ml-1 text-[10px] font-normal text-muted-foreground">
                            {q.mehsullar.olcu_vahidleri?.qisa_ad ?? q.mehsullar.olcu_vahidleri?.ad ?? "əd"}
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          <Badge variant="outline" className={cn("text-[10px]", kat.cls)}>
                            {kat.label}
                          </Badge>
                        </td>
                        <td className="px-3 py-2.5 max-w-xs">
                          <p className="line-clamp-2 text-xs text-muted-foreground" title={q.sebeb}>
                            {q.sebeb}
                          </p>
                        </td>
                        <td className="px-3 py-2.5 text-xs">
                          <span className="inline-flex items-center gap-1">
                            <User className="h-3 w-3 text-muted-foreground" />
                            {q.istifadeciler?.ad_soyad ?? "—"}
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          <Badge variant="outline" className={cn("text-[10px]", st.cls)}>
                            {st.label}
                          </Badge>
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          {q.status === "aktiv" && (
                            <DefektResolveDialog
                              defektId={q.id}
                              miqdar={Number(q.miqdar)}
                              mehsulAd={q.mehsullar?.ad ?? "—"}
                              defektAnbarAd={q.anbarlar?.ad ?? "—"}
                              anbarOptions={butunAnbarlar}
                            />
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

function Stat({ label, value, tone }: { label: string; value: string; tone: "amber" | "rose" | "emerald" | "slate" }) {
  const TONE = {
    amber: "text-amber-600 dark:text-amber-400",
    rose: "text-rose-600 dark:text-rose-400",
    emerald: "text-emerald-600 dark:text-emerald-400",
    slate: "text-slate-600 dark:text-slate-400",
  };
  return (
    <Card className="glass">
      <CardContent className="py-3">
        <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className={cn("mt-1 text-xl font-bold tabular-nums", TONE[tone])}>{value}</div>
      </CardContent>
    </Card>
  );
}
