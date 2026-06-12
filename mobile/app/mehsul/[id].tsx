import React from "react";
import { Text, View } from "react-native";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  Package,
  Pencil,
  ShoppingCart,
  History,
  Wrench,
  BarChart3,
  Info,
  Warehouse,
  Tag,
} from "lucide-react-native";

import {
  Screen,
  Card,
  Button,
  Accordion,
  ErrorState,
  Skeleton,
} from "../../src/components";
import { useProduct } from "../../src/features/mehsul/hooks";
import { formatMoney, formatNumber } from "../../src/lib/format";
import { C } from "../../src/theme";

// ─── Tarix köməkçisi ─────────────────────────────────────────────────────────
const fmtDate = (s?: string | null): string => (s ? s.slice(0, 10) : "—");

// ─── Yükləmə skeleti ─────────────────────────────────────────────────────────
function DetailSkeleton() {
  return (
    <Screen title="Yüklənir..." showBack scroll>
      <Skeleton className="w-full h-52 rounded-xl mb-4" />
      <Skeleton className="h-6 w-3/4 rounded mb-2" />
      <Skeleton className="h-4 w-1/2 rounded mb-4" />
      <Skeleton className="h-8 w-1/3 rounded mb-6" />
      <Skeleton className="h-12 rounded-xl mb-3" />
      <Skeleton className="h-12 rounded-xl mb-3" />
      <Skeleton className="h-12 rounded-xl" />
    </Screen>
  );
}

// ─── Ətraflı sıra komponenti ─────────────────────────────────────────────────
type InfoRowProps = { label: string; value: string; icon?: React.ReactNode };
function InfoRow({ label, value, icon }: InfoRowProps) {
  return (
    <View className="flex-row justify-between items-center py-1.5 border-b border-line">
      <View className="flex-row items-center gap-1.5">
        {icon != null && icon}
        <Text className="text-sub text-sm">{label}</Text>
      </View>
      <Text className="text-ink text-sm font-medium flex-shrink-1 ml-4 text-right">
        {value}
      </Text>
    </View>
  );
}

// ─── Statistika mini-kart ─────────────────────────────────────────────────────
type StatCardProps = { label: string; qty: number; mebleg: number; valyuta?: string; sifaris?: number };
function StatCard({ label, qty, mebleg, valyuta, sifaris }: StatCardProps) {
  return (
    <View className="flex-1 bg-brand/5 rounded-xl p-3 items-center">
      <Text className="text-sub text-xs mb-1">{label}</Text>
      <Text className="text-ink font-bold text-base">{formatNumber(qty)} əd.</Text>
      <Text className="text-brand text-xs font-semibold mt-0.5">
        {formatMoney(mebleg, valyuta)}
      </Text>
      {sifaris != null && (
        <Text className="text-sub text-xs mt-0.5">{sifaris} sifariş</Text>
      )}
    </View>
  );
}

