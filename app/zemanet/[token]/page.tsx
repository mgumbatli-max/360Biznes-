import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ShieldCheck, CheckCircle2, XCircle, Calendar, Tag, Building2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getZemanetByToken } from "@/features/servis/queries";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Zəmanət təsdiqi" };

export default async function ZemanetPublicPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const z = await getZemanetByToken(token);
  if (!z) notFound();

  const isActive = z.status === "aktiv" && (!z.bitme_tarixi || new Date(z.bitme_tarixi) > new Date());

  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <div className="mx-auto max-w-md space-y-4">
        <div className="text-center">
          <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl" style={{ background: "var(--brand-gradient)" }}>
            <ShieldCheck className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Zəmanət təsdiqi</h1>
          <p className="mt-1 text-sm text-muted-foreground">Bu QR sənədin orijinallığını təsdiqləyir.</p>
        </div>

        <Card className="glass">
          <CardContent className="space-y-4 py-6">
            <div className="text-center">
              {isActive ? (
                <Badge variant="outline" className="border-success/30 bg-success/10 text-success">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Aktiv zəmanət
                </Badge>
              ) : (
                <Badge variant="outline" className="border-danger/30 bg-danger/10 text-danger">
                  <XCircle className="h-3.5 w-3.5" /> Bitib və ya ləğv
                </Badge>
              )}
            </div>

            <div className="space-y-3 border-t border-border/40 pt-4">
              <Field icon={Building2} label="Şirkət" value={z.sirket_ad ?? "—"} />
              <Field icon={Tag} label="Məhsul" value={z.mehsul_ad ?? "—"} />
              {z.serial_nomre && <Field icon={Tag} label="Serial nömrə" value={z.serial_nomre} mono />}
              {z.musteri_ad && <Field icon={Tag} label="Müştəri" value={z.musteri_ad} />}
              <Field icon={Calendar} label="Başlama" value={formatDate(z.baslama_tarixi)} />
              {z.bitme_tarixi && <Field icon={Calendar} label="Bitmə" value={formatDate(z.bitme_tarixi)} />}
            </div>

            <div className="border-t border-border/40 pt-3 text-center">
              <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground">Unikal kod</div>
              <div className="font-mono text-sm font-semibold">{z.unikal_kod}</div>
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          360Biznes vasitəsi ilə təsdiqlənib
        </p>
      </div>
    </div>
  );
}

function Field({
  icon: Icon,
  label,
  value,
  mono,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start gap-2 text-sm">
      <Icon className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
      <div className="flex-1">
        <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className={`font-medium ${mono ? "font-mono text-xs" : ""}`}>{value}</div>
      </div>
    </div>
  );
}
