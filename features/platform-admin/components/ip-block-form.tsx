"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ShieldX, Check, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { adminBlockIp } from "@/features/platform-admin/actions";

export function IpBlockForm() {
  const router = useRouter();
  const [ip, setIp] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [pending, start] = useTransition();

  function submit(formData: FormData) {
    setErr(null);
    setOk(false);
    start(async () => {
      const r = await adminBlockIp(formData);
      if (r.ok) {
        setOk(true);
        setIp("");
        router.refresh();
        setTimeout(() => setOk(false), 1800);
      } else {
        setErr(r.error);
      }
    });
  }

  return (
    <form action={submit} className="flex flex-wrap items-end gap-2">
      <div className="min-w-[160px] flex-1 space-y-1.5">
        <Label htmlFor="ip_adres">IP ünvanı</Label>
        <Input
          id="ip_adres"
          name="ip_adres"
          value={ip}
          onChange={(e) => setIp(e.target.value)}
          placeholder="məs. 203.0.113.42"
          required
          className="h-9"
        />
      </div>
      <div className="min-w-[180px] flex-1 space-y-1.5">
        <Label htmlFor="sebeb">Səbəb</Label>
        <Input id="sebeb" name="sebeb" placeholder="Şübhəli login cəhdləri…" className="h-9" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="bitme_tarixi">Bitmə (istəyə bağlı)</Label>
        <Input id="bitme_tarixi" name="bitme_tarixi" type="datetime-local" className="h-9" />
      </div>
      <Button type="submit" disabled={pending || ip.trim().length === 0} className="h-9">
        <ShieldX className="h-3.5 w-3.5" /> {pending ? "Bloklanır…" : "Blokla"}
      </Button>

      {err ? (
        <p className="flex w-full items-center gap-1.5 text-xs text-danger">
          <AlertCircle className="h-3.5 w-3.5" /> {err}
        </p>
      ) : null}
      {ok ? (
        <p className="flex w-full items-center gap-1.5 text-xs text-success">
          <Check className="h-3.5 w-3.5" /> IP bloklandı
        </p>
      ) : null}
    </form>
  );
}
