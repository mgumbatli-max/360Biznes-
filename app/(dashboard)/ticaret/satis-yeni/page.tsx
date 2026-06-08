import type { Metadata } from "next";
import { ShoppingBag } from "lucide-react";
import { auth } from "@/auth";
import { TicaretSubNav } from "@/components/ticaret-subnav";
import { SatisYeniClient } from "@/features/ticaret/components/satis-yeni-client";
import { getSalespersonOptions } from "@/features/pos/sale-queries";
import {
  getAnbarOptions,
  getSablonlar,
  getQaralamalar,
} from "@/features/ticaret/satis-yeni-queries";
import { getAccounts } from "@/features/maliyye/account-queries";

export const metadata: Metadata = { title: "Yeni satış (Sifariş)" };

type SearchParams = { mehsul?: string };

export default async function SatisYeniPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { requireTicaretPerm } = await import("@/features/ticaret/access-guard");
  await requireTicaretPerm("satis.yarat");

  const session = await auth();
  if (!session?.user) return null;

  const sp = await searchParams;

  const [anbarlar, saticilar, sablonlar, qaralamalar, accounts] = await Promise.all([
    getAnbarOptions(),
    getSalespersonOptions(),
    getSablonlar(),
    getQaralamalar(20),
    getAccounts(),
  ]);

  // Yalnız satışdan gələn pul üçün uyğun hesablar: nağd, kart, bank, pos
  const hesabOptions = accounts
    .filter((a) => a.aktiv && ["negd", "kart", "bank", "pos", "elektron"].includes(a.nov))
    .map((a) => ({ id: a.id, ad: a.ad, nov: a.nov }));

  // URL-dən ?mehsul=UUID gəlibsə, onu ProductRow obyektinə çevirib
  // client komponentinə ötür ki, dərhal satış sətri kimi yarana bilsin.
  let prefillProduct: Awaited<ReturnType<typeof getProductRowById>> = undefined;
  if (sp.mehsul) {
    prefillProduct = await getProductRowById(sp.mehsul, anbarlar[0]?.id);
  }

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <header className="flex items-start gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-md bg-secondary text-muted-foreground">
          <ShoppingBag className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Yeni satış (sifariş)</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Tam formalı satış sənədi — B2B sifarişlər, formal təkliflər, qaralamalar.
          </p>
        </div>
      </header>

      <TicaretSubNav active="/ticaret/satis-yeni" />

      <SatisYeniClient
        anbarlar={anbarlar}
        saticilar={saticilar}
        defaultSalespersonId={session.user.id}
        sablonlar={sablonlar.map((s) => ({ id: s.id, ad: s.ad, payload: s.payload }))}
        qaralamalar={qaralamalar}
        prefillMehsulId={sp.mehsul}
        prefillProduct={prefillProduct}
        hesablar={hesabOptions}
      />
    </div>
  );
}

/**
 * Məhsulu ProductRow obyekti kimi qaytarır — `SatisYeniClient`-in
 * `addLine()` funksiyasına birbaşa keçirilə bilsin deyə.
 */
async function getProductRowById(mehsulId: string, defaultAnbarId?: number) {
  const { prisma } = await import("@/lib/db/prisma");
  const { withTenant } = await import("@/lib/db/with-tenant");
  const { requireTenant } = await import("@/lib/db/tenant-context");
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const m = await prisma.mehsullar.findFirst({
      where: { id: mehsulId, sahibkar_id: sahibkarId, aktiv: true },
      select: {
        id: true,
        ad: true,
        kod: true,
        barkod: true,
        satis_qiymeti: true,
        alish_qiymeti: true,
        min_satis_qiymeti: true,
        topdan_qiymeti: true,
        partnyor_qiymeti: true,
        vip_qiymeti: true,
        stok: {
          select: { miqdar: true, anbar_id: true, anbarlar: { select: { ad: true } } },
        },
      },
    });
    if (!m) return undefined;
    const inSelected = defaultAnbarId
      ? m.stok
          .filter((s) => s.anbar_id === defaultAnbarId)
          .reduce((s, x) => s + Number(x.miqdar ?? 0), 0)
      : m.stok.reduce((s, x) => s + Number(x.miqdar ?? 0), 0);
    const others = m.stok
      .filter((s) => s.anbar_id !== defaultAnbarId && Number(s.miqdar ?? 0) > 0)
      .map((s) => ({
        anbar_id: s.anbar_id as number,
        anbar_ad: s.anbarlar?.ad ?? `Anbar #${s.anbar_id}`,
        miqdar: Number(s.miqdar ?? 0),
      }))
      .sort((a, b) => b.miqdar - a.miqdar);
    return {
      id: m.id,
      ad: m.ad,
      kod: m.kod,
      barkod: m.barkod,
      satis_qiymeti: Number(m.satis_qiymeti ?? 0),
      alish_qiymeti: Number(m.alish_qiymeti ?? 0),
      min_satis_qiymeti: Number(m.min_satis_qiymeti ?? 0),
      topdan_qiymeti: Number(m.topdan_qiymeti ?? 0),
      partnyor_qiymeti: Number(m.partnyor_qiymeti ?? 0),
      vip_qiymeti: Number(m.vip_qiymeti ?? 0),
      stok_miqdari: inSelected,
      diger_anbarlarda: others,
    };
  });
}
