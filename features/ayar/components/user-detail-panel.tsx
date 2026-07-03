"use client";

import { useRouter, useSearchParams } from "next/navigation";
import {
  User,
  Shield,
  Users,
  Lock,
  Bell,
  Monitor,
  Activity,
  Mail,
  Phone,
  Briefcase,
  Hash,
  Globe,
  Clock,
  KeyRound,
  ShieldCheck,
  ShieldOff,
  Smartphone,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn, formatDate as fmtDate } from "@/lib/utils";
import { LiveToggle } from "./live-toggle";
import {
  UserProfileEditDialog,
  UserRoleChangeDialog,
  UserPasswordResetDialog,
  UserIpRestrictionDialog,
  UserSessionLimitDialog,
  UserDeleteButton,
} from "./user-action-dialogs";
import { toggleUserField } from "../actions";

type Filial = { id: number; ad: string };

export type UserDetail = {
  id: string;
  ad_soyad: string;
  email: string;
  telefon: string | null;
  aktiv: boolean | null;
  vezife: string | null;
  isci_kod: string | null;
  dil: string;
  time_zone: string;
  qeyd: string | null;
  iki_fa_aktiv: boolean;
  mecburi_sifre_deyis: boolean;
  son_sifre_deyis: Date | null;
  ip_meqdudiyyet: string[];
  sessiya_limit: number;
  bildiris_push: boolean;
  bildiris_email: boolean;
  bildiris_sms: boolean;
  bildiris_telegram: boolean;
  son_giris: Date | null;
  yaradildi: Date | null;
  ehtiyat_telefon: string | null;
  roles: {
    id: number;
    ad: string;
    reng: string | null;
    _count: { rol_icazeleri: number };
  } | null;
  istifadeci_filial: Array<{
    esas: boolean | null;
    filiallar: Filial;
  }>;
};

const TABS = [
  { key: "profil", label: "Profil", icon: User },
  { key: "rol", label: "Rol & icazə", icon: Shield },
  { key: "bagli", label: "Bağlı əməkdaşlar", icon: Users },
  { key: "sifre", label: "Təhlükəsizlik", icon: Lock },
  { key: "bildiris", label: "Bildiriş", icon: Bell },
  { key: "sessiya", label: "Sessiya", icon: Monitor },
  { key: "status", label: "Status", icon: Activity },
] as const;

function formatDate(d: Date | null) {
  if (!d) return "—";
  return fmtDate(d, { dateStyle: "short", timeStyle: "short" });
}

type RoleOption = {
  id: number;
  ad: string;
  reng: string | null;
  aciqlamaq: string | null;
  sistem: boolean | null;
  _count?: { rol_icazeleri: number; istifadeciler: number };
};

