import type { Metadata } from "next";
import { FileText, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { formatDate } from "@/lib/utils";
import { SenedSablonPreview } from "@/features/ayarlar/components/sened-sablon-preview";

export const metadata: Metadata = { title: "Sənəd şablonları" };
export const dynamic = "force-dynamic";

const QRUP_LABELS: Record<string, string> = {
  faktura: "Faktura",
  qaime: "Qaimə",
  cek: "POS çeki",
  zemanet: "Zəmanət talonu",
  akt: "Akt",
  email: "Email şablonu",
};

async function getDocumentTemplates() {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    return prisma.sened_sablonlari.findMany({
      where: { OR: [{ sahibkar_id: sahibkarId }, { sahibkar_id: null }] },
      orderBy: [{ qrup: "asc" }, { default_olsun: "desc" }, { ad: "asc" }],
    });
  });
}

export default async function SenedSablonPage() {
  const rows = await getDocumentTemplates();

  const byQrup = new Map<string, typeof rows>();
  for (const r of rows) {
    const arr = byQrup.get(r.qrup) ?? [];
    arr.push(r);
    byQrup.set(r.qrup, arr);
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Sənəd şablonları</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Faktura, qaimə, çek və zəmanət talonu üçün vizual şablon təyinatları.
        </p>
      </header>

      {byQrup.size === 0 ? (
        <Card className="glass border-dashed">
          <CardContent className="py-12 text-center">
            <FileText className="mx-auto h-8 w-8 text-muted-foreground/50" />
            <p className="mt-2 text-sm text-muted-foreground">Şablon yoxdur.</p>
          </CardContent>
        </Card>
      ) : (
        Array.from(byQrup.entries()).map(([qrup, sablonlar]) => (
          <section key={qrup} className="space-y-2">
            <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              {QRUP_LABELS[qrup] ?? qrup}
            </h2>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {sablonlar.map((s) => (
                <Card key={s.id} className={`glass ${!s.aktiv && "opacity-60"}`}>
                  <CardContent className="space-y-2 py-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-primary-light" />
                          <h3 className="truncate font-semibold">{s.ad}</h3>
                          {s.default_olsun && <Star className="h-3.5 w-3.5 fill-warning text-warning" />}
                          {s.sistem && <Badge variant="outline" className="text-[10px]">sistem</Badge>}
                          {!s.aktiv && <Badge variant="outline" className="text-[10px]">passiv</Badge>}
                        </div>
                        <div className="mt-1 font-mono text-[10.5px] text-muted-foreground">{s.kod}</div>
                        {s.qeyd && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{s.qeyd}</p>}
                      </div>
                      <Badge variant="outline" className="text-[10px] uppercase">{s.format}</Badge>
                    </div>
                    <div className="flex items-center justify-between border-t border-border/40 pt-2 text-[10.5px] text-muted-foreground">
                      <span>Yenilənib: {formatDate(s.yenilendi)}</span>
                      <SenedSablonPreview ad={s.ad} format={s.format} metn={s.metn} kod={s.kod} />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
