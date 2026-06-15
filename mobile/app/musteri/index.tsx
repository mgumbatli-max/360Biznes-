import React, { useState, useEffect } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { Users, Plus, Search } from "lucide-react-native";
import { useCustomers } from "../../src/features/musteri/hooks";
import type { Customer } from "../../src/features/musteri/types";
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

function CustomerRow({ item }: { item: Customer }) {
  const router = useRouter();
  const subLine = [item.telefon, item.sheher].filter(Boolean).join(" · ");
  return (
    <Card
      className="flex-row gap-3 items-center mb-2"
      onPress={() => router.push(`/musteri/${item.id}`)}
    >
      <View
        style={{ width: 44, height: 44, borderRadius: 22 }}
        className="bg-brand/10 items-center justify-center"
      >
        <Text className="text-brand font-bold text-base">
          {item.ad?.trim()?.charAt(0)?.toUpperCase() || "?"}
        </Text>
      </View>

      <View className="flex-1">
        <Text className="text-ink dark:text-inkDark font-semibold text-sm" numberOfLines={1}>
          {item.ad}
        </Text>
        {subLine ? (
          <Text className="text-sub dark:text-subDark text-xs mt-0.5" numberOfLines={1}>
            {subLine}
          </Text>
        ) : (
          <Text className="text-sub dark:text-subDark text-xs mt-0.5">Müştəri</Text>
        )}
      </View>

      <View className="items-end">
        {item.borc > 0 ? (
          <>
            <Text className="text-neg font-bold text-sm">
              {formatMoney(item.borc)}
            </Text>
            <Text className="text-sub dark:text-subDark text-[10px] mt-0.5">borc</Text>
          </>
        ) : (
          <Text className="text-sub dark:text-subDark text-xs">—</Text>
        )}
      </View>
    </Card>
  );
}

export default function MusteriListScreen() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [q, setQ] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setQ(query), 300);
    return () => clearTimeout(t);
  }, [query]);

  const {
    data,
    isLoading,
    isError,
    refetch,
    isRefetching,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useCustomers(q);

  const items = data?.pages.flatMap((p) => p.items) ?? [];
  const total = data?.pages[0]?.total ?? 0;

  if (isLoading) {
    return (
      <Screen title="Müştərilər" showBack>
        <View className="px-4 pt-3">
          <Input
            placeholder="Ad və ya telefon axtar"
            value={query}
            onChangeText={setQuery}
            rightSlot={<Search size={18} color={C.sub} />}
          />
        </View>
        <View className="px-4 pt-4">
          <ListSkeleton count={6} />
        </View>
      </Screen>
    );
  }

  if (isError) {
    return (
      <Screen title="Müştərilər" showBack>
        <ErrorState onRetry={refetch} />
      </Screen>
    );
  }

  return (
    <Screen title="Müştərilər" showBack>
      <OfflineBanner />
      <View className="px-4 pt-3 pb-2 gap-2">
        <Input
          placeholder="Ad və ya telefon axtar"
          value={query}
          onChangeText={setQuery}
          rightSlot={<Search size={18} color={C.sub} />}
        />
        {total > 0 && <Text className="text-sub dark:text-subDark text-xs">Cəmi: {total}</Text>}
      </View>

      {items.length === 0 ? (
        <EmptyState
          icon={<Users size={48} color={C.sub} strokeWidth={1.5} />}
          title="Müştəri tapılmadı"
          subtitle={q ? "Axtarışa uyğun nəticə yoxdur" : "Hələ müştəri əlavə edilməyib"}
          actionLabel="Yeni müştəri"
          onAction={() => router.push("/musteri/form")}
        />
      ) : (
        <FlatList<Customer>
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <CustomerRow item={item} />}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}
          initialNumToRender={10}
          maxToRenderPerBatch={20}
          windowSize={10}
          removeClippedSubviews
          onEndReached={() => {
            if (hasNextPage && !isFetchingNextPage) fetchNextPage();
          }}
          onEndReachedThreshold={0.4}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={C.brand}
              colors={[C.brand]}
            />
          }
          ListFooterComponent={
            isFetchingNextPage ? (
              <ActivityIndicator color={C.brand} style={{ marginVertical: 16 }} />
            ) : null
          }
        />
      )}

      <Pressable
        onPress={() => router.push("/musteri/form")}
        style={({ pressed }) => ({
          opacity: pressed ? 0.85 : 1,
          position: "absolute",
          bottom: 24,
          right: 20,
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: C.brand,
          alignItems: "center",
          justifyContent: "center",
          shadowColor: C.brandDark,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.35,
          shadowRadius: 6,
          elevation: 6,
        })}
        accessibilityRole="button"
        accessibilityLabel="Yeni müştəri"
      >
        <Plus color="#fff" size={26} strokeWidth={2.5} />
      </Pressable>
    </Screen>
  );
}
