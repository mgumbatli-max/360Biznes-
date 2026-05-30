import type { Metadata } from "next";
import Link from "next/link";
import { Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { UserList } from "@/features/ayar/components/user-list";
import { UserDetailPanel } from "@/features/ayar/components/user-detail-panel";
import { UserCreateDialog } from "@/features/ayar/components/user-create-dialog";
import {
  getIstifadeciList,
  getIstifadeciStats,
  getIstifadeciDetail,
  getRoles,
  getFiliallar,
} from "@/features/ayar/queries";

export const metadata: Metadata = { title: "İstifadəçilər" };

type SearchParams = Promise<{ selected?: string; tab?: string }>;

export default async function IstifadeciPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const [users, stats, roles, filiallar] = await Promise.all([
    getIstifadeciList(),
    getIstifadeciStats(),
    getRoles(),
    getFiliallar(),
  ]);

  const selectedId = params.selected ?? users[0]?.id ?? null;
  const detail = selectedId ? await getIstifadeciDetail(selectedId) : null;

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-secondary text-primary">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">İstifadəçi tənzimləmələri</h1>
            <p className="text-sm text-muted-foreground">
              Login hesabları, rol, icazə, 2FA, sessiya, bağlı əməkdaşlar və davranış
            </p>
          </div>
        </div>
        <UserCreateDialog roles={roles} filiallar={filiallar} />
      </header>


      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        <Stat label="Ümumi istifadəçi" value={stats.umumi} />
        <Stat label="Aktiv" value={stats.aktiv} tone="primary" />
        <Stat label="Passiv" value={stats.passiv} tone={stats.passiv > 0 ? "muted" : "default"} />
        <Stat label="Login hesabı" value={stats.loginHesabi} />
        <Stat label="2FA aktiv" value={stats.twoFa} tone={stats.twoFa > 0 ? "primary" : "muted"} />
        <Stat label="Son 7 günlük giriş" value={stats.son7gun} />
        <Stat label="Heç giriş etməmiş" value={stats.hecVaxt} tone={stats.hecVaxt > 0 ? "warn" : "default"} />
      </div>

      {users.length === 0 ? (
        <Card className="glass">
          <CardContent className="py-16 text-center">
            <Users className="mx-auto h-8 w-8 text-muted-foreground/50" />
            <h3 className="mt-3 font-semibold">İstifadəçi yoxdur</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              İşçi yarat → <Link href="/iscilier" className="text-primary hover:underline">İşçilər</Link> səhifəsindən.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[300px_1fr]">
          <UserList users={users} selectedId={selectedId} />
          {detail ? (
            <UserDetailPanel
              roles={roles}
              user={{
                id: detail.id,
                ad_soyad: detail.ad_soyad,
                email: detail.email,
                telefon: detail.telefon,
                aktiv: detail.aktiv,
                vezife: detail.vezife,
                isci_kod: detail.isci_kod,
                dil: detail.dil,
                time_zone: detail.time_zone,
                qeyd: detail.qeyd,
                iki_fa_aktiv: detail.iki_fa_aktiv,
                mecburi_sifre_deyis: detail.mecburi_sifre_deyis,
                son_sifre_deyis: detail.son_sifre_deyis,
                ip_meqdudiyyet: detail.ip_meqdudiyyet,
                sessiya_limit: detail.sessiya_limit,
                bildiris_push: detail.bildiris_push,
                bildiris_email: detail.bildiris_email,
                bildiris_sms: detail.bildiris_sms,
                bildiris_telegram: detail.bildiris_telegram,
                son_giris: detail.son_giris,
                yaradildi: detail.yaradildi ?? null,
                ehtiyat_telefon: detail.ehtiyat_telefon,
                roles: detail.roles
                  ? {
                      id: detail.roles.id,
                      ad: detail.roles.ad,
                      reng: detail.roles.reng,
                      _count: detail.roles._count,
                    }
                  : null,
                istifadeci_filial: detail.istifadeci_filial.map((b) => ({
                  esas: b.esas,
                  filiallar: { id: b.filiallar.id, ad: b.filiallar.ad },
                })),
              }}
            />
          ) : (
            <Card className="glass">
              <CardContent className="py-16 text-center text-sm text-muted-foreground">
                Sol paneldən istifadəçi seçin və ya{" "}
                <Link href="/iscilier" className="text-primary hover:underline">yenisini yaradın</Link>.
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number;
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
