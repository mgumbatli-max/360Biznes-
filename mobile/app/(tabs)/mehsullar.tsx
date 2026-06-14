import React, { useState, useEffect } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  View,
} from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { ImageOff, Package, Plus, Search } from "lucide-react-native";
import { useProducts } from "../../src/features/mehsul/hooks";
import type { Product } from "../../src/features/mehsul/types";
import {
  Card,
  EmptyState,
  ErrorState,
  Input,
  ListSkeleton,
  OfflineBanner,
  Screen,
} from "../../src/components";
import { formatMoney, formatNumber } from "../../src/lib/format";
import { C } from "../../src/theme";

// ─── Məhsul sırası komponenti ─────────────────────────────────────────────────
function ProductRow({ item }: { item: Product }) {
  const router = useRouter();

  const isLowStock =
    item.kritik_stok != null && item.stok_miqdari <= item.kritik_stok;

  const showStrikethrough =
    item.endirimli_qiymet != null &&
    item.endirimli_qiymet < item.satis_qiymeti;

  const displayPrice = formatMoney(
    item.endirimli_qiymet ?? item.satis_qiymeti,
    item.valyuta
  );

  const subLine = [item.kod, item.kateqoriya_ad].filter(Boolean).join(" · ");

  return (
    <Card
      className="flex-row gap-3 items-center mb-2"
      onPress={() => router.push(`/mehsul/${item.id}`)}
    >
      {/* Şəkil / placeholder */}
      {item.sekil_url ? (
        <Image
          source={{ uri: item.sekil_url }}
          style={{ width: 56, height: 56, borderRadius: 10 }}
          contentFit="cover"
        />
      ) : (
        <View
          style={{ width: 56, height: 56, borderRadius: 10 }}
          className="bg-brand/10 items-center justify-center"
        >
          <Package size={24} color={C.brand} strokeWidth={1.5} />
        </View>
      )}

      {/* Orta — ad + kod/kateqoriya */}
      <View className="flex-1">
        <Text className="text-ink dark:text-inkDark font-semibold text-sm" numberOfLines={1}>
          {item.ad}
        </Text>
        {subLine ? (
          <Text className="text-sub dark:text-subDark text-xs mt-0.5" numberOfLines={1}>
            {subLine}
          </Text>
        ) : null}
      </View>

      {/* Sağ — qiymət + stok */}
      <View className="items-end">
        <Text className="text-ink dark:text-inkDark font-bold text-sm">{displayPrice}</Text>
        {showStrikethrough && (
          <Text className="text-sub dark:text-subDark text-xs line-through">
            {formatMoney(item.satis_qiymeti, item.valyuta)}
          </Text>
        )}
        <Text
          className={`text-xs mt-0.5 ${isLowStock ? "text-neg" : "text-sub dark:text-subDark"}`}
        >
          {formatNumber(item.satis_acig_miqdari)}
          {item.olcu_ad ? ` ${item.olcu_ad}` : ""}
        </Text>
      </View>
    </Card>
  );
}

// ─── Əsas ekran ───────────────────────────────────────────────────────────────
export default function MehsullarScreen() {
  const router = useRouter();

  // Axtarış input dəyəri (dərhal)
  const [query, setQuery] = useState("");
  // Debounce edilmiş sorğu (300ms gecikdirmə)
  const [q, setQ] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => {
      setQ(query);
    }, 300);
    return () => clearTimeout(timer);
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
  } = useProducts(q);

  const items = data?.pages.flatMap((p) => p.items) ?? [];
  const total = data?.pages[0]?.total ?? 0;

  // ─── Yüklənmə skeleti ─────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <Screen title="Məhsullar" showBack>
        <View className="px-4 pt-3">
          <Input
            placeholder="Ad, kod və ya barkod axtar"
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

  // ─── Xəta halı ────────────────────────────────────────────────────────────
  if (isError) {
    return (
      <Screen title="Məhsullar" showBack>
        <ErrorState onRetry={refetch} />
      </Screen>
    );
  }

  return (
    <Screen title="Məhsullar" showBack>
      <OfflineBanner />

      {/* Axtarış + say xətti */}
      <View className="px-4 pt-3 pb-2 gap-2">
        <Input
          placeholder="Ad, kod və ya barkod axtar"
          value={query}
          onChangeText={setQuery}
          rightSlot={<Search size={18} color={C.sub} />}
        />
        {total > 0 && (
          <Text className="text-sub dark:text-subDark text-xs">
            Cəmi: {total}
          </Text>
        )}
      </View>

      {/* Boş hal */}
      {items.length === 0 ? (
        <EmptyState
          icon={<Package size={48} color={C.sub} strokeWidth={1.5} />}
          title="Məhsul tapılmadı"
          subtitle={
            q
              ? "Axtarışa uyğun nəticə yoxdur"
              : "Hələ məhsul əlavə edilməyib"
          }
          actionLabel="Yeni məhsul"
          onAction={() => router.push("/mehsul/form")}
        />
      ) : (
        <FlatList<Product>
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={({ item }: { item: Product }) => (
            <ProductRow item={item} />
          )}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}
          onEndReached={() => {
            if (hasNextPage && !isFetchingNextPage) {
              fetchNextPage();
            }
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
              <ActivityIndicator
                color={C.brand}
                style={{ marginVertical: 16 }}
              />
            ) : null
          }
        />
      )}

      {/* Floating + düyməsi */}
      <Pressable
        onPress={() => router.push("/mehsul/form")}
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
        accessibilityLabel="Yeni məhsul"
      >
        <Plus color="#fff" size={26} strokeWidth={2.5} />
      </Pressable>
    </Screen>
  );
}
