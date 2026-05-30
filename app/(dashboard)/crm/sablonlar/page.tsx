import type { Metadata } from "next";
import { FileText } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CrmSubNav } from "@/components/crm-subnav";
import { TemplateDialog } from "@/features/crm/components/template-dialog";
import { getTemplates } from "@/features/crm/queries";
import { DeleteTemplateButton } from "@/features/crm/components/delete-template-button";
import { TemplatePreview } from "@/features/crm/components/template-preview";

export const metadata: Metadata = { title: "Mesaj şablonları" };

const CHANNEL_LABELS: Record<string, string> = {
  whatsapp: "WhatsApp",
  sms: "SMS",
  email: "Email",
  telegram: "Telegram",
  instagram: "Instagram",
};

export default async function SablonlarPage() {
  const templates = await getTemplates();

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <CrmSubNav active="/crm/sablonlar" />
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Mesaj şablonları</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            WhatsApp, SMS və email üçün hazır şablonlar. Dəyişənlər avtomatik aşkarlanır.
          </p>
        </div>
        <TemplateDialog />
      </header>

      {templates.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
          <div className="mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-secondary">
            <FileText className="h-5 w-5 text-muted-foreground" />
          </div>
          <h3 className="font-semibold">Şablon yoxdur</h3>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            Yuxarıdakı &quot;Yeni şablon&quot; düyməsi ilə başlayın.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {templates.map((t) => (
            <Card key={t.id} className={`glass ${!t.aktiv && "opacity-60"}`}>
              <CardContent className="space-y-3 py-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold">{t.ad}</h3>
                      <Badge variant="outline" className="text-[10px]">
                        {CHANNEL_LABELS[t.kanal] ?? t.kanal}
                      </Badge>
                      {!t.aktiv && <Badge variant="outline" className="text-[10px]">passiv</Badge>}
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground font-mono">{t.hadisi}</div>
                  </div>
                  <div className="flex items-center gap-1">
                    <TemplateDialog initial={t} trigger="edit" />
                    <DeleteTemplateButton id={t.id} ad={t.ad} />
                  </div>
                </div>

                {t.movzu && (
                  <div className="text-xs">
                    <span className="text-muted-foreground">Mövzu: </span>
                    <span className="font-medium">{t.movzu}</span>
                  </div>
                )}

                <pre className="whitespace-pre-wrap rounded-md border border-border/40 bg-secondary/30 p-2 font-mono text-xs">
                  {t.matn}
                </pre>

                <TemplatePreview matn={t.matn} deyisenler={t.deyisenler} />

                {t.deyisenler.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {t.deyisenler.map((v) => (
                      <Badge key={v} variant="secondary" className="font-mono text-[10px]">
                        {`{{${v}}}`}
                      </Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
