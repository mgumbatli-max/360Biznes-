import type { Metadata } from "next";
import Link from "next/link";
import { UserX, MessageCircle, Info, Crown, Star, Clock, Trash2, Search } from "lucide-react";
import { BackButton } from "@/components/ui/back-button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { KpiCard } from "@/features/dashboard/components/kpi-card";
import { getInaktivMusteriler } from "@/features/elaqe/inaktiv-queries";
import { formatMoney, formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "İnaktiv müştərilər" };
export const dynamic = "force-dynamic";

type SP = { min?: string };

const SEVIYYE_META: Record<string, { label: string; cls: string; icon: typeof Crown; desc: string }> = {
  vip:           { label: "VIP",            cls: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/40",   icon: Crown, desc: "5000+ ₼ alıcı, 60 günə qədər almayıb — təcili qaytar" },
  sadiq:         { label: "Sadiq",          cls: "bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/40", icon: Star, desc: "5+ satış, 90 günə qədər almayıb" },
  itirilmekde:   { label: "İtirilməkdə",    cls: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/40",       icon: Clock, desc: "30-90 gün almayıb — re-engagement!" },
  passiv:        { label: "Passiv",         cls: "bg-secondary text-muted-foreground border-border",                          icon: Trash2, desc: "90+ gün almayıb" },
};

const MESSAGES: Record<string, string> = {
  vip: "Hörmətli {{ad}}, sizi yenidən görmək istərdik! 🎁 VIP statusunuza görə bu həftəlik xüsusi 15% endirim hazırladıq. Mağazaya təşrif buyurun — sizinlə yenidən görüşmək istəyirik.",
  sadiq: "Salam {{ad}}, çoxdandır sizi görmürük 😊. Sadiq müştərimiz kimi sizə yeni məhsullarımızdan xəbər vermək istəyirik və 10% endirim təklif edirik.",
  itirilmekde: "Salam {{ad}}! Son alışınızdan ({{son_tarix}}) sonra sizi görmürük. Bu həftə bütün məhsullarda 10% endirim — sizin geri qayıtmağınızı gözləyirik!",
  passiv: "Salam {{ad}}, sizə yeni təkliflərimiz var. Bir baxmaq istəyərdiniz? 5% endirim kuponunuz hazırdır.",
};

function digitsOnly(t: string): string {
  return t.replace(/\D/g, "");
}

function whatsappLink(phone: string | null, ad: string, seviyye: string, son_tarix: Date | null): string | null {
  if (!phone) return null;
  const p = digitsOnly(phone);
  if (p.length < 9) return null;
  const tpl = MESSAGES[seviyye] ?? MESSAGES.itirilmekde;
  const msg = tpl
    .replace(/\{\{ad\}\}/g, ad)
    .replace(/\{\{son_tarix\}\}/g, son_tarix ? son_tarix.toLocaleDateString("az-AZ") : "");
  return `https://wa.me/${p}?text=${encodeURIComponent(msg)}`;
}

export default async function InaktivPage({
  searchParams,
}: {
  searchParams?: Promise<SP>;
}) {
  const sp = (await searchParams) ?? {};
  const minGun = Math.max(7, Math.min(365, Number(sp.min) || 30));
  const rows = await getInaktivMusteriler(minGun);

  const vipCnt = rows.filter((r) => r.rfm_seviyye === "vip").length;
  const sadiqCnt = rows.filter((r) => r.rfm_seviyye === "sadiq").length;
  const itirCnt = rows.filter((r) => r.rfm_seviyye === "itirilmekde").length;
  const passivCnt = rows.filter((r) => r.rfm_seviyye === "passiv").length;
  const cemiPotensial = rows.reduce((s, r) => s + r.cemi_satis_mebleg, 0);

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <BackButton fallback="/elaqe" className="mt-1" />
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
              <UserX className="h-5 w-5 text-rose-500" />
              İnaktiv müştərilər
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {minGun}+ gündür almayan müştərilər — re-engagement kampaniyası üçün
            </p>
          </div>
        </div>
        <form className="flex items-center gap-2">
          <label className="text-xs text-muted-foreground">Min gün:</label>
          <select
            name="min"
            defaultValue={String(minGun)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          >
            {[14, 30, 60, 90, 180, 365].map((d) => (
              <option key={d} value={d}>{d} gün</option>
            ))}
          </select>
          <button type="submit" className="h-9 rounded-md bg-foreground px-3 text-xs font-bold text-background hover:opacity-90">
            <Search className="mr-1 inline h-3 w-3" />
            Süz
          </button>
        </form>
      </header>

      {/* KPI strip */}
      <section className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <KpiCard icon={UserX} label="Cəmi inaktiv" value={String(rows.length)} subline={`${minGun}+ gün`} tone={rows.length > 0 ? "warning" : "neutral"} />
        <KpiCard icon={Crown} label="VIP təcili" value={String(vipCnt)} subline="Yüksək dəyər" tone={vipCnt > 0 ? "danger" : "neutral"} />
        <KpiCard icon={Star} label="Sadiq" value={String(sadiqCnt)} subline="5+ alış" />
        <KpiCard icon={Clock} label="İtirilməkdə" value={String(itirCnt)} subline="30-90 gün" tone={itirCnt > 0 ? "warning" : "neutral"} />
        <KpiCard icon={Trash2} label="Passiv" value={String(passivCnt)} subline="90+ gün" tone="neutral" />
      </section>

      {/* İzah */}
      <Card className="glass border-sky-500/30 bg-sky-500/5">
        <CardContent className="space-y-1 py-3 text-[11px]">
          <div className="flex items-center gap-2 font-bold text-foreground">
            <Info className="h-3.5 w-3.5 text-sky-600" />
            RFM (Recency / Frequency / Monetary) analizi
          </div>
          <p className="text-muted-foreground">
            Hər müştəri tarixçəsinə görə avtomatik səviyyəyə bölünür. Hər səviyyə üçün ayrıca
            hazır WhatsApp şablonu var — VIP üçün 15% endirim, sadiqlər üçün 10%, itirilməkdə
            olanlar üçün xüsusi qaytar mesajı.
          </p>
          <p className="text-muted-foreground">
            <strong className="text-foreground">Potensial dəyər:</strong> bu müştərilərin tarixi cəm satışı{" "}
            <strong className="text-foreground tabular-nums">{formatMoney(cemiPotensial)}</strong> — geri qaytarmaq dəyər!
          </p>
        </CardContent>
      </Card>

      {/* List */}
      {rows.length === 0 ? (
        <Card className="glass border-dashed">
          <CardContent className="py-12 text-center">
            <UserX className="mx-auto mb-2 h-10 w-10 text-emerald-500/40" />
            <p className="text-sm font-semibold">Heç bir inaktiv müştəri yoxdur 🎉</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Bütün müştərilərin son {minGun} gün ərzində alışları var.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="glass">
          <CardContent className="p-0">
            <div className="divide-y divide-border/30">
              {rows.map((r) => {
                const meta = SEVIYYE_META[r.rfm_seviyye] ?? SEVIYYE_META.passiv;
                const Icon = meta.icon;
                const wa = whatsappLink(r.telefon, r.ad, r.rfm_seviyye, r.son_satis_tarix);
                return (
                  <div key={r.id} className="flex flex-wrap items-center gap-3 px-4 py-3 hover:bg-secondary/20">
                    <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${meta.cls.split(" ").slice(0, 2).join(" ")}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link href={`/elaqe/musteriler/${r.id}`} className="text-sm font-bold hover:text-primary">
                          {r.ad}
                        </Link>
                        <Badge variant="outline" className={`text-[10px] ${meta.cls}`}>
                          {meta.label}
                        </Badge>
                        {r.borc > 0 && (
                          <Badge variant="outline" className="text-[10px] border-rose-500/30 text-rose-600">
                            Borc: {formatMoney(r.borc)}
                          </Badge>
                        )}
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[10.5px] text-muted-foreground">
                        <span>
                          Son: {r.son_satis_tarix ? formatDate(r.son_satis_tarix) : "—"}{" "}
                          <span className="text-rose-600 font-semibold">({r.gun_qalib} gün)</span>
                        </span>
                        <span>·</span>
                        <span>Cəmi: <strong className="text-foreground tabular-nums">{r.cemi_satis_say}</strong> alış, <strong className="text-foreground tabular-nums">{formatMoney(r.cemi_satis_mebleg)}</strong></span>
                        {r.telefon && (
                          <>
                            <span>·</span>
                            <span className="font-mono">{r.telefon}</span>
                          </>
                        )}
                      </div>
                      <p className="mt-0.5 text-[9.5px] italic text-muted-foreground">{meta.desc}</p>
                    </div>
                    {wa ? (
                      <a
                        href={wa}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex h-8 items-center gap-1 rounded-md bg-emerald-500 px-3 text-xs font-bold text-white hover:bg-emerald-600"
                        title="WhatsApp ilə geri qaytarma mesajı göndər"
                      >
                        <MessageCircle className="h-3 w-3" />
                        Qaytar
                      </a>
                    ) : (
                      <span className="text-[10px] italic text-muted-foreground">Telefon yox</span>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
