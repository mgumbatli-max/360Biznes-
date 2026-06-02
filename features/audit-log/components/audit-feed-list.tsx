"use client";

import { useRouter, useSearchParams } from "next/navigation";
import {
  User,
  CheckCircle2,
  XCircle,
  ChevronRight,
  Globe,
  Monitor,
  Smartphone,
  Tablet,
  HelpCircle,
  FileEdit,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { OP_META, RESOURCE_LABEL } from "../labels";

type FeedRow = {
  id: bigint | string;
  yaradildi: Date | null;
  istifadeci_ad: string | null;
  istifadeci_id: string | null;
  emeliyyat: string;
  resurs_nov: string;
  resurs_id: string | null;
  status: string | null;
  sebeb: string | null;
  ip_adres: string | null;
  brauzer: string | null;
  os: string | null;
  cihaz: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  evvelki_data: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  yeni_data: any;
};

const TONE_BADGE: Record<string, string> = {
  success: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700",
  info: "border-sky-500/40 bg-sky-500/10 text-sky-700",
  danger: "border-rose-500/40 bg-rose-500/10 text-rose-700",
  warning: "border-amber-500/40 bg-amber-500/10 text-amber-700",
  primary: "border-violet-500/40 bg-violet-500/10 text-violet-700",
  neutral: "border-border/50 bg-secondary/40 text-muted-foreground",
};

function formatRelative(d: Date): string {
  const diffMs = Date.now() - d.getTime();
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return `${sec}san`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}dəq`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} saat`;
  const day = Math.floor(h / 24);
  if (day < 7) return `${day} gün`;
  return d.toLocaleDateString("az-AZ", { day: "2-digit", month: "short" });
}

function formatAbs(d: Date): string {
  return d.toLocaleString("az-AZ", { dateStyle: "short", timeStyle: "short" });
}

function countDiff(before: unknown, after: unknown): number {
  if (!before && !after) return 0;
  const b = (before && typeof before === "object" && !Array.isArray(before)) ? (before as Record<string, unknown>) : {};
  const a = (after && typeof after === "object" && !Array.isArray(after)) ? (after as Record<string, unknown>) : {};
  const keys = new Set([...Object.keys(b), ...Object.keys(a)]);
  let n = 0;
  for (const k of keys) {
    if (JSON.stringify(b[k]) !== JSON.stringify(a[k])) n++;
  }
  return n;
}

function DeviceIcon({ kind, className }: { kind: string | null; className?: string }) {
  if (kind === "mobile") return <Smartphone className={className} />;
  if (kind === "tablet") return <Tablet className={className} />;
  if (kind === "desktop") return <Monitor className={className} />;
  return <HelpCircle className={className} />;
}

