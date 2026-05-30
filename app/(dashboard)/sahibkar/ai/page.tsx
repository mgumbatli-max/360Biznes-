import type { Metadata } from "next";
import { Sparkles, Crown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { requireSahibkarSession } from "@/lib/sahibkar/guard";
import { getChatHistory, getMockStatus } from "@/features/ai/queries";
import { ChatClient } from "@/features/ai/components/chat-client";
import { SectionExplainer } from "@/features/sahibkar/components/section-explainer";
import type { ChatTurn } from "@/features/ai/types";

export const metadata: Metadata = { title: "Sahibkar AI Köməkçisi" };

export default async function SahibkarAiPage() {
  // PIN qoruması — yalnız sahibkar rolu və açıq sahibkar sessiyası
  await requireSahibkarSession();

  const history = await getChatHistory(50, "owner");
  const isMockMode = getMockStatus();

  const turns: ChatTurn[] = [];
  for (const h of history) {
    turns.push({ id: `u-${h.id}`, role: "user", content: h.prompt, yaradildi: h.yaradildi ?? undefined });
    turns.push({
      id: `a-${h.id}`,
      role: "assistant",
      content: h.cavab,
      is_mock: h.is_mock,
      yaradildi: h.yaradildi ?? undefined,
    });
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-amber-500 to-rose-500">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">Sahibkar AI Köməkçisi</h1>
              <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-[10px] text-amber-600 dark:text-amber-400">
                <Crown className="h-2.5 w-2.5" /> Tam giriş
              </Badge>
            </div>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Yalnız sahibkar bölməsi daxilində mövcuddur — şirkətin tam göstəricilərinə (gəlir, mənfəət, maya, kassa, işçi maaşları, partiya, məxfi qeydlər) giriş ilə cavab verir.
            </p>
          </div>
        </div>
      </header>

      <SectionExplainer
        icon={Sparkles}
        title="Sahibkar AI — başqalarından fərqi"
        tone="amber"
        description='Hər sorğuda AI-yə bizneslə bağlı real KPI bloku (bu günkü/aylıq satış + dəlta, kassa qalığı, partiya/maya, borclu müştərilər, TOP 5 satılan məhsul, açıq tapşırıq) inject olunur. Adi əməkdaş /ai-də bu məlumatları görmür — onlar yalnız öz performanslarını sorğula bilir.'
        bullets={[
          { label: "Tam KPI", text: "gəlir/mənfəət/maya/borc/kassa" },
          { label: "Məxfi", text: "yalnız PIN ilə açılır" },
          { label: "Tarixçə", text: "ayrı kanal — əməkdaş söhbətindən təcrid" },
        ]}
      />

      <ChatClient
        initial={turns}
        isMockMode={isMockMode}
        mode="owner"
        emptyHeading="Sahibkar AI — Tam giriş"
        emptySubtext="Şirkətin ümumi gəlir, mənfəət, maya, kassa, işçi performansı, məxfi qeydlər və partiya datasına aid hər sual ver."
        suggestions={[
          "Bu ayın gəliri keçən aydan necə fərqlənir?",
          "TOP 5 satılan məhsulum hansılardır?",
          "Borclu müştərilərim varmı, cəmi nə qədərdir?",
          "Bu ayın idxal partiyalarının cəm mayası?",
          "Hansı işçim ən çox satış edir?",
          "Kassa qalığım və aylıq xərclər?",
        ]}
      />
    </div>
  );
}
