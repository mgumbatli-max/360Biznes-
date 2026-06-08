"use client";

import { useTransition } from "react";
import { Coins, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Combobox, type ComboOption } from "@/components/ui/combobox";
import { toast } from "sonner";
import { openKassa } from "../session-actions";
import type { FilialOption } from "../session-queries";
import { useState } from "react";

type HesabOpt = { id: string; ad: string; nov: string };

export function OpenSessionCard({
  filiallar,
  hesablar = [],
}: {
  filiallar: FilialOption[];
  hesablar?: HesabOpt[];
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [filialId, setFilialId] = useState<string>(filiallar[0]?.id ? String(filiallar[0].id) : "");
  // Default — ilk nağd hesab (POS adətən nağd-dır)
  const defaultHesab = hesablar.find((h) => h.nov === "negd") ?? hesablar[0];
  const [hesabId, setHesabId] = useState<string>(defaultHesab?.id ?? "");

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        const res = await openKassa(fd);
        if (!res.ok) {
          setError(res.error);
          toast.error(res.error);
        } else {
          toast.success("Sessiya açıldı");
        }
      } catch (err) {
        // Uncaught exception (network drop, server timeout, Vercel cold-start fail).
        // Əvvəlcə bu yerdə yalnız console.error olurdu, istifadəçi spinner-i
        // əbədi görürdü — indi açıq error mesajı göstərilir.
        const msg = err instanceof Error ? err.message : "Naməlum xəta — şəbəkə və ya server problemi";
        console.error("[openKassa] uncaught", err);
        setError(msg);
        toast.error(`Sessiya açıla bilmədi: ${msg}`);
      }
    });
  }

  return (
    <Card className="glass mx-auto max-w-lg">
      <CardHeader className="text-center">
        <div
          className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-xl"
          style={{ background: "var(--brand-gradient)" }}
        >
          <Coins className="h-6 w-6 text-white" />
        </div>
        <CardTitle>Kassa sessiyasını açın</CardTitle>
        <p className="mt-1 text-sm text-muted-foreground">
          Satış etmək üçün əvvəlcə kassanı açmalısınız.
        </p>
      </CardHeader>

      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="ad">Kassa adı *</Label>
            <Input
              id="ad"
              name="ad"
              defaultValue={`Kassa ${new Date().toLocaleDateString("az-AZ")}`}
              required
              maxLength={100}
              disabled={pending}
            />
          </div>

          {filiallar.length > 1 && (
            <div className="space-y-2">
              <Label htmlFor="filial_id">Filial</Label>
              <Combobox
                options={filiallar.map<ComboOption>((f) => ({ value: String(f.id), label: f.ad }))}
                value={filialId}
                onChange={setFilialId}
                placeholder="— Seçin —"
                searchPlaceholder="🔍 Filial axtar..."
                emptyText="Tapılmadı"
                disabled={pending}
              />
              <input type="hidden" name="filial_id" value={filialId} />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="acilis_qaligi">Açılış qaliği (nağd)</Label>
            <Input
              id="acilis_qaligi"
              name="acilis_qaligi"
              type="number"
              min={0}
              step="0.01"
              defaultValue="0"
              disabled={pending}
            />
            <p className="text-xs text-muted-foreground">
              Sessiyaya başlayanda kassada olan nağd məbləğ.
            </p>
          </div>

          {/* Maliyə hesabı seçimi — POS-dan gələn pul bu hesaba düşür.
              VACİB: bu seçilmədikdə satışlar real bank/nağd balansa təsir göstərməyəcək. */}
          {hesablar.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="maliye_hesab_id">Pul hansı kassa/hesaba düşür?</Label>
              <select
                id="maliye_hesab_id"
                name="maliye_hesab_id"
                value={hesabId}
                onChange={(e) => setHesabId(e.target.value)}
                disabled={pending}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                {hesablar.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.ad} ({h.nov})
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                Bu sessiyada hər satış seçilən hesabın qaliqını avtomatik artıracaq.
              </p>
            </div>
          )}

          <Button
            type="submit"
            className="w-full font-semibold text-white"
            style={{ background: "var(--brand-gradient)" }}
            disabled={pending}
          >
            {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Sessiyanı aç
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