export function UserDetailPanel({
  user,
  roles = [],
}: {
  user: UserDetail;
  roles?: RoleOption[];
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const activeTab = (sp.get("tab") ?? "profil") as (typeof TABS)[number]["key"];

  const setTab = (tab: string) => {
    const params = new URLSearchParams(sp.toString());
    params.set("tab", tab);
    router.replace(`?${params.toString()}`, { scroll: false });
  };

  const initials = user.ad_soyad
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <Card className="glass">
      <CardContent className="space-y-4 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div
              className="grid h-12 w-12 shrink-0 place-items-center rounded-full text-sm font-bold text-white shadow"
              style={{ background: user.roles?.reng ?? "var(--brand-gradient)" }}
            >
              {initials || <User className="h-5 w-5" />}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-bold">{user.ad_soyad}</h2>
                {user.roles && (
                  <span
                    className="rounded-md px-1.5 py-0.5 text-[10px] font-semibold"
                    style={{
                      background: `${user.roles.reng ?? "#6366f1"}20`,
                      color: user.roles.reng ?? "#6366f1",
                    }}
                  >
                    {user.roles.ad}
                  </span>
                )}
                {user.iki_fa_aktiv && (
                  <Badge variant="outline" className="text-[10px] text-emerald-500">
                    2FA
                  </Badge>
                )}
                {user.aktiv ? (
                  <Badge variant="outline" className="text-[10px] text-emerald-500">
                    Aktiv
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px] text-muted-foreground">
                    Passiv
                  </Badge>
                )}
              </div>
              <div className="text-xs text-muted-foreground">
                {user.email}
                {user.isci_kod && <span> · {user.isci_kod}</span>}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <LiveToggle
              initial={!!user.aktiv}
              action={toggleUserField}
              fields={{ id: user.id, field: "aktiv" }}
              successMessage={user.aktiv ? "Deaktiv edildi" : "Aktiv edildi"}
            />
            <UserDeleteButton userId={user.id} userName={user.ad_soyad} />
          </div>
        </div>

        <nav className="flex flex-wrap gap-1 border-b border-border/40">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = activeTab === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={cn(
                  "inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition",
                  active ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {t.label}
                {t.key === "bagli" && (
                  <span className="ml-0.5 text-[10px] opacity-70">({user.istifadeci_filial.length})</span>
                )}
              </button>
            );
          })}
        </nav>

        {activeTab === "profil" && <ProfileTab user={user} />}
        {activeTab === "rol" && <RoleTab user={user} roles={roles} />}
        {activeTab === "bagli" && <ConnectedTab user={user} />}
        {activeTab === "sifre" && <SecurityTab user={user} />}
        {activeTab === "bildiris" && <NotifyTab user={user} />}
        {activeTab === "sessiya" && <SessionTab user={user} />}
        {activeTab === "status" && <StatusTab user={user} />}
      </CardContent>
    </Card>
  );
}

function ProfileTab({ user }: { user: UserDetail }) {
  return (
    <div className="space-y-5 pt-2">
      <div className="flex items-center justify-end">
        <UserProfileEditDialog
          user={{
            id: user.id,
            ad_soyad: user.ad_soyad,
            telefon: user.telefon,
            vezife: user.vezife,
            isci_kod: user.isci_kod,
            ehtiyat_telefon: user.ehtiyat_telefon,
            dil: user.dil,
            time_zone: user.time_zone,
            qeyd: user.qeyd,
          }}
        />
      </div>
      <Section title="Şəxsi məlumatlar">
        <Field label="Ad Soyad" value={user.ad_soyad} icon={User} />
        <Field label="Email" value={user.email} icon={Mail} hint="Email dəyişdirilmir (login üçün)" />
        <Field label="Telefon" value={user.telefon ?? "—"} icon={Phone} />
        <Field label="Vəzifə" value={user.vezife ?? "—"} icon={Briefcase} />
        <Field label="İşçi kodu" value={user.isci_kod ?? "—"} icon={Hash} />
        <Field label="Ehtiyat telefon" value={user.ehtiyat_telefon ?? "—"} icon={Phone} />
      </Section>
      <Section title="Dil və saat">
        <Field label="İnterfeys dili" value={langLabel(user.dil)} icon={Globe} />
        <Field label="Saat qurşağı" value={user.time_zone} icon={Clock} />
      </Section>
      {user.qeyd && (
        <Section title="Daxili qeyd">
          <div className="col-span-2 rounded-lg border border-border/40 p-3 text-sm">{user.qeyd}</div>
        </Section>
      )}
    </div>
  );
}

