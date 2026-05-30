import type { Metadata } from "next";
import { Boxes, MapPin, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { AnbarDialog } from "@/features/ayarlar/components/anbar-dialog";

export const metadata: Metadata = { title: "Anbar ayarları" };

async function getAnbarlar() {
  return withTenant(async () =>
    prisma.anbarlar.findMany({
      orderBy: { ad: "asc" },
      include: {
        filiallar: { select: { ad: true } },
        istifadeciler: { select: { ad_soyad: true } },
      },
    })
  );
}

async function getOptions() {
  return withTenant(async () => {
    const [filiallar, mesullar] = await Promise.all([
      prisma.filiallar.findMany({ where: { aktiv: true }, select: { id: true, ad: true }, orderBy: { ad: "asc" } }),
      prisma.istifadeciler.findMany({ where: { aktiv: true }, select: { id: true, ad_soyad: true }, orderBy: { ad_soyad: "asc" } }),
    ]);
    return { filiallar, mesullar };
  });
}

export default async function AyarAnbarPage() {
  const [rows, opts] = await Promise.all([getAnbarlar(), getOptions()]);

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Anbar ayarları</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Anbar siyahısı, məsul və status.
          </p>
        </div>
        <AnbarDialog filiallar={opts.filiallar} mesullar={opts.mesullar} />
      </header>

      {rows.length === 0 ? (
        <Card className="glass border-dashed">
          <CardContent className="py-12 text-center">
            <Boxes className="mx-auto h-8 w-8 text-muted-foreground/50" />
            <p className="mt-2 text-sm text-muted-foreground">Anbar yoxdur.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {rows.map((a) => (
            <Card key={a.id} className={`glass ${!a.aktiv && "opacity-60"}`}>
              <CardContent className="space-y-2 py-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Boxes className="h-4 w-4 text-primary-light" />
                      <h3 className="truncate font-semibold">{a.ad}</h3>
                      {!a.aktiv && <Badge variant="outline" className="text-[10px]">passiv</Badge>}
                    </div>
                    {a.unvan && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{a.unvan}</p>}
                  </div>
                  <AnbarDialog
                    filiallar={opts.filiallar}
                    mesullar={opts.mesullar}
                    anbar={{ id: a.id, ad: a.ad, unvan: a.unvan, filial_id: a.filial_id, mesul_id: a.mesul_id, aktiv: a.aktiv }}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2 border-t border-border/40 pt-2 text-xs">
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <MapPin className="h-3 w-3" /> {a.filiallar?.ad ?? "—"}
                  </div>
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <User className="h-3 w-3" /> {a.istifadeciler?.ad_soyad ?? "Məsul yoxdur"}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
