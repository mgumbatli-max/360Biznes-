"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  User,
  Briefcase,
  FileText,
  Lock,
  CheckCircle,
  Loader2,
  ArrowLeft,
  ArrowRight,
  Sparkles,
  Upload,
  Mail,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { completeOnboarding } from "../hr-actions";
import type { FilialOpt, RoleOpt } from "../types";

const STEPS = [
  { key: "personal", label: "Şəxsi məlumat", icon: User },
  { key: "work", label: "İş", icon: Briefcase },
  { key: "docs", label: "Sənədlər", icon: FileText },
  { key: "system", label: "Sistem girişi", icon: Lock },
  { key: "review", label: "Yoxlama", icon: CheckCircle },
];

const CHECKLIST = [
  "Müqavilə imzala",
  "ID kart verilməsi",
  "Sistem girişi və hesab",
  "İlk gün treninqi",
  "Avadanlıq verilməsi",
];

export function OnboardingWizard({
  roles,
  filiallar,
}: {
  roles: RoleOpt[];
  filiallar: FilialOpt[];
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Personal
  const [adSoyad, setAdSoyad] = useState("");
  const [finKod, setFinKod] = useState("");
  const [dogum, setDogum] = useState("");
  const [telefon, setTelefon] = useState("");
  const [unvan, setUnvan] = useState("");

  // Work
  const [vezife, setVezife] = useState("");
  const [filialId, setFilialId] = useState("");
  const [aylikMaas, setAylikMaas] = useState("0");
  const [iseBaslama, setIseBaslama] = useState(new Date().toISOString().slice(0, 10));
  const [kontraktNov, setKontraktNov] = useState("daimi");

  // Docs (mock — actual upload uses documents-actions later)
  const [docFiles, setDocFiles] = useState<string[]>([]);

  // System
  const [email, setEmail] = useState("");
  const [sifre, setSifre] = useState("");
  const [rolId, setRolId] = useState<string>(String(roles[0]?.id ?? 3));

  function genPassword() {
    const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#";
    let pwd = "";
    for (let i = 0; i < 10; i++) pwd += chars[Math.floor(Math.random() * chars.length)];
    setSifre(pwd);
    toast.message("Şifrə generasiya edildi", { description: pwd });
  }

  function next() {
    setError(null);
    if (step === 0 && adSoyad.trim().length < 2) {
      setError("Ad Soyad daxil edin");
      return;
    }
    if (step === 3) {
      if (!email.includes("@")) {
        setError("Email yanlışdır");
        return;
      }
      if (sifre.length < 6) {
        setError("Şifrə ən az 6 simvol olmalıdır");
        return;
      }
    }
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
  }

  function prev() {
    setStep((s) => Math.max(0, s - 1));
  }

  function submit() {
    setError(null);
    const fd = new FormData();
    fd.set("ad_soyad", adSoyad.trim());
    if (finKod) fd.set("fin_kod", finKod);
    if (dogum) fd.set("dogum_tarixi", dogum);
    if (telefon) fd.set("telefon", telefon);
    if (unvan) fd.set("unvan", unvan);
    if (vezife) fd.set("vezife", vezife);
    if (filialId) fd.set("default_filial_id", filialId);
    fd.set("aylik_maas", aylikMaas);
    fd.set("ise_baslama", iseBaslama);
    fd.set("kontrakt_nov", kontraktNov);
    fd.set("email", email.toLowerCase().trim());
    fd.set("sifre", sifre);
    fd.set("rol_id", rolId);

    startTransition(async () => {
      const res = await completeOnboarding(fd);
      if (res.ok) {
        toast.success("İşçi yaradıldı və onboarding tapşırıqları əlavə olundu");
        toast.message("Xoş gəldin emaili göndərildi (mock)", {
          description: `${email} → ${adSoyad}`,
        });
        router.push(res.id ? `/iscilier/${res.id}` : "/iscilier");
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <div className="space-y-4">
      {/* Stepper */}
      <div className="flex items-center justify-between gap-1 overflow-x-auto">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          const active = i === step;
          const done = i < step;
          return (
            <div key={s.key} className="flex flex-1 items-center">
              <button
                type="button"
                onClick={() => i < step && setStep(i)}
                className={`flex flex-1 items-center gap-2 rounded-md border px-2.5 py-2 text-xs transition ${
                  active
                    ? "border-primary/40 bg-primary/10 text-primary-light font-semibold"
                    : done
                    ? "border-success/30 bg-success/5 text-success cursor-pointer"
                    : "border-border/40 text-muted-foreground"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span className="whitespace-nowrap">{i + 1}. {s.label}</span>
              </button>
              {i < STEPS.length - 1 && (
                <div className={`h-0.5 w-3 ${done ? "bg-success" : "bg-border"}`} />
              )}
            </div>
          );
        })}
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card className="glass">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            Addım {step + 1} — {STEPS[step].label}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {step === 0 && (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="space-y-1 md:col-span-2">
                <Label className="text-xs">Ad Soyad *</Label>
                <Input value={adSoyad} onChange={(e) => setAdSoyad(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">FİN kod</Label>
                <Input value={finKod} onChange={(e) => setFinKod(e.target.value)} maxLength={20} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Doğum tarixi</Label>
                <Input
                  type="date"
                  value={dogum}
                  onChange={(e) => setDogum(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Telefon</Label>
                <Input
                  type="tel"
                  value={telefon}
                  onChange={(e) => setTelefon(e.target.value)}
                />
              </div>
              <div className="space-y-1 md:col-span-2">
                <Label className="text-xs">Ünvan</Label>
                <Input value={unvan} onChange={(e) => setUnvan(e.target.value)} />
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs">Vəzifə</Label>
                <Input
                  value={vezife}
                  onChange={(e) => setVezife(e.target.value)}
                  placeholder="Satıcı, Mühasib, ..."
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Şöbə / Filial</Label>
                <select
                  className="h-9 w-full rounded-md border border-border bg-card px-2 text-sm"
                  value={filialId}
                  onChange={(e) => setFilialId(e.target.value)}
                >
                  <option value="">— Seçin —</option>
                  {filiallar.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.ad}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Aylıq maaş (AZN)</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={aylikMaas}
                  onChange={(e) => setAylikMaas(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">İşə başlama</Label>
                <Input
                  type="date"
                  value={iseBaslama}
                  onChange={(e) => setIseBaslama(e.target.value)}
                />
              </div>
              <div className="space-y-1 md:col-span-2">
                <Label className="text-xs">Müqavilə tipi</Label>
                <select
                  className="h-9 w-full rounded-md border border-border bg-card px-2 text-sm"
                  value={kontraktNov}
                  onChange={(e) => setKontraktNov(e.target.value)}
                >
                  <option value="daimi">Daimi (tam ştat)</option>
                  <option value="muveqqeti">Müvəqqəti</option>
                  <option value="staj">Staj / praktika</option>
                </select>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Sənədləri sürükləyib buraxın və ya seçin. (Faktiki yükləmə yaradıldıqdan sonra
                Sənəd tab-ında aparılır.)
              </p>
              <label
                className="flex cursor-pointer flex-col items-center justify-center rounded-md border-2 border-dashed border-border/50 p-6 transition hover:border-primary/40"
                onClick={(e) => e.preventDefault()}
              >
                <Upload className="mb-2 h-6 w-6 text-muted-foreground/60" />
                <span className="text-sm">Faylları seçin</span>
                <span className="mt-1 text-[10.5px] text-muted-foreground">
                  Müqavilə, şəxsiyyət, ID, sağlamlıq
                </span>
                <input
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e) =>
                    setDocFiles((prev) => [
                      ...prev,
                      ...Array.from(e.target.files ?? []).map((f) => f.name),
                    ])
                  }
                />
              </label>
              {docFiles.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {docFiles.map((n, i) => (
                    <Badge key={i} variant="outline">
                      <FileText className="mr-1 h-3 w-3" /> {n}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs">Email *</Label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Rol *</Label>
                <select
                  className="h-9 w-full rounded-md border border-border bg-card px-2 text-sm"
                  value={rolId}
                  onChange={(e) => setRolId(e.target.value)}
                >
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.ad}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1 md:col-span-2">
                <Label className="text-xs">Şifrə *</Label>
                <div className="flex gap-2">
                  <Input
                    value={sifre}
                    onChange={(e) => setSifre(e.target.value)}
                    placeholder="Ən az 6 simvol"
                  />
                  <Button type="button" variant="outline" size="sm" onClick={genPassword}>
                    <Sparkles className="h-3.5 w-3.5" /> Generasiya
                  </Button>
                </div>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 gap-2 rounded-md border border-border/40 p-3 text-sm md:grid-cols-2">
                <KV label="Ad Soyad" value={adSoyad} />
                <KV label="FİN" value={finKod || "—"} />
                <KV label="Email" value={email} />
                <KV label="Telefon" value={telefon || "—"} />
                <KV label="Vəzifə" value={vezife || "—"} />
                <KV label="Müqavilə" value={kontraktNov} />
                <KV label="Aylıq maaş" value={`${aylikMaas} AZN`} />
                <KV label="İşə başlama" value={iseBaslama} />
              </div>
              <div className="rounded-md border border-success/20 bg-success/5 p-3">
                <div className="mb-2 inline-flex items-center gap-1.5 text-xs font-semibold text-success">
                  <CheckCircle className="h-3.5 w-3.5" /> Avto-yaranacaq onboarding checklist
                </div>
                <ul className="ml-5 list-disc space-y-0.5 text-xs">
                  {CHECKLIST.map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
              </div>
              <div className="rounded-md border border-info/20 bg-info/5 p-3 text-xs">
                <div className="inline-flex items-center gap-1.5 font-semibold text-info">
                  <Mail className="h-3.5 w-3.5" /> Xoş gəldin emaili (mock) {email} → {adSoyad}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={prev} disabled={step === 0 || pending}>
          <ArrowLeft className="h-4 w-4" /> Geri
        </Button>
        {step < STEPS.length - 1 ? (
          <Button onClick={next} disabled={pending}>
            Sonrakı <ArrowRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button onClick={submit} disabled={pending}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
            Tamamla
          </Button>
        )}
      </div>
    </div>
  );
}

function KV({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="font-medium">{value || "—"}</div>
    </div>
  );
}