export function AuditFeedList({ items }: { items: FeedRow[] }) {
  const router = useRouter();
  const sp = useSearchParams();

  function openDetail(id: string) {
    const params = new URLSearchParams(sp.toString());
    params.set("detail", id);
    router.replace(`?${params.toString()}`, { scroll: false });
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card/40">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 border-b border-border bg-card/95 backdrop-blur">
            <tr className="text-left text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground">
              <th className="px-3 py-2.5">Vaxt</th>
              <th className="px-3 py-2.5">İstifadəçi və cihaz</th>
              <th className="px-3 py-2.5">Hadisə</th>
              <th className="px-3 py-2.5">Detail</th>
              <th className="px-3 py-2.5">Şəbəkə</th>
              <th className="px-3 py-2.5 text-center">Status</th>
              <th className="px-3 py-2.5 text-right" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border/30">
            {items.map((r) => {
              const meta = OP_META[r.emeliyyat] ?? { label: r.emeliyyat, tone: "neutral" as const, verb: r.emeliyyat };
              const resourceLabel = RESOURCE_LABEL[r.resurs_nov] ?? r.resurs_nov;
              const success = r.status === "ugur" || r.status === null;
              const isNewDevice = r.emeliyyat === "yeni_cihaz_giris";
              const isFailedLogin = r.emeliyyat === "uğursuz_giris" || (!success && r.resurs_nov === "session");
              const isLoginish = ["giris", "yeni_cihaz_giris", "uğursuz_giris", "cixis", "pin_giris", "pin_lockout"].includes(r.emeliyyat);

              // Row background — yeni cihaz amber, uğursuz giriş rose, normal şəffaf
              const rowBg = isFailedLogin
                ? "bg-rose-500/[0.04] hover:bg-rose-500/[0.08]"
                : isNewDevice
                  ? "bg-amber-500/[0.06] hover:bg-amber-500/[0.10]"
                  : "hover:bg-secondary/30";

              const userName = r.istifadeci_ad ?? "Sistem";
              const initials = userName.split(" ").map((s) => s[0] ?? "").filter(Boolean).slice(0, 2).join("").toUpperCase() || "?";

              const diffCount = countDiff(r.evvelki_data, r.yeni_data);
              const hasData = Boolean(r.evvelki_data || r.yeni_data);

              return (
                <tr
                  key={r.id.toString()}
                  onClick={() => openDetail(r.id.toString())}
                  className={cn("cursor-pointer transition group", rowBg)}
                >
                  {/* Vaxt */}
                  <td className="px-3 py-2 whitespace-nowrap align-top">
                    <div className="flex items-start gap-1">
                      {isNewDevice && (
                        <span title="Yeni cihazdan giriş" className="text-base leading-none">🆕</span>
                      )}
                      <div>
                        <div className="text-xs font-medium text-foreground" title={r.yaradildi ? formatAbs(r.yaradildi) : ""}>
                          {r.yaradildi ? formatRelative(r.yaradildi) : "—"}
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          {r.yaradildi ? r.yaradildi.toLocaleTimeString("az-AZ", { hour: "2-digit", minute: "2-digit" }) : ""}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* İstifadəçi və cihaz */}
                  <td className="px-3 py-2 align-top">
                    <div className="flex items-start gap-2">
                      {/* Avatar */}
                      <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-secondary/60 text-[10px] font-bold">
                        {initials === "?" ? <User className="h-3.5 w-3.5" /> : initials}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-xs font-semibold text-foreground">
                          {userName}
                        </div>
                        {(r.cihaz || r.os || r.brauzer) ? (
                          <div className="mt-0.5 flex items-center gap-1 text-[10.5px] text-muted-foreground">
                            <DeviceIcon kind={r.cihaz} className="h-3 w-3 shrink-0" />
                            <span className="truncate">
                              {[r.os, r.brauzer].filter(Boolean).join(" · ") || r.cihaz}
                            </span>
                          </div>
                        ) : (
                          <div className="mt-0.5 text-[10.5px] italic text-muted-foreground/60">cihaz məlum deyil</div>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Hadisə */}
                  <td className="px-3 py-2 align-top">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge variant="outline" className={cn("text-[10px]", TONE_BADGE[meta.tone])}>
                        {meta.label}
                      </Badge>
                      {!isLoginish && r.resurs_nov && (
                        <span className="text-xs font-medium text-foreground">
                          {resourceLabel}
                        </span>
                      )}
                      {isNewDevice && (
                        <Badge variant="outline" className="border-amber-500/60 bg-amber-500/15 text-[9.5px] font-bold text-amber-700">
                          YENİ CİHAZ
                        </Badge>
                      )}
                    </div>
                    {r.resurs_id && !isLoginish && (
                      <div className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                        #{String(r.resurs_id).slice(0, 12)}
                      </div>
                    )}
                  </td>

                  {/* Detail — diff sayı və ya səbəb */}
                  <td className="max-w-[260px] px-3 py-2 align-top">
                    {hasData && diffCount > 0 ? (
                      <div className="inline-flex items-center gap-1 text-xs text-foreground">
                        <FileEdit className="h-3 w-3 text-sky-500" />
                        <span className="font-medium">{diffCount}</span>
                        <span className="text-muted-foreground">sahə dəyişdi</span>
                      </div>
                    ) : r.sebeb ? (
                      <div className="line-clamp-2 text-xs italic text-muted-foreground">
                        {r.sebeb}
                      </div>
                    ) : (
                      <span className="text-[11px] text-muted-foreground/50">—</span>
                    )}
                  </td>

                  {/* Şəbəkə — IP */}
                  <td className="px-3 py-2 align-top">
                    {r.ip_adres ? (
                      <div className="inline-flex items-center gap-1 text-[10.5px]">
                        <Globe className="h-3 w-3 text-muted-foreground" />
                        <span className="font-mono text-foreground">{r.ip_adres}</span>
                      </div>
                    ) : (
                      <span className="text-[11px] text-muted-foreground/50">yoxdur</span>
                    )}
                  </td>

                  {/* Status */}
                  <td className="px-3 py-2 text-center align-top">
                    {success ? (
                      <CheckCircle2 className="inline h-4 w-4 text-emerald-500" />
                    ) : (
                      <XCircle className="inline h-4 w-4 text-rose-500" />
                    )}
                  </td>

                  {/* Chevron */}
                  <td className="px-2 py-2 text-right align-top">
                    <ChevronRight className="inline h-4 w-4 text-muted-foreground/40 transition group-hover:text-muted-foreground group-hover:translate-x-0.5" />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
