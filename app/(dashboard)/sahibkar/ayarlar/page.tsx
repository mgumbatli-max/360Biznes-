import type { Metadata } from "next";
import { Settings, EyeOff, Eye, Clock, KeyRound, ShieldCheck, History as HistoryIcon, ShieldOff, Lock, Mail, BadgeCheck, BadgeX } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireSahibkarSession } from "@/lib/sahibkar/guard";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { toggleSahibkarSetting, updateSessionTimeout, updateSecretCode, updateRecoveryEmail, changePin } from "@/features/sahibkar/settings-actions";
import { DEFAULT_SECRET_CODE } from "@/features/sahibkar/constants";
import { SectionExplainer } from "@/features/sahibkar/components/section-explainer";

export const metadata: Metadata = { title: "Sahibkar ayarları" };

async function loadConfig() {
  return withTenant(async () => {
    const cfg = await prisma.sahibkar_ayar.findFirst();
    return {
      sidebar_gorunsun: cfg?.sidebar_gorunsun !== false,
      qoruma_aktiv: cfg?.qoruma_aktiv !== false,
      audit_log: cfg?.audit_log !== false,
      sessiya_muddet: cfg?.sessiya_muddet ?? 15,
      yanlis_limit: cfg?.yanlis_limit ?? 5,
      has_pin: !!cfg?.sifre_hash,
      has_secret: !!cfg?.gizli_kod_hash,
      berpa_email: cfg?.berpa_email ?? "",
      berpa_email_tesdiq: cfg?.berpa_email_tesdiq ?? false,
      updated: cfg?.yenilendi ?? cfg?.yaradildi ?? null,
    };
  });
}

