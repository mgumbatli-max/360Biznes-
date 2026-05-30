import type { Metadata } from "next";
import Link from "next/link";
import {
    Key,
  User,
  Shield,
  Monitor,
  Bell,
  Palette,
  Activity,
  LogOut,
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
  Lock,
} from "lucide-react";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PasswordForm } from "@/features/ayar/components/password-form";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Hesab ayarları" };

const SUB_TABS = [
  { key: "profil", label: "Profil", icon: User },
  { key: "tehlukesizlik", label: "Təhlükəsizlik", icon: Shield },
  { key: "sessiya", label: "Sessiya", icon: Monitor },
  { key: "bildiris", label: "Bildiriş", icon: Bell },
  { key: "gorunus", label: "Görünüş", icon: Palette },
  { key: "aktivlik", label: "Aktivlik", icon: Activity },
] as const;

type SearchParams = Promise<{ sub?: string }>;

async function getMyProfile(id: string) {
  return withTenant(() =>
    prisma.istifadeciler.findUnique({
      where: { id },
      select: {
        id: true,
        ad_soyad: true,
        email: true,
        telefon: true,
        vezife: true,
        isci_kod: true,
        dil: true,
        time_zone: true,
        qeyd: true,
        iki_fa_aktiv: true,
        mecburi_sifre_deyis: true,
        son_sifre_deyis: true,
        ip_meqdudiyyet: true,
        sessiya_limit: true,
        bildiris_push: true,
        bildiris_email: true,
        bildiris_sms: true,
        bildiris_telegram: true,
        son_giris: true,
        yaradildi: true,
      },
    })
  );
}

function formatDate(d: Date | null) {
  if (!d) return "—";
  return new Intl.DateTimeFormat("az-AZ", { dateStyle: "short", timeStyle: "short" }).format(d);
}

export default async function HesabPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const u = session.user;
  const profile = await getMyProfile(u.id);
  if (!profile) redirect("/login");

  const { sub: subParam } = await searchParams;
  const sub = (subParam ?? "profil") as (typeof SUB_TABS)[number]["key"];

  const initials = profile.ad_soyad
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <header className="flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-lg bg-secondary text-primary">
          <User className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Hesab ayarları</h1>
          <p className="text-sm text-muted-foreground">
            Profil, təhlükəsizlik, sessiya, bildiriş və görünüş tənzimləmələri
          </p>
        </div>
      </header>


      <Card className="glass">
        <CardContent className="py-4">
          <div className="flex flex-wrap items-center gap-4">
            <Avatar className="h-14 w-14">
              <AvatarFallback
                className="text-lg font-semibold text-white"
                style={{ background: "var(--brand-gradient)" }}
              >
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <div className="text-base font-bold">{profile.ad_soyad}</div>
                <Badge variant="outline" className="text-[10px]">{u.rol_ad}</Badge>
                <Badge variant="secondary" className="text-[10px]">{u.sahibkar_ad}</Badge>
                <Badge variant="outline" className="text-[10px] text-emerald-500">Aktiv</Badge>
              </div>
              <div className="mt-0.5 text-xs text-muted-foreground">{profile.email}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <nav className="flex flex-wrap gap-1 border-b border-border/40">
        {SUB_TABS.map((t) => {
          const Icon = t.icon;
          const active = sub === t.key;
          return (
            <Link
              key={t.key}
              href={`?sub=${t.key}`}
              scroll={false}
              className={cn(
                "inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition",
                active ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {t.label}
            </Link>
          );
        })}
      </nav>

      {sub === "profil" && <ProfilTab profile={profile} />}
      {sub === "tehlukesizlik" && <TehlukesizlikTab profile={profile} />}
      {sub === "sessiya" && <SessiyaTab />}
      {sub === "bildiris" && <BildirisTab profile={profile} />}
      {sub === "gorunus" && <GorunusTab />}
      {sub === "aktivlik" && <AktivlikTab profile={profile} />}
    </div>
  );
}

type Profile = NonNullable<Awaited<ReturnType<typeof getMyProfile>>>;

