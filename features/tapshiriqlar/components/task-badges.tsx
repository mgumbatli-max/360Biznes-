import { cn } from "@/lib/utils";

const PRIORITY: Record<string, { label: string; cls: string }> = {
  asagi: { label: "Aşağı", cls: "bg-muted text-muted-foreground border-border" },
  normal: { label: "Normal", cls: "bg-info/15 text-info border-info/30" },
  yuksek: { label: "Yüksək", cls: "bg-warning/15 text-warning border-warning/30" },
  tecili: { label: "Təcili", cls: "bg-danger/15 text-danger border-danger/30" },
};

const STATUS: Record<string, { label: string; cls: string }> = {
  yeni: { label: "Yeni", cls: "bg-primary/15 text-primary-light border-primary/30" },
  icrada: { label: "İcrada", cls: "bg-info/15 text-info border-info/30" },
  gozlemede: { label: "Gözləmədə", cls: "bg-warning/15 text-warning border-warning/30" },
  tamamlandi: { label: "Tamamlandı", cls: "bg-success/15 text-success border-success/30" },
  legv: { label: "Ləğv", cls: "bg-muted text-muted-foreground border-border line-through" },
};

export function PriorityBadge({ value }: { value: string }) {
  const s = PRIORITY[value] ?? PRIORITY.normal;
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[10.5px] font-medium uppercase tracking-wider", s.cls)}>
      {s.label}
    </span>
  );
}

export function TaskStatusBadge({ value }: { value: string }) {
  const s = STATUS[value] ?? STATUS.yeni;
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[10.5px] font-medium", s.cls)}>
      {s.label}
    </span>
  );
}