export default async function SahibkarAyarlarPage() {
  await requireSahibkarSession();
  const cfg = await loadConfig();

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <header className="flex items-start gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-slate-500 to-zinc-500">
          <Settings className="h-5 w-5 text-white" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">Sahibkar ayarları</h1>
            <Badge variant="outline" className="border-rose-500/30 bg-rose-500/10 text-[10px] text-rose-500">
              <Lock className="mr-1 h-2.5 w-2.5" />
              Məxfi
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Bu bölmənin görünüşü, giriş kodu, sessiya müddəti və audit log konfiqurasiyası.
          </p>
        </div>
      </header>

      <SectionExplainer
        icon={Settings}
        tone="slate"
        description="Sahibkar bölməsinin əsas konfiqurasiyası burada cəmlənir. Sidebar-da görünüş, PIN, gizli kod (panika rejimi), sessiya müddəti (avto-kilid), yanlış cəhd limiti, bərpa email və audit log toggle."
        bullets={[
          { label: "Sessiya", text: `${cfg.sessiya_muddet} dəq (boş qalanda kilid)` },
          { label: "Cəhd limiti", text: `${cfg.yanlis_limit} → lockout` },
          { label: "Audit", text: cfg.audit_log ? "aktiv" : "söndürülüb" },
        ]}
      />

      {/* Visibility toggle */}
      <Card className="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            {cfg.sidebar_gorunsun ? <Eye className="h-4 w-4 text-emerald-500" /> : <EyeOff className="h-4 w-4 text-rose-500" />}
            Sidebar görünüşü
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className={`rounded-lg border p-3 text-sm ${cfg.sidebar_gorunsun ? "border-emerald-500/30 bg-emerald-500/5" : "border-rose-500/30 bg-rose-500/5"}`}>
            {cfg.sidebar_gorunsun ? (
              <>
                <strong className="text-emerald-500">Görünür</strong> — sahibkar bölməsi sidebar-da nümayiş olunur. İstənilən vaxt PIN ilə daxil ola bilərsiniz.
              </>
            ) : (
              <>
                <strong className="text-rose-500">Gizli</strong> — sidebar-dan tam silinib. Bölməyə yalnız axtarış (⌘K) çubuğunda{" "}
                <code className="rounded bg-secondary/60 px-1 font-mono">{DEFAULT_SECRET_CODE}</code> (və ya öz kodunuzla) daxil olmaqla çıxa bilərsiniz.
              </>
            )}
          </div>

          <form action={async (fd: FormData) => {
            "use server";
            fd.set("sidebar_gorunsun", cfg.sidebar_gorunsun ? "0" : "1");
            await toggleSahibkarSetting(fd);
          }}>
            <Button type="submit" variant={cfg.sidebar_gorunsun ? "outline" : "default"}>
              {cfg.sidebar_gorunsun ? <><EyeOff className="h-3.5 w-3.5" /> Sidebar-dan gizlət</> : <><Eye className="h-3.5 w-3.5" /> Sidebar-da göstər</>}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Session timeout */}
      <Card className="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="h-4 w-4 text-primary" />
            Sessiya müddəti
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form
            action={async (fd: FormData) => {
              "use server";
              await updateSessionTimeout(fd);
            }}
            className="space-y-3"
          >
            <p className="text-xs text-muted-foreground">
              Aktivlik olmayanda neçə dəqiqə sonra avto-kilid olsun. (1-120 dəq)
            </p>
            <div className="flex items-center gap-3">
              <input
                type="number"
                name="sessiya_muddet"
                defaultValue={cfg.sessiya_muddet}
                min={1}
                max={120}
                className="h-10 w-32 rounded-md border border-border bg-background px-3 text-lg font-bold tabular-nums"
              />
              <span className="text-sm text-muted-foreground">dəqiqə</span>
              <Button type="submit" size="sm">Yadda saxla</Button>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {[5, 15, 30, 60].map((m) => (
                <a
                  key={m}
                  href={`?prefill=${m}`}
                  className="rounded-md border border-border bg-card px-2 py-1.5 text-center text-xs hover:bg-secondary"
                >
                  {m} dəq
                </a>
              ))}
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Secret search code */}
      <Card className="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <KeyRound className="h-4 w-4 text-amber-500" />
            Axtarış kodu (gizli giriş)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-xs text-muted-foreground">
            Bu kod sayəsində sidebar gizli olsa belə, axtarış çubuğuna (⌘K) yazaraq sahibkar bölməsinə daxil ola bilərsiniz.
            Default kod: <code className="rounded bg-secondary/60 px-1 font-mono text-foreground">{DEFAULT_SECRET_CODE}</code>
            {cfg.has_secret ? " — siz öz kodunuzu qurmusunuz." : " — hələ də bu istifadə olunur."}
          </p>
          <form
            action={async (fd: FormData) => {
              "use server";
              await updateSecretCode(fd);
            }}
            className="grid grid-cols-1 gap-3 md:grid-cols-2"
          >
            <div>
              <label className="text-xs text-muted-foreground">Yeni kod (3-12 rəqəm)</label>
              <input
                type="password"
                name="yeni_kod"
                inputMode="numeric"
                autoComplete="new-password"
                className="mt-1 h-10 w-full rounded-md border border-border bg-background px-3 font-mono tabular-nums"
                placeholder="məs. 9182"
                required
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Təkrar</label>
              <input
                type="password"
                name="yeni_kod_tekrar"
                inputMode="numeric"
                autoComplete="new-password"
                className="mt-1 h-10 w-full rounded-md border border-border bg-background px-3 font-mono tabular-nums"
                required
              />
            </div>
            <div className="md:col-span-2">
              <Button type="submit" variant="default">Kodu yenilə</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Recovery email */}
      <Card className="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Mail className="h-4 w-4 text-sky-500" />
            Bərpa email
            {cfg.berpa_email && (
              cfg.berpa_email_tesdiq ? (
                <span className="ml-2 inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-500">
                  <BadgeCheck className="h-2.5 w-2.5" />
                  Təsdiqlənib
                </span>
              ) : (
                <span className="ml-2 inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-500">
                  <BadgeX className="h-2.5 w-2.5" />
                  Təsdiq gözləyir
                </span>
              )
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-xs text-muted-foreground">
            PIN unutsanız, bu email-ə bərpa kodu göndərilir. Yalnız sizə məlum email seçin.
          </p>
          <form
            action={async (fd: FormData) => {
              "use server";
              await updateRecoveryEmail(fd);
            }}
            className="flex items-end gap-2"
          >
            <div className="flex-1">
              <label className="text-xs text-muted-foreground">Email</label>
              <input
                type="email"
                name="berpa_email"
                defaultValue={cfg.berpa_email}
                placeholder="example@mail.com"
                maxLength={255}
                className="mt-1 h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
              />
            </div>
            <Button type="submit">Yadda saxla</Button>
          </form>
        </CardContent>
      </Card>

      {/* PIN change */}
      <Card className="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="h-4 w-4 text-emerald-500" />
            PIN dəyişdir
            <span className="ml-2 text-[10px] font-normal text-muted-foreground">
              ({cfg.yanlis_limit} cəhddən sonra 5 dəq lockout)
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form
            action={async (fd: FormData) => {
              "use server";
              await changePin(fd);
            }}
            className="grid grid-cols-1 gap-3 md:grid-cols-3"
          >
            <div>
              <label className="text-xs text-muted-foreground">Köhnə PIN</label>
              <input type="password" name="kohne_pin" inputMode="numeric" className="mt-1 h-10 w-full rounded-md border border-border bg-background px-3 font-mono tabular-nums" required />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Yeni PIN</label>
              <input type="password" name="yeni_pin" inputMode="numeric" className="mt-1 h-10 w-full rounded-md border border-border bg-background px-3 font-mono tabular-nums" required />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Təkrar</label>
              <input type="password" name="yeni_pin_tekrar" inputMode="numeric" className="mt-1 h-10 w-full rounded-md border border-border bg-background px-3 font-mono tabular-nums" required />
            </div>
            <div className="md:col-span-3">
              <Button type="submit">PIN yenilə</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Audit log toggle */}
      <Card className="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <HistoryIcon className="h-4 w-4 text-violet-500" />
            Audit log
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Aktivləşdirildikdə hər əməliyyat (məhsul dəyişikliyi, kimin nə vaxt nə etdiyi) detallı yazılır.
            Tövsiyə olunur — daim aktiv saxlayın.
          </p>
          <form
            action={async (fd: FormData) => {
              "use server";
              fd.set("audit_log", cfg.audit_log ? "0" : "1");
              await toggleSahibkarSetting(fd);
            }}
          >
            <Button type="submit" variant={cfg.audit_log ? "outline" : "default"}>
              {cfg.audit_log ? <><ShieldOff className="h-3.5 w-3.5" /> Audit-i söndür</> : <><ShieldCheck className="h-3.5 w-3.5" /> Audit-i aktivləşdir</>}
            </Button>
            <span className={`ml-3 text-xs font-semibold ${cfg.audit_log ? "text-emerald-500" : "text-rose-500"}`}>
              ● {cfg.audit_log ? "Aktivdir" : "Söndürülüb"}
            </span>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
