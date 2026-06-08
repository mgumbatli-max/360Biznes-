"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Save, Loader2, X, Sparkles, ScanBarcode } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { setProductBarcode, setProductCost, setProductSalePrice } from "../quick-fix-actions";
import { ImageEditPopover } from "./image-edit-popover";
import { formatMoney } from "@/lib/utils";

/**
 * Inline barcode editor — used in /anbar/hesabat?mod=barkodsuz and
 * also embedded inside QuickView for any product.
 *
 * Renders a small input + Save button + "Avto yarat" (EAN-13) generator.
 */
export function BarcodeFix({ id, current, compact, onSuccess }: {
  id: string;
  current: string | null;
  compact?: boolean;
  onSuccess?: () => void;
}) {
  const router = useRouter();
  const [value, setValue] = useState(current ?? "");
  const [pending, startTransition] = useTransition();

  function generate() {
    const base = Array.from({ length: 12 }, () => Math.floor(Math.random() * 10)).join("");
    let sum = 0;
    for (let i = 0; i < 12; i++) sum += Number(base[i]) * (i % 2 === 0 ? 1 : 3);
    const check = (10 - (sum % 10)) % 10;
    setValue(base + check);
  }

  function save() {
    if (!value || value.trim().length < 3) {
      toast.error("Barkod ən az 3 simvol olmalıdır");
      return;
    }
    startTransition(async () => {
      const r = await setProductBarcode({ id, barkod: value.trim() });
      if (r.ok) {
        toast.success(current ? "Barkod yeniləndi" : "Barkod təyin edildi");
        onSuccess?.();
        router.refresh();
      } else {
        toast.error(r.error);
      }
    });
  }

  return (
    <div className={compact ? "flex items-center gap-1" : "flex flex-col gap-1.5"}>
      <Input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Barkod..."
        disabled={pending}
        className={compact ? "h-7 w-32 px-2 font-mono text-xs" : "h-8 font-mono"}
      />
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={generate}
          disabled={pending}
          title="Avto generasiya (EAN-13)"
          className="inline-flex h-7 items-center gap-1 rounded border border-border bg-secondary/40 px-2 text-[10px] font-semibold hover:bg-secondary"
        >
          <Sparkles className="h-3 w-3" /> Avto
        </button>
        <Button
          type="button"
          size="sm"
          disabled={pending || !value.trim() || value.trim() === current}
          onClick={save}
          className="h-7 px-2 font-semibold text-white"
          style={{ background: "var(--brand-gradient)" }}
        >
          {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
          Saxla
        </Button>
      </div>
    </div>
  );
}

// ❌ DEPRECATED: CostFix silindi.
// Maya yalnız alış qaiməsindən hesablanır — birbaşa redaktə yoxdur.
// İstifadəçi "Mayasız məhsullar" hesabatından "Alış yarat" linkinə yönlədilir.

/**
 * Inline sale-price editor (satis_qiymeti) — for "qiymetsiz" problem rows.
 */
export function SalePriceFix({ id, current, onSuccess }: { id: string; current: number; onSuccess?: () => void }) {
  return <NumberFix id={id} current={current} action="sale" placeholder="Satış ₼" onSuccess={onSuccess} />;
}

function NumberFix({ id, current, action, placeholder, onSuccess }: {
  id: string;
  current: number;
  action: "cost" | "sale";
  placeholder: string;
  onSuccess?: () => void;
}) {
  const router = useRouter();
  const [value, setValue] = useState(String(current || ""));
  const [pending, startTransition] = useTransition();

  function save() {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) {
      toast.error("0-dan böyük rəqəm daxil edin");
      return;
    }
    startTransition(async () => {
      const r = action === "cost"
        ? await setProductCost({ id, value: n })
        : await setProductSalePrice({ id, value: n });
      if (r.ok) {
        toast.success("Yeniləndi");
        onSuccess?.();
        router.refresh();
      } else {
        toast.error(r.error);
      }
    });
  }

  return (
    <div className="flex items-center gap-1">
      <Input
        type="number"
        min={0}
        step="0.01"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        disabled={pending}
        className="h-7 w-24 px-2 text-right text-xs tabular-nums"
      />
      <Button
        type="button"
        size="sm"
        disabled={pending || !value.trim() || Number(value) === current}
        onClick={save}
        className="h-7 px-2 font-semibold text-white"
        style={{ background: "var(--brand-gradient)" }}
      >
        {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
      </Button>
    </div>
  );
}

/**
 * Image quick-fix cell — for "sekilsiz" problem rows.
 * Uses existing ImageEditPopover (URL / Computer / AI tabs).
 */
export function ImageFix({ id, productName, current, onSuccess }: {
  id: string;
  productName: string;
  current: string | null;
  onSuccess?: () => void;
}) {
  return (
    <ImageEditPopover
      mehsulId={id}
      currentUrl={current}
      productName={productName}
      label={current ? "Dəyiş" : "Şəkil əlavə et"}
      onSuccess={onSuccess}
    />
  );
}
