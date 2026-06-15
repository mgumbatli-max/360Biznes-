import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Building2, Mail, Phone, MapPin, Calendar, Boxes, Users, ShoppingCart } from "lucide-react";
import { BackButton } from "@/components/ui/back-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { requirePlatformAdmin } from "@/lib/platform-admin/guard";
import { getTenantDetail, getGlobalUsers, getTenantModules } from "@/features/platform-admin/queries";
import { TenantActions } from "@/features/platform-admin/components/tenant-actions";
import { ImpersonateButton } from "@/features/platform-admin/components/impersonate-button";
import { UserAdminActions } from "@/features/platform-admin/components/user-admin-actions";
import { ModuleToggle } from "@/features/platform-admin/components/module-toggle";
import { formatDate, formatMoney } from "@/lib/utils";

export const metadata: Metadata = { title: "Tenant detayı" };

export default async function TenantDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePlatformAdmin();
  const { id } = await params;
  const t = await getTenantDetail(id);
  if (!t) notFound();

  const latestAbune = t.abuneler[0];

  // Bu şirkətin əməkdaşları (bütün, silinmişlər daxil) — əməliyyatlarla.
  const { rows: emekdaslar } = await getGlobalUsers({ tenantId: id, status: "hamisi" });

  // Bu şirkətin modul səlahiyyətləri (per-tenant entitlement).
  const modullar = await getTenantModules(id);
  const now = new Date();

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

      {/* Modullar (funksiyalar) — per-tenant modul səlahiyyəti (aç/söndür + qiymət) */}
      <Card className="glass">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Boxes className="h-4 w-4 text-primary-light" /> Modullar (funksiyalar)
          </CardTitle>
          <Badge variant="outline">{modullar.filter((m) => m.aktiv).length} / {modullar.length} aktiv</Badge>
        </CardHeader>
        <CardContent className="p-0">
          {modullar.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Modul yoxdur</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-border/60 text-left text-[10.5px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Modul</th>
                  <th className="px-3 py-2">Qiymət</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Bitmə</th>
                  <th className="px-3 py-2 text-right">Əməliyyat</th>
                </tr>
              </thead>
              <tbody>
                {modullar.map((m) => {
                  const muddetiBitib = Boolean(m.bitme && m.bitme < now);
                  return (
                    <tr key={m.kod} className="border-b border-border/30">
                      <td className="px-3 py-2 font-medium">{m.ad}</td>
                      <td className="px-3 py-2 text-xs tabular-nums">{formatMoney(m.aylik_qiymet)}/ay</td>
                      <td className="px-3 py-2">
                        {m.aktiv ? (
                          <Badge variant="outline" className="border-success/30 text-success text-[10px]">Aktiv</Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px]">Passiv</Badge>
                        )}
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {m.bitme ? (
                          <span className={muddetiBitib ? "text-danger" : ""}>{formatDate(m.bitme)}</span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <ModuleToggle sahibkarId={t.id} modulKod={m.kod} aktiv={m.aktiv} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Əməkdaşlar — bu şirkətin istifadəçiləri (şifrə yenilə / aktiv / sessiya / sil) */}
      <Card className="glass">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4 text-primary-light" /> Əməkdaşlar
          </CardTitle>
          <Badge variant="outline">{emekdaslar.length}</Badge>
        </CardHeader>
        <CardContent className="p-0">
          {emekdaslar.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Əməkdaş yoxdur</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-border/60 text-left text-[10.5px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Ad soyad</th>
                  <th className="px-3 py-2">Email</th>
                  <th className="px-3 py-2">Rol</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Son giriş</th>
                  <th className="px-3 py-2 text-right">Əməliyyat</th>
                </tr>
              </thead>
              <tbody>
                {emekdaslar.map((u) => (
                  <tr key={u.id} className="border-b border-border/30">
                    <td className="px-3 py-2 font-medium">{u.ad_soyad}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{u.email}</td>
                    <td className="px-3 py-2 text-xs">{u.rol_ad}</td>
                    <td className="px-3 py-2">
                      {u.deleted_at ? (
                        <Badge variant="outline" className="border-danger/30 text-danger text-[10px]">Silinmiş</Badge>
                      ) : u.aktiv ? (
                        <Badge variant="outline" className="border-success/30 text-success text-[10px]">Aktiv</Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px]">Deaktiv</Badge>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs">{u.son_giris ? formatDate(u.son_giris) : "heç vaxt"}</td>
                    <td className="px-3 py-2 text-right">
                      <UserAdminActions user={{ id: u.id, ad_soyad: u.ad_soyad, aktiv: u.aktiv, deleted_at: u.deleted_at }} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

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
