import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Calendar, Tag, Settings, BarChart3, Ticket } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getCampaignDetail } from "@/features/kampaniyalar/queries";
import { TIP_META, STATUS_META, type KampaniyaTip, type KampaniyaStatus } from "@/features/kampaniyalar/types";
import { CampaignStatusButtons } from "@/features/kampaniyalar/components/campaign-status-buttons";
import { CouponBulkDialog } from "@/features/kampaniyalar/components/coupon-bulk-dialog";
import { TelegramBroadcastButton } from "@/features/kampaniyalar/components/telegram-broadcast-button";
import { CampaignDiscountFix } from "@/features/kampaniyalar/components/campaign-discount-fix";
import { cn, formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Kampaniya detalı" };

export default async function CampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await getCampaignDetail(id);
  if (!c) notFound();

  const tipMeta = TIP_META[c.tip as KampaniyaTip] ?? TIP_META.percent_endirim;
  const statusMeta = STATUS_META[c.status as KampaniyaStatus] ?? STATUS_META.draft;

  // Endirim parametri yoxlanışı — kupon və endirim tipləri üçün
  const needsDiscount = ["percent_endirim", "sabit_endirim", "sebet_endirim", "flash_sale", "doğum_gunu", "welcome", "reaktivlesdir", "coupon"].includes(c.tip);
  const actionObj = (c.action_json ?? {}) as Record<string, unknown>;
  const discountType = (actionObj.discount_type as "percent" | "fixed" | undefined) ?? null;
  const discountValue = Number.isFinite(Number(actionObj.value)) && Number(actionObj.value) > 0
    ? Number(actionObj.value)
    : null;
  const discountMissing = needsDiscount && (!discountType || !discountValue);

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <Link href="/kampaniyalar" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ChevronLeft className="h-3 w-3" /> Kampaniyalar
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-4">
          <div className="grid h-14 w-14 flex-shrink-0 place-items-center rounded-2xl bg-secondary text-3xl shadow-sm">
            {c.ikon ?? tipMeta.emoji}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">{c.ad}</h1>
              <Badge variant="outline" className={cn("text-[10px]", statusMeta.reng)}>{statusMeta.ad}</Badge>
            </div>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              {c.aciqlamaq ?? tipMeta.tesvir}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <Badge variant="outline" className="text-[10px]">{tipMeta.ad}</Badge>
              {c.stackable && <Badge variant="outline" className="text-[10px]">Stack icazəli</Badge>}
              <Badge variant="outline" className="text-[10px]">Prioritet: {c.prioritet}</Badge>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <TelegramBroadcastButton campaignId={c.id} />
          {c.tip === "coupon" && <CouponBulkDialog campaignId={c.id} campaignName={c.ad} />}
          <CampaignStatusButtons id={c.id} currentStatus={c.status as KampaniyaStatus} />
        </div>
      </header>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card className="glass">
          <CardContent className="space-y-1 py-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">İstifadə</div>
            <div className="text-2xl font-bold tabular-nums">{c.current_uses}</div>
          </CardContent>
        </Card>
        <Card className="glass">
          <CardContent className="space-y-1 py-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Maks limit</div>
            <div className="text-2xl font-bold tabular-nums">{c.max_uses ?? "∞"}</div>
          </CardContent>
        </Card>
        <Card className="glass">
          <CardContent className="space-y-1 py-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Müştəri başına</div>
            <div className="text-2xl font-bold tabular-nums">{c.max_per_user ?? "∞"}</div>
          </CardContent>
        </Card>
        <Card className="glass">
          <CardContent className="space-y-1 py-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Kuponlar</div>
            <div className="text-2xl font-bold tabular-nums">{c._count.coupons}</div>
          </CardContent>
        </Card>
      </section>

      {needsDiscount && (
        <Card className="glass">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Tag className="h-4 w-4 text-primary" /> Endirim parametri
            </CardTitle>
          </CardHeader>
          <CardContent>
            <CampaignDiscountFix
              campaignId={c.id}
              currentType={discountType}
              currentValue={discountValue}
              isMissing={discountMissing}
            />
          </CardContent>
        </Card>
      )}

      <Card className="glass">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Calendar className="h-4 w-4 text-primary" /> Vaxt çərçivəsi
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-2 text-sm md:grid-cols-3">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Başlama</div>
            <div className="font-medium">{formatDate(c.baslama, { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Bitmə</div>
            <div className="font-medium">{c.bitme ? formatDate(c.bitme, { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "Müddətsiz"}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Yaradıldı</div>
            <div className="font-medium">{formatDate(c.yaradildi, { day: "2-digit", month: "short", year: "numeric" })}</div>
          </div>
        </CardContent>
      </Card>

      {c.coupons.length > 0 && (
        <Card className="glass">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Ticket className="h-4 w-4 text-rose-500" /> Kuponlar
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y divide-border/40">
              {c.coupons.map((k) => (
                <li key={k.id} className="flex items-center justify-between gap-3 px-4 py-2 text-xs">
                  <code className="font-mono">{k.kod}</code>
                  <span className="tabular-nums">{k.current_uses}/{k.max_uses}</span>
                  <Badge variant="outline" className={cn("text-[10px]", k.aktiv ? "border-emerald-500/40 text-emerald-500" : "")}>
                    {k.aktiv ? "Aktiv" : "Passiv"}
                  </Badge>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
