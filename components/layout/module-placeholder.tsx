import type { LucideIcon } from "lucide-react";
import { Construction } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type Props = {
  icon: LucideIcon;
  title: string;
  description: string;
  phase: number;
  features: string[];
};

export function ModulePlaceholder({ icon: Icon, title, description, phase, features }: Props) {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-start gap-4">
        <div
          className="grid h-12 w-12 flex-shrink-0 place-items-center rounded-xl"
          style={{ background: "var(--brand-gradient)" }}
        >
          <Icon className="h-6 w-6 text-white" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
            <Badge variant="secondary" className="gap-1">
              <Construction className="h-3 w-3" />
              Mərhələ {phase}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
      </div>

      <Card className="glass">
        <CardContent className="space-y-3 py-6">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Bu modulda olacaq
          </h3>
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {features.map((f) => (
              <li key={f} className="flex items-start gap-2 text-sm">
                <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary-light" />
                <span className="text-muted-foreground">{f}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <p className="text-center text-xs text-muted-foreground">
        Bu modul Mərhələ {phase}-də implementasiya olunacaq. Köhnə vanilla layihədə işlək versiyası mövcuddur.
      </p>
    </div>
  );
}
