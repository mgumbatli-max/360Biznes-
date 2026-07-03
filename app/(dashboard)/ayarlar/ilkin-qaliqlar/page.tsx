import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowLeft,
  PlayCircle,
  Wallet,
  Building2,
  Users,
  Truck,
  Boxes,
  TrendingDown,
  TrendingUp,
  CheckCircle2,
  Lock,
  AlertCircle,
  Banknote,
  CreditCard,
  Coins,
  Download,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { getIlkinQaliqStats } from "@/features/ayar/queries";
import { cn, formatMoney } from "@/lib/utils";

export const metadata: Metadata = { title: "İlkin qalıqlar" };

const STEPS = [
  { key: "kassa", label: "Kassa & Bank qalıqları", icon: Wallet },
  { key: "musteri", label: "Müştəri borcları (debitor)", icon: Users },
  { key: "techizatci", label: "Təchizatçı borcları (kreditor)", icon: Truck },
  { key: "stok", label: "İlkin stok", icon: Boxes },
  { key: "menfeet", label: "Mənfəət və xərc", icon: TrendingUp },
  { key: "yekun", label: "Yekun və qoruma", icon: CheckCircle2 },
] as const;

type SearchParams = Promise<{ step?: string }>;

export default async function IlkinQaliqlarPage({ searchParams }: { searchParams: SearchParams }) {
  const { step: stepParam } = await searchParams;
  const step = (stepParam ?? "kassa") as (typeof STEPS)[number]["key"];
  const stats = await getIlkinQaliqStats();

  const stepIndex = STEPS.findIndex((s) => s.key === step);

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-secondary text-primary">
            <PlayCircle className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">İlkin qalıqlar</h1>
            <p className="text-sm text-muted-foreground">
              Sistemə keçidə qədər olan biznes vəziyyətini daxil et: pul, borc, stok, P&L
            </p>
          </div>
        </div>
        <Badge variant="outline" className="text-[10px] text-amber-500">
          <Lock className="mr-1 h-3 w-3" /> Hələ qorunmayıb
        </Badge>
      </header>


      <Card className="glass border-primary/30 bg-primary/5">
        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div className="space-y-1 text-sm">
              <p className="font-semibold">
                Niyə ilkin qalıqlar vacibdir?
              </p>
              <p className="text-muted-foreground">
                Sistemə yeni keçirsiniz — köhnə proqramda (yaxud kağızda) olan vəziyyəti bura yazsaq, hesabatlar
                ilk gündən düzgün başlayacaq. Yoxsa kassa balansı 0-dan, müştəri borcları sıfırdan görsəniləcək.
              </p>
              <p className="text-muted-foreground">
                Hər mərhələni doldurun və sonda «Qoru və başlat» düyməsi ilə təsdiqləyin. Təsdiqdən sonra
                ilkin qalıqlar avtomatik «opening balance» əməliyyatı kimi yazılır və hesabatda «01.01.20XX
                tarixində ilkin qalıq» kimi görünür.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <ProgressBar steps={STEPS as readonly { key: string; label: string }[]} activeIdx={stepIndex} />

      {step === "kassa" && <KassaStep stats={stats} />}
      {step === "musteri" && <MusteriStep stats={stats} />}
      {step === "techizatci" && <TechizatciStep stats={stats} />}
      {step === "stok" && <StokStep stats={stats} />}
      {step === "menfeet" && <MenfeetStep />}
      {step === "yekun" && <YekunStep stats={stats} />}

      <div className="flex items-center justify-between border-t border-border/40 pt-4">
        {stepIndex > 0 ? (
          <Link
            href={`?step=${STEPS[stepIndex - 1].key}`}
            scroll={false}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-secondary px-3 py-2 text-xs font-semibold hover:bg-secondary/70"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> {STEPS[stepIndex - 1].label}
          </Link>
        ) : (
          <span />
        )}
        {stepIndex < STEPS.length - 1 && (
          <Link
            href={`?step=${STEPS[stepIndex + 1].key}`}
            scroll={false}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
          >
            Növbəti: {STEPS[stepIndex + 1].label} →
          </Link>
        )}
      </div>
    </div>
  );
}

