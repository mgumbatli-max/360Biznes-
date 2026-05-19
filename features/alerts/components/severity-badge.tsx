import { cn } from "@/lib/utils";

const STYLES: Record<string, { label: string; cls: string }> = {
  info: { label: "Məlumat", cls: "bg-info/15 text-info border-info/30" },
  xeber: { label: "Xəbər", cls: "bg-info/15 text-info border-info/30" },
  risk: { label: "Risk", cls: "bg-warning/15 text-warning border-warning/30" },
  kritik: { label: "Kritik", cls: "bg-danger/15 text-danger border-danger/30 animate-pulse-glow" },
};

export function SeverityBadge({ value }: { value: string }) {
  const s = STYLES[value] ?? STYLES.risk;
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[10.5px] font-medium uppercase tracking-wider", s.cls)}>
      {s.label}
    </span>
  );
}

const STATUS_STYLES: Record<string, { label: string; cls: string }> = {
  yeni: { label: "Yeni", cls: "bg-primary/15 text-primary-light border-primary/30" },
  baxilir: { label: "Baxılır", cls: "bg-info/15 text-info border-info/30" },
  snoozed: { label: "Təxirə salınıb", cls: "bg-muted text-muted-foreground border-border" },
  hell_olundu: { label: "Həll olundu", cls: "bg-success/15 text-success border-success/30" },
  legv: { label: "Ləğv", cls: "bg-muted text-muted-foreground border-border" },
};

export function StatusBadge({ value }: { value: string }) {
  const s = STATUS_STYLES[value] ?? STATUS_STYLES.yeni;
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[10.5px] font-medium", s.cls)}>
      {s.label}
    </span>
  );
}