function RoleTab({ user, roles }: { user: UserDetail; roles: RoleOption[] }) {
  if (!user.roles) {
    return (
      <div className="rounded-xl border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
        İstifadəçiyə hələ rol təyin edilməyib
      </div>
    );
  }
  return (
    <div className="space-y-4 pt-2">
      <div className="flex items-start gap-3 rounded-xl border border-border/40 p-4">
        <div
          className="grid h-12 w-12 shrink-0 place-items-center rounded-lg text-lg font-bold text-white"
          style={{ background: user.roles.reng ?? "#6366f1" }}
        >
          {user.roles.ad.slice(0, 1).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-base font-bold">{user.roles.ad}</div>
          <div className="text-xs text-muted-foreground">{user.roles._count.rol_icazeleri} icazə</div>
        </div>
        <UserRoleChangeDialog
          userId={user.id}
          currentRoleId={user.roles?.id ?? null}
          currentRoleName={user.roles.ad}
          roles={roles}
        />
      </div>
      <div className="text-xs text-muted-foreground">
        Rolun bütün icazə matrisini görmək üçün →{" "}
        <a href={`/ayarlar/rollar/${user.roles.id}`} className="text-primary hover:underline">
          {user.roles.ad} rolu
        </a>
      </div>
    </div>
  );
}

function ConnectedTab({ user }: { user: UserDetail }) {
  if (user.istifadeci_filial.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
        İstifadəçinin filialları yoxdur
      </div>
    );
  }
  return (
    <div className="space-y-2 pt-2">
      <div className="text-xs text-muted-foreground">Bu istifadəçi {user.istifadeci_filial.length} filiala bağlıdır.</div>
      {user.istifadeci_filial.map((b) => (
        <div key={b.filiallar.id} className="flex items-center gap-2 rounded-lg border border-border/40 px-3 py-2">
          <Briefcase className="h-4 w-4 text-primary" />
          <span className="flex-1 text-sm">{b.filiallar.ad}</span>
          {b.esas && <Badge variant="outline" className="text-[10px]">əsas</Badge>}
        </div>
      ))}
    </div>
  );
}

function SecurityTab({ user }: { user: UserDetail }) {
  return (
    <div className="space-y-3 pt-2">
      <SecurityCard
        icon={KeyRound}
        title="Şifrə"
        description={user.son_sifre_deyis ? `Son dəyişiklik: ${formatDate(user.son_sifre_deyis)}` : "Heç dəyişdirilməyib"}
      >
        <UserPasswordResetDialog userId={user.id} userName={user.ad_soyad} />
      </SecurityCard>

      <SecurityCard
        icon={user.iki_fa_aktiv ? ShieldCheck : ShieldOff}
        title="İki faktorlu autentifikasiya (2FA)"
        description={user.iki_fa_aktiv ? "Aktiv — TOTP kodu tələb olunur" : "Söndürülüb — aktivləşdirsəniz girişin təhlükəsizliyi artar"}
        warn={!user.iki_fa_aktiv}
      >
        <LiveToggle
          initial={user.iki_fa_aktiv}
          action={toggleUserField}
          fields={{ id: user.id, field: "iki_fa_aktiv" }}
          successMessage={user.iki_fa_aktiv ? "2FA söndürüldü" : "2FA aktiv edildi"}
        />
      </SecurityCard>

      <SecurityCard
        icon={Smartphone}
        title="Sessiya limiti"
        description={
          user.sessiya_limit === 0
            ? "Limitsiz — istənilən sayda qurğudan girə bilər"
            : user.sessiya_limit === 1
            ? "Yalnız 1 qurğudan giriş"
            : `Eyni anda maksimum ${user.sessiya_limit} sessiya`
        }
      >
        <UserSessionLimitDialog userId={user.id} currentLimit={user.sessiya_limit} />
      </SecurityCard>

      <SecurityCard
        icon={Shield}
        title="IP məhdudiyyəti"
        description={
          user.ip_meqdudiyyet.length === 0
            ? "Bütün IP-lərdən girişə icazəlidir"
            : `${user.ip_meqdudiyyet.length} IP icazəlidir — yalnız bu IP-lərdən giriş olur`
        }
      >
        <UserIpRestrictionDialog userId={user.id} currentIps={user.ip_meqdudiyyet} />
      </SecurityCard>

      <SecurityCard
        icon={Lock}
        title="Məcburi şifrə dəyiş"
        description={user.mecburi_sifre_deyis ? "Növbəti girişdə şifrənin dəyişdirilməsi tələb olunacaq" : "Söndürülüb"}
      >
        <LiveToggle
          initial={user.mecburi_sifre_deyis}
          action={toggleUserField}
          fields={{ id: user.id, field: "mecburi_sifre_deyis" }}
          successMessage="Şifrə dəyiş tələbi yeniləndi"
        />
      </SecurityCard>
    </div>
  );
}

