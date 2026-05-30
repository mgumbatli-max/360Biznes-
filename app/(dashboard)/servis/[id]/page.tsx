import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Phone,
  User,
  Tag,
  ShieldCheck,
  Calendar,
  CircleDollarSign,
  Wrench,
  Printer,
} from "lucide-react";
import { BackButton } from "@/components/ui/back-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  getServisDetail,
  getMaliyeAccountsForServis,
  getServisPayments,
  getAktSablonlari,
  getServisEhtiyatHisseler,
  getMehsulOptionsForServis,
} from "@/features/servis/queries";
import { SERVIS_STATUS_LABELS, SERVIS_PRIORITY_LABELS } from "@/features/servis/types";
import { ProductInline } from "@/features/anbar/components/product-inline";
import { formatDate, formatMoney } from "@/lib/utils";
import { ServisStatusActions } from "@/features/servis/components/servis-status-actions";
import { QuickStatusBar } from "@/features/servis/components/quick-status-bar";
import { DiagnostikaForm } from "@/features/servis/components/diagnostika-form";
import { RepairNoteForm } from "@/features/servis/components/repair-note-form";
import { QiymetTeklifForm } from "@/features/servis/components/qiymet-teklif-form";
import { PaymentForm } from "@/features/servis/components/payment-form";
import { StatusTimeline } from "@/features/servis/components/status-timeline";
import { ServisFayllar } from "@/features/servis/components/servis-fayllar";
import { MusteriShareButton } from "@/features/servis/components/musteri-share-button";
import { AktPrintButton } from "@/features/servis/components/akt-print-button";
import { EhtiyatHisseTab } from "@/features/servis/components/ehtiyat-hisse-tab";
import { NotifyTab } from "@/features/servis/components/notify-tab";

export const metadata: Metadata = { title: "Servis detayı" };

