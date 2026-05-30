import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Building2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CompanyForm } from "@/features/ayar/components/company-form";
import { getCompany, getCompanyProfileCompleteness } from "@/features/ayar/queries";

export const metadata: Metadata = { title: "Şirkət profili" };

export default async function KompaniyaPage() {
  const [company, completeness] = await Promise.all([getCompany(), getCompanyProfileCompleteness()]);
  if (!company) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <header className="flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-lg bg-secondary text-primary">
          <Building2 className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Şirkət profili</h1>
          <p className="text-sm text-muted-foreground">Brend, VÖEN, ünvan, logo və əlaqə məlumatları</p>
        </div>
      </header>


      <Card className="glass">
        <CardContent className="space-y-2 py-4">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold">Profil tamamlanması</span>
            <span className="tabular-nums text-muted-foreground">{completeness.percent}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full transition-all"
              style={{ width: `${completeness.percent}%`, background: "var(--brand-gradient)" }}
            />
          </div>
          {completeness.missing.length > 0 && (
            <div className="text-[11px] text-muted-foreground">
              Doldurulmamış: <span className="text-foreground/80">{completeness.missing.join(", ")}</span>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="glass">
        <CardHeader>
          <CardTitle className="text-base">Rekvizitlər</CardTitle>
        </CardHeader>
        <CardContent>
          <CompanyForm
            initial={{
              ad: company.ad,
              email: company.email,
              voen: company.voen,
              telefon: company.telefon,
              unvan: company.unvan,
              seh_r: company.seh_r,
              domen: company.domen,
              brend_rengi: company.brend_rengi,
              brend_tonu: company.brend_tonu,
              loqo_url: company.loqo_url,
              biznes_novu: company.biznes_novu,
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
