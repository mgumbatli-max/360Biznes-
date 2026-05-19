"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Send, Link2, Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createQiymetTeklif } from "../actions";
import { formatMoney } from "@/lib/utils";

export function QiymetTeklifForm({
  id,
  currentXerc,
  trackToken,
}: {
  id: string;
  currentXerc: number;
  trackToken?: string;
}) {
  const router = useRouter();
  const [iscik, setIscik] = useState(0);
  const [hisse, setHisse] = useState(currentXerc);
  const [edv, setEdv] = useState(0);
  const [qeyd, setQeyd] = useState("");
  const [pending, startTransition] = useTransition();

  const publicLink =
    trackToken && typeof window !== "undefined"
      ? `${window.location.origin}/servis-track/${trackToken}/teklif/${id}`
      : "";

  function copyLink() {
    if (!publicLink) return;
    navigator.clipboard.writeText(publicLink);
    toast.success("Link kopyalandı");
  }

  const cem = iscik + hisse + edv;

  function submit() {
    const fd = new FormData();
    fd.append("id", id);
    fd.append("iscik", String(iscik));
    fd.append("hisse", String(hisse));
    fd.append("edv", String(edv));
    fd.append("qeyd", qeyd);
    startTransition(async () => {
      const res = await createQiymetTeklif(fd);
      if (res.ok) {
        toast.success(`Təklif yaradıldı: ${formatMoney(res.data?.cem ?? cem)}`);
        router.refresh();
      } else toast.error(res.error);
    });
  }

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      <div className="space-y-2">
        <Label>İşçilik</Label>
        <Input
          type="number"
          step="0.01"
          value={iscik}
          onChange={(e) => setIscik(Number(e.target.value || 0))}
          disabled={pending}
        />
      </div>
      <div className="space-y-2">
        <Label>Hissə dəyəri</Label>
        <Input
          type="number"
          step="0.01"
          value={hisse}
          onChange={(e) => setHisse(Number(e.target.value || 0))}
          disabled={pending}
        />
      </div>
      <div className="space-y-2">
        <Label>ƏDV</Label>
        <Input
          type="number"
          step="0.01"
          value={edv}
          onChange={(e) => setEdv(Number(e.target.value || 0))}
          disabled={pending}
        />
      </div>
      <div className="space-y-2">
        <Label>Cəmi</Label>
        <div className="flex h-9 items-center rounded-md border border-border bg-secondary/40 px-3 text-sm font-semibold tabular-nums">
          {formatMoney(cem)}
        </div>
      </div>
      <div className="md:col-span-2 space-y-2">
        <Label>Qeyd</Label>
        <textarea
          value={qeyd}
          onChange={(e) => setQeyd(e.target.value)}
          rows={2}
          disabled={pending}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
      </div>
      <div className="md:col-span-2 flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={submit} disabled={pending || cem <= 0}>
          {pending ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Send className="mr-2 h-3.5 w-3.5" />}
          Müştəriyə təsdiq göndər
        </Button>
        {publicLink && (
          <>
            <button
              type="button"
              onClick={copyLink}
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-card/40 px-3 text-xs hover:bg-secondary"
              title={publicLink}
            >
              <Copy className="h-3.5 w-3.5" /> Public link
            </button>
            <a
              href={publicLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-card/40 px-3 text-xs hover:bg-secondary"
            >
              <Link2 className="h-3.5 w-3.5" /> Ön-bax
            </a>
          </>
        )}
      </div>
    </div>
  );
}
