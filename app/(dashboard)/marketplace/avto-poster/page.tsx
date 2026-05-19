import type { Metadata } from "next";
import Link from "next/link";
import { Send, Sparkles, FileEdit, Clock, CheckCircle2, XCircle, ArrowRight } from "lucide-react";
import { MarketplaceSubNav } from "@/components/marketplace-subnav";
import { KpiCard } from "@/features/dashboard/components/kpi-card";
import { PostComposer } from "@/features/marketplace/components/post-composer";
import { PostsList } from "@/features/marketplace/components/posts-list";
import {
  getSocialAccounts,
  getAllPosts,
  getSocialStats,
  type PostStatus,
} from "@/features/marketplace/social-queries";
import { publishDuePosts } from "@/features/marketplace/social-actions";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";

export const metadata: Metadata = { title: "Avto-Poster" };
export const dynamic = "force-dynamic";

type SP = { status?: string; hesab?: string };

async function getProductOptions() {
  return withTenant(() =>
    prisma.mehsullar.findMany({
      where: { aktiv: true },
      orderBy: { ad: "asc" },
      take: 500,
      select: { id: true, ad: true, sekil_url: true },
    }),
  );
}

export default async function AvtoPosterPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const filterStatus = (sp.status ?? "") as PostStatus | "";

  // Hər səhifə açılışında planlaşdırılmış vaxtı keçən postları dərc et
  await publishDuePosts().catch(() => null);

  const [accounts, allPosts, stats, products] = await Promise.all([
    getSocialAccounts(),
    getAllPosts(),
    getSocialStats(),
    getProductOptions(),
  ]);

  const posts = filterStatus
    ? allPosts.filter((p) => p.status === filterStatus)
    : allPosts;

  const FILTERS: Array<{ key: string; label: string; status: PostStatus | ""; tone?: "info" | "success" | "warning" | "danger" }> = [
    { key: "hamisi",          label: "Hamısı",          status: "" },
    { key: "qaralama",        label: "Qaralama",        status: "qaralama", tone: "warning" },
    { key: "planlasdirilmis", label: "Planlaşdırılmış", status: "planlasdirilmis", tone: "info" },
    { key: "gonderildi",      label: "Göndərildi",      status: "gonderildi", tone: "success" },
    { key: "xeta",            label: "Xəta",            status: "xeta", tone: "danger" },
  ];

  const counts: Record<string, number> = {
    hamisi: allPosts.length,
    qaralama: stats.qaralama,
    planlasdirilmis: stats.planlasdirilmis,
    gonderildi: allPosts.filter((p) => p.status === "gonderildi").length,
    xeta: stats.xeta,
  };

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <MarketplaceSubNav active="/marketplace/avto-poster" />

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-gradient-to-br from-violet-500 to-pink-500 shadow-lg shadow-violet-500/30">
            <Send className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
              Avto-Poster
              <span className="rounded-full border border-purple-500/40 bg-purple-500/10 px-1.5 py-0.5 text-[9px] font-semibold text-purple-500">
                <Sparkles className="mr-0.5 inline h-2.5 w-2.5" /> AI
              </span>
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Bir mətndən Instagram, Facebook, TikTok, Telegram, WhatsApp-a eyni anda post. AI mətn yazır, planlaşdırma avto.
            </p>
          </div>
        </div>
      </header>

      {/* KPI */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard icon={FileEdit} label="Qaralama" value={String(stats.qaralama)} subline="Hazırlanır" tone={stats.qaralama > 0 ? "warning" : "neutral"} />
        <KpiCard icon={Clock} label="Planlaşdırılmış" value={String(stats.planlasdirilmis)} subline="Vaxt gözləyir" tone={stats.planlasdirilmis > 0 ? "info" : "neutral"} />
        <KpiCard icon={CheckCircle2} label="Son 30 gün" value={String(stats.gonderildi_30g)} subline="Göndərilib" tone="success" />
        <KpiCard icon={XCircle} label="Xəta" value={String(stats.xeta)} subline="Yenidən cəhd et" tone={stats.xeta > 0 ? "danger" : "neutral"} />
      </section>

      {/* Hesab linki — əgər heç bir aktiv hesab yoxdursa */}
      {accounts.filter((a) => a.aktiv).length === 0 && (
        <Link
          href="/marketplace/sosial"
          className="group flex items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 transition hover:border-amber-500/50"
        >
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-amber-500/15 text-amber-600">
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-amber-800 dark:text-amber-300">Aktiv sosial hesab yoxdur</div>
            <div className="text-xs text-muted-foreground">
              Post göndərmək üçün ən azı 1 sosial hesab qoşmaq lazımdır.
            </div>
          </div>
          <ArrowRight className="h-4 w-4 text-amber-600 transition group-hover:translate-x-1" />
        </Link>
      )}

      {/* 2-sütun: Composer (sol) + Postlar siyahısı (sağ) */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1.1fr]">
        <PostComposer accounts={accounts} products={products} prefillHesabId={sp.hesab} />

        <div className="space-y-3">
          {/* Filter pill-ləri */}
          <div className="flex flex-wrap gap-1 rounded-xl border border-border bg-card/40 p-1">
            {FILTERS.map((f) => {
              const isOn = filterStatus === f.status;
              const count = counts[f.key] ?? 0;
              const href = f.status ? `?status=${f.status}` : "?";
              return (
                <Link
                  key={f.key}
                  href={href}
                  className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-semibold transition ${
                    isOn ? "bg-background text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {f.label}
                  <span className="rounded-full bg-secondary/60 px-1 text-[9px] tabular-nums">{count}</span>
                </Link>
              );
            })}
          </div>
          <PostsList posts={posts} accounts={accounts} />
        </div>
      </div>

      {/* Footer hint */}
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs">
        <strong className="text-primary">💡 Necə işləyir?</strong>{" "}
        <span className="text-muted-foreground">
          1) AI mətn yarat (məhsul seç və ya azad mövzu). 2) Hansı platformalara getməlidir seç. 3) İndi dərc et VƏYA planlaşdır.
          Planlaşdırılmış postlar səhifə açıldıqda avto-yoxlanır — vaxt çatdıqda göndərilir.
        </span>
      </div>
    </div>
  );
}
