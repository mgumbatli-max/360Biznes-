import React, { useState, useEffect } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { ShoppingCart, Search, Receipt } from "lucide-react-native";
import { useSales } from "../../src/features/satis/hooks";
import type { Sale, SaleStats } from "../../src/features/satis/types";
import {
  Card,
  EmptyState,
  ErrorState,
  Input,
  ListSkeleton,
  OfflineBanner,
  Screen,
} from "../../src/components";
import { formatMoney } from "../../src/lib/format";
import { C } from "../../src/theme";

const STATUS_LABEL: Record<string, string> = {
  tamamlandi: "Tamamlandı", qaralama: "Qaralama", legv: "Ləğv",
  qaytarildi: "Qaytarıldı", kreditde: "Kreditdə",
};

function StatsHeader({ s }: { s: SaleStats }) {
  const cell = (label: string, count: number, mebleg: number, tone?: "pos" | "neg") => (
    <View className="flex-1 items-center">
      <Text className={`font-bold text-base ${tone === "neg" ? "text-neg" : "text-ink dark:text-inkDark"}`}>
        {formatMoney(mebleg)}
      </Text>
      <Text className="text-sub dark:text-subDark text-[10px] mt-0.5">{label} · {count}</Text>
    </View>
  );
  return (
    <Card className="flex-row mb-3">
      {cell("Bugün", s.bugun.count, s.bugun.mebleg, "pos")}
      <View style={{ width: 1 }} className="bg-line dark:bg-lineDark" />
      {cell("Həftə", s.bu_hefte.count, s.bu_hefte.mebleg)}
      <View style={{ width: 1 }} className="bg-line dark:bg-lineDark" />
      {cell("Ay", s.bu_ay.count, s.bu_ay.mebleg)}
    </Card>
  );
}

function SaleRow({ item }: { item: Sale }) {
  const router = useRouter();
  const unpaid = item.son_mebleg - item.odenilmis;
  const sub = [item.musteri_ad ?? "Pərakəndə", String(item.tarix).slice(0, 10)]
    .filter(Boolean)
    .join(" · ");
  return (
    <Card className="flex-row gap-3 items-center mb-2" onPress={() => router.push(`/satis/${item.id}`)}>
      <View style={{ width: 40, height: 40, borderRadius: 10 }} className="bg-brand/10 items-center justify-center">
        <Receipt size={20} color={C.brand} strokeWidth={1.8} />
      </View>
      <View className="flex-1">
        <Text className="text-ink dark:text-inkDark font-semibold text-sm" numberOfLines={1}>
          № {item.nomre} {item.qaralama ? "· qaralama" : ""}
        </Text>
        <Text className="text-sub dark:text-subDark text-xs mt-0.5" numberOfLines={1}>{sub}</Text>
      </View>
      <View className="items-end">
        <Text className="text-ink dark:text-inkDark font-bold text-sm">{formatMoney(item.son_mebleg)}</Text>
        {unpaid > 0.005 ? (
          <Text className="text-neg text-[10px] mt-0.5">borc {formatMoney(unpaid)}</Text>
        ) : (
          <Text className="text-sub dark:text-subDark text-[10px] mt-0.5">{STATUS_LABEL[item.status] ?? item.status}</Text>
        )}
      </View>
    </Card>
  );
}

export default function SatisScreen() {
  const [query, setQuery] = useState("");
  const [q, setQ] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setQ(query), 300);
    return () => clearTimeout(t);
  }, [query]);

  const {
    data, isLoading, isError, refetch, isRefetching,
    fetchNextPage, hasNextPage, isFetchingNextPage,
  } = useSales(q);

  const items = data?.pages.flatMap((p) => p.items) ?? [];
  const stats = data?.pages[0]?.stats ?? null;

  if (isLoading) {
    return (
      <Screen title="Satış">
        <View className="px-4 pt-3"><Input placeholder="№, müştəri axtar" value={query} onChangeText={setQuery} rightSlot={<Search size={18} color={C.sub} />} /></View>
        <View className="px-4 pt-4"><ListSkeleton count={6} /></View>
      </Screen>
    );
  }
  if (isError) {
    return <Screen title="Satış"><ErrorState onRetry={refetch} /></Screen>;
  }

  return (
    <Screen title="Satış">
      <OfflineBanner />
      <View className="px-4 pt-3 pb-1">
        <Input placeholder="№, müştəri axtar" value={query} onChangeText={setQuery} rightSlot={<Search size={18} color={C.sub} />} />
      </View>
      {items.length === 0 ? (
        <EmptyState
          icon={<ShoppingCart size={48} color={C.sub} strokeWidth={1.5} />}
          title="Satış tapılmadı"
          subtitle={q ? "Axtarışa uyğun nəticə yoxdur" : "Hələ satış qeydə alınmayıb"}
        />
      ) : (
        <FlatList<Sale>
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <SaleRow item={item} />}
          ListHeaderComponent={stats ? <StatsHeader s={stats} /> : null}
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 100 }}
          onEndReached={() => { if (hasNextPage && !isFetchingNextPage) fetchNextPage(); }}
          onEndReachedThreshold={0.4}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={C.brand} colors={[C.brand]} />}
          ListFooterComponent={isFetchingNextPage ? <ActivityIndicator color={C.brand} style={{ marginVertical: 16 }} /> : null}
        />
      )}
    </Screen>
  );
}
