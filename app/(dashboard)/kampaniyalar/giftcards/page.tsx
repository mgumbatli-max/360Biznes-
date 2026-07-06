import type { Metadata } from "next";
import Link from "next/link";
import { CreditCard, ChevronLeft } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getGiftCards } from "@/features/kampaniyalar/queries";
import { cn, formatMoney, formatDate } from "@/lib/utils";
import { GiftCardCreateButton } from "@/features/kampaniyalar/components/gift-card-create-button";
import { GiftCardAssignButton } from "@/features/kampaniyalar/components/gift-card-assign-button";
import { GiftCardRedeemButton } from "@/features/kampaniyalar/components/gift-card-redeem-button";

export const metadata: Metadata = { title: "Hədiyyə kartları" };

export default async function GiftCardsPage() {
  const cards = await getGiftCards();
  const active = cards.filter((c) => c.aktiv && Number(c.qaliq) > 0);
  const used = cards.filter((c) => !c.aktiv || Number(c.qaliq) === 0);

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <Link href="/kampaniyalar" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ChevronLeft className="h-3 w-3" /> Kampaniyalar
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br from-fuchsia-500 to-purple-600 text-white shadow-lg">
            <CreditCard className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Hədiyyə kartları</h1>
            <p className="text-sm text-muted-foreground">
              Hədiyyə kartı sat və ya qaytarmada mağaza krediti ver — sonra ödəniş kimi istifadə et
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <GiftCardRedeemButton />
          <GiftCardCreateButton />
        </div>
      </header>

      <section className="space-y-2">
        <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-muted-foreground">
          Aktiv kartlar ({active.length})
        </h2>
        {active.length === 0 ? (
          <Card className="glass border-dashed">
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              Hələ aktiv hədiyyə kartı yoxdur — yuxarıdan yeni kart yarat.
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {active.map((c) => (
              <Card key={c.id} className="glass overflow-hidden">
                <div className={cn("h-2 bg-gradient-to-r from-fuchsia-500 to-purple-600")} />
                <CardContent className="space-y-2 py-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <code className="rounded bg-secondary/60 px-2 py-0.5 font-mono text-xs">{c.kart_kod}</code>
                      {c.kontragentler && (
                        <div className="mt-1 text-xs text-muted-foreground">→ {c.kontragentler.ad}</div>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/10 text-emerald-500 text-[10px]">Aktiv</Badge>
                      {c.qaytaran_satis_id && (
                        <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-600 text-[10px]">Mağaza krediti</Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex items-baseline justify-between border-t border-border/40 pt-2">
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Qalıq</div>
                      <div className="text-xl font-bold tabular-nums text-fuchsia-500">{formatMoney(Number(c.qaliq))}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Nominal</div>
                      <div className="text-sm tabular-nums text-muted-foreground">{formatMoney(Number(c.nominal))}</div>
                    </div>
                  </div>
                  <div className="text-[10.5px] text-muted-foreground">
                    Yaradıldı: {formatDate(c.yaradildi, { day: "2-digit", month: "short", year: "numeric" })}
                    {c.bitme_tarixi && (
                      <span className="ml-2">· Bitir: {formatDate(c.bitme_tarixi, { day: "2-digit", month: "short" })}</span>
                    )}
                  </div>
                  <div className="flex gap-1 border-t border-border/40 pt-2">
                    <Link
                      href={`/kampaniyalar/giftcards/${c.id}/print`}
                      target="_blank"
                      className="inline-flex flex-1 items-center justify-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-[11px] font-medium hover:bg-secondary"
                    >
                      🖨️ Çap et
                    </Link>
                    <GiftCardAssignButton kartId={c.id} currentName={c.kontragentler?.ad ?? null} />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {used.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-muted-foreground">
            İstifadə olunmuş / passiv ({used.length})
          </h2>
          <ul className="divide-y divide-border/40 rounded-lg border border-border bg-card/40">
            {used.slice(0, 10).map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 px-3 py-2 text-xs">
                <code className="font-mono">{c.kart_kod}</code>
                <span className="text-muted-foreground">{c.kontragentler?.ad ?? "—"}</span>
                <span className="text-muted-foreground">{formatMoney(Number(c.nominal))}</span>
                <Badge variant="outline" className="text-[10px]">{c.aktiv ? "boş" : "ləğv"}</Badge>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
