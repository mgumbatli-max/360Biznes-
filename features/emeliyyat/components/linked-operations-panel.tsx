"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  CreditCard,
  FileText,
  Package,
  Wrench,
  Eye,
  ExternalLink,
  Loader2,
  X,
  ShieldAlert,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn, formatMoney } from "@/lib/utils";
import { OperationQuickView } from "@/features/ticaret/components/operation-quick-view";
import {
  getLinkedOperationsAction,
  type LinkedOp,
  type LinkedOpType,
} from "../linked-operations-action";
import { cancelLinkedOperation } from "../cancel-linked";

const TYPE_ICON: Record<LinkedOpType, React.ReactNode> = {
  satis: <FileText className="h-4 w-4 shrink-0" />,
  alis: <FileText className="h-4 w-4 shrink-0" />,
  maliyye: <CreditCard className="h-4 w-4 shrink-0" />,
  qaytarma: <FileText className="h-4 w-4 shrink-0" />,
  transfer: <Package className="h-4 w-4 shrink-0" />,
  servis: <Wrench className="h-4 w-4 shrink-0" />,
};

const TYPE_LABEL: Record<LinkedOpType, string> = {
  satis: "Satış",
  alis: "Alış",
  maliyye: "Maliyyə",
  qaytarma: "Qaytarma",
  transfer: "Transfer",
  servis: "Servis",
};

// Yerindəcə (in-place) ləğv yalnız bu tiplər üçün mövcud cancel action-ına yönəlir.
const CANCELLABLE: ReadonlySet<LinkedOpType> = new Set<LinkedOpType>([
  "satis",
  "alis",
  "maliyye",
  "qaytarma",
]);

// Inline QuickView yalnız satis/alis dəstəkləyir; qalanları deep-link.
const QUICKVIEW_TYPES: ReadonlySet<LinkedOpType> = new Set<LinkedOpType>([
  "satis",
  "alis",
]);

function isoToDate(iso: string | null): string {
  if (!iso) return "—";
  return iso.slice(0, 10);
}

export function LinkedOperationsPanel({
  target,
  mode,
  onResolved,
}: {
  target: { type: LinkedOpType; id: string };
  mode: "view" | "resolve";
  onResolved?: () => void;
}) {
  const [links, setLinks] = useState<LinkedOp[] | null>(null);
  const [loading, startLoading] = useTransition();

  // Inline QuickView (yalnız satis/alis).
  const [quick, setQuick] = useState<{ nov: "satis" | "alis"; id: string; href: string } | null>(
    null,
  );

  const reload = useCallback(() => {
    startLoading(async () => {
      const data = await getLinkedOperationsAction(target);
      setLinks(data);
    });
    // startLoading qeyri-async olduğu üçün burada Promise qaytarmırıq.
  }, [target]);

  useEffect(() => {
    reload();
  }, [reload]);

  // resolve rejimində: bütün bloklayanlar həll olunanda parent-ə bildir.
  useEffect(() => {
    if (mode !== "resolve" || links === null) return;
    const remaining = links.filter((l) => l.blocks).length;
    if (remaining === 0) onResolved?.();
  }, [links, mode, onResolved]);

  if (loading && links === null) {
    return (
      <div className="space-y-2 py-1">
        {[0, 1].map((i) => (
          <div key={i} className="h-12 w-full animate-pulse rounded-md bg-muted/60" />
        ))}
      </div>
    );
  }

  if (links !== null && links.length === 0) {
    return (
      <p className="py-3 text-center text-xs text-muted-foreground">
        Bağlı əməliyyat yoxdur
      </p>
    );
  }

  // resolve rejimində bloklayanlar əvvəl (vurğulu).
  const ordered =
    mode === "resolve" && links
      ? [...links].sort((a, b) => Number(b.blocks) - Number(a.blocks))
      : (links ?? []);

  return (
    <div className="space-y-2">
      {mode === "resolve" && (
        <p className="text-xs font-medium text-muted-foreground">
          Əvvəlcə bağlı əməliyyatları həll edin:
        </p>
      )}

      <ul className="space-y-2">
        {ordered.map((op) => (
          <LinkedRow
            key={`${op.type}:${op.id}`}
            op={op}
            mode={mode}
            onView={() => {
              if (QUICKVIEW_TYPES.has(op.type)) {
                setQuick({ nov: op.type as "satis" | "alis", id: op.id, href: op.href });
              }
            }}
            onResolved={reload}
          />
        ))}
      </ul>

      {quick && (
        <OperationQuickView
          open
          onOpenChange={(v) => {
            if (!v) setQuick(null);
          }}
          nov={quick.nov}
          id={quick.id}
          detailHref={quick.href}
        />
      )}
    </div>
  );
}

