import React, { useState, useEffect } from "react";
import { FlatList, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { ShieldAlert, Search } from "lucide-react-native";
import { useNezaret } from "../../src/features/nezaret/hooks";
import type { Alert as AlertItem } from "../../src/features/nezaret/types";
import { Card, EmptyState, ErrorState, Input, ListSkeleton, OfflineBanner, Screen } from "../../src/components";
import { C } from "../../src/theme";

const SEV_META: Record<string, { label: string; bg: string; fg: string }> = {
  kritik: { label: "Kritik", bg: "#fef2f2", fg: "#dc2626" },
  yuksek: { label: "Yüksək", bg: "#fff7ed", fg: "#ea580c" },
  risk: { label: "Risk", bg: "#fffbeb", fg: "#d97706" },
  info: { label: "İnfo", bg: "#eff6ff", fg: "#2563eb" },
  xeber: { label: "Xəbər", bg: "#eff6ff", fg: "#2563eb" },
};
function sevMeta(s: string) { return SEV_META[s] ?? { label: s, bg: "#f1f5f9", fg: "#475569" }; }

const FILTERS = [
  { key: "hamisi", label: "Hamısı" },
  { key: "kritik", label: "Kritik" },
  { key: "yuksek", label: "Yüksək" },
  { key: "risk", label: "Risk" },
];

function AlertRow({ item }: { item: AlertItem }) {
  const sv = sevMeta(item.seviyye);
  return (
    <Card className="mb-2">
      <View className="flex-row items-center justify-between">
        <Text className="text-ink dark:text-inkDark font-semibold text-sm flex-1" numberOfLines={2}>
          {item.kateqoriya_emoji ? `${item.kateqoriya_emoji} ` : ""}{item.basliq}
        </Text>
        <View style={{ backgroundColor: sv.bg, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, marginLeft: 8 }}>
          <Text style={{ color: sv.fg, fontSize: 11, fontWeight: "600" }}>{sv.label}</Text>
        </View>
      </View>
      {item.tesvir ? <Text className="text-sub dark:text-subDark text-xs mt-1" numberOfLines={2}>{item.tesvir}</Text> : null}
      <Text className="text-sub dark:text-subDark text-[11px] mt-1">{item.kateqoriya_ad}{item.obyekt_basliq ? ` · ${item.obyekt_basliq}` : ""}</Text>
    </Card>
  );
}

export default function NezaretScreen() {
  const [query, setQuery] = useState("");
  const [q, setQ] = useState("");
  const [seviyye, setSeviyye] = useState("hamisi");
  useEffect(() => { const t = setTimeout(() => setQ(query), 300); return () => clearTimeout(t); }, [query]);

  const { data, isLoading, isError, refetch, isRefetching } = useNezaret(seviyye, q);
  const items = data?.items ?? [];
  const sum = data?.summary;

  const header = (
    <View className="px-4 pt-3 pb-1 gap-2">
      {sum ? (
        <Card>
          <View className="flex-row justify-between">
            <View className="items-center flex-1"><Text className="text-ink dark:text-inkDark font-bold text-base">{sum.open}</Text><Text className="text-sub dark:text-subDark text-[11px]">Açıq</Text></View>
            <View className="items-center flex-1"><Text style={{ color: "#dc2626" }} className="font-bold text-base">{sum.kritik}</Text><Text className="text-sub dark:text-subDark text-[11px]">Kritik</Text></View>
            <View className="items-center flex-1"><Text className="text-ink dark:text-inkDark font-bold text-base">{sum.today}</Text><Text className="text-sub dark:text-subDark text-[11px]">Bu gün</Text></View>
          </View>
        </Card>
      ) : null}
      <Input placeholder="Xəbərdarlıq axtar" value={query} onChangeText={setQuery} rightSlot={<Search size={18} color={C.sub} />} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 2 }}>
        {FILTERS.map((f) => {
          const active = seviyye === f.key;
          return (
            <Pressable key={f.key} onPress={() => setSeviyye(f.key)} style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: active ? C.brand : C.card, borderWidth: 1, borderColor: active ? C.brand : C.line }}>
              <Text style={{ color: active ? "#fff" : C.sub, fontSize: 12, fontWeight: "600" }}>{f.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );

  if (isLoading) return <Screen title="Nəzarət Mərkəzi" showBack>{header}<View className="px-4 pt-2"><ListSkeleton count={5} /></View></Screen>;
  if (isError) return <Screen title="Nəzarət Mərkəzi" showBack>{header}<ErrorState onRetry={refetch} /></Screen>;

  return (
    <Screen title="Nəzarət Mərkəzi" showBack>
      <OfflineBanner />
      {header}
      {items.length === 0 ? (
        <EmptyState icon={<ShieldAlert size={48} color={C.sub} strokeWidth={1.5} />} title="Xəbərdarlıq yoxdur" subtitle="Hər şey qaydasındadır ✓" />
      ) : (
        <FlatList<AlertItem>
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <AlertRow item={item} />}
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={C.brand} colors={[C.brand]} />}
        />
      )}
    </Screen>
  );
}
