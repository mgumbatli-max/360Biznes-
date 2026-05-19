"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Loader2,
  X,
  User,
  Globe,
  Monitor,
  ChevronRight,
  AlertCircle,
  Clock,
  Activity,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Detail = {
  id: string;
  yaradildi: string | null;
  istifadeci: { ad_soyad: string | null; email?: string };
  emeliyyat: string;
  resurs_nov: string;
  resurs_id: string | null;
  url: string | null;
  metod: string | null;
  status: string | null;
  sebeb: string | null;
  ip_adres: string | null;
  user_agent: string | null;
  brauzer: string | null;
  os: string | null;
  cihaz: string | null;
  sessiya_id: string | null;
  evvelki_data: unknown;
  yeni_data: unknown;
};

export function AuditDetailModal() {
  const router = useRouter();
  const sp = useSearchParams();
  const id = sp.get("detail");
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    const ac = new AbortController();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setError(null);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDetail(null);
    fetch(`/api/audit-log/detail?id=${id}`, { signal: ac.signal })
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error ?? "Yüklənmədi");
        return j as Detail;
      })
      .then((d) => {
        if (!ac.signal.aborted) setDetail(d);
      })
      .catch((e) => {
        if (!ac.signal.aborted) setError(String(e));
      })
      .finally(() => {
        if (!ac.signal.aborted) setLoading(false);
      });
    return () => ac.abort();
  }, [id]);

  function close() {
    const params = new URLSearchParams(sp.toString());
    params.delete("detail");
    const qs = params.toString();
    router.replace(qs ? `?${qs}` : "?", { scroll: false });
  }

  return (
    <Dialog open={!!id} onOpenChange={(o) => !o && close()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto md:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" /> Audit qeyd detalları
          </DialogTitle>
        </DialogHeader>

        {loading && (
          <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Yüklənir...
          </div>
        )}
        {error && (
          <div className="rounded-lg border border-rose-500/30 bg-rose-500/5 px-3 py-2 text-sm text-rose-600">
            <AlertCircle className="inline h-4 w-4" /> {error}
          </div>
        )}
        {detail && <DetailBody d={detail} />}
      </DialogContent>
    </Dialog>
  );
}

function DetailBody({ d }: { d: Detail }) {
  const yaradildi = d.yaradildi ? new Date(d.yaradildi) : null;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <MetaField label="Vaxt" icon={Clock} value={yaradildi?.toLocaleString("az-AZ") ?? "—"} />
        <MetaField
          label="İstifadəçi"
          icon={User}
          value={d.istifadeci.ad_soyad ?? "—"}
          sub={d.istifadeci.email}
        />
        <MetaField
          label="Əməliyyat"
          icon={Activity}
          valueNode={
            <span className="inline-flex items-center gap-1">
              <Badge variant="outline" className="text-[10px]">{d.emeliyyat}</Badge>
              {d.status && (
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[10px]",
                    d.status === "ugur" ? "border-emerald-500/40 text-emerald-600" : "border-rose-500/40 text-rose-500"
                  )}
                >
                  {d.status}
                </Badge>
              )}
            </span>
          }
        />
        <MetaField
          label="Resurs"
          icon={ChevronRight}
          value={d.resurs_nov}
          sub={d.resurs_id ?? undefined}
        />
        <MetaField label="URL" icon={Globe} value={d.url ?? "—"} sub={d.metod ?? undefined} mono />
        <MetaField label="IP" icon={Globe} value={d.ip_adres ?? "—"} mono />
        <MetaField
          label="Cihaz / OS / Brauzer"
          icon={Monitor}
          value={[d.cihaz, d.os, d.brauzer].filter(Boolean).join(" · ") || "—"}
        />
        <MetaField label="Sessiya ID" icon={Activity} value={d.sessiya_id?.slice(0, 12) ?? "—"} mono />
      </div>

      {d.sebeb && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-sm">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-amber-600">Səbəb</div>
          <div className="mt-0.5">{d.sebeb}</div>
        </div>
      )}

      {d.user_agent && (
        <div className="rounded-lg border border-border/40 px-3 py-2">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">User-Agent</div>
          <div className="mt-0.5 break-all font-mono text-[11px] text-muted-foreground">{d.user_agent}</div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <JsonBlock title="Əvvəl" value={d.evvelki_data} tone="rose" />
        <JsonBlock title="Sonra" value={d.yeni_data} tone="emerald" />
      </div>
    </div>
  );
}

function MetaField({
  label,
  icon: Icon,
  value,
  valueNode,
  sub,
  mono,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  value?: string;
  valueNode?: React.ReactNode;
  sub?: string;
  mono?: boolean;
}) {
  return (
    <div className="rounded-lg border border-border/40 px-3 py-2">
      <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3 w-3" /> {label}
      </div>
      <div className={cn("mt-0.5 truncate text-sm", mono && "font-mono text-xs")}>
        {valueNode ?? value}
      </div>
      {sub && <div className="text-[11px] text-muted-foreground">{sub}</div>}
    </div>
  );
}

function JsonBlock({
  title,
  value,
  tone,
}: {
  title: string;
  value: unknown;
  tone: "rose" | "emerald";
}) {
  if (value === null || value === undefined) {
    return (
      <div className="rounded-lg border border-border/40 px-3 py-2">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</div>
        <div className="mt-1 text-xs text-muted-foreground">— (boş)</div>
      </div>
    );
  }

  const json = JSON.stringify(value, null, 2);
  const cls =
    tone === "rose"
      ? "border-rose-500/30 bg-rose-500/5"
      : "border-emerald-500/30 bg-emerald-500/5";

  return (
    <div className={cn("rounded-lg border px-3 py-2", cls)}>
      <div className="flex items-center justify-between">
        <div className="text-[10px] font-semibold uppercase tracking-wider">{title}</div>
        <button
          type="button"
          onClick={() => navigator.clipboard?.writeText(json)}
          className="text-[10px] font-semibold text-muted-foreground hover:text-foreground"
        >
          Kopyala
        </button>
      </div>
      <pre className="mt-1 max-h-64 overflow-auto whitespace-pre-wrap break-all font-mono text-[11px] leading-relaxed">
        {json}
      </pre>
    </div>
  );
}

// Row click row component
export function AuditRowLink({ id, children }: { id: bigint | string; children: React.ReactNode }) {
  const router = useRouter();
  const sp = useSearchParams();

  function open() {
    const params = new URLSearchParams(sp.toString());
    params.set("detail", String(id));
    router.replace(`?${params.toString()}`, { scroll: false });
  }

  return (
    <tr
      onClick={open}
      className="cursor-pointer border-b border-border/30 transition hover:bg-secondary/40"
    >
      {children}
    </tr>
  );
}
