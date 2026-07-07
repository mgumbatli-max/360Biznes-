import React, { useState, useEffect } from "react";
import { FlatList, RefreshControl, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { UserCog, Search } from "lucide-react-native";
import { useEmekdasList } from "../../src/features/emekdas/hooks";
import type { EmekdasItem } from "../../src/features/emekdas/types";
import { Card, EmptyState, ErrorState, Input, ListSkeleton, OfflineBanner, Screen } from "../../src/components";
import { C } from "../../src/theme";

const STATUS_META: Record<string, { label: string; bg: string; fg: string }> = {
  aktiv: { label: "Aktiv", bg: "#ecfdf5", fg: "#059669" },
  mezuniyyetde: { label: "Məzuniyyət", bg: "#eff6ff", fg: "#2563eb" },
  cixib: { label: "Çıxıb", bg: "#fef2f2", fg: "#dc2626" },
  passiv: { label: "Passiv", bg: "#f1f5f9", fg: "#475569" },
};
function statusMeta(s: string) {
  return STATUS_META[s] ?? { label: s, bg: "#f1f5f9", fg: "#475569" };
}

function EmekdasRow({ item }: { item: EmekdasItem }) {
  const router = useRouter();
  const st = statusMeta(item.status);
  const sub = [item.vezife || item.rol_ad, item.default_filial_ad].filter(Boolean).join(" · ");
  return (
    <Card className="flex-row gap-3 items-center mb-2" onPress={() => router.push(`/emekdas/${item.id}`)}>
      <View style={{ width: 44, height: 44, borderRadius: 22 }} className="bg-brand/10 items-center justify-center">
        <Text className="text-brand font-bold text-base">{item.ad_soyad?.trim()?.charAt(0)?.toUpperCase() || "?"}</Text>
      </View>
      <View className="flex-1">
        <Text className="text-ink dark:text-inkDark font-semibold text-sm" numberOfLines={1}>{item.ad_soyad}</Text>
        <Text className="text-sub dark:text-subDark text-xs mt-0.5" numberOfLines={1}>{sub || "Əməkdaş"}</Text>
      </View>
      <View style={{ backgroundColor: st.bg, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}>
        <Text style={{ color: st.fg, fontSize: 11, fontWeight: "600" }}>{st.label}</Text>
      </View>
    </Card>
  );
}

export default function EmekdasListScreen() {
  const [query, setQuery] = useState("");
  const [q, setQ] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setQ(query), 300);
    return () => clearTimeout(t);
  }, [query]);

  const { data, isLoading, isError, refetch, isRefetching } = useEmekdasList(q);
  const items = data?.items ?? [];

  const header = (
    <View className="px-4 pt-3 pb-2 gap-2">
      <Input placeholder="Ad, vəzifə, telefon axtar" value={query} onChangeText={setQuery} rightSlot={<Search size={18} color={C.sub} />} />
      {data && data.total > 0 && <Text className="text-sub dark:text-subDark text-xs">Cəmi: {data.total}</Text>}
    </View>
  );

  if (isLoading) {
    return (
      <Screen title="Əməkdaşlar" showBack>
        {header}
        <View className="px-4 pt-2"><ListSkeleton count={6} /></View>
      </Screen>
    );
  }
  if (isError) {
    return (
      <Screen title="Əməkdaşlar" showBack>
        {header}
        <ErrorState onRetry={refetch} />
      </Screen>
    );
  }

  return (
    <Screen title="Əməkdaşlar" showBack>
      <OfflineBanner />
      {header}
      {items.length === 0 ? (
        <EmptyState
          icon={<UserCog size={48} color={C.sub} strokeWidth={1.5} />}
          title="Əməkdaş tapılmadı"
          subtitle={q ? "Axtarışa uyğun nəticə yoxdur" : "Hələ əməkdaş yoxdur"}
        />
      ) : (
        <FlatList<EmekdasItem>
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <EmekdasRow item={item} />}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}
          initialNumToRender={10}
          maxToRenderPerBatch={20}
          windowSize={10}
          removeClippedSubviews
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={C.brand} colors={[C.brand]} />}
        />
      )}
    </Screen>
  );
}