function ProgressBar({
  steps,
  activeIdx,
}: {
  steps: readonly { key: string; label: string }[];
  activeIdx: number;
}) {
  return (
    <nav className="flex flex-wrap items-center gap-2">
      {steps.map((s, i) => {
        const active = i === activeIdx;
        const done = i < activeIdx;
        return (
          <Link
            key={s.key}
            href={`?step=${s.key}`}
            scroll={false}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition",
              active
                ? "bg-primary text-primary-foreground"
                : done
                ? "bg-emerald-500/15 text-emerald-600"
                : "bg-secondary text-muted-foreground hover:bg-secondary/70"
            )}
          >
            <span
              className={cn(
                "grid h-5 w-5 place-items-center rounded-full text-[10px] font-bold",
                active ? "bg-white/20" : done ? "bg-emerald-500/20" : "bg-background"
              )}
            >
              {done ? "✓" : i + 1}
            </span>
            <span className="hidden sm:inline">{s.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function KassaStep({ stats }: { stats: Awaited<ReturnType<typeof getIlkinQaliqStats>> }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <StatPill label="Cəmi nağd kassa" value={formatMoney(stats.negdQaliq)} icon={Banknote} />
        <StatPill label="Cəmi bank/kart" value={formatMoney(stats.bankQaliq)} icon={CreditCard} />
        <StatPill label="Ümumi qalıq" value={formatMoney(stats.umumiQaliq)} icon={Coins} tone="primary" />
      </div>

      <Card className="glass">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Hesab qalıqları</CardTitle>
        </CardHeader>
        <CardContent>
          {stats.hesablar.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
              Heç bir maliyyə hesabı yoxdur. <Link className="text-primary hover:underline" href="/ayarlar/bank">Bank hesabı yarat</Link>.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border/40">
              <table className="w-full text-sm">
                <thead className="text-[10.5px] uppercase tracking-wider text-muted-foreground">
                  <tr className="border-b border-border/40 text-left">
                    <th className="px-3 py-2">Hesab adı</th>
                    <th className="px-3 py-2">Növ</th>
                    <th className="px-3 py-2">IBAN/Bank</th>
                    <th className="px-3 py-2">Valyuta</th>
                    <th className="px-3 py-2 text-right">İlkin qalıq</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.hesablar.map((h) => (
                    <tr key={h.id} className="border-b border-border/30">
                      <td className="px-3 py-2 font-semibold">{h.ad}</td>
                      <td className="px-3 py-2">
                        <Badge variant="outline" className="text-[10px] capitalize">{h.nov}</Badge>
                      </td>
                      <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                        {h.iban ?? h.bank_adi ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-xs">{h.valyuta}</td>
                      <td className="px-3 py-2">
                        <Input
                          type="number"
                          step="0.01"
                          defaultValue={Number(h.qaliq ?? 0).toFixed(2)}
                          className="h-8 w-32 text-right tabular-nums"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="mt-3 flex items-center justify-between gap-2">
            <Link
              href="/ayarlar/bank"
              className="text-xs font-semibold text-primary hover:underline"
            >
              + Yeni hesab əlavə et
            </Link>
            <button className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90">
              Qalıqları saxla
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function MusteriStep({ stats }: { stats: Awaited<ReturnType<typeof getIlkinQaliqStats>> }) {
  return (
    <Card className="glass">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Müştəri borcları (Debitor)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
          Hal-hazırda sizə pul borclu olan müştəriləri burada qeyd edin. Sistemə daxil etdikdə bu borclar
          «Açıq qaiməsi var» kimi görünəcək və borc hesabatı düzgün başlayacaq.
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <StatPill label="Sistemdə müştəri" value={String(stats.musteriSayi)} icon={Users} />
          <StatPill label="Borc məbləği" value="—" icon={TrendingDown} tone="warn" />
          <StatPill label="Borclu müştəri sayı" value="0" icon={Users} />
        </div>

        <div className="rounded-lg border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
          <p>Borclu müştəriləri əl ilə əlavə edin və ya Excel ilə yükləyin</p>
          <div className="mt-3 flex items-center justify-center gap-2">
            <button className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90">
              + Müştəri borcu əlavə et
            </button>
            <Link
              href="/ayarlar/inteqrasiya?tab=musteri-borc"
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-secondary px-3 py-1.5 text-xs font-semibold hover:bg-secondary/70"
            >
              <Download className="h-3 w-3" /> Excel şablon
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function TechizatciStep({ stats }: { stats: Awaited<ReturnType<typeof getIlkinQaliqStats>> }) {
  return (
    <Card className="glass">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Təchizatçı borcları (Kreditor)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
          Sizin təchizatçılara borcunuzu burada qeyd edin. Sistem keçidində «Ödənilməmiş alış qaimələri»
          siyahısı düzgün görünəcək.
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <StatPill label="Sistemdə təchizatçı" value={String(stats.techizatciSayi)} icon={Truck} />
          <StatPill label="Borc məbləği" value="—" icon={TrendingDown} tone="warn" />
          <StatPill label="Borclu təchizatçı" value="0" icon={Truck} />
        </div>

        <div className="rounded-lg border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
          <p>Təchizatçı borcunu əl ilə əlavə edin və ya Excel ilə yükləyin</p>
          <div className="mt-3 flex items-center justify-center gap-2">
            <button className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90">
              + Təchizatçı borcu əlavə et
            </button>
            <Link
              href="/ayarlar/inteqrasiya?tab=techizatci-borc"
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-secondary px-3 py-1.5 text-xs font-semibold hover:bg-secondary/70"
            >
              <Download className="h-3 w-3" /> Excel şablon
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function StokStep({ stats }: { stats: Awaited<ReturnType<typeof getIlkinQaliqStats>> }) {
  return (
    <Card className="glass">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">İlkin stok</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <StatPill label="Sistemdə məhsul" value={String(stats.mehsulSayi)} icon={Boxes} />
          <StatPill label="Cəmi stok miqdarı" value={String(stats.stokMiqdar)} icon={Boxes} tone="primary" />
          <StatPill label="Maya dəyəri" value="—" icon={Coins} />
        </div>

        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
          Anbarınızda olan məhsulları və miqdarları daxil edin. Maya qiyməti hesabatlar üçün vacibdir.
        </div>

        <div className="rounded-lg border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
          <p className="mb-3">Stok yükləmə üsulu seçin:</p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Link
              href="/ayarlar/inteqrasiya?tab=mehsul"
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
            >
              <Download className="h-3 w-3" /> Məhsul şablonu yüklə
            </Link>
            <Link
              href="/ayarlar/inteqrasiya?tab=stok"
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-secondary px-3 py-1.5 text-xs font-semibold hover:bg-secondary/70"
            >
              <Download className="h-3 w-3" /> Stok cədvəli
            </Link>
            <Link
              href="/anbar/inventar"
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-secondary px-3 py-1.5 text-xs font-semibold hover:bg-secondary/70"
            >
              Sayım aç (manual)
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function MenfeetStep() {
  return (
    <div className="space-y-4">
      <Card className="glass">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">İlkin mənfəət/xərc baseline (opsional)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
            Köhnə proqramdan keçidə qədər olan illik mənfəət, xərc və satışı qeyd edə bilərsiniz. Bu məlumat
            müqayisəli hesabat üçün istifadə olunur («keçən il bu vaxt» göstəricisi).
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FieldGroup label="Keçən il ümumi satış (₼)" placeholder="0.00" />
            <FieldGroup label="Keçən il ümumi xərc (₼)" placeholder="0.00" />
            <FieldGroup label="Keçən il əmək haqqı (₼)" placeholder="0.00" />
            <FieldGroup label="Keçən il vergi (₼)" placeholder="0.00" />
            <FieldGroup label="Keçən il satış sayı" placeholder="0" type="number" />
            <FieldGroup label="Keçən il müştəri sayı" placeholder="0" type="number" />
          </div>
        </CardContent>
      </Card>

      <Card className="glass">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Açılış tarixi və mühasibat dövrü</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FieldGroup label="İlkin qalıq tarixi" type="date" defaultValue={new Date().toISOString().slice(0, 10)} hint="Hesabatlar bu tarixdən başlayacaq" />
            <FieldGroup label="Mühasibat dövrü başlanğıcı" type="date" defaultValue={`${new Date().getFullYear()}-01-01`} hint="İllik hesabat dövrünün başlama tarixi" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function YekunStep({ stats }: { stats: Awaited<ReturnType<typeof getIlkinQaliqStats>> }) {
  const checklist = [
    { label: "Kassa/bank qalıqları", filled: stats.umumiQaliq > 0, value: formatMoney(stats.umumiQaliq) },
    { label: "Müştəri borcları (debitor)", filled: false, value: "Doldurulmayıb" },
    { label: "Təchizatçı borcları (kreditor)", filled: false, value: "Doldurulmayıb" },
    { label: "İlkin stok", filled: stats.stokMiqdar > 0, value: `${stats.stokMiqdar} ədəd` },
    { label: "Mənfəət/xərc baseline", filled: false, value: "Doldurulmayıb (opsional)" },
  ];

  const completed = checklist.filter((c) => c.filled).length;

  return (
    <div className="space-y-4">
      <Card className="glass">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Yoxlama siyahısı</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-3 flex items-center gap-3">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full transition-all"
                style={{ width: `${(completed / checklist.length) * 100}%`, background: "var(--brand-gradient)" }}
              />
            </div>
            <span className="text-xs font-semibold tabular-nums">
              {completed}/{checklist.length}
            </span>
          </div>
          <ul className="space-y-2">
            {checklist.map((c) => (
              <li key={c.label} className="flex items-center gap-2 text-sm">
                {c.filled ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-amber-500" />
                )}
                <span className="flex-1">{c.label}</span>
                <span className={cn("text-xs tabular-nums", c.filled ? "text-emerald-600" : "text-muted-foreground")}>
                  {c.value}
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card className="glass border-emerald-500/30">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base text-emerald-600">
            <Lock className="h-4 w-4" /> İlkin qalıqları qoru
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Təsdiq etdikdən sonra ilkin qalıqlar «opening balance» əməliyyatı kimi yazılır və artıq dəyişdirilməz.
            Yenidən redaktə üçün admin icazəsi tələb olunur.
          </p>
          <ul className="space-y-1.5 text-sm">
            <li className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
              <span>Audit log-a yazılır</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
              <span>Hər hesab üçün «Açılış mərhələsi» kassa orderi avto yaradılır</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
              <span>Hesabatlar bu tarixdən hesablanır</span>
            </li>
          </ul>
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
            <Link
              href="?step=kassa"
              scroll={false}
              className="rounded-md border border-border bg-secondary px-3 py-2 text-xs font-semibold hover:bg-secondary/70"
            >
              Geri qayıt və düzəlt
            </Link>
            <button className="rounded-md bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700">
              ✓ Təsdiqlə və başlat
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function StatPill({
  label,
  value,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  tone?: "default" | "primary" | "warn";
}) {
  return (
    <div className="glass flex items-center gap-3 rounded-xl border border-border/40 px-3 py-3">
      <div
        className={cn(
          "grid h-9 w-9 shrink-0 place-items-center rounded-lg",
          tone === "primary"
            ? "bg-primary/10 text-primary"
            : tone === "warn"
            ? "bg-amber-500/10 text-amber-500"
            : "bg-secondary text-muted-foreground"
        )}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="text-lg font-bold tabular-nums">{value}</div>
      </div>
    </div>
  );
}

function FieldGroup({
  label,
  placeholder,
  type = "text",
  hint,
  defaultValue,
}: {
  label: string;
  placeholder?: string;
  type?: string;
  hint?: string;
  defaultValue?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </label>
      <Input type={type} placeholder={placeholder} defaultValue={defaultValue} />
      {hint && <div className="mt-0.5 text-[11px] text-muted-foreground">{hint}</div>}
    </div>
  );
}