function LinkedRow({
  op,
  mode,
  onView,
  onResolved,
}: {
  op: LinkedOp;
  mode: "view" | "resolve";
  onView: () => void;
  onResolved: () => void;
}) {
  const canQuickView = QUICKVIEW_TYPES.has(op.type);
  const canCancel = CANCELLABLE.has(op.type);
  const highlight = mode === "resolve" && op.blocks;

  return (
    <li
      className={cn(
        "rounded-md border bg-card/40 px-3 py-2.5 transition-colors",
        highlight ? "border-destructive/40 bg-destructive/5" : "border-border/50",
      )}
    >
      <div className="flex items-center gap-3">
        <span className="text-muted-foreground">{TYPE_ICON[op.type]}</span>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              {TYPE_LABEL[op.type]}
            </span>
            <span className="truncate text-xs font-medium text-foreground/90">{op.rol}</span>
            {highlight && (
              <Badge variant="destructive" className="gap-1 text-[9px]">
                <ShieldAlert className="h-3 w-3" />
                Bloklayır
              </Badge>
            )}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10.5px] text-muted-foreground">
            <span className="truncate font-mono">{op.nomre}</span>
            <span>· {formatMoney(op.mebleg)}</span>
            <span>· {isoToDate(op.tarix)}</span>
            {op.status && (
              <Badge variant="outline" className="text-[9px] uppercase tracking-wide">
                {op.status}
              </Badge>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {canQuickView ? (
            <Button size="xs" variant="outline" onClick={onView}>
              <Eye className="h-3 w-3" />
              Bax
            </Button>
          ) : (
            <Button size="xs" variant="outline" asChild>
              <Link href={op.href} target="_blank" rel="noopener">
                <ExternalLink className="h-3 w-3" />
                Bax
              </Link>
            </Button>
          )}

          {canCancel && <CancelLinkedDialog op={op} onResolved={onResolved} />}
        </div>
      </div>
    </li>
  );
}

function CancelLinkedDialog({
  op,
  onResolved,
}: {
  op: LinkedOp;
  onResolved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();
  // Bu op-un öz blocker-ləri (zəncir növbəti səviyyəsi).
  const [chain, setChain] = useState<{ type: LinkedOpType; id: string } | null>(null);
  const [chainError, setChainError] = useState<{ error: string; hint?: string } | null>(null);

  function onConfirm() {
    const r = reason.trim();
    if (r.length < 3) {
      toast.error("Səbəb ən azı 3 simvol olmalıdır");
      return;
    }
    startTransition(async () => {
      const res = await cancelLinkedOperation({ type: op.type, id: op.id }, r);
      if (res.ok) {
        toast.success("Ləğv edildi");
        setOpen(false);
        setReason("");
        setChain(null);
        setChainError(null);
        onResolved();
        return;
      }
      // Bloklanıb: bu op-un öz bağlı əməliyyatlarını zəncir kimi göstər.
      if (res.blockers && res.blockers.length > 0) {
        setChain({ type: op.type, id: op.id });
        setChainError({ error: res.error, hint: res.hint });
        toast.error(res.error, { description: res.hint });
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) {
          setReason("");
          setChain(null);
          setChainError(null);
        }
      }}
    >
      <Button size="xs" variant="destructive" onClick={() => setOpen(true)}>
        <X className="h-3 w-3" />
        Ləğv et
      </Button>

      <DialogContent className="md:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-base">
            {TYPE_LABEL[op.type]} ləğvi — {op.rol}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {chain && chainError ? (
            // Zəncir: bu op-un öz blokları — yenidən təsdiq+səbəb (auto-ləğv YOX).
            <div className="space-y-2">
              <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                <div className="font-medium">{chainError.error}</div>
                {chainError.hint && (
                  <p className="mt-1 opacity-90">{chainError.hint}</p>
                )}
              </div>
              <LinkedOperationsPanel
                mode="resolve"
                target={chain}
                onResolved={() => {
                  // Alt-blok təmizləndi → istifadəçi yenidən "Təsdiq et" basa bilər.
                  setChain(null);
                  setChainError(null);
                }}
              />
            </div>
          ) : (
            <div className="space-y-2">
              <label htmlFor="cancel-reason" className="text-sm font-medium">
                Səbəb *
              </label>
              <textarea
                id="cancel-reason"
                rows={3}
                required
                autoFocus
                maxLength={2000}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Ləğv səbəbini yazın (min 3 simvol)…"
                className="flex w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                disabled={pending}
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => setOpen(false)}
            disabled={pending}
          >
            İmtina
          </Button>
          {!chain && (
            <Button
              type="button"
              variant="destructive"
              onClick={onConfirm}
              disabled={pending || reason.trim().length < 3}
            >
              {pending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              Təsdiq et
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
