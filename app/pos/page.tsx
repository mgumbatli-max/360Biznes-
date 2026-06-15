import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ShoppingCart, AlertCircle } from "lucide-react";
import { auth } from "@/auth";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  getActiveKassa,
  getFilialOptions,
} from "@/features/pos/session-queries";
import {
  getDefaultAnbar,
  getSalespersonOptions,
} from "@/features/pos/sale-queries";
import { getQuickProducts } from "@/features/pos/quick-products-queries";
import { OpenSessionCard } from "@/features/pos/components/open-session-card";
// SÜRƏT: PosClient client-only dinamik wrapper-dən import olunur (ssr:false +
// skeleton). `ssr:false` Server Component-də qadağandır (Next.js 16) — ona görə
// wrapper "use client"-dir. Props/JSX 1:1 eynidir, auth/rol gate-ləri dəyişməz.
import { PosClient } from "@/features/pos/components/pos-client-dynamic";
import { getRoleAllowedTiers } from "@/features/ayarlar/qiymet-icaze";
import { getPosPriceSettings } from "@/features/ayarlar/pos-qiymet";
import { getRequestPermissions } from "@/lib/auth/get-permissions";

export const metadata: Metadata = { title: "POS — İsti satış" };

export default async function PosPage() {
  const session = await auth();
  if (!session?.user) return null;

  // Master icazə yoxlaması — `pos.access` yoxdursa POS girişi rədd olunur.
  // Sahibkar / admin avtomatik dəstəklənir (sahibkar bütün icazələrə malikdir).
  const requestPerms = await getRequestPermissions();
  const rolAdLower = (session.user.rol_ad ?? "").toLowerCase();
  const isOwnerOrAdmin =
    rolAdLower.includes("sahibkar") ||
    rolAdLower.includes("owner") ||
    rolAdLower.includes("admin");
  if (!isOwnerOrAdmin && !requestPerms.includes("pos.access")) {
    redirect("/tapshiriqlar");
  }

  // Əvvəlcə kassa sessiyasını oxu, sonra onun filialına bağlı anbarı tap.
  // POS-da stok düzgün görünməsi üçün kassa-anbar uyğunluğu vacibdir.
  const [active, filiallar, saticilar] = await Promise.all([
    getActiveKassa(),
    getFilialOptions(),
    getSalespersonOptions(),
  ]);
  const { getPosAnbarOptions } = await import("@/features/pos/sale-queries");
  const [anbar, anbarOptions] = await Promise.all([
    getDefaultAnbar(active?.filial_id ?? null),
    getPosAnbarOptions(active?.filial_id ?? null),
  ]);

  if (!active) {
    // POS sessiya açmaq üçün hesablar — pul hansı maliye hesabına düşəcəyini seçmək üçün
    const { getAccounts } = await import("@/features/maliyye/account-queries");
    const accounts = await getAccounts();
    const posHesablar = accounts
      .filter((a) => a.aktiv && ["negd", "kart", "bank", "pos"].includes(a.nov))
      .map((a) => ({ id: a.id, ad: a.ad, nov: a.nov }));
    return (
      <div className="mx-auto max-w-2xl space-y-6 px-4 py-8">
        <header className="text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-rose-100 text-rose-700">
            <ShoppingCart className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">
            POS / İsti satış
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Satışa başlamaq üçün kassa sessiyasını açın.
          </p>
        </header>
        <OpenSessionCard filiallar={filiallar} hesablar={posHesablar} />
      </div>
    );
  }

  if (!anbar) {
    return (
      <div className="mx-auto max-w-xl px-4 py-8">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Aktiv anbar tapılmadı. Əvvəlcə Ayarlar → Anbar bölməsindən anbar
            yaradın.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const [initialQuickProducts, allowedTiers, posSettings] =
    await Promise.all([
      getQuickProducts(anbar.id, 10),
      getRoleAllowedTiers(session.user.rol_id ?? 0),
      getPosPriceSettings(),
    ]);
  const icazeler = requestPerms;

  const isOwner =
    rolAdLower.includes("sahibkar") ||
    rolAdLower.includes("owner") ||
    icazeler.includes("pos.view_cost") ||
    icazeler.includes("pos.view_margin");
  const isAdmin =
    isOwner ||
    rolAdLower.includes("admin") ||
    rolAdLower.includes("müdir") ||
    rolAdLower.includes("mudir") ||
    icazeler.includes("pos.view_min_price");

  return (
    <PosClient
      kassaId={active.id}
      anbarId={anbar.id}
      anbarAd={anbar.ad}
      anbarOptions={anbarOptions}
      saticilar={saticilar}
      defaultSalespersonId={session.user.id}
      initialQuickProducts={initialQuickProducts}
      allowedTiers={allowedTiers}
      posSettings={posSettings}
      isOwner={isOwner}
      isAdmin={isAdmin}
      kassaInfo={{
        ad: active.ad,
        acan_ad: active.acan_ad,
        filial_ad: active.filial_ad,
        acilis_tarixi: active.acilis_tarixi.toISOString(),
        acilis_qaligi: active.acilis_qaligi,
        emeliyyatlar_say: active.emeliyyatlar_say,
        cari_negd: active.cari_negd,
        cari_kart: active.cari_kart,
        cari_bank: active.cari_bank,
        cari_borc: active.cari_borc,
        cemi_satis: active.cemi_satis,
      }}
    />
  );
}
