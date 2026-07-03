"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import Link from "next/link";
import {
  Phone,
  User,
  Mail,
  Package,
  AlertTriangle,
  ShieldCheck,
  Calendar,
  UserCheck,
  Wrench,
  CircleDollarSign,
  FileText,
  Loader2,
  ArrowRight,
  X,
  ListTodo,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { VisuallyHidden as VisuallyHiddenPrimitive } from "radix-ui";
import { SERVIS_STATUS_LABELS, type ServisStatus } from "../types";
import { changeServisStatus } from "../actions";
import { ServisFayllar, type ServisFaylItem } from "./servis-fayllar";
import { PaymentForm } from "./payment-form";
import { NotesTab } from "./notes-tab";
import { RejectReasonDialog } from "./reject-reason-dialog";
import { formatMoney, formatDate } from "@/lib/utils";
import { useMounted } from "@/lib/hooks/use-mounted";

const VisuallyHidden = VisuallyHiddenPrimitive.Root;

const NEXT_STAGES: Record<string, { status: ServisStatus; label: string }[]> = {
  qebul_edildi: [{ status: "diaqnostikada", label: "Yoxlanılır" }],
  diaqnostikada: [
    { status: "teklif_gozleyir", label: "Təklifə" },
    { status: "usta_baxir", label: "Ustaya" },
  ],
  teklif_gozleyir: [
    { status: "temir_olunur", label: "Təmirə" },
    { status: "ehtiyat_hisse", label: "Hissə gözlə" },
  ],
  usta_baxir: [
    { status: "temir_olunur", label: "Təmirə" },
    { status: "ehtiyat_hisse", label: "Hissə gözlə" },
  ],
  ehtiyat_hisse: [{ status: "temir_olunur", label: "Təmirə" }],
  temir_olunur: [{ status: "temir_edildi", label: "Hazır" }],
  temir_edildi: [{ status: "musteriye_tehvil", label: "Təhvil ver" }],
};

export type DetailTimelineEntry = {
  id: number;
  evvelki_status: string | null;
  yeni_status: string;
  qeyd: string | null;
  yaradildi: Date | null;
  deyisen_ad?: string | null;
};

export type DetailPayment = {
  id: string;
  tarix: Date | null;
  yaradildi: Date | null;
  meblegh: number;
  valyuta: string;
  hesab_ad: string | null;
  hesab_nov: string | null;
  type_kod: string | null;
  type_ad: string | null;
  qeyd: string | null;
};

export type DetailTask = {
  id: string;
  basliq: string;
  status: string | null;
  prioritet: string | null;
  deadline: Date | null;
  mesul_ad: string | null;
};

export type ServisModalData = {
  id: string;
  nomre: string;
  status: string;
  musteri_ad: string;
  musteri_telefon: string;
  musteri_email?: string | null;
  musteri_id?: string | null;
  mehsul_ad: string;
  mehsul_seri_nomresi: string | null;
  mehsul_id?: string | null;
  mehsul_kod?: string | null;
  mehsul_barkod?: string | null;
  problem_tesviri: string;
  yaradildi: Date | null;
  texmini_tehvil: Date | null;
  qapanma_tarixi: Date | null;
  zemanet_var: boolean;
  zemanet_baslama: Date | null;
  zemanet_bitme: Date | null;
  qebul_eden_ad: string | null;
  servis_iscisi_ad: string | null;
  temir_xerci: number;
  musteriden_alinan: number;
  netice_aciqlamasi: string | null;
  satis_id: string | null;
  /** Tab içərikləri */
  fayllar: ServisFaylItem[];
  tarixce: DetailTimelineEntry[];
  tapsiriqlar: DetailTask[];
  odeniyler: DetailPayment[];
  /** Finans tab üçün */
  accounts: { id: string; ad: string; nov: string }[];
};

export function ServisDetailModal({
  data,
  onOpenChange,
}: {
  data: ServisModalData | null;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const mounted = useMounted();
  const open = !!data;

  function close() {
    onOpenChange(false);
    // URL-dən detail parametrini sil
    const sp = new URLSearchParams(searchParams.toString());
    sp.delete("detail");
    const next = sp.toString();
    router.replace(`${pathname}${next ? `?${next}` : ""}`, { scroll: false });
  }

  function go(status: ServisStatus) {
    if (!data) return;
    startTransition(async () => {
      const res = await changeServisStatus(data.id, status);
      if (res.ok) {
        toast.success("Status dəyişdi");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  if (!data) return null;

  const stat = SERVIS_STATUS_LABELS[data.status] ?? SERVIS_STATUS_LABELS.qebul_edildi;
  const next = NEXT_STAGES[data.status] ?? [];
  const overdue = mounted && data.texmini_tehvil && new Date(data.texmini_tehvil) < new Date() && !data.qapanma_tarixi;
  const balance = data.temir_xerci - data.musteriden_alinan;
  const netProfit = data.musteriden_alinan - data.temir_xerci;

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? null : close())}>
      <DialogContent
        showCloseButton={false}
        className="!max-w-5xl !w-[92vw] max-h-[92vh] gap-0 overflow-hidden p-0 sm:!max-w-5xl"
      >
        <VisuallyHidden>
          <DialogTitle>{`Servis: ${data.nomre} — ${data.musteri_ad}`}</DialogTitle>
        </VisuallyHidden>

        {/* Header */}
        <div className="flex items-center justify-between border-b border-border bg-secondary/30 px-4 py-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-base font-bold">{data.nomre}</span>
              <span className="text-muted-foreground">—</span>
              <span className="truncate font-semibold">{data.musteri_ad}</span>
              <Badge variant="outline" className={stat.cls}>{stat.label}</Badge>
              {overdue && (
                <Badge variant="outline" className="border-rose-400/40 bg-rose-400/10 text-rose-300">
                  <AlertTriangle className="h-3 w-3" /> Gecikib
                </Badge>
              )}
            </div>
            {data.yaradildi && (
              <div className="mt-0.5 text-xs text-muted-foreground">
                Qəbul: {formatDate(data.yaradildi, { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={close}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition hover:bg-secondary hover:text-foreground"
            aria-label="Bağla"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="grid grid-cols-1 gap-0 overflow-y-auto md:grid-cols-2" style={{ maxHeight: "calc(92vh - 56px - 60px)" }}>
          {/* Sol panel — müştəri/məhsul */}
          <div className="space-y-4 border-r border-border/40 p-4">
            <section>
              <h3 className="mb-2 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Müştəri
              </h3>
              <div className="space-y-1.5 rounded-md border border-border/40 bg-card/40 p-3 text-sm">
                <InfoRow icon={User} value={data.musteri_ad} />
                <InfoRow icon={Phone} value={data.musteri_telefon} />
                {data.musteri_email && <InfoRow icon={Mail} value={data.musteri_email} />}
                {data.musteri_id && (
                  <Link
                    href={`/elaqe/musteriler/${data.musteri_id}`}
                    className="inline-flex items-center gap-1 text-xs text-primary-light hover:underline"
                  >
                    Müştəri profilinə bax <ExternalLink className="h-3 w-3" />
                  </Link>
                )}
              </div>
            </section>

            <section>
              <h3 className="mb-2 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Məhsul
              </h3>
              <div className="space-y-1.5 rounded-md border border-border/40 bg-card/40 p-3 text-sm">
                <InfoRow icon={Package} value={data.mehsul_ad} />
                {data.mehsul_seri_nomresi && (
                  <InfoRow label="Seri / IMEI" value={data.mehsul_seri_nomresi} mono />
                )}
                {data.mehsul_kod && <InfoRow label="Kod" value={data.mehsul_kod} mono />}
              </div>
            </section>

            <section>
              <h3 className="mb-2 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Problem
              </h3>
              <div className="rounded-md border border-border/40 bg-card/40 p-3 text-sm">
                <p className="whitespace-pre-wrap">{data.problem_tesviri}</p>
              </div>
            </section>
          </div>

          {/* Sağ panel — status/zəmanət/işçilər/maliyə */}
          <div className="space-y-4 p-4">
            <section>
              <h3 className="mb-2 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Status
              </h3>
              <div className="rounded-md border border-border/40 bg-card/40 p-3">
                <Badge variant="outline" className={stat.cls}>{stat.label}</Badge>
                {data.texmini_tehvil && (
                  <div className="mt-2 flex items-center gap-2 text-xs">
                    <Calendar className="h-3 w-3 text-muted-foreground" />
                    <span className="text-muted-foreground">Vəd tarixi:</span>
                    <span className={overdue ? "font-medium text-rose-400" : "font-medium"}>
                      {formatDate(data.texmini_tehvil)}
                    </span>
                  </div>
                )}
                {data.qapanma_tarixi && (
                  <div className="mt-1 flex items-center gap-2 text-xs">
                    <Calendar className="h-3 w-3 text-emerald-400" />
                    <span className="text-muted-foreground">Bitmə:</span>
                    <span className="font-medium text-emerald-400">
                      {formatDate(data.qapanma_tarixi)}
                    </span>
                  </div>
                )}
              </div>
            </section>

            <section>
              <h3 className="mb-2 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Zəmanət
              </h3>
              <div className="rounded-md border border-border/40 bg-card/40 p-3 text-sm">
                {data.zemanet_var ? (
                  <div>
                    <Badge variant="outline" className="border-emerald-400/30 bg-emerald-400/10 text-emerald-300">
                      <ShieldCheck className="h-3 w-3" /> Zəmanətli
                    </Badge>
                    {data.zemanet_baslama && data.zemanet_bitme && (
                      <div className="mt-1.5 text-xs text-muted-foreground">
                        {formatDate(data.zemanet_baslama)} →{" "}
                        {formatDate(data.zemanet_bitme)}
                      </div>
                    )}
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground">Zəmanət yoxdur</span>
                )}
              </div>
            </section>

            <section>
              <h3 className="mb-2 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                İşçilər
              </h3>
              <div className="space-y-1.5 rounded-md border border-border/40 bg-card/40 p-3 text-sm">
                <InfoRow icon={UserCheck} label="Qəbul edən" value={data.qebul_eden_ad ?? "—"} />
                <InfoRow icon={Wrench} label="Servis işçisi" value={data.servis_iscisi_ad ?? "—"} />
              </div>
            </section>

            <section>
              <h3 className="mb-2 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Maliyə
              </h3>
              <div className="space-y-1.5 rounded-md border border-border/40 bg-card/40 p-3 text-sm">
                <InfoRow icon={Wrench} label="Təmir xərci" value={formatMoney(data.temir_xerci)} />
                <InfoRow icon={CircleDollarSign} label="Müştəridən" value={formatMoney(data.musteriden_alinan)} />
                <div className="mt-1 border-t border-border/40 pt-1.5">
                  <InfoRow
                    label="Qalıq"
                    value={formatMoney(balance > 0 ? balance : 0)}
                    tone={balance > 0 ? "danger" : "success"}
                  />
                </div>
              </div>
            </section>
          </div>

          {/* Tabs full-width below */}
          <div className="md:col-span-2 border-t border-border/40 p-4">
            <Tabs defaultValue="fayllar">
              <TabsList variant="line" className="w-full overflow-x-auto">
                <TabsTrigger value="fayllar">
                  Fayllar{data.fayllar.length > 0 ? ` (${data.fayllar.length})` : ""}
                </TabsTrigger>
                <TabsTrigger value="tarixce">
                  Tarixçə{data.tarixce.length > 0 ? ` (${data.tarixce.length})` : ""}
                </TabsTrigger>
                <TabsTrigger value="tapsiriqlar">
                  Tapşırıqlar{data.tapsiriqlar.length > 0 ? ` (${data.tapsiriqlar.length})` : ""}
                </TabsTrigger>
                <TabsTrigger value="finans">Finans</TabsTrigger>
                <TabsTrigger value="qeyd">Qeyd</TabsTrigger>
              </TabsList>

              <TabsContent value="fayllar" className="pt-4">
                <ServisFayllar servisId={data.id} fayllar={data.fayllar} />
              </TabsContent>

              <TabsContent value="tarixce" className="pt-4">
                <TimelineList entries={data.tarixce} />
              </TabsContent>

              <TabsContent value="tapsiriqlar" className="pt-4">
                <TaskList tasks={data.tapsiriqlar} servisId={data.id} />
              </TabsContent>

              <TabsContent value="finans" className="pt-4 space-y-4">
                <div className="rounded-md border border-border/40 bg-card/30 p-3">
                  <div className="mb-3 grid grid-cols-3 gap-3 text-sm">
                    <div>
                      <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground">Təmir xərci</div>
                      <div className="mt-0.5 font-semibold tabular-nums">{formatMoney(data.temir_xerci)}</div>
                    </div>
                    <div>
                      <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground">Müştəridən alınan</div>
                      <div className="mt-0.5 font-semibold tabular-nums text-emerald-400">
                        {formatMoney(data.musteriden_alinan)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground">Net qazanc</div>
                      <div
                        className={`mt-0.5 font-semibold tabular-nums ${
                          netProfit > 0 ? "text-emerald-400" : netProfit < 0 ? "text-rose-400" : ""
                        }`}
                      >
                        {formatMoney(netProfit)}
                      </div>
                    </div>
                  </div>
                  {data.netice_aciqlamasi && (
                    <div className="mt-2 rounded-md border border-border/40 bg-secondary/20 p-2 text-xs">
                      <div className="mb-1 font-semibold uppercase tracking-wider text-muted-foreground">
                        Nəticə açıqlaması
                      </div>
                      <p className="whitespace-pre-wrap">{data.netice_aciqlamasi}</p>
                    </div>
                  )}
                </div>

                <div>
                  <h4 className="mb-2 text-[10.5px] uppercase tracking-wider text-muted-foreground">
                    Yeni ödəniş
                  </h4>
                  <PaymentForm id={data.id} accounts={data.accounts} />
                </div>

                {data.odeniyler.length > 0 && (
                  <div>
                    <h4 className="mb-2 text-[10.5px] uppercase tracking-wider text-muted-foreground">
                      Ödəniş tarixçəsi
                    </h4>
                    <ul className="divide-y divide-border/40 rounded-md border border-border/40 bg-card/30">
                      {data.odeniyler.map((p) => (
                        <li key={p.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                          <CircleDollarSign className="h-3.5 w-3.5 flex-shrink-0 text-emerald-400" />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium tabular-nums">{formatMoney(p.meblegh)}</span>
                              {p.hesab_ad && (
                                <span className="text-xs text-muted-foreground">
                                  · {p.hesab_ad} ({p.hesab_nov ?? "—"})
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {p.tarix ? formatDate(p.tarix, { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"}
                              {p.qeyd && ` · ${p.qeyd}`}
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="qeyd" className="pt-4">
                <NotesTab
                  servisId={data.id}
                  notes={data.tarixce.map((t) => ({
                    id: t.id,
                    qeyd: t.qeyd,
                    yaradildi: t.yaradildi,
                    yeni_status: t.yeni_status,
                    deyisen_ad: t.deyisen_ad ?? null,
                  }))}
                />
              </TabsContent>
            </Tabs>
          </div>
        </div>

        {/* Footer — status flow düymələri */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border bg-secondary/30 px-4 py-2.5">
          <div className="flex flex-wrap items-center gap-1.5">
            {next.map((n) => (
              <Button
                key={n.status}
                size="sm"
                variant="outline"
                onClick={() => go(n.status)}
                disabled={pending}
                className="h-8"
              >
                {pending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <ArrowRight className="mr-1.5 h-3.5 w-3.5" />}
                {n.label}
              </Button>
            ))}
            <RejectReasonDialog
              servisId={data.id}
              onDone={() => router.refresh()}
            />
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <Link
              href={`/servis/${data.id}/print?format=akt`}
              target="_blank"
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-card/40 px-3 text-xs hover:bg-secondary"
            >
              <FileText className="h-3.5 w-3.5" /> Akt çap et
            </Link>
            <Link
              href={`/servis/${data.id}`}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-card/40 px-3 text-xs hover:bg-secondary"
            >
              <ExternalLink className="h-3.5 w-3.5" /> Tam detay
            </Link>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- Local helpers ---------- */

function InfoRow({
  icon: Icon,
  label,
  value,
  mono,
  tone,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  label?: string;
  value: string;
  mono?: boolean;
  tone?: "success" | "danger";
}) {
  const toneCls = tone === "success" ? "text-emerald-400" : tone === "danger" ? "text-rose-400" : "";
  return (
    <div className="flex items-start gap-2">
      {Icon && <Icon className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />}
      {label && <span className="text-xs text-muted-foreground">{label}:</span>}
      <span className={`flex-1 text-sm ${mono ? "font-mono text-xs" : ""} ${toneCls}`}>{value}</span>
    </div>
  );
}

function TimelineList({ entries }: { entries: DetailTimelineEntry[] }) {
  if (entries.length === 0) {
    return <p className="text-sm text-muted-foreground">Hələ tarixçə yoxdur.</p>;
  }
  return (
    <ol className="relative space-y-2.5">
      {entries.map((e) => {
        const prev = e.evvelki_status ? SERVIS_STATUS_LABELS[e.evvelki_status] : null;
        const next = SERVIS_STATUS_LABELS[e.yeni_status];
        const isQeyd = e.yeni_status === "qeyd";
        return (
          <li key={e.id} className="rounded-md border border-border/40 bg-card/40 p-3 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              {!isQeyd && next ? (
                <>
                  {prev && <Badge variant="outline" className={prev.cls}>{prev.label}</Badge>}
                  {prev && <span className="text-xs text-muted-foreground">→</span>}
                  <Badge variant="outline" className={next.cls}>{next.label}</Badge>
                </>
              ) : (
                <Badge variant="outline" className="border-slate-400/30 bg-slate-400/10 text-slate-300">
                  Qeyd
                </Badge>
              )}
              {e.deyisen_ad && <span className="text-xs text-muted-foreground">· {e.deyisen_ad}</span>}
              {e.yaradildi && (
                <span className="ml-auto text-xs text-muted-foreground">
                  {formatDate(e.yaradildi, { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                </span>
              )}
            </div>
            {e.qeyd && <p className="mt-1.5 whitespace-pre-wrap text-xs text-muted-foreground">{e.qeyd}</p>}
          </li>
        );
      })}
    </ol>
  );
}

function TaskList({ tasks }: { tasks: DetailTask[]; servisId: string }) {
  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center gap-1 rounded-md border border-dashed border-border/60 py-8 text-center text-xs text-muted-foreground">
        <ListTodo className="h-4 w-4" />
        <span>Bu servisə bağlı tapşırıq yoxdur.</span>
        <Link href="/tapshiriqlar" className="mt-1 text-primary-light hover:underline">
          Tapşırıqlar bölməsinə keç →
        </Link>
      </div>
    );
  }
  return (
    <ul className="space-y-2">
      {tasks.map((t) => (
        <li key={t.id} className="flex items-start gap-2 rounded-md border border-border/40 bg-card/40 p-3 text-sm">
          <ListTodo className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Link href={`/tapshiriqlar/${t.id}`} className="font-medium hover:underline">
                {t.basliq}
              </Link>
              {t.status && (
                <Badge variant="outline" className="text-[10px]">
                  {t.status}
                </Badge>
              )}
              {t.prioritet && (
                <Badge variant="outline" className="text-[10px]">
                  {t.prioritet}
                </Badge>
              )}
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              {t.mesul_ad && <span>· {t.mesul_ad}</span>}
              {t.deadline && (
                <span>· son: {formatDate(t.deadline)}</span>
              )}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

/**
 * URL `?detail=<id>` parametri ilə modal trigger.
 * Bu wrapper-i page.tsx-də render edib; URL-də `detail` olduqda
 * `/api/servis/<id>/detail` çağırılır və modal göstərilir.
 */
export function ServisDetailModalRouter() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const detailId = searchParams.get("detail");
  const [data, setData] = useState<ServisModalData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!detailId) {
      setData(null);
      return;
    }
    setLoading(true);
    fetch(`/api/servis/${detailId}/detail`, { cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) return null;
        const j = await r.json();
        return j.data as ServisModalData | null;
      })
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch(() => {
        if (!cancelled) setData(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [detailId]);

  function clearDetail() {
    setData(null);
    const sp = new URLSearchParams(searchParams.toString());
    sp.delete("detail");
    const next = sp.toString();
    router.replace(`${pathname}${next ? `?${next}` : ""}`, { scroll: false });
  }

  if (!detailId) return null;
  if (loading && !data) {
    return (
      <Dialog open onOpenChange={(v) => (v ? null : clearDetail())}>
        <DialogContent showCloseButton={false} className="sm:max-w-md">
          <VisuallyHidden>
            <DialogTitle>Yüklənir</DialogTitle>
          </VisuallyHidden>
          <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Servis yüklənir…
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return <ServisDetailModal data={data} onOpenChange={(v) => (v ? null : clearDetail())} />;
}
