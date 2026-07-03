"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ShieldCheck,
  ExternalLink,
  Calendar,
  Phone,
  Printer,
  Wrench,
  XCircle,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useColumnToggle, type ColumnDef } from "@/components/ui/column-toggle";
import { ProductInline } from "@/features/anbar/components/product-inline";
import { formatDate, formatMoney } from "@/lib/utils";
import { useMounted } from "@/lib/hooks/use-mounted";
import { deactivateZemanet, createServisFromZemanet } from "../zemanet-actions";
import { ZemanetQrCell } from "./zemanet-qr-cell";
import type { ZemanetRow } from "../types";

const COLS: ColumnDef[] = [
  { key: "talon", label: "Talon", required: true },
  { key: "satis", label: "Satış" },
  { key: "musteri", label: "Müştəri" },
  { key: "telefon", label: "Telefon" },
  { key: "mehsul", label: "Məhsul" },
  { key: "seri", label: "Serial / IMEI" },
  { key: "baslama", label: "Başlama" },
  { key: "bitme", label: "Bitmə" },
  { key: "muddet", label: "Müddət (ay)" },
  { key: "status", label: "Status" },
  { key: "qaytarma", label: "Qaytarma sayı" },
  { key: "son_temir", label: "Son təmir" },
  { key: "amel", label: "Əməl", required: true },
];
const ORDER = COLS.map((c) => c.key);

