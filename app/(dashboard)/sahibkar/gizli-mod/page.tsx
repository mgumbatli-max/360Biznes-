import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { EyeOff, Eye, ShieldAlert, Info, KeyRound } from "lucide-react";
import { BackButton } from "@/components/ui/back-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getSahibkarState } from "@/lib/sahibkar/guard";
import { getStealthState } from "@/lib/stealth/server";
import { setStealthMode } from "@/lib/stealth/actions";

export const metadata: Metadata = { title: "Gizli mod" };

export default async function GizliModPage() {
  const state = await getSahibkarState();
  if (state === "needs-setup") redirect("/sahibkar/setup");
  if (state === "needs-verify") redirect("/sahibkar/verify");
  if (state !== "ready") redirect("/dashboard");

  const stealth = await getStealthState();

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <header className="flex items-start gap-3">
        <BackButton fallback="/sahibkar" className="mt-1" />
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <EyeOff className="h-5 w-5 text-violet-500" />
            Gizli mod
          </h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Sistemin bütün ekranlarındakı rəqəmlər müvəqqəti olaraq kiçildilərək göstərilir.
            Dost, rəqib və ya təsadüfi şəxs ekranına baxsa real rəqəmləri görmür.
          </p>
        </div>
      </header>

      {/* Cari vəziyyət */}
      <Card className={stealth.aktiv ? "glass border-violet-500/40 bg-violet-500/10" : "glass"}>
        <CardContent className="flex items-center justify-between gap-3 py-4">
          <div className="flex items-center gap-3">
            <div className={`grid h-12 w-12 place-items-center rounded-xl ${stealth.aktiv ? "bg-violet-500 text-white" : "bg-secondary text-muted-foreground"}`}>
              {stealth.aktiv ? <EyeOff className="h-6 w-6" /> : <Eye className="h-6 w-6" />}
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Cari vəziyyət</div>
              <div className="text-xl font-bold">
                {stealth.aktiv ? `🔒 Aktiv (${Math.round(stealth.scale * 100)}% göstərilir)` : "Söndürülüb"}
              </div>
            </div>
          </div>
          {stealth.aktiv && (
            <form action={async (fd: FormData) => { "use server"; await setStealthMode(fd); }}>
              <input type="hidden" name="action" value="off" />
              <PinInputCompact label="Söndür" />
            </form>
          )}
        </CardContent>
      </Card>

      {/* Necə işləyir */}
      <Card className="glass border-sky-500/30 bg-sky-500/5">
        <CardContent className="space-y-2 py-4 text-[12px]">
          <div className="flex items-center gap-2 font-bold text-foreground">
            <Info className="h-4 w-4 text-sky-600" />
            Necə işləyir?
          </div>
          <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
            <li>
              <strong className="text-foreground">Real data heç vaxt dəyişmir.</strong>{" "}
              DB-də həqiqi rəqəmlər saxlanır. Bu yalnız <em>ekran görüntüsü</em> dəyişdirir.
            </li>
            <li>
              Aktiv olduqda <strong className="text-foreground">bütün modulu</strong> (satış, borc, kassa, KPI, hesabat) əhatə edir.
            </li>
            <li>
              <strong className="text-foreground">Excel eksport</strong>, <strong className="text-foreground">bank uzlaşma</strong>, <strong className="text-foreground">vergi hesabatı</strong>{" "}
              həmişə <strong>real</strong> rəqəm verir — yalnız ekran maskalanır.
            </li>
            <li>
              Hər ekranda <strong className="text-foreground">🔒 banner</strong> görünür ki, sahibkar səhv etməsin.
            </li>
            <li>
              <strong className="text-foreground">Avto-söndürülmə:</strong> 12 saatdan sonra avtomatik söndürülür.
            </li>
            <li>
              <strong className="text-foreground">PIN tələbi:</strong> Aktivləşdirmə və söndürmə üçün sahibkar PIN-i tələb olunur.
            </li>
          </ul>
        </CardContent>
      </Card>

      {/* Aktivləşdir form */}
      {!stealth.aktiv && (
        <Card className="glass">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldAlert className="h-4 w-4 text-violet-500" />
              Gizli modu aktivləşdir
            </CardTitle>
            <p className="text-[11px] text-muted-foreground">
              Hər ekranda rəqəmlər seçdiyin scale ilə kiçildiləcək.
            </p>
          </CardHeader>
          <CardContent>
            <form action={async (fd: FormData) => { "use server"; await setStealthMode(fd); }} className="space-y-4">
              <input type="hidden" name="action" value="on" />

              {/* Scale seçimi */}
              <div>
                <label className="text-xs font-semibold">Göstərmə nisbəti</label>
                <div className="mt-1 grid grid-cols-4 gap-1.5">
                  {[
                    { v: 0.1, label: "10%", desc: "Çox az" },
                    { v: 0.2, label: "20%", desc: "Standard" },
                    { v: 0.5, label: "50%", desc: "Yarı" },
                    { v: 0.7, label: "70%", desc: "Az fərq" },
                  ].map((opt) => (
                    <label
                      key={opt.v}
                      className="flex cursor-pointer flex-col rounded-md border border-border bg-card px-2 py-2 text-center hover:border-primary/40 has-[:checked]:border-primary has-[:checked]:bg-primary/10"
                    >
                      <input
                        type="radio"
                        name="scale"
                        value={opt.v}
                        defaultChecked={opt.v === 0.2}
                        className="sr-only"
                      />
                      <span className="text-base font-bold">{opt.label}</span>
                      <span className="text-[9.5px] text-muted-foreground">{opt.desc}</span>
                    </label>
                  ))}
                </div>
                <p className="mt-1 text-[10.5px] text-muted-foreground">
                  Misal: 20% seçilsə 50,000 ₼ satış → 10,000 ₼ kimi görsənir
                </p>
              </div>

              {/* PIN */}
              <div>
                <label className="text-xs font-semibold">Sahibkar PIN</label>
                <input
                  type="password"
                  name="pin"
                  placeholder="••••"
                  className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm tracking-widest"
                  required
                  autoComplete="off"
                />
                <p className="mt-1 inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                  <KeyRound className="h-2.5 w-2.5" />
                  Sahibkar səhifəsinə daxil olduğun eyni PIN
                </p>
              </div>

              <button
                type="submit"
                className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-violet-600 px-4 text-sm font-bold text-white hover:bg-violet-700"
              >
                <EyeOff className="h-4 w-4" />
                Gizli modu aktivləşdir
              </button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Nələri əhatə etmir */}
      <Card className="glass border-amber-500/30 bg-amber-500/5">
        <CardContent className="space-y-1.5 py-3 text-[11px]">
          <div className="flex items-center gap-2 font-bold text-foreground">
            <ShieldAlert className="h-4 w-4 text-amber-500" />
            ⚠ Diqqət — nələri əhatə etmir
          </div>
          <p className="text-muted-foreground">
            Bu funksiya yalnız <strong>vizual qoruma</strong>dır. Aşağıdakı yerlərdə{" "}
            <strong className="text-foreground">real rəqəm</strong> görünə bilər:
          </p>
          <ul className="list-disc space-y-0.5 pl-5 text-muted-foreground">
            <li>Excel / CSV eksport edilən fayllar</li>
            <li>Çap edilən qaimələr və çeklər</li>
            <li>Vergi və bank inteqrasiyası</li>
            <li>Audit log və sənəd arxivi</li>
            <li>Mobil push bildirişlər</li>
          </ul>
          <p className="text-muted-foreground">
            Real qoruma üçün <strong>fiziki cihaz təhlükəsizliyini</strong> də nəzərdə tut — ekran kilidi, sessiya çıxış və s.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function PinInputCompact({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="password"
        name="pin"
        placeholder="PIN"
        className="h-9 w-24 rounded-md border border-input bg-background px-2 text-sm tracking-widest"
        required
      />
      <button
        type="submit"
        className="inline-flex h-9 items-center gap-1 rounded-md bg-rose-500/15 px-3 text-xs font-bold text-rose-600 hover:bg-rose-500/25 dark:text-rose-400"
      >
        <Eye className="h-3 w-3" />
        {label}
      </button>
    </div>
  );
}