function ProfilTab({ profile }: { profile: Profile }) {
  return (
    <div className="space-y-4">
      <Card className="glass">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Şəxsi məlumat</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <FieldDisplay label="Ad Soyad" value={profile.ad_soyad} icon={User} />
            <FieldDisplay label="Email" value={profile.email} icon={Mail} />
            <FieldDisplay label="Telefon" value={profile.telefon ?? "—"} icon={Phone} />
            <FieldDisplay label="Vəzifə" value={profile.vezife ?? "—"} icon={Briefcase} />
            <FieldDisplay label="İşçi kodu" value={profile.isci_kod ?? "—"} icon={Hash} />
          </div>
        </CardContent>
      </Card>

      <Card className="glass">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Dil və saat</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <FieldDisplay label="İnterfeys dili" value={langLabel(profile.dil)} icon={Globe} />
            <FieldDisplay label="Saat qurşağı" value={profile.time_zone} icon={Clock} />
          </div>
        </CardContent>
      </Card>

      {profile.qeyd && (
        <Card className="glass">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Daxili qeyd</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{profile.qeyd}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function TehlukesizlikTab({ profile }: { profile: Profile }) {
  return (
    <div className="space-y-4">
      <Card className="glass">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <KeyRound className="h-4 w-4" /> Şifrə
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-3 text-xs text-muted-foreground">
            Son şifrə dəyişikliyi: {formatDate(profile.son_sifre_deyis)}
          </div>
          <PasswordForm />
        </CardContent>
      </Card>

      <SecurityRow
        icon={profile.iki_fa_aktiv ? ShieldCheck : ShieldOff}
        title="İki faktorlu autentifikasiya (2FA)"
        description={
          profile.iki_fa_aktiv
            ? "Aktiv — hər girişdə əlavə kod tələb olunur (Google Authenticator)"
            : "Söndürülüb — aktivləşdirsəniz girişin təhlükəsizliyi artar"
        }
        warn={!profile.iki_fa_aktiv}
        action={profile.iki_fa_aktiv ? "Söndür" : "Aktiv et"}
      />

      <SecurityRow
        icon={Smartphone}
        title="Sessiya limiti"
        description={
          profile.sessiya_limit === 0
            ? "Limitsiz — istənilən sayda qurğudan girə bilərsən"
            : profile.sessiya_limit === 1
            ? "Yalnız 1 qurğudan giriş"
            : `Eyni anda maksimum ${profile.sessiya_limit} sessiya`
        }
        action="Tənzimlə"
      />

      <SecurityRow
        icon={Shield}
        title="IP məhdudiyyəti"
        description={
          profile.ip_meqdudiyyet.length === 0
            ? "Bütün IP-lərdən girişə icazəlidir"
            : `${profile.ip_meqdudiyyet.length} IP icazəlidir — yalnız bu IP-lərdən giriş olar`
        }
        action="+ IP əlavə et"
      />

      <SecurityRow
        icon={Lock}
        title="Məcburi şifrə dəyiş"
        description={
          profile.mecburi_sifre_deyis
            ? "Növbəti girişdə şifrənin dəyişdirilməsi tələb olunacaq"
            : "Söndürülüb"
        }
        action={profile.mecburi_sifre_deyis ? "Ləğv et" : "Tələb et"}
      />
    </div>
  );
}

function SessiyaTab() {
  return (
    <Card className="glass">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Aktiv sessiyalar</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="rounded-lg border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
          Aktiv sessiya tarixçəsi göstərilmir
        </div>
      </CardContent>
    </Card>
  );
}

function BildirisTab({ profile }: { profile: Profile }) {
  return (
    <Card className="glass">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Mənə bildiriş gəlsin</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <ToggleRow title="Push (brauzer)" enabled={profile.bildiris_push} />
        <ToggleRow title="Email" enabled={profile.bildiris_email} />
        <ToggleRow title="SMS" enabled={profile.bildiris_sms} />
        <ToggleRow title="WhatsApp" enabled={false} />
        <ToggleRow title="Telegram" enabled={profile.bildiris_telegram} />
        <div className="text-[11px] text-muted-foreground">
          Hansı hadisədə bildiriş gələcəyini{" "}
          <Link href="/ayarlar/bildiris" className="text-primary hover:underline">
            Bildiriş tənzimləmələri
          </Link>{" "}
          səhifəsindən təyin edin.
        </div>
      </CardContent>
    </Card>
  );
}

function GorunusTab() {
  return (
    <div className="space-y-4">
      <Card className="glass">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Tema</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-2">
            <ThemeBtn name="Qaranlıq" sample="bg-zinc-900 text-white" />
            <ThemeBtn name="Açıq" sample="bg-zinc-100 text-zinc-900" />
            <ThemeBtn name="Avto (sistem)" sample="bg-gradient-to-b from-zinc-100 to-zinc-800 text-white" />
          </div>
        </CardContent>
      </Card>

      <Card className="glass">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Şrift ölçüsü</CardTitle>
        </CardHeader>
        <CardContent>
          <select className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
            <option>Avto</option>
            <option>Kiçik</option>
            <option>Orta</option>
            <option>Böyük</option>
          </select>
        </CardContent>
      </Card>

      <Card className="glass">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Sidebar</CardTitle>
        </CardHeader>
        <CardContent>
          <ToggleRow title="Default açıq saxla" enabled={false} />
        </CardContent>
      </Card>
    </div>
  );
}

function AktivlikTab({ profile }: { profile: Profile }) {
  return (
    <div className="space-y-4">
      <Card className="glass">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Son aktivlik</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <FieldDisplay label="Hesab yaradıldı" value={formatDate(profile.yaradildi)} />
            <FieldDisplay label="Son giriş" value={formatDate(profile.son_giris)} />
            <FieldDisplay label="Cəmi sessiya (30 gün)" value="—" />
            <FieldDisplay label="Status" value="Aktiv" />
          </div>
        </CardContent>
      </Card>

      <Card className="glass border-rose-500/30">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base text-rose-500">
            <LogOut className="h-4 w-4" /> Hesabdan çıxış
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-sm text-muted-foreground">
            Bu qurğudan çıx. Digər qurğulardakı sessiyalar saxlanılır.
          </p>
          <Link
            href="/api/auth/signout"
            className="inline-flex items-center gap-1.5 rounded-md bg-rose-600 px-3 py-2 text-xs font-semibold text-white hover:bg-rose-700"
          >
            <LogOut className="h-3.5 w-3.5" /> Çıxış
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}

function FieldDisplay({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="flex items-start gap-2">
      {Icon && <Icon className="mt-0.5 h-3.5 w-3.5 text-muted-foreground" />}
      <div className="min-w-0">
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="text-sm">{value}</div>
      </div>
    </div>
  );
}

function ToggleRow({ title, enabled }: { title: string; enabled: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border/50 px-3 py-2.5">
      <span className="text-sm font-semibold">{title}</span>
      <div
        className={cn(
          "inline-flex h-5 w-9 shrink-0 items-center rounded-full",
          enabled ? "bg-emerald-500" : "bg-muted"
        )}
      >
        <span
          className={cn(
            "ml-0.5 inline-block h-4 w-4 rounded-full bg-white shadow",
            enabled ? "translate-x-4" : "translate-x-0"
          )}
        />
      </div>
    </div>
  );
}

function SecurityRow({
  icon: Icon,
  title,
  description,
  action,
  warn,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  action: string;
  warn?: boolean;
}) {
  return (
    <Card className={cn("glass", warn && "border-amber-500/30")}>
      <CardContent className="flex items-start justify-between gap-3 py-3">
        <div className="flex items-start gap-2.5">
          <Icon className={cn("mt-0.5 h-4 w-4", warn ? "text-amber-500" : "text-muted-foreground")} />
          <div>
            <div className="text-sm font-semibold">{title}</div>
            <div className="text-xs text-muted-foreground">{description}</div>
          </div>
        </div>
        <button
          type="button"
          className="shrink-0 rounded-md border border-border bg-secondary px-2.5 py-1 text-xs font-semibold transition hover:bg-secondary/70"
        >
          {action}
        </button>
      </CardContent>
    </Card>
  );
}

function ThemeBtn({ name, sample }: { name: string; sample: string }) {
  return (
    <button
      type="button"
      className={cn(
        "flex flex-col items-center gap-2 rounded-xl border border-border/40 p-3 transition hover:border-primary/40",
      )}
    >
      <div className={cn("h-12 w-full rounded-md", sample)} />
      <span className="text-xs font-semibold">{name}</span>
    </button>
  );
}

function langLabel(d: string) {
  const map: Record<string, string> = { az: "Azərbaycan", en: "English", ru: "Русский", tr: "Türkçe" };
  return map[d] ?? d;
}