function NotifyTab({ user }: { user: UserDetail }) {
  return (
    <div className="space-y-3 pt-2">
      <div className="text-xs text-muted-foreground">Bu istifadəçi hansı kanallarda bildiriş alacaq</div>

      <LiveToggle
        title="Push (brauzer)"
        initial={user.bildiris_push}
        action={toggleUserField}
        fields={{ id: user.id, field: "bildiris_push" }}
        successMessage="Push bildiriş yeniləndi"
      />
      <LiveToggle
        title="Email"
        initial={user.bildiris_email}
        action={toggleUserField}
        fields={{ id: user.id, field: "bildiris_email" }}
        successMessage="Email bildiriş yeniləndi"
      />
      <LiveToggle
        title="SMS"
        initial={user.bildiris_sms}
        action={toggleUserField}
        fields={{ id: user.id, field: "bildiris_sms" }}
        successMessage="SMS bildiriş yeniləndi"
      />
      <LiveToggle
        title="Telegram"
        initial={user.bildiris_telegram}
        action={toggleUserField}
        fields={{ id: user.id, field: "bildiris_telegram" }}
        successMessage="Telegram bildiriş yeniləndi"
      />

      <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
        Hansı hadisədə bildiriş gələcəyini «<a href="/ayarlar/bildiris" className="font-semibold underline">Bildiriş tənzimləməsi</a>» səhifəsindən təyin edin.
      </div>
    </div>
  );
}

function SessionTab({ user: _user }: { user: UserDetail }) {
  return (
    <div className="space-y-3 pt-2">
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Son sessiyalar (30 gün)</div>
      <div className="rounded-xl border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
        Sessiya tarixçəsi yoxdur
      </div>
    </div>
  );
}

function StatusTab({ user }: { user: UserDetail }) {
  return (
    <div className="space-y-3 pt-2">
      <Section title="Son aktivlik">
        <Field label="Hesab yaradıldı" value={formatDate(user.yaradildi)} />
        <Field label="Son giriş" value={formatDate(user.son_giris)} />
        <Field label="Status" value={user.aktiv ? "Aktiv" : "Passiv"} />
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</div>
      <div className="grid grid-cols-1 gap-x-4 gap-y-2 md:grid-cols-2">{children}</div>
    </div>
  );
}

function Field({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="flex items-start gap-2">
      {Icon && <Icon className="mt-0.5 h-3.5 w-3.5 text-muted-foreground" />}
      <div className="min-w-0">
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="text-sm">{value}</div>
        {hint && <div className="text-[11px] text-muted-foreground">{hint}</div>}
      </div>
    </div>
  );
}

function SecurityCard({
  icon: Icon,
  title,
  description,
  children,
  warn,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  children: React.ReactNode;
  warn?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 rounded-lg border px-3 py-3",
        warn ? "border-amber-500/30 bg-amber-500/5" : "border-border/50"
      )}
    >
      <div className="flex items-start gap-2.5">
        <Icon className={cn("mt-0.5 h-4 w-4", warn ? "text-amber-500" : "text-muted-foreground")} />
        <div className="min-w-0">
          <div className="text-sm font-semibold">{title}</div>
          <div className="text-xs text-muted-foreground">{description}</div>
        </div>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function langLabel(d: string) {
  const map: Record<string, string> = { az: "Azərbaycan", en: "English", ru: "Русский", tr: "Türkçe" };
  return map[d] ?? d;
}