// ─── Əsas ekran ───────────────────────────────────────────────────────────────
export default function MehsulDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data, isLoading, isError, refetch } = useProduct(id ?? "");

  // Yükləmə
  if (isLoading) return <DetailSkeleton />;

  // Xəta / boş
  if (isError || data?.item == null) {
    return (
      <Screen title="Məhsul" showBack scroll>
        <ErrorState
          title="Məhsul tapılmadı"
          message="Məlumat yüklənmədi. Yenidən cəhd edin."
          onRetry={() => void refetch()}
        />
      </Screen>
    );
  }

  const { item, stok, hereketler, son_satislar, stats, servis } = data;
  const valyuta = (item.valyuta as string | undefined) ?? "AZN";

  // ─── Stok hesabı ──────────────────────────────────────────────────────────
  const totalStok = stok.length > 0
    ? stok.reduce((s, r) => s + r.miqdar, 0)
    : (item.stok_miqdari ?? 0);

  const kritikStok = item.kritik_stok;
  const isKritik = kritikStok != null && totalStok <= kritikStok;

  // ─── Qiymətlər ────────────────────────────────────────────────────────────
  const satisQiymeti = item.satis_qiymeti ?? 0;
  const endirimliQiymet = item.endirimli_qiymet;
  const gosterileQiymet = endirimliQiymet ?? satisQiymeti;
  const hasDiscount = endirimliQiymet != null && endirimliQiymet < satisQiymeti;

  // ─── Ətraflı bölmə üçün məlumat ──────────────────────────────────────────
  const minSatis = item.min_satis_qiymeti ?? 0;
  const topdan = item.topdan_qiymeti ?? 0;
  const partnyor = item.partnyor_qiymeti ?? 0;
  const vip = item.vip_qiymeti ?? 0;

  const barkod = item.barkod as string | null | undefined;
  const model = item.model as string | null | undefined;
  const rang = item.rang as string | null | undefined;
  const istehsalci = item.istehsalci as string | null | undefined;
  const olculer = item.olculer as string | null | undefined;
  const cheki_kg = item.cheki_kg as number | null | undefined;
  const qutu_say = item.qutu_say as number | null | undefined;
  const zemanet_ay = item.zemanet_ay as number | null | undefined;
  const serial_lazim = item.serial_lazim as boolean | undefined;
  const imei_lazim = item.imei_lazim as boolean | undefined;
  const edv_status = item.edv_status as string | null | undefined;
  const qisaca_tesvir = item.qisaca_tesvir as string | null | undefined;
  const aciqlamaq = item.aciqlamaq as string | null | undefined;

  const hasEtraflı =
    barkod != null ||
    model != null ||
    rang != null ||
    istehsalci != null ||
    olculer != null ||
    cheki_kg != null ||
    qutu_say != null ||
    zemanet_ay != null ||
    serial_lazim != null ||
    imei_lazim != null ||
    edv_status != null ||
    qisaca_tesvir != null ||
    aciqlamaq != null ||
    minSatis > 0 ||
    topdan > 0 ||
    partnyor > 0 ||
    vip > 0;

  // ─── Başlıq (truncate) ────────────────────────────────────────────────────
  const screenTitle =
    item.ad.length > 30 ? item.ad.slice(0, 28) + "…" : item.ad;

  return (
    <Screen title={screenTitle} showBack scroll>
      {/* ── Məzmun bölgəsi (alt paneli üçün padding) ── */}
      <View className="pb-24">
        {/* ───── Hero kart ───────────────────────────────────────────── */}
        <Card className="mb-4 p-0 overflow-hidden">
          {/* Şəkil */}
          {item.sekil_url != null ? (
            <Image
              source={{ uri: item.sekil_url }}
              style={{ width: "100%", height: 200 }}
              contentFit="cover"
            />
          ) : (
            <View
              className="w-full items-center justify-center"
              style={{ height: 200, backgroundColor: C.brandLight }}
            >
              <Package size={64} color={C.brand} strokeWidth={1.5} />
            </View>
          )}

          {/* Ad + meta ────────────────────────────────────────────── */}
          <View className="p-4">
            <Text className="text-ink text-xl font-bold mb-2">{item.ad}</Text>

            {/* Çiplər: kateqoriya, marka, kod */}
            <View className="flex-row flex-wrap gap-1.5 mb-3">
              {item.kateqoriyalar?.ad != null && (
                <View className="bg-line rounded-full px-2 py-0.5">
                  <Text className="text-sub text-xs">{item.kateqoriyalar.ad}</Text>
                </View>
              )}
              {item.markalar?.ad != null && (
                <View className="bg-line rounded-full px-2 py-0.5">
                  <Text className="text-sub text-xs">{item.markalar.ad}</Text>
                </View>
              )}
              {item.kod != null && (
                <View className="bg-line rounded-full px-2 py-0.5">
                  <Text className="text-sub text-xs">{item.kod}</Text>
                </View>
              )}
            </View>

            {/* Qiymət ─────────────────────────────────────────────── */}
            <View className="flex-row items-baseline gap-2 mb-3">
              <Text className="text-brand text-2xl font-extrabold">
                {formatMoney(gosterileQiymet, valyuta)}
              </Text>
              {hasDiscount && (
                <Text className="text-sub text-sm line-through">
                  {formatMoney(satisQiymeti, valyuta)}
                </Text>
              )}
            </View>

            {/* Stok çipi ──────────────────────────────────────────── */}
            <View
              className={`self-start rounded-full px-3 py-1 ${
                isKritik ? "bg-red-100" : "bg-teal-50"
              }`}
            >
              <Text
                className={`text-xs font-semibold ${
                  isKritik ? "text-red-600" : "text-teal-700"
                }`}
              >
                {isKritik ? "⚠ " : ""}
                Stok: {formatNumber(totalStok)}{" "}
                {item.olcu_vahidleri?.qisa ??
                  item.olcu_vahidleri?.ad ??
                  "əd."}
              </Text>
            </View>
          </View>
        </Card>

        {/* ───── Akkordeonlar ────────────────────────────────────────── */}
        <Card className="mb-4">
          {/* 1. Stok (anbar üzrə) */}
          {stok.length > 0 && (
            <Accordion
              title="Stok (anbar üzrə)"
              icon={<Warehouse size={16} color={C.brand} strokeWidth={2} />}
              defaultOpen={false}
            >
              {stok.map((row, i) => (
                <View
                  key={`${row.anbar_id}-${i}`}
                  className="flex-row justify-between items-center py-1.5 border-b border-line"
                >
                  <Text className="text-ink text-sm flex-1">{row.anbar_ad}</Text>
                  <View className="items-end">
                    <Text className="text-ink text-sm font-semibold">
                      {formatNumber(row.miqdar)}
                    </Text>
                    {row.son_qiymet != null && (
                      <Text className="text-sub text-xs">
                        {formatMoney(row.son_qiymet, valyuta)}
                      </Text>
                    )}
                  </View>
                </View>
              ))}
            </Accordion>
          )}

          {/* 2. Son satışlar */}
          {son_satislar.length > 0 && (
            <Accordion
              title="Son satışlar"
              icon={<ShoppingCart size={16} color={C.brand} strokeWidth={2} />}
              defaultOpen={false}
            >
              {son_satislar.map((row) => (
                <View
                  key={row.sale_id}
                  className="flex-row justify-between items-start py-1.5 border-b border-line"
                >
                  <View className="flex-1 mr-2">
                    <Text className="text-ink text-sm font-medium">{row.nomre}</Text>
                    <Text className="text-sub text-xs">
                      {fmtDate(row.tarix)} · {row.musteri_ad ?? "—"}
                    </Text>
                  </View>
                  <View className="items-end">
                    <Text className="text-ink text-sm">
                      {formatNumber(row.miqdar)} × {formatMoney(row.vahid_qiymet, valyuta)}
                    </Text>
                    <Text className="text-brand text-xs font-semibold">
                      = {formatMoney(row.cemi, valyuta)}
                    </Text>
                  </View>
                </View>
              ))}
            </Accordion>
          )}

          {/* 3. Son hərəkətlər */}
          {hereketler.length > 0 && (
            <Accordion
              title="Son hərəkətlər"
              icon={<History size={16} color={C.brand} strokeWidth={2} />}
              defaultOpen={false}
            >
              {hereketler.map((row) => (
                <View
                  key={row.id}
                  className="flex-row justify-between items-start py-1.5 border-b border-line"
                >
                  <View className="flex-1 mr-2">
                    <Text className="text-ink text-sm font-medium">
                      {row.nov} · {row.anbar_ad}
                    </Text>
                    <Text className="text-sub text-xs">
                      {fmtDate(row.tarix)}
                      {row.edilen_ad != null ? ` · ${row.edilen_ad}` : ""}
                    </Text>
                  </View>
                  <Text
                    className={`text-sm font-bold ${
                      row.miqdar >= 0 ? "text-teal-600" : "text-red-500"
                    }`}
                  >
                    {row.miqdar >= 0 ? "+" : ""}
                    {formatNumber(row.miqdar)}
                  </Text>
                </View>
              ))}
            </Accordion>
          )}

          {/* 4. Servis tarixçəsi */}
          {servis.rows.length > 0 && (
            <Accordion
              title={`Servis tarixçəsi (${servis.stats.total})`}
              icon={<Wrench size={16} color={C.brand} strokeWidth={2} />}
              defaultOpen={false}
            >
              {/* Mini statistika */}
              <View className="flex-row gap-2 mb-2 pb-2 border-b border-line">
                <Text className="text-sub text-xs">
                  Cəmi{" "}
                  <Text className="text-ink font-semibold">{servis.stats.total}</Text>
                  {"  "}·{"  "}Aktiv{" "}
                  <Text className="text-ink font-semibold">{servis.stats.active}</Text>
                  {"  "}·{"  "}Bu il{" "}
                  <Text className="text-ink font-semibold">{servis.stats.thisYear}</Text>
                </Text>
              </View>
              {servis.rows.map((row) => (
                <View
                  key={row.id}
                  className="py-2 border-b border-line"
                >
                  <View className="flex-row justify-between items-center mb-0.5">
                    <Text className="text-ink text-sm font-semibold">{row.nomre}</Text>
                    <View
                      className="rounded-full px-2 py-0.5 bg-teal-50"
                    >
                      <Text className="text-teal-700 text-xs">{row.status}</Text>
                    </View>
                  </View>
                  <Text className="text-sub text-xs mb-0.5">
                    {fmtDate(row.yaradildi)} · {row.musteri_ad}
                  </Text>
                  <Text
                    className="text-sub text-xs"
                    numberOfLines={2}
                  >
                    {row.problem_tesviri}
                  </Text>
                </View>
              ))}
            </Accordion>
          )}

          {/* 5. Statistika */}
          {stats.toplam.qty > 0 && (
            <Accordion
              title="Statistika"
              icon={<BarChart3 size={16} color={C.brand} strokeWidth={2} />}
              defaultOpen={false}
            >
              <View className="flex-row gap-2 py-2">
                <StatCard
                  label="Bu ay"
                  qty={stats.bu_ay.qty}
                  mebleg={stats.bu_ay.mebleg}
                  valyuta={valyuta}
                />
                <StatCard
                  label="Son 30 gün"
                  qty={stats.son_30.qty}
                  mebleg={stats.son_30.mebleg}
                  valyuta={valyuta}
                />
                <StatCard
                  label="Toplam"
                  qty={stats.toplam.qty}
                  mebleg={stats.toplam.mebleg}
                  valyuta={valyuta}
                  sifaris={stats.toplam.sifaris_say}
                />
              </View>
            </Accordion>
          )}

          {/* 6. Ətraflı */}
          {hasEtraflı && (
            <Accordion
              title="Ətraflı"
              icon={<Info size={16} color={C.brand} strokeWidth={2} />}
              defaultOpen={false}
            >
              {/* Əsas məlumatlar */}
              {barkod != null && (
                <InfoRow
                  label="Barkod"
                  value={barkod}
                  icon={<Tag size={13} color={C.sub} strokeWidth={2} />}
                />
              )}
              {model != null && <InfoRow label="Model" value={model} />}
              {rang != null && <InfoRow label="Rəng" value={rang} />}
              {istehsalci != null && <InfoRow label="İstehsalçı" value={istehsalci} />}
              {olculer != null && <InfoRow label="Ölçülər" value={olculer} />}
              {cheki_kg != null && (
                <InfoRow label="Çəki" value={`${formatNumber(cheki_kg)} kq`} />
              )}
              {qutu_say != null && (
                <InfoRow label="Qutu sayı" value={formatNumber(qutu_say)} />
              )}
              {zemanet_ay != null && (
                <InfoRow label="Zəmanət" value={`${zemanet_ay} ay`} />
              )}
              {serial_lazim != null && (
                <InfoRow
                  label="Serial nömrə"
                  value={serial_lazim ? "Bəli" : "Xeyr"}
                />
              )}
              {imei_lazim != null && (
                <InfoRow
                  label="IMEI"
                  value={imei_lazim ? "Bəli" : "Xeyr"}
                />
              )}
              {edv_status != null && <InfoRow label="ƏDV statusu" value={edv_status} />}
              {qisaca_tesvir != null && (
                <InfoRow label="Qısa təsvir" value={qisaca_tesvir} />
              )}
              {aciqlamaq != null && (
                <InfoRow label="Açıqlama" value={aciqlamaq} />
              )}

              {/* Qiymət skaları */}
              {(minSatis > 0 || topdan > 0 || partnyor > 0 || vip > 0) && (
                <View className="mt-2">
                  <Text className="text-sub text-xs font-semibold uppercase mb-1">
                    Qiymət cədvəli
                  </Text>
                  {minSatis > 0 && (
                    <InfoRow
                      label="Min satış"
                      value={formatMoney(minSatis, valyuta)}
                    />
                  )}
                  {topdan > 0 && (
                    <InfoRow
                      label="Topdan"
                      value={formatMoney(topdan, valyuta)}
                    />
                  )}
                  {partnyor > 0 && (
                    <InfoRow
                      label="Partnyor"
                      value={formatMoney(partnyor, valyuta)}
                    />
                  )}
                  {vip > 0 && (
                    <InfoRow
                      label="VIP"
                      value={formatMoney(vip, valyuta)}
                    />
                  )}
                </View>
              )}
            </Accordion>
          )}
        </Card>
      </View>

      {/* ───── Altdaki sərt panel ────────────────────────────────────── */}
      {/* Not: Screen scroll mode-da contentContainerStyle={padding:16} var,
          buna görə "absolute" istifadə etmək olmaz. Alt panel scroll sonunda göstərilir
          — pb-24 yuxarıda verildi ki görünsün. */}
      <View
        style={{ position: "absolute", bottom: 0, left: 0, right: 0 }}
        className="bg-white border-t border-line px-4 py-3 flex-row gap-3"
      >
        <View className="flex-1">
          <Button
            title="Redaktə"
            variant="primary"
            icon={<Pencil size={16} color="#fff" strokeWidth={2} />}
            onPress={() => router.push(`/mehsul/form?id=${id}`)}
          />
        </View>
        <View className="flex-1">
          <Button
            title="Sat"
            variant="outline"
            disabled
            icon={<ShoppingCart size={16} color={C.brand} strokeWidth={2} />}
          />
        </View>
      </View>
    </Screen>
  );
}
