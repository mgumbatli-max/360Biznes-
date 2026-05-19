import { cn } from "@/lib/utils";

const STATUS: Record<string, { label: string; cls: string }> = {
  yeni: { label: "Yeni", cls: "bg-info/15 text-info border-info/30" },
  tesdiq: { label: "Təsdiq", cls: "bg-primary/15 text-primary-light border-primary/30" },
  gonderildi: { label: "Göndərildi", cls: "bg-info/15 text-info border-info/30" },
  tamamlandi: { label: "Tamamlandı", cls: "bg-success/15 text-success border-success/30" },
  legv: { label: "Ləğv", cls: "bg-danger/15 text-danger border-danger/30 line-through" },
};

const ODENIS: Record<string, { label: string; cls: string }> = {
  negd: { label: "Nağd", cls: "bg-success/15 text-success" },
  kart: { label: "Kart", cls: "bg-info/15 text-info" },
  kecirme: { label: "Bank", cls: "bg-info/15 text-info" },
  nisye: { label: "Borc", cls: "bg-warning/15 text-warning" },
};

export function SaleStatusBadge({ value }: { value: string }) {
  const s = STATUS[value] ?? STATUS.yeni;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[10.5px] font-medium",
        s.cls
      )}
    >
      {s.label}
    </span>
  );
}

export function PaymentBadge({ value }: { value: string }) {
  const o = ODENIS[value] ?? ODENIS.negd;
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[10.5px] font-medium", o.cls)}>
      {o.label}
    </span>
  );
}