export default async function ServisDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [s, accounts, payments, aktSablonlari, hisseler, mehsullar] = await Promise.all([
    getServisDetail(id),
    getMaliyeAccountsForServis(),
    getServisPayments(id),
    getAktSablonlari(),
    getServisEhtiyatHisseler(id),
    getMehsulOptionsForServis(),
  ]);
  if (!s) notFound();

  const primaryQrToken = s.zemanetler[0]?.qr_token ?? null;

  const status = SERVIS_STATUS_LABELS[s.status] ?? SERVIS_STATUS_LABELS.qebul_edildi;
  const prioTag = /\bprioritet:(asagi|orta|yuksek|tecili)\b/i.exec(s.daxili_qeyd ?? "")?.[1]?.toLowerCase() ?? "orta";
  const prio = SERVIS_PRIORITY_LABELS[prioTag] ?? SERVIS_PRIORITY_LABELS.orta;
  const profit = Number(s.musteriden_alinan ?? 0) - Number(s.temir_xerci ?? 0);
  const balance = Number(s.temir_xerci ?? 0) - Number(s.musteriden_alinan ?? 0);

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <header className="flex items-start gap-3">
        <BackButton fallback="/servis" className="mt-1" />
        <div className="min-w-0 flex-1">
          <h1 className="font-mono text-xl font-bold">{s.nomre}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={status.cls}>{status.label}</Badge>
            <Badge variant="outline" className={prio.cls}>Prioritet: {prio.label}</Badge>
            {s.zemanet_var && (
              <Badge variant="outline" className="border-emerald-400/30 text-emerald-300">
                <ShieldCheck className="h-3 w-3" /> Zəmanət
              </Badge>
            )}
            {s.satis_sifarisleri && (
              <Link href={`/ticaret/satislar/${s.satis_sifarisleri.id}`} className="text-xs text-primary-light hover:underline">
                Satış: {s.satis_sifarisleri.nomre} →
              </Link>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/servis/${id}/print`}
            target="_blank"
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border px-3 text-sm hover:bg-secondary"
          >
            <Printer className="h-3.5 w-3.5" /> Qəbz çap et
          </Link>
          <AktPrintButton
            servisId={s.id}
            sablonlar={aktSablonlari.map((a) => ({
              id: a.id,
              ad: a.ad,
              nov: a.nov,
              format: a.format ?? null,
              default_sablon: a.default_sablon ?? false,
            }))}
          />
          <MusteriShareButton
            servisId={s.id}
            servisNomre={s.nomre}
            musteriAd={s.musteri_ad}
            musteriTelefon={s.musteri_telefon}
            qrToken={primaryQrToken}
          />
          <ServisStatusActions id={s.id} currentStatus={s.status} />
        </div>
      </header>

      <QuickStatusBar id={s.id} currentStatus={s.status} telefon={s.musteri_telefon} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="glass">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">Müştəri</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row icon={User} value={s.musteri_ad} />
            <Row icon={Phone} value={s.musteri_telefon} />
            {s.kontragentler && (
              <Link href={`/elaqe/musteriler/${s.kontragentler.id}`} className="text-xs text-primary-light hover:underline">
                Müştəri profilinə bax →
              </Link>
            )}
          </CardContent>
        </Card>

        <Card className="glass">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">Məhsul</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {s.mehsul_id ? (
              <ProductInline
                id={s.mehsul_id}
                ad={s.mehsul_ad}
                kod={s.mehsullar?.kod ?? null}
                barkod={s.mehsullar?.barkod ?? null}
                showImage={false}
                size="xs"
              />
            ) : (
              <Row icon={Tag} value={s.mehsul_ad} />
            )}
            {s.mehsul_seri_nomresi && <Row label="Serial / IMEI" value={s.mehsul_seri_nomresi} mono />}
            {s.satis_tarixi && <Row icon={Calendar} label="Satış tarixi" value={formatDate(s.satis_tarixi)} />}
            {s.zemanet_baslama && s.zemanet_bitme && (
              <Row label="Zəmanət" value={`${formatDate(s.zemanet_baslama)} → ${formatDate(s.zemanet_bitme)}`} />
            )}
          </CardContent>
        </Card>

        <Card className="glass">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">Mali</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row icon={Wrench} label="Təmir xərci" value={formatMoney(Number(s.temir_xerci ?? 0))} />
            <Row icon={CircleDollarSign} label="Müştəridən" value={formatMoney(Number(s.musteriden_alinan ?? 0))} />
            <div className="border-t border-border/40 pt-2">
              <Row
                label="Qalıq borc"
                value={formatMoney(balance > 0 ? balance : 0)}
                tone={balance > 0 ? "danger" : "success"}
                bold
              />
              <Row
                label="Mənfəət"
                value={formatMoney(profit)}
                tone={profit > 0 ? "success" : profit < 0 ? "danger" : undefined}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="umumi">
        <TabsList variant="line" className="w-full overflow-x-auto">
          <TabsTrigger value="umumi">Ümumi</TabsTrigger>
          <TabsTrigger value="diaqnostika">Diaqnostika</TabsTrigger>
          <TabsTrigger value="temir">Təmir prosesi</TabsTrigger>
          <TabsTrigger value="hisseler">Ehtiyat hissələr</TabsTrigger>
          <TabsTrigger value="qiymet">Qiymət</TabsTrigger>
          <TabsTrigger value="odenis">Ödəniş</TabsTrigger>
          <TabsTrigger value="fayllar">Fayllar{s.servis_fayllari.length > 0 ? ` (${s.servis_fayllari.length})` : ""}</TabsTrigger>
          <TabsTrigger value="zemanet">Zəmanət</TabsTrigger>
          <TabsTrigger value="bildiris">Bildiriş</TabsTrigger>
          <TabsTrigger value="audit">Audit</TabsTrigger>
        </TabsList>

        <TabsContent value="umumi" className="space-y-4 pt-4">
          <Card className="glass">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Problem təsviri</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap text-sm">{s.problem_tesviri}</p>
            </CardContent>
          </Card>

          <Card className="glass">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Status tarixçəsi</CardTitle>
            </CardHeader>
            <CardContent>
              <StatusTimeline entries={s.servis_status_tarixce} />
            </CardContent>
          </Card>

          <Card className="glass">
            <CardContent className="grid grid-cols-2 gap-3 py-4 text-xs sm:grid-cols-4">
              <Field label="Qəbul edən" value={s.istifadeciler_servis_qeydleri_qebul_eden_idToistifadeciler?.ad_soyad ?? "—"} />
              <Field label="Texnik" value={s.istifadeciler_servis_qeydleri_servis_iscisi_idToistifadeciler?.ad_soyad ?? "—"} />
              {s.yaradildi && <Field label="Yaradılıb" value={formatDate(s.yaradildi)} />}
              {s.texmini_tehvil && <Field label="Vəd tarixi" value={formatDate(s.texmini_tehvil)} />}
              {s.servis_defekt_kateq && (
                <Field
                  label="Defekt kateqoriyası"
                  value={`${s.servis_defekt_kateq.ad}${s.servis_defekt_kateq.qrup ? ` · ${s.servis_defekt_kateq.qrup}` : ""}`}
                />
              )}
              {s.komplektasiya && (
                <div className="sm:col-span-4">
                  <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground">Aksessuarlar</div>
                  <div className="mt-0.5 text-muted-foreground">{s.komplektasiya}</div>
                </div>
              )}
              {s.netice_aciqlamasi && (
                <div className="sm:col-span-4">
                  <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground">Nəticə</div>
                  <div className="mt-0.5 whitespace-pre-wrap">{s.netice_aciqlamasi}</div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="diaqnostika" className="space-y-4 pt-4">
          <Card className="glass">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Diaqnostika qeydləri</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                {s.texniki_qeyd || "Hələ qeyd yoxdur."}
              </p>
              <DiagnostikaForm id={s.id} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="temir" className="space-y-4 pt-4">
          <Card className="glass">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Təmir qeyd timeline</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <RepairNoteForm id={s.id} />
              <StatusTimeline entries={s.servis_status_tarixce.filter((t) => t.yeni_status === "qeyd" || t.qeyd)} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="hisseler" className="space-y-4 pt-4">
          <Card className="glass">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Ehtiyat hissələr</CardTitle>
            </CardHeader>
            <CardContent>
              <EhtiyatHisseTab
                servisId={s.id}
                hisseler={hisseler}
                mehsullar={mehsullar.map((m) => ({
                  id: m.id,
                  ad: m.ad,
                  kod: m.kod ?? null,
                  barkod: m.barkod ?? null,
                }))}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="qiymet" className="space-y-4 pt-4">
          <Card className="glass">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Qiymət təklifi</CardTitle>
            </CardHeader>
            <CardContent>
              <QiymetTeklifForm
                id={s.id}
                currentXerc={Number(s.temir_xerci ?? 0)}
                trackToken={primaryQrToken ?? s.id.slice(-8)}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="odenis" className="space-y-4 pt-4">
          <Card className="glass">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Ödəniş</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-3 grid grid-cols-3 gap-3 rounded-md border border-border/40 p-3 text-sm">
                <div>
                  <div className="text-xs text-muted-foreground">Yekun</div>
                  <div className="font-semibold">{formatMoney(Number(s.temir_xerci ?? 0))}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Alındı</div>
                  <div className="font-semibold text-emerald-400">{formatMoney(Number(s.musteriden_alinan ?? 0))}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Qalıq</div>
                  <div className={`font-semibold ${balance > 0 ? "text-rose-400" : "text-emerald-400"}`}>
                    {formatMoney(balance > 0 ? balance : 0)}
                  </div>
                </div>
              </div>
              <PaymentForm id={s.id} accounts={accounts} />
            </CardContent>
          </Card>

          <Card className="glass">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Ödəniş tarixçəsi</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {payments.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-muted-foreground">Hələ ödəniş yoxdur.</p>
              ) : (
                <div className="divide-y divide-border/40">
                  {payments.map((p) => (
                    <div key={p.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
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
                        <div className="mt-0.5 text-xs text-muted-foreground">
                          {p.tarix ? formatDate(p.tarix) : "—"}
                          {p.qeyd && ` · ${p.qeyd}`}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="fayllar" className="space-y-4 pt-4">
          <Card className="glass">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Fayllar və fotolar</CardTitle>
            </CardHeader>
            <CardContent>
              <ServisFayllar
                servisId={s.id}
                fayllar={s.servis_fayllari.map((f) => ({
                  id: f.id,
                  fayl_adi: f.fayl_adi,
                  orijinal_adi: f.orijinal_adi,
                  nov: f.nov,
                  aciqlama: f.aciqlama,
                  olcu_bayt: f.olcu_bayt,
                  mime_tip: f.mime_tip,
                  yaradildi: f.yaradildi,
                }))}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="zemanet" className="space-y-4 pt-4">
          <Card className="glass">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Zəmanət</CardTitle>
            </CardHeader>
            <CardContent>
              {s.zemanetler.length > 0 ? (
                <div className="space-y-2 text-sm">
                  {s.zemanetler.map((z) => (
                    <div key={z.id} className="flex items-center justify-between rounded-md border border-border/40 p-2">
                      <div>
                        <div className="font-mono text-xs">{z.unikal_kod}</div>
                        <div className="text-xs text-muted-foreground">
                          Bitir: {z.bitme_tarixi ? formatDate(z.bitme_tarixi) : "—"} · {z.status}
                        </div>
                      </div>
                      <Link href={`/servis/zemanet`} className="text-xs text-primary-light hover:underline">
                        Zəmanətə bax →
                      </Link>
                    </div>
                  ))}
                </div>
              ) : s.zemanet_var ? (
                <p className="text-sm text-muted-foreground">Zəmanət dövründədir, lakin əlaqəli talon yoxdur.</p>
              ) : (
                <p className="text-sm text-muted-foreground">Bu servisə zəmanət bağlanmayıb.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="bildiris" className="space-y-4 pt-4">
          <Card className="glass">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Müştəri bildirişləri</CardTitle>
            </CardHeader>
            <CardContent>
              <NotifyTab
                servisId={s.id}
                servisNomre={s.nomre}
                musteriAd={s.musteri_ad}
                musteriTelefon={s.musteri_telefon}
                son_xeber={s.son_musteri_xeber}
                trackToken={primaryQrToken ?? s.id.slice(-8)}
                loglar={parseNotifyLogs(s.daxili_qeyd)}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit" className="space-y-4 pt-4">
          <Card className="glass">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Audit</CardTitle>
            </CardHeader>
            <CardContent>
              <StatusTimeline entries={s.servis_status_tarixce} dense />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Row({
  icon: Icon,
  label,
  value,
  mono,
  tone,
  bold,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  label?: string;
  value: string;
  mono?: boolean;
  tone?: "success" | "danger";
  bold?: boolean;
}) {
  const toneCls = tone === "success" ? "text-emerald-400" : tone === "danger" ? "text-rose-400" : "";
  return (
    <div className="flex items-start gap-2">
      {Icon && <Icon className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />}
      {label && <span className="text-xs text-muted-foreground">{label}:</span>}
      <span className={`flex-1 ${mono ? "font-mono text-xs" : ""} ${bold ? "font-semibold" : ""} ${toneCls}`}>
        {value}
      </span>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-0.5 font-medium">{value}</div>
    </div>
  );
}

/** daxili_qeyd-dən bildiriş loglarını parse et */
function parseNotifyLogs(daxili: string | null | undefined): { yaradildi: Date | null; channel: string; message: string }[] {
  if (!daxili) return [];
  const lines = daxili.split("\n");
  const out: { yaradildi: Date | null; channel: string; message: string }[] = [];
  for (const line of lines) {
    const m = /^\[([^\]]+)\]\s*\[Bildiriş:([^\]/]+)(?:\/([^\]]+))?\]\s*(.*)$/.exec(line);
    if (m) {
      out.push({
        yaradildi: new Date(m[1].replace(",", "")) || null,
        channel: `${m[2]}${m[3] ? `/${m[3]}` : ""}`,
        message: m[4],
      });
    }
  }
  return out.reverse().slice(0, 20);
}
