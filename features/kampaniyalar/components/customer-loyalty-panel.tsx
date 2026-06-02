import "server-only";
import Link from "next/link";
import { Star, Plus, Printer, History } from "lucide-react";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TIER_META, type LoyaltyTier } from "@/features/kampaniyalar/types";
import { cn, formatMoney, formatDate } from "@/lib/utils";
import { CustomerLoyaltyActions } from "./customer-loyalty-actions";

async function getCustomerCard(kontragentId: string) {
  return withTenant(async () => {
    return prisma.loyalty_cards.findFirst({
      where: { kontragent_id: kontragentId },
      include: {
        loyalty_tx: { orderBy: { yaradildi: "desc" }, take: 5 },
      },
    });
  });
}

export async function CustomerLoyaltyPanel({ kontragentId }: { kontragentId: string }) {
  const card = await getCustomerCard(kontragentId);

  // Kart yoxdursa — yaratmaq düyməsi göstər
  if (!card) {
    return (
      <Card className="glass border-dashed border-amber-500/30 bg-amber-500/[0.03]">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 py-3">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-amber-500/15">
              <Star className="h-5 w-5 text-amber-500" />
            </div>
            <div>
              <p className="font-semibold">Loyalty kart yoxdur</p>
              <p className="text-xs text-muted-foreground">
                Bu müştəri sadiqlik proqramına qoşulmayıb. Kart açıb bonus toplama başla.
              </p>
            </div>
          </div>
          <CustomerLoyaltyActions kontragentId={kontragentId} hasCard={false} />
        </CardContent>
      </Card>
    );
  }

  const tierMeta = TIER_META[card.tier as LoyaltyTier] ?? TIER_META.bronze;
  const balans = Number(card.balans);
  const totalQazanc = Number(card.total_qazanc);
  const totalSerf = Number(card.total_serf);

  return (
    <Card className="glass overflow-hidden border-amber-500/30">
      <div aria-hidden className={cn("h-1 bg-gradient-to-r", tierMeta.reng)} />
      <CardHeader className="flex flex-row items-start justify-between gap-3 pb-2">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <Star className="h-4 w-4 text-amber-500" /> Loyalty kart
            <Badge variant="outline" className={cn("text-[10px]", tierMeta.reng)}>
              {tierMeta.emoji} {tierMeta.ad}
            </Badge>
          </CardTitle>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Kart kodu: <code className="rounded bg-secondary/60 px-1.5 py-0.5 font-mono">{card.kart_kod}</code>
          </p>
        </div>
        <div className="flex gap-1.5">
          <Button asChild size="sm" variant="outline">
            <Link href={`/kampaniyalar/kart/${card.id}/print`} target="_blank">
              <Printer className="h-3 w-3" /> Çap
            </Link>
          </Button>
          <CustomerLoyaltyActions kontragentId={kontragentId} hasCard={true} kartId={card.id} balans={balans} />
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-2.5">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Cari balans</div>
            <div className="mt-0.5 text-xl font-bold tabular-nums text-emerald-500">{formatMoney(balans)}</div>
          </div>
          <div className="rounded-lg border border-border bg-secondary/30 p-2.5">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Cəm qazanc</div>
            <div className="mt-0.5 text-xl font-bold tabular-nums">{formatMoney(totalQazanc)}</div>
          </div>
          <div className="rounded-lg border border-border bg-secondary/30 p-2.5">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Cəm sərf</div>
            <div className="mt-0.5 text-xl font-bold tabular-nums text-muted-foreground">{formatMoney(totalSerf)}</div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="outline" className="text-[10px]">🎁 +{tierMeta.bonusPct}% hər satışdan</Badge>
          {tierMeta.endirimPct > 0 && (
            <Badge variant="outline" className="text-[10px]">💰 {tierMeta.endirimPct}% endirim</Badge>
          )}
          {card.son_alish_de && (
            <Badge variant="outline" className="text-[10px]">
              <History className="mr-0.5 h-2.5 w-2.5" /> Son alış: {formatDate(card.son_alish_de, { day: "2-digit", month: "short" })}
            </Badge>
          )}
        </div>

        {card.loyalty_tx.length > 0 && (
          <div className="border-t border-border/40 pt-2">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
              Son 5 əməliyyat
            </div>
            <ul className="space-y-0.5">
              {card.loyalty_tx.map((t) => (
                <li key={String(t.id)} className="flex items-center justify-between gap-2 text-[11px]">
                  <span className="text-muted-foreground">
                    {formatDate(t.yaradildi, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                    {t.qeyd && <span className="ml-1 italic">· {t.qeyd}</span>}
                  </span>
                  <span className={cn(
                    "tabular-nums font-semibold",
                    Number(t.mebleg) > 0 ? "text-emerald-500" : "text-rose-500",
                  )}>
                    {Number(t.mebleg) > 0 ? "+" : ""}{formatMoney(Number(t.mebleg))}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
