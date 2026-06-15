import React, { useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { ListTodo, Plus, Clock, User } from "lucide-react-native";
import { useTasks } from "../../src/features/tapshiriq/hooks";
import type { Task } from "../../src/features/tapshiriq/types";
import { Card, EmptyState, ErrorState, ListSkeleton, OfflineBanner, Screen } from "../../src/components";
import { C } from "../../src/theme";

const STATUS_FILTERS: { key: string; label: string }[] = [
  { key: "", label: "Hamısı" },
  { key: "yeni", label: "Yeni" },
  { key: "icrada", label: "İcrada" },
  { key: "tamamlandi", label: "Bitmiş" },
];
const STATUS_LABEL: Record<string, string> = { yeni: "Yeni", icrada: "İcrada", gozlemede: "Gözləmədə", tamamlandi: "Bitdi", legv: "Ləğv" };
const PRIO_COLOR: Record<string, string> = { tecili: C.neg, yuksek: C.warn, normal: C.brand, asagi: C.sub };

function TaskRow({ item }: { item: Task }) {
  const router = useRouter();
  const overdue = item.deadline && new Date(item.deadline) < new Date() && item.status !== "tamamlandi" && item.status !== "legv";
  return (
    <Card className="mb-2" onPress={() => router.push(`/tapshiriq/${item.id}`)}>
      <View className="flex-row items-start gap-2.5">
        <View style={{ width: 8, height: 8, borderRadius: 4, marginTop: 6, backgroundColor: PRIO_COLOR[item.prioritet] ?? C.sub }} />
        <View className="flex-1">
          <Text className="text-ink dark:text-inkDark font-semibold text-sm" numberOfLines={2}>{item.basliq}</Text>
          <View className="flex-row items-center gap-3 mt-1 flex-wrap">
            {item.mesul_ad ? (
              <View className="flex-row items-center gap-1">
                <User size={11} color={C.sub} />
                <Text className="text-sub dark:text-subDark text-[11px]">{item.mesul_ad}</Text>
              </View>
            ) : null}
            {item.deadline ? (
              <View className="flex-row items-center gap-1">
                <Clock size={11} color={overdue ? C.neg : C.sub} />
                <Text className={`text-[11px] ${overdue ? "text-neg" : "text-sub dark:text-subDark"}`}>{String(item.deadline).slice(0, 10)}</Text>
              </View>
            ) : null}
          </View>
        </View>
        <Text className={`text-[10px] font-medium ${item.status === "tamamlandi" ? "text-pos" : "text-sub dark:text-subDark"}`}>
          {STATUS_LABEL[item.status] ?? item.status}
        </Text>
      </View>
    </Card>
  );
}

export default function TapshiriqListScreen() {
  const router = useRouter();
  const [scope, setScope] = useState("menim");
  const [status, setStatus] = useState("");
  const { data, isLoading, isError, refetch, isRefetching, fetchNextPage, hasNextPage, isFetchingNextPage } = useTasks(scope, status, "");
  const items = data?.pages.flatMap((p) => p.items) ?? [];

  const Filters = (
    <View className="px-4 pt-3 gap-2">
      <View className="flex-row bg-bg dark:bg-bgDark rounded-xl p-1">
        {(["menim", "hamisi"] as const).map((sc) => (
          <Pressable key={sc} onPress={() => setScope(sc)} className="flex-1 rounded-lg py-2 items-center" style={{ backgroundColor: scope === sc ? C.brand : "transparent" }}>
            <Text className="text-xs font-semibold" style={{ color: scope === sc ? "#fff" : C.sub }}>{sc === "menim" ? "Mənim" : "Hamısı"}</Text>
          </Pressable>
        ))}
      </View>
      <View className="flex-row gap-2">
        {STATUS_FILTERS.map((f) => {
          const on = status === f.key;
          return (
            <Pressable key={f.key} onPress={() => setStatus(f.key)} className="rounded-full px-3 py-1.5" style={{ backgroundColor: on ? C.brand : "#fff", borderWidth: 1, borderColor: on ? C.brand : C.line }}>
              <Text className="text-[11px] font-medium" style={{ color: on ? "#fff" : C.sub }}>{f.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );

  if (isLoading) {
    return <Screen title="Tapşırıqlar" showBack>{Filters}<View className="px-4 pt-4"><ListSkeleton count={6} /></View></Screen>;
  }
  if (isError) {
    return <Screen title="Tapşırıqlar" showBack><ErrorState onRetry={refetch} /></Screen>;
  }

  return (
    <Screen title="Tapşırıqlar" showBack>
      <OfflineBanner />
      {Filters}
      {items.length === 0 ? (
        <EmptyState
          icon={<ListTodo size={48} color={C.sub} strokeWidth={1.5} />}
          title="Tapşırıq yoxdur"
          subtitle="Yeni tapşırıq yaradın və ya təyin edin"
          actionLabel="Yeni tapşırıq"
          onAction={() => router.push("/tapshiriq/form")}
        />
      ) : (
        <FlatList<Task>
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <TaskRow item={item} />}
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 100 }}
          initialNumToRender={10}
          maxToRenderPerBatch={20}
          windowSize={10}
          removeClippedSubviews
          onEndReached={() => { if (hasNextPage && !isFetchingNextPage) fetchNextPage(); }}
          onEndReachedThreshold={0.4}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={C.brand} colors={[C.brand]} />}
          ListFooterComponent={isFetchingNextPage ? <ActivityIndicator color={C.brand} style={{ marginVertical: 16 }} /> : null}
        />
      )}
      <Pressable
        onPress={() => router.push("/tapshiriq/form")}
        style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1, position: "absolute", bottom: 24, right: 20, width: 56, height: 56, borderRadius: 28, backgroundColor: C.brand, alignItems: "center", justifyContent: "center", shadowColor: C.brandDark, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 6, elevation: 6 })}
        accessibilityRole="button" accessibilityLabel="Yeni tapşırıq"
      >
        <Plus color="#fff" size={26} strokeWidth={2.5} />
      </Pressable>
    </Screen>
  );
}
