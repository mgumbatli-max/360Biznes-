import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Building2, Mail, Phone, MapPin, Calendar, Boxes, Users, ShoppingCart } from "lucide-react";
import { BackButton } from "@/components/ui/back-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { requirePlatformAdmin } from "@/lib/platform-admin/guard";
import { getTenantDetail } from "@/features/platform-admin/queries";
import { TenantActions } from "@/features/platform-admin/components/tenant-actions";
import { ImpersonateButton } from "@/features/platform-admin/components/impersonate-button";
import { formatDate, formatMoney } from "@/lib/utils";

export const metadata: Metadata = { title: "Tenant detayı" };

export default async function TenantDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePlatformAdmin();
  const { id } = await params;
  const t = await getTenantDetail(id);
  if (!t) notFound();

  const latestAbune = t.abuneler[0];

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <BackButton fallback="/platform-admin/tenantlar" className="mt-1" />
          <div>
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary-light" />
              <h1 className="text-2xl font-bold tracking-tight">{t.ad}</h1>
              <Badge variant="outline" className={t.status === "aktiv" ? "border-success/30 text-success" : "border-danger/30 text-danger"}>
                {t.status === "aktiv" ? "Aktiv" : "Dayandırıldı"}
              </Badge>
            </div>
            <p className="mt-0.5 text-sm text-muted-foreground">ID: <span className="font-mono">{t.id}</span></p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ImpersonateButton tenantId={t.id} tenantAd={t.ad} />
          <TenantActions tenantId={t.id} currentStatus={t.status ?? "aktiv"} />
        </div>
      </header>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="glass">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">Əlaqə</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5 text-sm">
            <Row icon={Mail} value={t.email} />
            {t.telefon && <Row icon={Phone} value={t.telefon} />}
            {t.unvan && <Row icon={MapPin} value={t.unvan} />}
            {t.seh_r && <Row icon={MapPin} value={`${t.seh_r}`} />}
            {t.voen && <Row label="VÖEN" value={t.voen} mono />}
            {t.domen && <Row label="Domen" value={t.domen} mono />}
          </CardContent>
        </Card>

        <Card className="glass">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">Abunə</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5 text-sm">
            {latestAbune ? (
              <>
                <Row label="Plan" value={latestAbune.abune_planlari?.ad ?? "—"} />
                <Row label="Növ" value={latestAbune.novu === "sinaq" ? "Sınaq" : "Ödənişli"} />
                <Row label="Status" value={latestAbune.status ?? "—"} />
                <Row icon={Calendar} label="Bitir" value={formatDate(latestAbune.bitme)} />
                {latestAbune.novu !== "sinaq" && (
                  <Row label="Aylıq" value={formatMoney(Number(latestAbune.abune_planlari?.ayl_q_qiymet ?? 0))} />
                )}
              </>
            ) : (
              <p className="text-muted-foreground">Abunə yoxdur</p>
            )}
          </CardContent>
        </Card>

        <Card className="glass">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">Statistika</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Stat icon={Users} label="İstifadəçi" value={t._count.istifadeciler} />
            <Stat icon={Building2} label="Filial" value={t._count.filiallar} />
            <Stat icon={Boxes} label="Anbar" value={t._count.anbarlar} />
            <Stat icon={Boxes} label="Məhsul" value={t._count.mehsullar} />
            <Stat icon={ShoppingCart} label="Satış" value={t._count.satis_sifarisleri} />
          </CardContent>
        </Card>
      </section>

      <Card className="glass">
        <CardHeader>
          <CardTitle className="text-base">Abunə tarixçəsi</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {t.abuneler.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Tarixçə yoxdur</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-border/60 text-left text-[10.5px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Plan</th>
                  <th className="px-3 py-2">Növ</th>
                  <th className="px-3 py-2">Başlanğıc</th>
                  <th className="px-3 py-2">Bitir</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {t.abuneler.map((a) => (
                  <tr key={a.id} className="border-b border-border/30">
                    <td className="px-3 py-2">{a.abune_planlari?.ad ?? "—"}</td>
                    <td className="px-3 py-2 text-xs">{a.novu}</td>
                    <td className="px-3 py-2 text-xs">{formatDate(a.baslama)}</td>
                    <td className="px-3 py-2 text-xs">{formatDate(a.bitme)}</td>
                    <td className="px-3 py-2"><Badge variant="outline" className="text-[10px]">{a.status}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ icon: Icon, label, value, mono }: { icon?: React.ComponentType<{ className?: string }>; label?: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start gap-2">
      {Icon && <Icon className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />}
      {label && <span className="text-xs text-muted-foreground">{label}:</span>}
      <span className={`flex-1 ${mono ? "font-mono text-xs" : ""}`}>{value}</span>
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: number }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        <span>{label}</span>
      </div>
      <span className="tabular-nums font-semibold">{value}</span>
    </div>
  );
}
