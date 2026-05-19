"use client";

import { useMemo, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import {
  Search,
  X,
  Plus,
  type LucideIcon,
  FileText,
  ShoppingBag,
  BadgeDollarSign,
  HandHelping,
  Gift,
  AlertOctagon,
  Crown,
  ScrollText,
  ArrowRightLeft,
  Repeat2,
  Diamond,
  PackageMinus,
  PiggyBank,
  Wallet,
  Coins,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { KIND_META, type OperationQrup, type OperationTip } from "./quick-op-dialog";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type GroupDef = {
  kod: OperationQrup;
  baslik: string;
  accent: string;
};

const GROUPS: GroupDef[] = [
  { kod: "qaime",      baslik: "Qaimə (mədaxil)", accent: "text-emerald-600 dark:text-emerald-400" },
  { kod: "xercler",    baslik: "Xərclər",          accent: "text-rose-600 dark:text-rose-400" },
  { kod: "maas_isci",  baslik: "Əməkdaş",          accent: "text-sky-600 dark:text-sky-400" },
  { kod: "transfer",   baslik: "Transfer",         accent: "text-indigo-600 dark:text-indigo-400" },
  { kod: "sahibkar",   baslik: "Sahibkar",         accent: "text-fuchsia-600 dark:text-fuchsia-400" },
  { kod: "duzelis",    baslik: "Düzəliş",          accent: "text-violet-600 dark:text-violet-400" },
  { kod: "borclar",    baslik: "Borc",             accent: "text-amber-600 dark:text-amber-400" },
];

const GROUP_TILE: Record<OperationQrup, string> = {
  qaime:      "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  xercler:    "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
  maas_isci:  "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
  transfer:   "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300",
  sahibkar:   "bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-500/15 dark:text-fuchsia-300",
  duzelis:    "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
  borclar:    "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
};

const TIP_BADGE: Record<OperationTip, { ad: string; cls: string }> = {
  medaxil:  { ad: "Mədaxil",  cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300" },
  mexaric:  { ad: "Məxaric",  cls: "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300" },
  transfer: { ad: "Transfer", cls: "bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300" },
  xususi:   { ad: "Xüsusi",   cls: "bg-slate-200 text-slate-700 dark:bg-slate-500/25 dark:text-slate-200" },
};

const ICON_MAP: Record<string, LucideIcon> = {
  qaime: FileText,
  xercler: ShoppingBag,
  maas: BadgeDollarSign,
  avans: HandHelping,
  bonus: Gift,
  cerime: AlertOctagon,
  tesisci_pul: Crown,
  tehtl_hesab: ScrollText,
  transfer: ArrowRightLeft,
  valyuta_mubadile: Repeat2,
  dividend: Diamond,
  borc_silinme: PackageMinus,
  artirma: PiggyBank,
  azaltma: Wallet,
  barter: Repeat2,
};

const FALLBACK_ICON: LucideIcon = Coins;

function normalize(s: string): string {
  return s.toLocaleLowerCase("az").trim();
}

export function OpPickerDialog({ open, onOpenChange }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [query, setQuery] = useState<string>("");

  const grouped = useMemo(() => {
    const q = normalize(query);
    const groupAdMap = new Map(GROUPS.map((g) => [g.kod, normalize(g.baslik)]));
    const filtered = Object.entries(KIND_META).filter(([kod, meta]) => {
      if (!q) return true;
      const hay = [
        kod,
        normalize(meta.ad),
        groupAdMap.get(meta.qrup) ?? "",
        meta.qrup,
      ].join(" ");
      return hay.includes(q);
    });
    const byGroup = new Map<OperationQrup, { kod: string; meta: typeof KIND_META[string] }[]>();
    for (const [kod, meta] of filtered) {
      const arr = byGroup.get(meta.qrup) ?? [];
      arr.push({ kod, meta });
      byGroup.set(meta.qrup, arr);
    }
    return byGroup;
  }, [query]);

  function pick(kod: string) {
    onOpenChange(false);
    setQuery("");
    // Yeni iş axını — Prospect ERP üslubunda tək səhifə açılır.
    const params = new URLSearchParams(sp.toString());
    params.set("tip", kod);
    router.push(`/maliyye/emeliyyat/yeni?${params.toString()}`);
  }

  const totalShown = Array.from(grouped.values()).reduce((acc, arr) => acc + arr.length, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="md:max-w-4xl max-h-[88vh] overflow-hidden p-0 gap-0"
      >
        <DialogHeader className="px-6 pt-5 pb-3 border-b border-border">
          <div className="flex items-center justify-between gap-3">
            <DialogTitle className="flex items-center gap-2 text-base">
              <Search className="h-4 w-4 text-muted-foreground" aria-hidden />
              <span>Yeni əməliyyat</span>
            </DialogTitle>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground"
              aria-label="Bağla"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="relative mt-3">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Əməliyyat növü axtar..."
              autoFocus
              className="h-10 w-full rounded-lg border border-input bg-background pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </DialogHeader>

        <div className="px-6 py-4 space-y-5 overflow-y-auto max-h-[calc(88vh-9.5rem)]">
          {totalShown === 0 && (
            <div className="rounded-lg border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
              Heç bir əməliyyat tapılmadı
            </div>
          )}
          {GROUPS.map((g) => {
            const items = grouped.get(g.kod);
            if (!items || items.length === 0) return null;
            return (
              <section key={g.kod}>
                <h3 className={`mb-2 text-[10.5px] font-semibold uppercase tracking-wider ${g.accent}`}>
                  {g.baslik}
                </h3>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {items.map(({ kod, meta }) => {
                    const Icon = ICON_MAP[kod] ?? FALLBACK_ICON;
                    const tipInfo = TIP_BADGE[meta.tip];
                    return (
                      <button
                        key={kod}
                        type="button"
                        data-op-pick={kod}
                        onClick={() => pick(kod)}
                        className="group flex items-start gap-2.5 rounded-lg border border-border bg-card/40 p-2.5 text-left transition hover:scale-[1.02] hover:border-primary/40 hover:ring-1 hover:ring-primary/30 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-ring"
                      >
                        <span
                          className={`flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-md ${GROUP_TILE[meta.qrup]}`}
                          aria-hidden
                        >
                          <Icon className="h-4 w-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-medium leading-tight text-foreground line-clamp-2">
                            {meta.ad}
                          </span>
                          <span
                            className={`mt-1 inline-flex items-center rounded px-1.5 py-px text-[10px] font-semibold uppercase tracking-wider ${tipInfo.cls}`}
                          >
                            {tipInfo.ad}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}

type TriggerProps = {
  label?: string;
  className?: string;
};

export function OpPickerTrigger({ label = "Yeni əməliyyat", className }: TriggerProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          className ??
          "inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-white shadow-sm hover:shadow"
        }
        style={{ background: "var(--brand-gradient)" }}
      >
        <Plus className="h-3.5 w-3.5" />
        <span>{label}</span>
      </button>
      <OpPickerDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