export function ZemanetTable({ rows }: { rows: ZemanetRow[] }) {
  const router = useRouter();
  const cols = useColumnToggle("servis-zemanet-cols-v1", COLS, ORDER);
  const [q, setQ] = useState("");
  const [activeOnly, setActiveOnly] = useState(false);
  const [expiringSoon, setExpiringSoon] = useState(false);
  const [pending, startTransition] = useTransition();
  const mounted = useMounted();

  const filtered = useMemo(() => {
    const now = new Date();
    const in30 = new Date();
    in30.setDate(in30.getDate() + 30);
    return rows.filter((r) => {
      const isActive = r.status === "aktiv" && new Date(r.bitme_tarixi) > now;
      if (activeOnly && !isActive) return false;
      if (expiringSoon) {
        if (!isActive) return false;
        if (new Date(r.bitme_tarixi) > in30) return false;
      }
      if (q) {
        const qq = q.toLowerCase();
        const inAny =
          r.unikal_kod.toLowerCase().includes(qq) ||
          (r.musteri_ad ?? "").toLowerCase().includes(qq) ||
          (r.musteri_telefon ?? "").includes(qq) ||
          (r.mehsul_ad ?? "").toLowerCase().includes(qq) ||
          (r.serial_nomre ?? "").toLowerCase().includes(qq) ||
          (r.imei ?? "").toLowerCase().includes(qq);
        if (!inAny) return false;
      }
      return true;
    });
  }, [rows, q, activeOnly, expiringSoon]);

  function deactivate(id: string) {
    if (!confirm("Bu talonu ləğv etmək istədiyinizə əminsinizmi?")) return;
    startTransition(async () => {
      const res = await deactivateZemanet(id);
      if (res.ok) {
        toast.success("Ləğv edildi");
        router.refresh();
      } else toast.error(res.error);
    });
  }

  function createServis(id: string) {
    const problem = prompt("Problem təsviri (məcburi):");
    if (!problem || problem.trim().length < 3) return;
    startTransition(async () => {
      const res = await createServisFromZemanet(id, problem.trim());
      if (res.ok) {
        toast.success("Servis qəbulu yaradıldı");
        if (res.id) router.push(`/servis/${res.id}`);
        else router.refresh();
      } else toast.error(res.error);
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Talon, müştəri, telefon, IMEI…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="h-9 max-w-xs"
        />
        <label className="flex items-center gap-1.5 text-sm">
          <input
            type="checkbox"
            checked={activeOnly}
            onChange={(e) => setActiveOnly(e.target.checked)}
            className="h-4 w-4 accent-primary"
          />
          Yalnız aktiv
        </label>
        <label className="flex items-center gap-1.5 text-sm">
          <input
            type="checkbox"
            checked={expiringSoon}
            onChange={(e) => setExpiringSoon(e.target.checked)}
            className="h-4 w-4 accent-primary"
          />
          Bitməyə 30 gün qalıb
        </label>
        <div className="ml-auto">{cols.render()}</div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
          Filtrlərə uyğun talon yoxdur.
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card/40 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border/60 text-left text-[10.5px] uppercase tracking-wider text-muted-foreground">
              <tr>
                {cols.order.map((k) => {
                  if (!cols.isVisible(k)) return null;
                  const def = COLS.find((c) => c.key === k);
                  if (!def) return null;
                  const right = k === "qaytarma" || k === "amel";
                  return (
                    <th key={k} className={`px-3 py-2.5 ${right ? "text-right" : ""}`}>
                      {def.label}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {filtered.map((z) => {
                const isActive = mounted && z.status === "aktiv" && new Date(z.bitme_tarixi) > new Date();
                return (
                  <tr key={z.id} className={`border-b border-border/30 hover:bg-secondary/40 ${pending ? "opacity-50" : ""}`}>
                    {cols.order.map((k) => {
                      if (!cols.isVisible(k)) return null;
                      switch (k) {
                        case "talon":
                          return (
                            <td key={k} className="px-3 py-2.5">
                              <div className="flex items-center gap-1.5">
                                <ZemanetQrCell
                                  unikalKod={z.unikal_kod}
                                  qrToken={z.qr_token}
                                  musteriAd={z.musteri_ad}
                                  mehsulAd={z.mehsul_ad}
                                />
                                <div>
                                  <div className="flex items-center gap-1">
                                    <ShieldCheck className="h-3 w-3 text-primary-light" />
                                    <span className="font-mono text-xs font-medium">{z.unikal_kod}</span>
                                  </div>
                                </div>
                              </div>
                            </td>
                          );
                        case "satis":
                          return (
                            <td key={k} className="px-3 py-2.5 text-xs">
                              {z.satis_id ? (
                                <Link href={`/ticaret/satislar/${z.satis_id}`} className="text-primary-light hover:underline">
                                  {z.satis_nomre ?? "→"}
                                </Link>
                              ) : (
                                <span className="text-muted-foreground">Manual</span>
                              )}
                            </td>
                          );
                        case "musteri":
                          return <td key={k} className="px-3 py-2.5">{z.musteri_ad ?? "—"}</td>;
                        case "telefon":
                          return (
                            <td key={k} className="px-3 py-2.5">
                              {z.musteri_telefon ? (
                                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <Phone className="h-3 w-3" />
                                  {z.musteri_telefon}
                                </div>
                              ) : "—"}
                            </td>
                          );
                        case "mehsul":
                          return (
                            <td key={k} className="px-3 py-2.5">
                              {z.mehsul_id ? (
                                <ProductInline
                                  id={z.mehsul_id}
                                  ad={z.mehsul_ad ?? "—"}
                                  kod={z.mehsul_kod}
                                  barkod={z.mehsul_barkod}
                                  showImage={false}
                                  size="xs"
                                />
                              ) : (
                                z.mehsul_ad ?? "—"
                              )}
                            </td>
                          );
                        case "seri":
                          return (
                            <td key={k} className="px-3 py-2.5 font-mono text-xs">
                              {z.serial_nomre ?? z.imei ?? "—"}
                            </td>
                          );
                        case "baslama":
                          return (
                            <td key={k} className="px-3 py-2.5 text-xs">
                              <div className="flex items-center gap-1">
                                <Calendar className="h-3 w-3 text-muted-foreground" />
                                {formatDate(z.baslama_tarixi)}
                              </div>
                            </td>
                          );
                        case "bitme":
                          return (
                            <td key={k} className="px-3 py-2.5 text-xs">{formatDate(z.bitme_tarixi)}</td>
                          );
                        case "muddet":
                          return <td key={k} className="px-3 py-2.5 text-xs">{z.ay_sayi} ay</td>;
                        case "status":
                          return (
                            <td key={k} className="px-3 py-2.5">
                              <Badge variant="outline" className={isActive ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300" : "border-slate-400/30 bg-slate-400/10 text-slate-300"}>
                                {isActive ? "Aktiv" : "Bitib"}
                              </Badge>
                            </td>
                          );
                        case "qaytarma":
                          return (
                            <td key={k} className="px-3 py-2.5 text-right text-xs">
                              {z.servis_sayi > 0 ? z.servis_sayi : "—"}
                            </td>
                          );
                        case "son_temir":
                          return (
                            <td key={k} className="px-3 py-2.5 text-xs">
                              {z.son_temir ? formatDate(z.son_temir) : "—"}
                            </td>
                          );
                        case "amel":
                          return (
                            <td key={k} className="px-3 py-2.5 text-right">
                              <div className="flex items-center justify-end gap-0.5">
                                <Link
                                  href={`/zemanet/${z.qr_token}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary"
                                  title="Public QR view"
                                >
                                  <ExternalLink className="h-3.5 w-3.5" />
                                </Link>
                                <a
                                  href={`/api/zemanet/${z.id}/talon.pdf`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary"
                                  title="Talonu çap et"
                                >
                                  <Printer className="h-3.5 w-3.5" />
                                </a>
                                <Button
                                  size="icon-sm"
                                  variant="ghost"
                                  onClick={() => createServis(z.id)}
                                  disabled={pending}
                                  title="Bu zəmanətdən servis yarat"
                                >
                                  <Wrench className="h-3.5 w-3.5" />
                                </Button>
                                {isActive && (
                                  <Button
                                    size="icon-sm"
                                    variant="ghost"
                                    onClick={() => deactivate(z.id)}
                                    disabled={pending}
                                    title="Talonu ləğv et"
                                  >
                                    {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5 text-rose-400" />}
                                  </Button>
                                )}
                              </div>
                            </td>
                          );
                        default:
                          return null;
                      }
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="border-t border-border/40 px-3 py-2 text-xs text-muted-foreground">
            Cəmi: {filtered.length} talon
          </div>
        </div>
      )}
    </div>
  );
}
