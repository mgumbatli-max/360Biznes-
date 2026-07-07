import React, { useState } from "react";
import { FlatList, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { Megaphone, Ticket } from "lucide-react-native";
import { useKampaniyalar } from "../../src/features/kampaniya/hooks";
import type { Kampaniya } from "../../src/features/kampaniya/types";
import { Card, EmptyState, ErrorState, ListSkeleton, OfflineBanner, Screen } from "../../src/components";
import { C } from "../../src/theme";

const STATUS_META: Record<string, { label: string; bg: string; fg: string }> = {
  active: { label: "Aktiv", bg: "#ecfdf5", fg: "#059669" },
  paused: { label: "Dayandırılıb", bg: "#fff7ed", fg: "#ea580c" },
  draft: { label: "Qaralama", bg: "#f1f5f9", fg: "#475569" },
  expired: { label: "Bitib", bg: "#fef2f2", fg: "#dc2626" },
};
function statusMeta(s: string) { return STATUS_META[s] ?? { label: s, bg: "#f1f5f9", fg: "#475569" }; }
function fmtDate(s?: string | null): string {
  if (!s) return "müddətsiz";
  const d = new Date(s);
  if (isNaN(d.getTime())) return "—";
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
}

const FILTERS = [
  { key: "hamisi", label: "Hamısı" },
  { key: "active", label: "Aktiv" },
  { key: "paused", label: "Dayandırılıb" },
  { key: "draft", label: "Qaralama" },
];

function KampaniyaRow({ item }: { item: Kampaniya }) {
  const st = statusMeta(item.status);
  return (
    <Card className="mb-2">
      <View className="flex-row items-center justify-between">
        <Text className="text-ink dark:text-inkDark font-bold text-sm flex-1" numberOfLines={1}>{item.ad}</Text>
        <View style={{ backgroundColor: st.bg, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}>
          <Text style={{ color: st.fg, fontSize: 11, fontWeight: "600" }}>{st.label}</Text>
        </View>
      </View>
      <View className="flex-row items-center justify-between mt-1.5">
        <Text className="text-sub dark:text-subDark text-xs">{item.tip} · bitmə {fmtDate(item.bitme)}</Text>
        <View className="flex-row items-center gap-3">
          {item.kupon_say > 0 ? (
            <View className="flex-row items-center gap-1"><Ticket size={12} color={C.sub} /><Text className="text-sub dark:text-subDark text-[11px]">{item.kupon_say}</Text></View>
          ) : null}
          <Text className="text-sub dark:text-subDark text-[11px]">
            {item.max_uses ? `${item.current_uses}/${item.max_uses}` : `${item.current_uses} istifadə`}
          </Text>
        </View>
      </View>
    </Card>
  );
}

export default function KampaniyaScreen() {
  const [status, setStatus] = useState("hamisi");
  const { data, isLoading, isError, refetch, isRefetching } = useKampaniyalar(status);
  const items = data?.items ?? [];

  const header = (
    <View className="px-4 pt-3 pb-1">
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 2 }}>
        {FILTERS.map((f) => {
          const active = status === f.key;
          return (
            <Pressable key={f.key} onPress={() => setStatus(f.key)} style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: active ? C.brand : C.card, borderWidth: 1, borderColor: active ? C.brand : C.line }}>
              <Text style={{ color: active ? "#fff" : C.sub, fontSize: 12, fontWeight: "600" }}>{f.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );

  if (isLoading) return <Screen title="Kampaniyalar" showBack>{header}<View className="px-4 pt-2"><ListSkeleton count={5} /></View></Screen>;
  if (isError) return <Screen title="Kampaniyalar" showBack>{header}<ErrorState onRetry={refetch} /></Screen>;

  return (
    <Screen title="Kampaniyalar" showBack>
      <OfflineBanner />
      {header}
      {items.length === 0 ? (
        <EmptyState icon={<Megaphone size={48} color={C.sub} strokeWidth={1.5} />} title="Kampaniya yoxdur" subtitle={status !== "hamisi" ? "Filtrə uyğun nəticə yoxdur" : "Hələ kampaniya yaradılmayıb"} />
      ) : (
        <FlatList<Kampaniya>
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <KampaniyaRow item={item} />}
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={C.brand} colors={[C.brand]} />}
        />
      )}
    </Screen>
  );
}
