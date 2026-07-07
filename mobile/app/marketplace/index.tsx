import React from "react";
import { FlatList, RefreshControl, Text, View } from "react-native";
import { Store, AlertTriangle, CheckCircle2 } from "lucide-react-native";
import { useMarketplace } from "../../src/features/marketplace/hooks";
import type { MarketplaceAccount } from "../../src/features/marketplace/types";
import { Card, EmptyState, ErrorState, ListSkeleton, OfflineBanner, Screen } from "../../src/components";
import { formatMoney } from "../../src/lib/format";
import { C } from "../../src/theme";

function fmtDate(s?: string | null): string {
  if (!s) return "heç vaxt";
  const d = new Date(s);
  if (isNaN(d.getTime())) return "—";
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function AccountRow({ item }: { item: MarketplaceAccount }) {
  const hasError = !!item.son_xeta;
  return (
    <Card className="mb-2">
      <View className="flex-row items-center justify-between">
        <View className="flex-1">
          <Text className="text-ink dark:text-inkDark font-bold text-sm" numberOfLines={1}>{item.ad}</Text>
          <Text className="text-sub dark:text-subDark text-xs mt-0.5">{item.platform}{item.store_id ? ` · ${item.store_id}` : ""}</Text>
        </View>
        {item.aktiv ? (
          <View className="flex-row items-center gap-1"><CheckCircle2 size={14} color="#059669" /><Text style={{ color: "#059669", fontSize: 11, fontWeight: "600" }}>Aktiv</Text></View>
        ) : (
          <Text style={{ color: C.sub, fontSize: 11 }}>Passiv</Text>
        )}
      </View>
      <View className="flex-row items-center justify-between mt-1.5">
        <Text className="text-sub dark:text-subDark text-[11px]">Son sync: {fmtDate(item.son_sync)}</Text>
        <Text className="text-sub dark:text-subDark text-[11px]">Komissiya {item.komisyon_faiz}%</Text>
      </View>
      {hasError ? (
        <View className="flex-row items-center gap-1.5 mt-1.5">
          <AlertTriangle size={13} color="#dc2626" />
          <Text style={{ color: "#dc2626", fontSize: 11, flex: 1 }} numberOfLines={2}>{item.son_xeta}</Text>
        </View>
      ) : null}
    </Card>
  );
}

export default function MarketplaceScreen() {
  const { data, isLoading, isError, refetch, isRefetching } = useMarketplace();
  const accounts = data?.accounts ?? [];
  const stats = data?.stats;

  if (isLoading) {
    return <Screen title="Marketplace" showBack><View className="px-4 pt-4"><ListSkeleton count={5} /></View></Screen>;
  }
  if (isError) {
    return <Screen title="Marketplace" showBack><ErrorState onRetry={refetch} /></Screen>;
  }

  return (
    <Screen title="Marketplace" showBack>
      <OfflineBanner />
      {stats ? (
        <View className="px-4 pt-3">
          <Card>
            <View className="flex-row justify-between">
              <View className="items-center flex-1"><Text className="text-ink dark:text-inkDark font-bold text-base">{stats.aktiv}/{stats.total}</Text><Text className="text-sub dark:text-subDark text-[11px]">Aktiv hesab</Text></View>
              <View className="items-center flex-1"><Text className="text-ink dark:text-inkDark font-bold text-base">{stats.bu_ay_sifaris}</Text><Text className="text-sub dark:text-subDark text-[11px]">Bu ay sifariş</Text></View>
              <View className="items-center flex-1"><Text className="text-ink dark:text-inkDark font-bold text-base">{formatMoney(stats.bu_ay_meblegh)}</Text><Text className="text-sub dark:text-subDark text-[11px]">Bu ay məbləğ</Text></View>
            </View>
          </Card>
        </View>
      ) : null}

      {accounts.length === 0 ? (
        <EmptyState icon={<Store size={48} color={C.sub} strokeWidth={1.5} />} title="Marketplace hesabı yoxdur" subtitle="Web-də hesab əlavə edin" />
      ) : (
        <FlatList<MarketplaceAccount>
          data={accounts}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <AccountRow item={item} />}
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={C.brand} colors={[C.brand]} />}
        />
      )}
    </Screen>
  );
}
