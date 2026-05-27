import { Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { BackButton } from "@/components/ui/back-button";
import { SettingsTopNav } from "./settings-top-nav";

type Props = {
  title: string;
  description: string;
  features: string[];
};

export function ComingSoon({ title, description, features }: Props) {
  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <BackButton fallback="/ayarlar" label="Tənzimləmələr" />

      <header>
        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Tənzimləmələr</div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </header>

      <SettingsTopNav />

      <Card className="glass">
        <CardContent className="space-y-4 py-6">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-violet-500/15 text-violet-500">
              <Sparkles className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold">Bu modul hazırlanır</h3>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Vanilla 360Biznes-də olan funksionallıq Next.js-ə köçürülür və genişləndirilir. Aşağıdakı funksiyalar planlaşdırılıb.
              </p>
            </div>
          </div>

          <ul className="space-y-2 text-sm">
            {features.map((f) => (
              <li key={f} className="flex items-start gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                <span>{f}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
