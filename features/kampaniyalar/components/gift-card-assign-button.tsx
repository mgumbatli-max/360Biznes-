"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, Loader2, Search, Check } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { assignGiftCardToCustomer } from "../actions";
import {
  searchKontragentForBonusBlacklist,
  getTopKontragents,
  type ExcludedKontragent,
} from "@/features/iscilier/bonus-profile-actions";

export function GiftCardAssignButton({ kartId, currentName }: { kartId: string; currentName: string | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<ExcludedKontragent[]>([]);
  const [searching, setSearching] = useState(false);
  const [pending, startTransition] = useTransition();
  const dbRef = useRef<number | null>(null);

  // Dialog açılanda default 30 müştəri yüklə (axtarışsız da görünsün)
  useEffect(() => {
    if (!open) return;
    if (q.trim().length >= 2) return; // axtarışda olarsa default-a düşmə
    setSearching(true);
    getTopKontragents("musteri").then((rows) => {
      setResults(rows);
      setSearching(false);
    });
  }, [open, q]);

  // Axtarış — 2+ simvolda fəal
  useEffect(() => {
    if (dbRef.current) window.clearTimeout(dbRef.current);
    if (q.trim().length < 2) return;
    setSearching(true);
    dbRef.current = window.setTimeout(async () => {
      const r = await searchKontragentForBonusBlacklist(q);
      setResults(r);
      setSearching(false);
    }, 220);
    return () => {
      if (dbRef.current) window.clearTimeout(dbRef.current);
    };
  }, [q]);

  function onPick(k: ExcludedKontragent) {
    startTransition(async () => {
      const res = await assignGiftCardToCustomer(kartId, k.id);
      if (res.ok) {
        toast.success(`Müştəriyə təyin olundu: ${k.ad}`);
        setOpen(false);
        setQ("");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="inline-flex flex-1 items-center justify-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-[11px] font-medium hover:bg-secondary"
        >
          <UserPlus className="h-3 w-3" />
          {currentName ? "Müştərini dəyiş" : "Müştəriyə təyin"}
        </button>
      </DialogTrigger>
      <DialogContent className="md:max-w-md">
        <DialogHeader>
          <DialogTitle>Hədiyyə kartını müştəriyə təyin et</DialogTitle>
        </DialogHeader>
        {currentName && (
          <p className="text-xs text-muted-foreground">
            İndi: <b className="text-foreground">{currentName}</b>. Yeni müştəri seç və ya bağla.
          </p>
        )}
        <div className="space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Müştəri adı / telefon / VÖEN..."
              className="h-9 w-full rounded-md border border-input bg-background pl-8 pr-3 text-sm"
              autoFocus
            />
          </div>
          {searching && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" /> Axtarılır...
            </div>
          )}
          {!searching && q.trim().length >= 2 && results.length === 0 && (
            <p className="text-xs text-muted-foreground">Tapılmadı. Daha az hərflə cəhd edin.</p>
          )}
          {results.length > 0 && (
            <ul className="max-h-60 overflow-y-auto rounded-md border border-border divide-y divide-border/40">
              {results.map((k) => (
                <li key={k.id}>
                  <button
                    type="button"
                    onClick={() => onPick(k)}
                    disabled={pending}
                    className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-secondary"
                  >
                    <span className="truncate">{k.ad}</span>
                    <Check className="h-3 w-3 text-muted-foreground" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
            Bağla
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
