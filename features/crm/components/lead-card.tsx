"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Phone, Mail, CalendarClock, MoreHorizontal, ShoppingCart, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { az } from "date-fns/locale";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LeadDialog } from "./lead-dialog";
import { changeLeadStage, convertLeadToMusteri, convertLeadToSale, deleteLead } from "../actions";
import { LEAD_STAGES, LEAD_PRIORITY, type LeadCard, type LeadStatus } from "../types";
import { cn, formatMoney, formatDate } from "@/lib/utils";
import { useMounted } from "@/lib/hooks/use-mounted";

export function LeadCardItem({ lead }: { lead: LeadCard }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const mounted = useMounted();
  const overdue = mounted && lead.novbeti_elaqe && lead.novbeti_elaqe < new Date();

  function moveStage(s: LeadStatus) {
    startTransition(async () => {
      const res = await changeLeadStage(lead.id, s);
      if (res.ok) toast.success("Mərhələ dəyişdi");
      else toast.error("Alınmadı");
    });
  }

  function convert() {
    startTransition(async () => {
      const res = await convertLeadToMusteri(lead.id);
      if (res.ok) toast.success("Müştəriyə çevrildi");
      else toast.error(res.error);
    });
  }

  function convertSale() {
    startTransition(async () => {
      const res = await convertLeadToSale(lead.id);
      if (res.ok) {
        toast.success("Satış qaralaması yaradıldı");
        router.push(`/ticaret/satislar/${res.saleId}`);
      } else toast.error(res.error);
    });
  }

  function remove() {
    if (typeof window !== "undefined" && !window.confirm("Bu lead silinsin?")) return;
    startTransition(async () => {
      const res = await deleteLead(lead.id);
      if (res.ok) toast.success("Silindi");
      else toast.error(res.error);
    });
  }

  return (
    <div className={cn("group rounded-lg border border-border/50 bg-card/60 p-3 transition hover:border-border", pending && "opacity-60")}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className={cn("h-2 w-2 rounded-full shrink-0", LEAD_PRIORITY[lead.prioritet]?.cls?.split(" ")[0] ?? "bg-muted")} title={LEAD_PRIORITY[lead.prioritet]?.label} />
            <div className="truncate text-sm font-semibold">{lead.ad}</div>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1">
            {lead.menbe && (
              <Badge variant="outline" className="h-5 text-[10px]">{lead.menbe}</Badge>
            )}
            {lead.menecer_ad && (
              <Badge variant="outline" className="h-5 text-[10px]">{lead.menecer_ad}</Badge>
            )}
            <span className="text-[10px] text-muted-foreground">{lead.gunler_stage}g</span>
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon-sm" variant="ghost" className="opacity-0 group-hover:opacity-100">
              <MoreHorizontal className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {LEAD_STAGES.filter((s) => s.value !== lead.status).map((s) => (
              <DropdownMenuItem key={s.value} onSelect={() => moveStage(s.value)}>
                Mərhələ → {s.label}
              </DropdownMenuItem>
            ))}
            <DropdownMenuItem onSelect={() => convert()}>Müştəriyə çevir</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => convertSale()}>→ Satışa çevir</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => remove()} className="text-destructive focus:text-destructive">
              Sil
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="mt-2 space-y-1 text-xs text-muted-foreground">
        {lead.telefon && (
          <div className="flex items-center gap-1.5">
            <Phone className="h-3 w-3" />
            <span>{lead.telefon}</span>
          </div>
        )}
        {lead.email && (
          <div className="flex items-center gap-1.5">
            <Mail className="h-3 w-3" />
            <span className="truncate">{lead.email}</span>
          </div>
        )}
        {lead.novbeti_elaqe && (
          <div className={cn("flex items-center gap-1.5", overdue && "text-danger")}>
            <CalendarClock className="h-3 w-3" />
            <span>{mounted ? formatDistanceToNow(lead.novbeti_elaqe, { addSuffix: true, locale: az }) : formatDate(lead.novbeti_elaqe)}</span>
          </div>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-border/40 pt-2 text-xs">
        <div className="flex items-center gap-2">
          {lead.budce > 0 && <span className="font-semibold tabular-nums">{formatMoney(lead.budce)}</span>}
          <span className="text-muted-foreground">{lead.ehtimal}%</span>
        </div>
        <LeadDialog initial={lead} trigger="edit" />
      </div>

      {lead.status === "qazandi" && (
        <Button
          size="sm"
          onClick={convertSale}
          disabled={pending}
          className="mt-2 h-7 w-full font-semibold text-white"
          style={{ background: "var(--brand-gradient)" }}
        >
          {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <ShoppingCart className="h-3 w-3" />}
          → Satışa çevir
        </Button>
      )}
    </div>
  );
}
