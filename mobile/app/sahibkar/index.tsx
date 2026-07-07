import React from "react";
import { RefreshControl, ScrollView, Text, View } from "react-native";
import { Crown, TrendingUp } from "lucide-react-native";
import { useSahibkar } from "../../src/features/sahibkar/hooks";
import { Card, ErrorState, Screen, Skeleton } from "../../src/components";
import { formatMoney } from "../../src/lib/format";
import { C } from "../../src/theme";

function Line({ label, value, pct, strong, neg }: { label: string; value: number; pct?: number; strong?: boolean; neg?: boolean }) {
  return (
    <View className="flex-row items-center justify-between py-2" style={{ borderTopWidth: strong ? 1 : 0, borderTopColor: C.line }}>
      <Text className={strong ? "text-ink dark:text-inkDark font-bold text-sm" : "text-sub dark:text-subDark text-sm"}>{label}</Text>
      <View className="items-end">
        <Text style={{ color: neg && value < 0 ? "#dc2626" : strong ? C.brand : C.ink, fontWeight: strong ? "800" : "600", fontSize: strong ? 16 : 14 }}>
          {formatMoney(value)}
        </Text>
        {pct !== undefined ? <Text className="text-sub dark:text-subDark text-[10px]">{pct.toFixed(1)}%</Text> : null}
      </View>
    </View>
  );
}

export default function SahibkarScreen() {
  const { data, isLoading, isError, refetch, isRefetching } = useSahibkar();

  if (isLoading) {
    return <Screen title="Sahibkar" showBack><View className="px-4 pt-4 gap-3"><Skeleton className="h-24 rounded-2xl" /><Skeleton className="h-56 rounded-2xl" /></View></Screen>;
  }
  if (isError || !data?.cost) {
    return <Screen title="Sahibkar" showBack><ErrorState onRetry={refetch} /></Screen>;
  }

  const c = data.cost;
  return (
    <Screen title="Sahibkar" showBack>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 12 }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={C.brand} colors={[C.brand]} />}
      >
        <Card>
          <View className="flex-row items-center gap-2">
            <Crown size={18} color="#d97706" />
            <Text className="text-ink dark:text-inkDark font-bold text-base">Bu ay maya/mənfəət</Text>
          </View>
          <View className="flex-row items-center gap-2 mt-3">
            <TrendingUp size={16} color={C.brand} />
            <Text className="text-sub dark:text-subDark text-sm">Xalis mənfəət</Text>
          </View>
          <Text style={{ color: c.net_profit >= 0 ? C.brand : "#dc2626", fontWeight: "800", fontSize: 26, marginTop: 2 }}>
            {formatMoney(c.net_profit)}
          </Text>
        </Card>

        <Card>
          <Line label="Gəlir (dövriyyə)" value={c.revenue} />
          <Line label="Endirim verilib" value={c.discount_given} />
          <Line label="Maya (COGS)" value={c.cogs} pct={c.cogs_pct} />
          <Line label="Ümumi mənfəət" value={c.gross_profit} strong />
          <Line label="Əməliyyat xərci" value={c.opex} pct={c.opex_pct} />
          <Line label="Əmək haqqı (aylıq)" value={c.payroll_monthly} pct={c.payroll_pct} />
          <Line label="Xalis mənfəət" value={c.net_profit} strong neg />
        </Card>
      </ScrollView>
    </Screen>
  );
}
