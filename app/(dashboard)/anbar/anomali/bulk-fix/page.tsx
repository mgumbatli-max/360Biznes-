import type { Metadata } from "next";
import Link from "next/link";
import { ImageOff, Sparkles, Zap, ExternalLink } from "lucide-react";
import { BackButton } from "@/components/ui/back-button";
import { AnbarSubNav } from "@/components/anbar-subnav";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { BulkImageGrid } from "@/features/anbar/anomali/components/bulk-image-grid";

export const metadata: Metadata = { title: "Bulk şəkil yarat" };
export const dynamic = "force-dynamic";

type SP = { page?: string };

async function getMissingImageProducts(page: number) {
  return withTenant(async () => {
    const { sahibkarId: _sahibkarId } = requireTenant();
    void _sahibkarId; // tenant filter handled by prisma extension
    const PAGE_SIZE = 30;
    const [items, total] = await Promise.all([
      prisma.mehsullar.findMany({
        where: {
          aktiv: true,
          OR: [{ sekil_url: null }, { sekil_url: "" }],
        },
        select: {
          id: true,
          ad: true,
          kod: true,
          kateqoriyalar: { select: { ad: true } },
          markalar: { select: { ad: true } },
        },
        orderBy: { ad: "asc" },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
      }),
      prisma.mehsullar.count({
        where: { aktiv: true, OR: [{ sekil_url: null }, { sekil_url: "" }] },
      }),
    ]);
    return { items, total, pageSize: PAGE_SIZE };
  });
}

export default async function BulkFixPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? 1) || 1);
  const { items, total, pageSize } = await getMissingImageProducts(page);
  const pageCount = Math.ceil(total / pageSize);

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <AnbarSubNav active="/anbar/anomali" />

      <BackButton fallback="/anbar/anomali" label="Anomali siyahısı" />

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/15 text-primary">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">AI ilə bulk şəkil yarat</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              <strong className="text-foreground">{total}</strong> məhsul şəkilsizdir. Hər biri üçün AI yarat, Unsplash-dən
              gətir, və ya URL əlavə et.
            </p>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <InfoCard
          icon={Zap}
          title="Sürətli AI (pulsuz)"
          desc="Pollinations.ai — məhsul adına görə pulsuz AI şəkil generasiya edir. Sürətli, açar tələb etmir."
        />
        <InfoCard
          icon={Sparkles}
          title="Premium AI (OpenAI DALL-E)"
          desc="DALL-E 3 ilə yüksək keyfiyyətli unikal şəkil. Tələb edir: OPENAI_API_KEY (env)."
        />
        <InfoCard
          icon={ExternalLink}
          title="Manual URL"
          desc="İstədiyiniz şəklin URL-ini yapışdırın — istehsalçı saytından və ya öz CDN-dən."
        />
      </div>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-emerald-500/40 bg-emerald-500/5 p-12 text-center">
          <ImageOff className="mx-auto mb-2 h-8 w-8 text-emerald-500/60" />
          <h3 className="font-semibold text-emerald-700 dark:text-emerald-400">Hamısı tamamdır</h3>
          <p className="mt-1 text-sm text-muted-foreground">Bütün məhsulların şəkli var.</p>
        </div>
      ) : (
        <BulkImageGrid items={items} />
      )}

      {/* Pagination */}
      {pageCount > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <Link
            href={`/anbar/anomali/bulk-fix?page=${Math.max(1, page - 1)}`}
            className={`rounded-md border border-border bg-card px-3 py-1.5 text-xs font-semibold ${page === 1 ? "pointer-events-none opacity-40" : "hover:bg-secondary"}`}
          >
            ← Əvvəlki
          </Link>
          <span className="text-xs text-muted-foreground">
            Səhifə {page} / {pageCount}
          </span>
          <Link
            href={`/anbar/anomali/bulk-fix?page=${Math.min(pageCount, page + 1)}`}
            className={`rounded-md border border-border bg-card px-3 py-1.5 text-xs font-semibold ${page === pageCount ? "pointer-events-none opacity-40" : "hover:bg-secondary"}`}
          >
            Növbəti →
          </Link>
        </div>
      )}
    </div>
  );
}

function InfoCard({
  icon: Icon,
  title,
  desc,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  desc: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      <p className="mt-1 text-[11.5px] leading-snug text-muted-foreground">{desc}</p>
    </div>
  );
}
