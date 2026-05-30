import type { Metadata } from "next";
import Link from "next/link";
import { Briefcase, Building2, MapPin, ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Sahibkar profili" };

async function getSahibkarInfo() {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const [sahibkar, filialSayi, anbarSayi, iscilerSayi, modullarSayi] = await Promise.all([
      prisma.sahibkarlar.findUnique({ where: { id: sahibkarId } }),
      prisma.filiallar.count(),
      prisma.anbarlar.count(),
      prisma.istifadeciler.count({ where: { aktiv: true } }),
      prisma.sahibkar_modullar.count({ where: { aktiv: true } }),
    ]);
    return { sahibkar, filialSayi, anbarSayi, iscilerSayi, modullarSayi };
  });
}

export default async function SahibkarProfilPage() {
  const info = await getSahibkarInfo();
  const s = info.sahibkar;
  if (!s) {
    return <div className="p-6 text-sm text-muted-foreground">Sahibkar tapılmadı.</div>;
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <header className="flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-lg bg-secondary text-muted-foreground">
          <Briefcase className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Sahibkar profili</h1>
          <p className="text-sm text-muted-foreground">Təşkilat profili və ümumi statistika</p>
        </div>
      </header>

      <Card className="glass">
        <CardContent className="space-y-3 py-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 text-xl font-bold">
                <Building2 className="h-5 w-5 text-primary-light" /> {s.ad}
              </h2>
              {s.email && <p className="mt-0.5 text-sm text-muted-foreground">{s.email}</p>}
            </div>
            <Badge variant="outline" className={s.status === "aktiv" ? "border-success/30 text-success" : "border-warning/30 text-warning"}>
              {s.status ?? "—"}
            </Badge>
          </div>

          <div className="grid grid-cols-2 gap-3 border-t border-border/40 pt-3 text-sm md:grid-cols-3">
            {s.voen && (
              <div>
                <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground">VÖEN</div>
                <div className="mt-0.5 font-mono">{s.voen}</div>
              </div>
            )}
            {s.telefon && (
              <div>
                <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground">Telefon</div>
                <div className="mt-0.5">{s.telefon}</div>
              </div>
            )}
            {s.biznes_novu && (
              <div>
                <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground">Biznes növü</div>
                <div className="mt-0.5">{s.biznes_novu}</div>
              </div>
            )}
            {s.seh_r && (
              <div className="flex items-start gap-1.5">
                <MapPin className="mt-0.5 h-3 w-3 text-muted-foreground" />
                <div>
                  <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground">Şəhər</div>
                  <div className="mt-0.5">{s.seh_r}</div>
                </div>
              </div>
            )}
            {s.magaza_sayi && (
              <div>
                <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground">Mağaza sayı</div>
                <div className="mt-0.5">{s.magaza_sayi}</div>
              </div>
            )}
            {s.isci_sayi && (
              <div>
                <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground">İşçi sayı</div>
                <div className="mt-0.5">{s.isci_sayi}</div>
              </div>
            )}
            <div>
              <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground">Qoşulma tarixi</div>
              <div className="mt-0.5">{formatDate(s.yaradildi)}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Filial" value={info.filialSayi} />
        <StatCard label="Anbar" value={info.anbarSayi} />
        <StatCard label="Aktiv işçi" value={info.iscilerSayi} />
        <StatCard label="Modul" value={info.modullarSayi} />
      </section>

      <section className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <ProfileLink href="/ayarlar/kompaniya" title="Kompaniya" desc="Brend və ünvanı redaktə et" />
        <ProfileLink href="/sahibkar" title="Sahibkar paneli" desc="Geniş profil və tapşırıqlar" />
        <ProfileLink href="/ayarlar/abune" title="Abunə" desc="Plan və ödəniş tarixçəsi" />
      </section>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card className="glass">
      <CardContent className="py-4">
        <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="mt-1 text-xl font-bold tabular-nums">{value}</div>
      </CardContent>
    </Card>
  );
}

function ProfileLink({ href, title, desc }: { href: string; title: string; desc: string }) {
  return (
    <Link href={href}>
      <Card className="glass transition hover:border-primary/30">
        <CardContent className="flex items-center justify-between py-4">
          <div>
            <div className="text-sm font-semibold">{title}</div>
            <div className="text-xs text-muted-foreground">{desc}</div>
          </div>
          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
        </CardContent>
      </Card>
    </Link>
  );
}
