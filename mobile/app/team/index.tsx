import React from "react";
import { FlatList, Pressable, Text, View, RefreshControl } from "react-native";
import { useRouter } from "expo-router";
import { MessageSquare, Hash } from "lucide-react-native";
import { useChannels } from "../../src/features/team/hooks";
import type { Channel } from "../../src/features/team/types";
import { EmptyState, ErrorState, ListSkeleton, OfflineBanner, Screen } from "../../src/components";
import { C } from "../../src/theme";

function timeLabel(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  return sameDay
    ? `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
    : `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function ChannelRow({ item }: { item: Channel }) {
  const router = useRouter();
  const isDirect = item.novu === "direct";
  const preview = item.lastMessage
    ? `${!isDirect && item.lastMessage.gonderici_ad ? item.lastMessage.gonderici_ad.split(" ")[0] + ": " : ""}${item.lastMessage.mesaj}`
    : "Hələ mesaj yoxdur";
  return (
    <Pressable
      onPress={() => router.push(`/team/${item.id}`)}
      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1, flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 11, paddingHorizontal: 16, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: C.line })}
    >
      <View style={{ width: 50, height: 50, borderRadius: 25, backgroundColor: C.brand + "1a", alignItems: "center", justifyContent: "center" }}>
        {isDirect ? (
          <Text style={{ color: C.brand, fontWeight: "700", fontSize: 18 }}>{item.ad?.trim()?.charAt(0)?.toUpperCase() || "?"}</Text>
        ) : (
          <Hash size={22} color={C.brand} />
        )}
      </View>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Text style={{ flex: 1, color: C.ink, fontWeight: "600", fontSize: 15 }} numberOfLines={1}>{item.ad}</Text>
          <Text style={{ color: C.sub, fontSize: 11 }}>{timeLabel(item.son_mesaj_de ?? item.lastMessage?.yaradildi ?? null)}</Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", marginTop: 2 }}>
          <Text style={{ flex: 1, color: C.sub, fontSize: 13 }} numberOfLines={1}>{preview}</Text>
          {item.unread > 0 ? (
            <View style={{ minWidth: 20, height: 20, borderRadius: 10, backgroundColor: C.brand, alignItems: "center", justifyContent: "center", paddingHorizontal: 6, marginLeft: 6 }}>
              <Text style={{ color: "#fff", fontSize: 11, fontWeight: "700" }}>{item.unread > 99 ? "99+" : item.unread}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

export default function TeamScreen() {
  const { data, isLoading, isError, refetch, isRefetching } = useChannels();
  const channels = data?.channels ?? [];

  if (isLoading) return <Screen title="Söhbətlər" showBack><View className="px-4 pt-4"><ListSkeleton count={7} /></View></Screen>;
  if (isError) return <Screen title="Söhbətlər" showBack><ErrorState onRetry={refetch} /></Screen>;

  return (
    <Screen title="Söhbətlər" showBack scroll={false}>
      <OfflineBanner />
      {channels.length === 0 ? (
        <EmptyState
          icon={<MessageSquare size={48} color={C.sub} strokeWidth={1.5} />}
          title="Söhbət yoxdur"
          subtitle="Web-də komanda kanalı yaradın, sonra burada yazışın"
        />
      ) : (
        <FlatList<Channel>
          data={channels}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => <ChannelRow item={item} />}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={C.brand} colors={[C.brand]} />}
        />
      )}
    </Screen>
  );
}
