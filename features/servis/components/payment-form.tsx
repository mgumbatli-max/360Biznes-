"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, CircleDollarSign } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { recordPayment } from "../actions";

type AccountOpt = { id: string; ad: string; nov: string };

export function PaymentForm({
  id,
  accounts = [],
}: {
  id: string;
  accounts?: AccountOpt[];
}) {
  const router = useRouter();
  const [meblegh, setMeblegh] = useState(0);
  const [qeyd, setQeyd] = useState("");
  const [odenisNov, setOdenisNov] = useState<"negd" | "kart" | "bank" | "borc">("negd");
  const [hesabId, setHesabId] = useState<string>(accounts.find((a) => a.nov === "negd")?.id ?? accounts[0]?.id ?? "");
  const [kassayaElaveEt, setKassayaElaveEt] = useState(true);
  const [satisKimiQeydEt, setSatisKimiQeydEt] = useState(true);
  const [pending, startTransition] = useTransition();

  // Borc rejimi: kassa və satış toggles passiv olur (avtomatik qapanır)
  const isBorc = odenisNov === "borc";

  function submit() {
    if (meblegh <= 0) return;
    const fd = new FormData();
    fd.append("id", id);
    fd.append("meblegh", String(meblegh));
    fd.append("odenis_nov", odenisNov);
    if (!isBorc && hesabId) fd.append("hesab_id", hesabId);
    fd.append("kassaya_elave_et", isBorc ? "false" : (kassayaElaveEt ? "true" : "false"));
    fd.append("satis_kimi_qeyd_et", isBorc ? "false" : (satisKimiQeydEt ? "true" : "false"));
    fd.append("qeyd", qeyd);
    startTransition(async () => {
      const res = await recordPayment(fd);
      if (res.ok) {
        toast.success(isBorc ? "Borc kimi yazıldı" : "Ödəniş yazıldı, kassa hərəkəti edildi");
        setMeblegh(0);
        setQeyd("");
        router.refresh();
      } else toast.error(res.error);
    });
  }

  const odenisOptions: { v: typeof odenisNov; label: string }[] = [
    { v: "negd", label: "Nağd" },
    { v: "kart", label: "Kart" },
    { v: "bank", label: "Bank köçürməsi" },
    { v: "borc", label: "Müştəri borcu" },
  ];

  // Nəğd üçün yalnız `negd` növ kassa, digər üçün hamısı
  const filteredAccounts = odenisNov === "negd"
    ? accounts.filter((a) => a.nov === "negd" || a.nov === "kassa")
    : accounts;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="space-y-2">
          <Label>Məbləğ *</Label>
          <Input
            type="number"
            step="0.01"
            value={meblegh}
            onChange={(e) => setMeblegh(Number(e.target.value || 0))}
            disabled={pending}
            placeholder="0.00"
          />
        </div>

        <div className="space-y-2">
          <Label>Ödəniş üsulu</Label>
          <select
            value={odenisNov}
            onChange={(e) => setOdenisNov(e.target.value as typeof odenisNov)}
            disabled={pending}
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            {odenisOptions.map((o) => (
              <option key={o.v} value={o.v}>{o.label}</option>
            ))}
          </select>
        </div>

        {!isBorc && (
          <div className="space-y-2">
            <Label>Kassa / Hesab</Label>
            <select
              value={hesabId}
              onChange={(e) => setHesabId(e.target.value)}
              disabled={pending}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">— Seçin —</option>
              {filteredAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.ad} ({a.nov})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label>Qeyd</Label>
        <Input
          value={qeyd}
          onChange={(e) => setQeyd(e.target.value)}
          disabled={pending}
          placeholder="Ekran dəyişməsi, batareya və s..."
        />
      </div>

      {!isBorc && (
        <div className="flex flex-wrap gap-4 rounded-md border border-border/40 bg-secondary/20 p-3 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={kassayaElaveEt}
              onChange={(e) => setKassayaElaveEt(e.target.checked)}
              disabled={pending}
              className="h-4 w-4 accent-primary"
            />
            <span>Kassaya əlavə et (maliyə əməliyyatı)</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={satisKimiQeydEt}
              onChange={(e) => setSatisKimiQeydEt(e.target.checked)}
              disabled={pending}
              className="h-4 w-4 accent-primary"
            />
            <span>Satışda xidmət kimi qeyd et</span>
          </label>
        </div>
      )}

      {isBorc && (
        <div className="rounded-md border border-amber-400/30 bg-amber-400/5 p-3 text-xs text-amber-200">
          Borc rejimində kassa hərəkəti edilmir. Yalnız müştərinin borc qalığı artır.
        </div>
      )}

      <Button size="sm" onClick={submit} disabled={pending || meblegh <= 0}>
        {pending ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <CircleDollarSign className="mr-2 h-3.5 w-3.5" />}
        Ödənişi əlavə et
      </Button>
    </div>
  );
}
