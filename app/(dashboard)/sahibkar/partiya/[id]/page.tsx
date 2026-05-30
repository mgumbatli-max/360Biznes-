import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Truck, Package, Receipt, FileText, Store, ExternalLink,
  Globe, Phone, Mail, Calendar,
} from "lucide-react";
import { BackButton } from "@/components/ui/back-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { requireSahibkarSession } from "@/lib/sahibkar/guard";
import { getPartiyaDetail } from "@/features/sahibkar/partiya-detail-queries";
import { SectionExplainer } from "@/features/sahibkar/components/section-explainer";
import { formatMoney, formatNumber, formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Partiya detalı" };

export default async function PartiyaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireSahibkarSession();
  const { id } = await params;
  const numId = Number(id);
  if (!Number.isFinite(numId)) notFound();

  const p = await getPartiyaDetail(numId);
  if (!p) notFound();

  const xercCemi = p.sahibkar_partiya_xerc.reduce((s, x) => s + Number(x.mebleg_azn), 0);
  const mehsulCemi = p.sahibkar_partiya_mehsul.length;
  const senedSay = p.sahibkar_partiya_sened.length;

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <BackButton fallback="/sahibkar/partiya" className="mt-1" />
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
              <Truck className="h-5 w-5 text-amber-500" />
              {p.ad}
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="outline" className="text-[10px]">{p.status ?? "qaralama"}</Badge>
              {p.olke && <span className="flex items-center gap-1"><Globe className="h-3 w-3" /> {p.olke}</span>}
              {p.tarix && <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {formatDate(p.tarix)}</span>}
              {p.valyuta && <span>{p.valyuta} (kurs {Number(p.kurs ?? 1).toFixed(4)})</span>}
            </div>
          </div>
        </div>
      </header>

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
        <Kpi label="Xarici val cəmi" value={`${Number(p.cemi_xarici_val ?? 0).toLocaleString("az-AZ")} ${p.valyuta ?? ""}`} />
        <Kpi label="Xarici → AZN" value={formatMoney(Number(p.cemi_xarici_azn ?? 0))} />
        <Kpi label="Əlavə xərc" value={formatMoney(xercCemi)} />
        <Kpi label="Real maya AZN" value={formatMoney(Number(p.cemi_real_maya_azn ?? 0))} tone="emerald" />
        <Kpi label="Məhsul / Sənəd" value={`${mehsulCemi} / ${senedSay}`} />
      </div>

      <SectionExplainer
        icon={Truck}
        tone="amber"
        description="Bu partiyaya aid bütün bağlantılar bir səhifədə: təchizatçı/alıcı, alış sifariş, mal sətirləri, paylanmış xərclər (gömrük, daşınma, toplama), sənədlər və mağaza paylanması."
      />

      {/* Bağlantılar */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {p.sahibkar_techizatci && (
          <Card className="glass">
            <CardHeader className="pb-2"><CardTitle className="text-sm">Təchizatçı</CardTitle></CardHeader>
            <CardContent className="space-y-1 text-xs">
              <div className="font-semibold">{p.sahibkar_techizatci.ad}</div>
              {p.sahibkar_techizatci.olke && <div className="flex items-center gap-1.5 text-muted-foreground"><Globe className="h-3 w-3" /> {p.sahibkar_techizatci.olke}</div>}
              {p.sahibkar_techizatci.telefon && <div className="flex items-center gap-1.5 text-muted-foreground"><Phone className="h-3 w-3" /> {p.sahibkar_techizatci.telefon}</div>}
              {p.sahibkar_techizatci.email && <div className="flex items-center gap-1.5 text-muted-foreground"><Mail className="h-3 w-3" /> {p.sahibkar_techizatci.email}</div>}
            </CardContent>
          </Card>
        )}
        {p.alis_sifarisleri && (
          <Card className="glass border-emerald-500/30">
            <CardHeader className="pb-2"><CardTitle className="text-sm">Bağlı alış sifariş</CardTitle></CardHeader>
            <CardContent className="space-y-1 text-xs">
              <div className="font-semibold">{p.alis_sifarisleri.qaime_nomre ?? p.alis_sifarisleri.nomre ?? `#${p.alis_sifarisleri.id}`}</div>
              <div className="text-muted-foreground">{p.alis_sifarisleri.tarix ? formatDate(p.alis_sifarisleri.tarix) : "—"}</div>
              <div className="tabular-nums">{formatMoney(Number(p.alis_sifarisleri.umumi_mebleg ?? 0))}</div>
              <Link href={`/satinalma/${p.alis_sifarisleri.id}`} className="mt-1 inline-flex items-center gap-1 text-[11px] text-primary-light hover:underline">
                Sifarişə bax <ExternalLink className="h-3 w-3" />
              </Link>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Məhsullar */}
      {p.sahibkar_partiya_mehsul.length > 0 && (
        <Card className="glass">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Package className="h-4 w-4 text-sky-500" /> Mal sətirləri ({p.sahibkar_partiya_mehsul.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-secondary/40 text-[10.5px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-2 py-2 text-left">Məhsul</th>
                  <th className="px-2 py-2 text-left">Mağaza</th>
                  <th className="px-2 py-2 text-right">Say</th>
                  <th className="px-2 py-2 text-right">Vahid maya</th>
                  <th className="px-2 py-2 text-right">Cəmi maya</th>
                  <th className="px-2 py-2 text-right">Plan satış</th>
                  <th className="px-2 py-2 text-right">Marja %</th>
                  <th className="px-2 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {p.sahibkar_partiya_mehsul.map((m) => (
                  <tr key={m.id} className="border-b border-border/30">
                    <td className="px-2 py-1.5">
                      <div className="font-medium">{m.ad}</div>
                      {m.model && <div className="text-[10px] text-muted-foreground">{m.model}{m.reng ? ` · ${m.reng}` : ""}</div>}
                    </td>
                    <td className="px-2 py-1.5 text-xs text-muted-foreground">{m.sahibkar_partiya_magaza?.ad ?? "—"}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{formatNumber(Number(m.miqdar ?? 0), 0)}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{formatMoney(Number(m.real_maya_unit ?? 0))}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{formatMoney(Number(m.real_maya_cemi ?? 0))}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{m.satis_qiymeti_plan ? formatMoney(Number(m.satis_qiymeti_plan)) : "—"}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{m.gozlenen_marja ? `${Number(m.gozlenen_marja).toFixed(1)}%` : "—"}</td>
                    <td className="px-2 py-1.5">
                      {m.mehsullar && (
                        <Link href={`/anbar/mehsullar/${m.mehsullar.id}`} className="text-primary-light hover:underline">
                          <ExternalLink className="inline h-3 w-3" />
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* Xərclər */}
      {p.sahibkar_partiya_xerc.length > 0 && (
        <Card className="glass">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Receipt className="h-4 w-4 text-rose-500" /> Əlavə xərclər ({p.sahibkar_partiya_xerc.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1.5">
              {p.sahibkar_partiya_xerc.map((x) => (
                <li key={x.id} className="flex items-center justify-between gap-3 rounded-md border border-border/30 px-3 py-1.5 text-xs">
                  <div className="min-w-0">
                    <div className="font-medium">{x.ad}</div>
                    <div className="text-[10px] text-muted-foreground">
                      {x.nov ?? "basqa"} · paylanma: {x.bolme_usulu ?? "məbləğ"}
                      {x.qeyd ? ` · ${x.qeyd}` : ""}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="font-semibold tabular-nums">{formatMoney(Number(x.mebleg_azn))}</div>
                    {x.mebleg_orig && x.valyuta && (
                      <div className="text-[10px] text-muted-foreground">
                        {Number(x.mebleg_orig).toLocaleString("az-AZ")} {x.valyuta}
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex items-center justify-between border-t border-border/30 pt-2 text-xs font-semibold">
              <span>Cəmi xərc</span>
              <span className="tabular-nums">{formatMoney(xercCemi)}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sənədlər */}
      {p.sahibkar_partiya_sened.length > 0 && (
        <Card className="glass">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <FileText className="h-4 w-4 text-violet-500" /> Sənədlər ({p.sahibkar_partiya_sened.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1">
              {p.sahibkar_partiya_sened.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-3 rounded-md border border-border/30 px-3 py-1.5 text-xs">
                  <div className="flex items-center gap-2">
                    <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="font-medium">{s.ad ?? "(adsız)"}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                    {s.yuklendi && <span>{formatDate(s.yuklendi)}</span>}
                    {s.fayl_yol && (
                      <a href={s.fayl_yol} target="_blank" rel="noopener noreferrer" className="text-primary-light hover:underline">
                        <ExternalLink className="inline h-3 w-3" />
                      </a>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Mağaza paylanması */}
      {p.sahibkar_partiya_magaza.length > 0 && (
        <Card className="glass">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Store className="h-4 w-4 text-emerald-500" /> Mağaza paylanması ({p.sahibkar_partiya_magaza.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="grid grid-cols-1 gap-1.5 md:grid-cols-2">
              {p.sahibkar_partiya_magaza.map((m) => (
                <li key={m.id} className="rounded-md border border-border/30 px-3 py-1.5 text-xs">
                  <div className="font-medium">{m.ad}</div>
                  <div className="text-[10px] text-muted-foreground">
                    {m.olke ?? "—"}{m.unvan ? ` · ${m.unvan}` : ""}
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: string; tone?: "emerald" }) {
  return (
    <div className={`rounded-md border px-3 py-2 ${tone === "emerald" ? "border-emerald-500/30 bg-emerald-500/10" : "border-border/40 bg-secondary/30"}`}>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`mt-0.5 text-sm font-semibold tabular-nums ${tone === "emerald" ? "text-emerald-700 dark:text-emerald-400" : ""}`}>{value}</div>
    </div>
  );
}
