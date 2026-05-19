"use client";

import { useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Upload, Trash2, Image as ImageIcon, Sparkles, Sun, Moon, Flame, Snowflake } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { saveCompany, uploadCompanyLogo } from "../actions";

type Initial = {
  ad: string;
  email: string | null;
  voen: string | null;
  telefon: string | null;
  unvan: string | null;
  seh_r: string | null;
  domen: string | null;
  brend_rengi: string | null;
  brend_tonu: string | null;
  loqo_url: string | null;
  biznes_novu: string | null;
};

const BRAND_TONES = [
  { key: "professional", label: "Pro", color: "#6366F1", icon: Sparkles },
  { key: "minimal", label: "Min", color: "#64748B", icon: Snowflake },
  { key: "warm", label: "Warm", color: "#F59E0B", icon: Flame },
  { key: "dark", label: "Dark", color: "#0F172A", icon: Moon },
  { key: "live", label: "Live", color: "#A855F7", icon: Sun },
] as const;

const BIZNES_NOVU = [
  "Elektronika / aksesuar",
  "Geyim / ayaqqabı",
  "Ərzaq / supermarket",
  "Restoran / kafe",
  "Aptek / kosmetika",
  "Mebel / ev",
  "Avto hissə",
  "Tikinti / inşaat",
  "Servis xidməti",
  "Digər",
];

export function CompanyForm({ initial }: { initial: Initial }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);
  const [logoUrl, setLogoUrl] = useState(initial.loqo_url ?? "");
  const [brandColor, setBrandColor] = useState(initial.brend_rengi ?? "#6366F1");
  const [brandTone, setBrandTone] = useState(initial.brend_tonu ?? "professional");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  async function handleLogoUpload(file: File) {
    setUploading(true);
    setError(null);
    const fd = new FormData();
    fd.append("logo", file);
    const res = await uploadCompanyLogo(fd);
    setUploading(false);
    if (!res.ok) {
      setError(res.error);
      toast.error(res.error);
    } else {
      setLogoUrl(res.url);
      toast.success("Logo yükləndi");
      router.refresh();
    }
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    fd.set("brend_rengi", brandColor);
    fd.set("brend_tonu", brandTone);
    fd.set("loqo_url", logoUrl);
    startTransition(async () => {
      const res = await saveCompany(fd);
      if (!res.ok) {
        setError(res.error);
        toast.error(res.error);
      } else {
        toast.success("Yadda saxlanıldı");
        router.refresh();
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* === BRAND === */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[280px_1fr]">
        <div className="space-y-3">
          <Label>Logo və brend</Label>
          <div
            className={cn(
              "relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed transition",
              logoUrl ? "border-border" : "border-border/60 bg-secondary/30 hover:bg-secondary/50"
            )}
            style={logoUrl ? { background: brandColor + "10" } : undefined}
          >
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt="Logo" className="h-full w-full object-contain" />
            ) : (
              <div
                className="grid h-24 w-24 place-items-center rounded-2xl text-3xl font-bold text-white"
                style={{ background: brandColor }}
              >
                {(initial.ad ?? "?").slice(0, 1).toUpperCase()}
              </div>
            )}

            {uploading && (
              <div className="absolute inset-0 grid place-items-center bg-background/80">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleLogoUpload(f);
              e.target.value = "";
            }}
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md border border-border bg-secondary px-3 py-1.5 text-xs font-semibold hover:bg-secondary/70"
            >
              <Upload className="h-3 w-3" /> Logo yüklə
            </button>
            {logoUrl && (
              <button
                type="button"
                onClick={() => setLogoUrl("")}
                className="inline-flex items-center justify-center rounded-md border border-rose-500/40 bg-rose-500/10 px-2 py-1.5 text-rose-500 hover:bg-rose-500/20"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground">PNG/JPG/WebP/SVG · ən çox 2 MB</p>

          <div className="space-y-1.5">
            <Label htmlFor="brend_rengi" className="text-xs">Brend rəngi</Label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                id="brend_rengi"
                value={brandColor}
                onChange={(e) => setBrandColor(e.target.value)}
                className="h-9 w-12 cursor-pointer rounded-md border border-border"
              />
              <Input
                value={brandColor}
                onChange={(e) => setBrandColor(e.target.value)}
                placeholder="#6366F1"
                maxLength={9}
                className="flex-1 font-mono text-xs uppercase"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Brend tonu</Label>
            <div className="grid grid-cols-5 gap-1">
              {BRAND_TONES.map((t) => {
                const Icon = t.icon;
                const active = brandTone === t.key;
                return (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setBrandTone(t.key)}
                    className={cn(
                      "flex flex-col items-center gap-1 rounded-lg border px-1 py-2 text-[10px] font-semibold transition",
                      active ? "border-primary bg-primary/10 text-primary" : "border-border bg-secondary/40 text-muted-foreground hover:bg-secondary/70"
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" style={{ color: t.color }} />
                    {t.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Rekvizitlər</h3>

          <div className="space-y-2">
            <Label htmlFor="ad">Şirkət adı *</Label>
            <Input id="ad" name="ad" required minLength={2} maxLength={150} defaultValue={initial.ad} disabled={pending} />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="voen">VÖEN</Label>
              <Input id="voen" name="voen" maxLength={20} defaultValue={initial.voen ?? ""} disabled={pending} placeholder="10 rəqəm" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="biznes_novu">Biznes növü</Label>
              <select
                id="biznes_novu"
                name="biznes_novu"
                defaultValue={initial.biznes_novu ?? ""}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                disabled={pending}
              >
                <option value="">— Seçim —</option>
                {BIZNES_NOVU.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" maxLength={150} defaultValue={initial.email ?? ""} disabled={pending} placeholder="info@sirket.az" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="telefon">Telefon</Label>
              <Input id="telefon" name="telefon" type="tel" maxLength={30} defaultValue={initial.telefon ?? ""} disabled={pending} placeholder="+994..." />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="seher">Şəhər</Label>
              <Input id="seher" name="seher" maxLength={80} defaultValue={initial.seh_r ?? ""} disabled={pending} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="domen">Custom domen</Label>
              <Input
                id="domen"
                name="domen"
                maxLength={100}
                defaultValue={initial.domen ?? ""}
                placeholder="sirket.az"
                disabled={pending}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="unvan">Rəsmi ünvan</Label>
            <textarea
              id="unvan"
              name="unvan"
              rows={2}
              maxLength={500}
              defaultValue={initial.unvan ?? ""}
              placeholder="Bakı şəh., ... küçə, bina"
              className="flex w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              disabled={pending}
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <p className="text-[11px] text-muted-foreground">
              «* məcburi sahə. Brend dəyişiklikləri bütün modullarda görünür.
            </p>
            <Button
              type="submit"
              disabled={pending}
              className="font-semibold text-white"
              style={{ background: brandColor }}
            >
              {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Yadda saxla
            </Button>
          </div>
        </div>
      </div>
    </form>
  );
}
