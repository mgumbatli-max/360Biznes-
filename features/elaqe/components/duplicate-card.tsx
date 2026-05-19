"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Merge, Loader2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { mergeContacts } from "../actions";
import { formatMoney, formatDate } from "@/lib/utils";
import type { DuplicatePair } from "../queries";

type Props = { pair: DuplicatePair };

const KIND_LABEL: Record<DuplicatePair["kind"], string> = {
  telefon: "Telefon eyni",
  voen: "VÖEN eyni",
  fin: "FİN eyni",
  email: "Email eyni",
  ad: "Ad oxşardır",
};

const KIND_COLOR: Record<DuplicatePair["kind"], string> = {
  telefon: "bg-warning/15 text-warning",
  voen: "bg-info/15 text-info",
  fin: "bg-info/15 text-info",
  email: "bg-warning/15 text-warning",
  ad: "bg-danger/15 text-danger",
};

export function DuplicateCard({ pair }: Props) {
  const router = useRouter();
  const [primary, setPrimary] = useState<string>(pair.ids[0]);
  const [pending, startTransition] = useTransition();

  function onMerge() {
    const others = pair.ids.filter((id) => id !== primary);
    if (others.length === 0) {
      toast.error("Birləşdiriləcək yoxdur");
      return;
    }
    if (!confirm(`${others.length} qeyd seçilmiş kontragentlə birləşdiriləcək. Davam edək?`)) return;
    startTransition(async () => {
      const res = await mergeContacts(primary, others);
      if (res.ok) {
        toast.success("Birləşdirildi");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <div className="rounded-xl border border-border bg-card/40 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <Badge variant="outline" className={`text-[10px] ${KIND_COLOR[pair.kind]}`}>
          {KIND_LABEL[pair.kind]}: {pair.value.slice(0, 40)}
        </Badge>
        <span className="text-xs text-muted-foreground">{pair.contacts.length} qeyd</span>
      </div>
      <div className="space-y-1.5">
        {pair.contacts.map((c) => (
          <label
            key={c.id}
            className={`flex items-start gap-2 rounded-md border px-2 py-1.5 transition ${
              primary === c.id ? "border-primary/40 bg-primary/10" : "border-border/40 hover:bg-secondary/30"
            }`}
          >
            <input
              type="radio"
              name={`primary-${pair.value}`}
              checked={primary === c.id}
              onChange={() => setPrimary(c.id)}
              className="mt-1 accent-primary"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium">{c.ad}</span>
                {c.voen && <span className="font-mono text-xs text-muted-foreground">VÖEN: {c.voen}</span>}
              </div>
              <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                {c.telefon && <span>{c.telefon}</span>}
                {c.email && <span>{c.email}</span>}
                {c.fin_kod && <span>FİN: {c.fin_kod}</span>}
                {c.borc > 0 && <span className="text-warning">Borc: {formatMoney(c.borc)}</span>}
                <span>Yaradıldı: {formatDate(c.yaradildi)}</span>
              </div>
            </div>
            <Link
              href={`/elaqe/musteriler/${c.id}`}
              className="inline-flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-secondary hover:text-foreground"
              title="Aç"
            >
              <ExternalLink className="h-3 w-3" />
            </Link>
          </label>
        ))}
      </div>
      <div className="mt-2.5 flex items-center justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={() => toast.info("Qeyd edildi (saxlama növbəti versiyada)")} disabled={pending}>
          Fərqlidir
        </Button>
        <Button size="sm" onClick={onMerge} disabled={pending}>
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Merge className="h-3.5 w-3.5" />}
          Birləşdir
        </Button>
      </div>
    </div>
  );
}
