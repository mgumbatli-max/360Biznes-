"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { ScanLine, Search, Loader2, X, User } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn, formatMoney } from "@/lib/utils";
import { findLoyaltyCard, type FoundLoyaltyCard } from "../actions";
import { TIER_META, type LoyaltyTier } from "../types";

type Props = {
  /** Tapılan kart valideyninə qaytarmaq üçün callback (POS-da satışa qoşmaq) */
  onFound?: (card: FoundLoyaltyCard) => void;
  /** Avtomatik focus saxlasın — POS-da scanner-in işləməsi üçün vacibdir */
  autoFocus?: boolean;
  /** Kompakt görüntü (header-də istifadə üçün) */
  compact?: boolean;
};

/**
 * Loyalty kart axtarış komponenti.
 * Scanner barkod oxutduqda və ya kassir əl ilə kod/telefon/ad daxil etdikdə işə düşür.
 * - Enter basıldıqda axtarış
 * - 300ms debounce avtomatik axtarış (3+ simvol)
 * - Tapılmasa "Tapılmadı" göstərir
 * - Tapılarsa kart info paneli açılır
 */
export function CardScanner({ onFound, autoFocus, compact }: Props) {
  const [query, setQuery] = useState("");
  const [card, setCard] = useState<FoundLoyaltyCard | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const debounceRef = useRef<number | null>(null);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  // Avtomatik axtarış (debounced)
  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    if (query.trim().length < 3) {
      setCard(null);
      setNotFound(false);
      return;
    }
    debounceRef.current = window.setTimeout(() => {
      startTransition(async () => {
        const found = await findLoyaltyCard(query);
        setCard(found);
        setNotFound(!found);
        if (found && onFound) onFound(found);
      });
    }, 300);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [query, onFound]);

  function clear() {
    setQuery("");
    setCard(null);
    setNotFound(false);
    inputRef.current?.focus();
  }

  return (
    <div className="space-y-3">
      {/* Input */}
      <div className="relative">
        <ScanLine className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Kart kodunu skan et və ya telefon/ad yaz..."
          className={cn(
            "w-full rounded-lg border-2 border-violet-500/30 bg-background pl-10 pr-10 font-mono text-sm shadow-sm focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20",
            compact ? "h-9" : "h-12 text-base",
          )}
          autoComplete="off"
          spellCheck={false}
          maxLength={50}
        />
        {pending && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />}
        {query && !pending && (
          <button
            type="button"
            onClick={clear}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:bg-secondary"
            aria-label="Təmizlə"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* İpucu */}
      {!query && !compact && (
        <p className="text-[10.5px] text-muted-foreground">
          💡 Barkod scanner-i USB-yə qoşun və kartı skan edin. Ya da telefon nömrəsi / kart kodu / müştəri adını yazın.
        </p>
      )}

      {/* Nəticə */}
      {card && (
        <CardResult card={card} />
      )}
      {notFound && query.length >= 3 && !pending && (
        <div className="flex items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/5 px-3 py-2 text-xs">
          <Search className="h-3.5 w-3.5 text-rose-500" />
          <span>
            <b>«{query}»</b> üçün kart tapılmadı. Yeni müştəri qeydiyyatdan keçirin və kart avto-yaranacaq.
          </span>
        </div>
      )}
    </div>
  );
}

function CardResult({ card }: { card: FoundLoyaltyCard }) {
  const tierMeta = TIER_META[card.tier as LoyaltyTier] ?? TIER_META.bronze;
  return (
    <Card className="overflow-hidden border-emerald-500/30 bg-gradient-to-br from-emerald-500/5 via-card to-background animate-fade-in">
      <CardContent className="space-y-2 py-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-3 min-w-0">
            <div className={cn("grid h-11 w-11 flex-shrink-0 place-items-center rounded-2xl text-xl shadow-sm", tierMeta.reng)}>
              {tierMeta.emoji}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <Link href={`/elaqe/musteriler/${card.kontragent.id}`} className="font-bold hover:text-primary">
                  {card.kontragent.ad}
                </Link>
                <Badge variant="outline" className={cn("text-[10px]", tierMeta.reng)}>
                  {tierMeta.emoji} {tierMeta.ad}
                </Badge>
              </div>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10.5px] text-muted-foreground">
                <code className="font-mono">{card.kart_kod}</code>
                {card.kontragent.telefon && (
                  <>
                    <span className="text-muted-foreground/40">·</span>
                    <span>{card.kontragent.telefon}</span>
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Balans</div>
            <div className="text-xl font-bold tabular-nums text-emerald-500">{formatMoney(card.balans)}</div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 border-t border-border/40 pt-2 text-[11px] text-muted-foreground">
          <Badge variant="outline" className="text-[10px]">🎁 +{tierMeta.bonusPct}% bonus</Badge>
          {tierMeta.endirimPct > 0 && (
            <Badge variant="outline" className="text-[10px]">💰 {tierMeta.endirimPct}% endirim</Badge>
          )}
          <span className="ml-auto">Həyatlik qazanc: <b className="text-foreground">{formatMoney(card.total_qazanc)}</b></span>
        </div>
        <div className="flex items-center gap-1.5">
          <Button asChild size="sm" variant="outline" className="flex-1">
            <Link href={`/elaqe/musteriler/${card.kontragent.id}`}>
              <User className="h-3 w-3" /> Müştəri profili
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
