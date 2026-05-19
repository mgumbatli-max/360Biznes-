import Link from "next/link";
import { Eye } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { LabActivateButton } from "./lab-activate-button";
import { RENG_BG, RENG_GRADIENT, type LabFeature } from "../catalog";

export function LabCard({ feature, active }: { feature: LabFeature; active: boolean }) {
  const Icon = feature.icon;
  const iconBg = RENG_BG[feature.reng];

  const statusBadge =
    feature.status === "tam"
      ? { label: "Tam funksional", cls: "bg-emerald-500/15 text-emerald-500 border-emerald-500/40" }
      : feature.status === "alfa"
      ? { label: "Alfa", cls: "bg-purple-500/15 text-purple-500 border-purple-500/40" }
      : feature.status === "aktiv"
      ? { label: "Aktiv", cls: "bg-primary/15 text-primary border-primary/40" }
      : { label: "preview", cls: "bg-amber-500/15 text-amber-500 border-amber-500/40" };

  return (
    <Card
      className={cn(
        "group relative overflow-hidden border-border/60 bg-card/60 p-4 transition-all hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg",
        active && "border-emerald-500/40 ring-1 ring-emerald-500/30"
      )}
    >
      {/* Halo */}
      <div
        className={cn(
          "pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-gradient-to-br opacity-10 blur-2xl transition group-hover:opacity-25",
          RENG_GRADIENT[feature.reng]
        )}
      />
      {/* Top-right status */}
      <Badge variant="outline" className={cn("absolute right-3 top-3 z-10 text-[9px]", statusBadge.cls)}>
        {statusBadge.label}
      </Badge>

      <div className="relative space-y-3">
        {/* Icon */}
        <div className={cn("grid h-10 w-10 place-items-center rounded-lg", iconBg)}>
          <Icon className="h-5 w-5" />
        </div>

        {/* Title + desc */}
        <div>
          <h3 className="font-bold leading-tight">{feature.ad}</h3>
          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{feature.tesvir}</p>
        </div>

        {/* Action row */}
        <div className="flex items-center gap-2 pt-1">
          <Link
            href={`/360-lab/${feature.id}`}
            className="inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-md bg-foreground text-xs font-semibold text-background transition hover:bg-foreground/90"
          >
            <Eye className="h-3 w-3" />
            Aç
          </Link>
          <LabActivateButton id={feature.id} active={active} compact />
        </div>

        {/* Bottom hint */}
        <div className="flex items-center justify-between border-t border-border/30 pt-2 text-[10px] text-muted-foreground">
          {feature.status === "tam" ? (
            <span className="font-semibold text-emerald-500">Tam funksional</span>
          ) : (
            <span>10 preview</span>
          )}
          {active && <span className="font-semibold text-emerald-500">● Sənin LAB-da aktiv</span>}
        </div>
      </div>
    </Card>
  );
}
