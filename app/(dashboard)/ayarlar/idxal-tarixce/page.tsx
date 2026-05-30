import type { Metadata } from "next";
import Link from "next/link";
import { Upload, AlertTriangle, FileSpreadsheet } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { TEMPLATES } from "@/features/inteqrasiya/templates";

export const metadata: Metadata = { title: "İdxal tarixçəsi" };

async function getHistory() {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const [items, stats] = await Promise.all([
      prisma.import_partiyalari.findMany({
        where: { sahibkar_id: sahibkarId },
        orderBy: { yaradildi: "desc" },
        take: 200,
        include: { istifadeciler: { select: { ad_soyad: true, email: true } } },
      }),
      prisma.import_partiyalari.groupBy({
        by: ["status"],
        where: { sahibkar_id: sahibkarId },
        _count: { _all: true },
      }),
    ]);
    return { items, stats };
  });
}

function formatDate(d: Date | null) {
  if (!d) return "—";
  return new Intl.DateTimeFormat("az-AZ", { dateStyle: "short", timeStyle: "short" }).format(d);
}

export default async function Page() {
  const { items, stats } = await getHistory();

  const get = (s: string) => stats.find((g) => g.status === s)?._count._all ?? 0;
  const cemi = items.length;
  const tamamlandi = get("tamamlandi");
  const ugursuz = get("ugursuz");
  const yarimcin = get("icra_edilir");

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <header className="flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-lg bg-secondary text-primary">
          <Upload className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">İdxal tarixçəsi</h1>
          <p className="text-sm text-muted-foreground">Bütün Excel/CSV idxallarının nəticələri</p>
        </div>
      </header>


      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiPill label="Cəmi idxal" value={String(cemi)} />
        <KpiPill label="Müvəffəq" value={String(tamamlandi)} tone="primary" />
        <KpiPill label="İcra edilir" value={String(yarimcin)} tone="warn" />
        <KpiPill label="Uğursuz" value={String(ugursuz)} tone="muted" />
      </div>

      <Card className="glass">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">İdxal qeydləri</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border/60 text-left text-[10.5px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-3 py-2.5">Tarix</th>
                  <th className="px-3 py-2.5">İstifadəçi</th>
                  <th className="px-3 py-2.5">Şablon</th>
                  <th className="px-3 py-2.5">Fayl</th>
                  <th className="px-3 py-2.5 text-right">Cəmi</th>
                  <th className="px-3 py-2.5 text-right">Yeni</th>
                  <th className="px-3 py-2.5 text-right">Yeniləndi</th>
                  <th className="px-3 py-2.5 text-right">Xəta</th>
                  <th className="px-3 py-2.5">Status</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-3 py-16 text-center">
                      <Upload className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
                      <p className="text-sm font-semibold">Hələ idxal edilməyib</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        <Link href="/ayarlar/inteqrasiya" className="text-primary hover:underline">
                          İnteqrasiya mərkəzindən
                        </Link>{" "}
                        başla — Excel şablonunu yüklə.
                      </p>
                    </td>
                  </tr>
                ) : (
                  items.map((p) => {
                    const tmpl = TEMPLATES[p.sablon_nov];
                    return (
                      <tr key={p.id} className="border-b border-border/30">
                        <td className="px-3 py-2 text-xs whitespace-nowrap text-muted-foreground">
                          {formatDate(p.yaradildi)}
                        </td>
                        <td className="px-3 py-2 text-xs">{p.istifadeciler?.ad_soyad ?? "—"}</td>
                        <td className="px-3 py-2">
                          <Badge variant="outline" className="text-[10px]">
                            {tmpl?.title ?? p.sablon_nov}
                          </Badge>
                        </td>
                        <td className="px-3 py-2 text-xs">
                          <span className="inline-flex items-center gap-1 truncate">
                            <FileSpreadsheet className="h-3 w-3 text-muted-foreground" />
                            {p.fayl_adi ?? "—"}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right text-xs tabular-nums">{p.cemi_satir ?? 0}</td>
                        <td className="px-3 py-2 text-right text-xs tabular-nums text-emerald-600">
                          {p.yeni_satir ?? 0}
                        </td>
                        <td className="px-3 py-2 text-right text-xs tabular-nums text-primary">
                          {p.yenilenecek ?? 0}
                        </td>
                        <td className="px-3 py-2 text-right text-xs tabular-nums">
                          {(p.xeta_satir ?? 0) > 0 ? (
                            <span className="text-rose-500">{p.xeta_satir}</span>
                          ) : (
                            "0"
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <StatusBadge status={p.status ?? "—"} />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card className="glass border-amber-500/30">
        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
            <div className="space-y-1 text-sm">
              <p className="font-semibold">Geri qaytarma necə işləyir?</p>
              <ul className="ml-4 list-disc space-y-0.5 text-muted-foreground">
                <li>Hər idxalın bir batch ID-si olur — bütün dəyişikliklər həmin batch altında izlənir.</li>
                <li>«Geri qaytar» düyməsi batch-da yaradılan/dəyişdirilən qeydləri silir.</li>
                <li>Stok hərəkətləri ləğv edilir — hesabatlarda əks olunur.</li>
                <li>Müvəffəq idxalı yalnız 48 saat içində geri qaytarmaq olar (audit qoruması).</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    tamamlandi: { label: "Tamamlandı", cls: "text-emerald-600 border-emerald-500/40" },
    icra_edilir: { label: "İcra edilir", cls: "text-amber-600 border-amber-500/40" },
    ugursuz: { label: "Uğursuz", cls: "text-rose-500 border-rose-500/40" },
    yuklendi: { label: "Yükləndi", cls: "text-muted-foreground" },
  };
  const v = map[status] ?? { label: status, cls: "" };
  return (
    <Badge variant="outline" className={`text-[10px] ${v.cls}`}>
      {v.label}
    </Badge>
  );
}

function KpiPill({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "primary" | "warn" | "muted";
}) {
  const toneClass =
    tone === "primary"
      ? "text-primary"
      : tone === "warn"
      ? "text-amber-500"
      : tone === "muted"
      ? "text-muted-foreground"
      : "text-foreground";
  return (
    <div className="glass rounded-xl border border-border/40 px-3 py-2">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`mt-0.5 text-2xl font-bold tabular-nums ${toneClass}`}>{value}</div>
    </div>
  );
}
