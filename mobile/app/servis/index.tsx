import React, { useState, useEffect } from "react";
import { FlatList, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Wrench, Search } from "lucide-react-native";
import { useServisList } from "../../src/features/servis/hooks";
import type { ServisItem } from "../../src/features/servis/types";
import { Card, EmptyState, ErrorState, Input, ListSkeleton, OfflineBanner, Screen } from "../../src/components";
import { formatMoney } from "../../src/lib/format";
import { C } from "../../src/theme";

const STATUS_META: Record<string, { label: string; bg: string; fg: string }> = {
  teklif_gozleyir: { label: "Təklif gözləyir", bg: "#f5f3ff", fg: "#7c3aed" },
  temir_olunur: { label: "Təmir olunur", bg: "#fff7ed", fg: "#ea580c" },
  diaqnostika: { label: "Diaqnostika", bg: "#eff6ff", fg: "#2563eb" },
  hazir: { label: "Hazır", bg: "#ecfdf5", fg: "#059669" },
  musteriye_tehvil: { label: "Təhvil verildi", bg: "#f0fdf4", fg: "#16a34a" },
  redd_edildi: { label: "Rədd edildi", bg: "#fef2f2", fg: "#dc2626" },
  qaytarildi: { label: "Qaytarıldı", bg: "#fef2f2", fg: "#dc2626" },
};
function statusMeta(s: string) {
  return STATUS_META[s] ?? { label: s.replace(/_/g, " "), bg: "#f1f5f9", fg: "#475569" };
}

const FILTERS = [
  { key: "hamisi", label: "Hamısı" },
  { key: "temir_olunur", label: "Təmirdə" },
  { key: "teklif_gozleyir", label: "Təklif" },
  { key: "hazir", label: "Hazır" },
  { key: "musteriye_tehvil", label: "Təhvil" },
];

function ServisRow({ item }: { item: ServisItem }) {
  const router = useRouter();
  const st = statusMeta(item.status);
  return (
    <Card className="mb-2" onPress={() => router.push(`/servis/${item.id}`)}>
      <View className="flex-row items-center justify-between">
        <Text className="text-ink dark:text-inkDark font-bold text-sm" numberOfLines={1}>
          {item.nomre}
        </Text>
        <View style={{ backgroundColor: st.bg, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}>
          <Text style={{ color: st.fg, fontSize: 11, fontWeight: "600" }}>{st.label}</Text>
        </View>
      </View>
      <Text className="text-ink dark:text-inkDark text-sm mt-1" numberOfLines={1}>
        {item.mehsul_ad || "—"}
      </Text>
      <Text className="text-sub dark:text-subDark text-xs mt-0.5" numberOfLines={1}>
        {[item.musteri_ad, item.musteri_telefon].filter(Boolean).join(" · ") || "Müştəri yox"}
      </Text>
      {item.problem ? (
        <Text className="text-sub dark:text-subDark text-xs mt-1" numberOfLines={2}>
          {item.problem}
        </Text>
      ) : null}
      <View className="flex-row items-center justify-between mt-1.5">
        <Text className="text-sub dark:text-subDark text-[11px]">
          {item.servis_iscisi_ad ? `Usta: ${item.servis_iscisi_ad}` : "Usta təyin edilməyib"}
        </Text>
        {item.temir_xerci > 0 ? (
          <Text className="text-ink dark:text-inkDark font-semibold text-xs">{formatMoney(item.temir_xerci)}</Text>
        ) : null}
      </View>
    </Card>
  );
}

export default function ServisListScreen() {
  const [query, setQuery] = useState("");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("hamisi");

  useEffect(() => {
    const t = setTimeout(() => setQ(query), 300);
    return () => clearTimeout(t);
  }, [query]);

  const { data, isLoading, isError, refetch, isRefetching } = useServisList(status, q);
  const items = data?.items ?? [];

  const header = (
    <View className="px-4 pt-3 pb-1 gap-2">
      <Input placeholder="№, müştəri, məhsul axtar" value={query} onChangeText={setQuery} rightSlot={<Search size={18} color={C.sub} />} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 2 }}>
        {FILTERS.map((f) => {
          const active = status === f.key;
          return (
            <Pressable
              key={f.key}
              onPress={() => setStatus(f.key)}
              style={{
                paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999,
                backgroundColor: active ? C.brand : C.card, borderWidth: 1, borderColor: active ? C.brand : C.line,
              }}
            >
              <Text style={{ color: active ? "#fff" : C.sub, fontSize: 12, fontWeight: "600" }}>{f.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );

  if (isLoading) {
    return (
      <Screen title="Servis" showBack>
        {header}
        <View className="px-4 pt-2"><ListSkeleton count={6} /></View>
      </Screen>
    );
  }
  if (isError) {
    return (
      <Screen title="Servis" showBack>
        {header}
        <ErrorState onRetry={refetch} />
      </Screen>
    );
  }

  return (
    <Screen title="Servis" showBack>
      <OfflineBanner />
      {header}
      {items.length === 0 ? (
        <EmptyState
          icon={<Wrench size={48} color={C.sub} strokeWidth={1.5} />}
          title="Servis qeydi tapılmadı"
          subtitle={q || status !== "hamisi" ? "Filtrə uyğun nəticə yoxdur" : "Hələ servis qeydi yoxdur"}
        />
      ) : (
        <FlatList<ServisItem>
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <ServisRow item={item} />}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100, paddingTop: 4 }}
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
