import type { Metadata } from "next";
import { MessageSquare } from "lucide-react";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { BackButton } from "@/components/ui/back-button";
import { SettingsTopNav } from "@/features/ayar/components/settings-top-nav";
import {
  MessageTemplateList,
  type MessageTemplate,
} from "@/features/ayarlar/components/message-template-list";

export const metadata: Metadata = { title: "Mesaj şablonları" };

async function getTemplates(): Promise<MessageTemplate[]> {
  return withTenant(async () => {
    const rows = await prisma.mesaj_sablonlari.findMany({
      orderBy: [{ aktiv: "desc" }, { yenilendi: "desc" }],
      select: {
        id: true,
        ad: true,
        hadisi: true,
        kanal: true,
        movzu: true,
        matn: true,
        deyisenler: true,
        aktiv: true,
        default_sablon: true,
      },
    });
    return rows;
  });
}

export default async function Page() {
  const items = await getTemplates();

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <BackButton fallback="/ayarlar" label="Tənzimləmələr" />

      <header className="flex items-start gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-violet-500/15 text-violet-500">
          <MessageSquare className="h-5 w-5" />
        </div>
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Tənzimləmələr</div>
          <h1 className="text-2xl font-bold tracking-tight">Mesaj şablonları</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            WhatsApp, SMS, email, Telegram və Instagram üçün mətn şablonları. Placeholder dəstəyi:{" "}
            <code className="rounded bg-secondary px-1 py-0.5 font-mono text-[11px]">{`{{musteri_ad}}`}</code>,{" "}
            <code className="rounded bg-secondary px-1 py-0.5 font-mono text-[11px]">{`{{mebleg}}`}</code>,{" "}
            <code className="rounded bg-secondary px-1 py-0.5 font-mono text-[11px]">{`{{qaime_no}}`}</code>
          </p>
        </div>
      </header>

      <SettingsTopNav />

      <MessageTemplateList items={items} />
    </div>
  );
}
