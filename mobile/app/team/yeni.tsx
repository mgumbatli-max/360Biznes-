import React, { useState } from "react";
import { FlatList, Pressable, Text, View, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { Users } from "lucide-react-native";
import { useTeamUsers, useCreateDM, type TeamUser } from "../../src/features/team/hooks";
import { EmptyState, ErrorState, ListSkeleton, Screen } from "../../src/components";
import { C } from "../../src/theme";

export default function NewChatScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const { data: users, isLoading, isError, refetch } = useTeamUsers();
  const createDM = useCreateDM();
  const [busyId, setBusyId] = useState<string | null>(null);

  async function start(u: TeamUser) {
    if (createDM.isPending) return;
    setBusyId(u.id);
    try {
      const res = await createDM.mutateAsync(u.id);
      if (res?.id) {
        await qc.invalidateQueries({ queryKey: ["team-channels"] });
        router.replace(`/team/${res.id}`);
      }
    } catch {
      setBusyId(null);
    }
  }

  if (isLoading) return <Screen title="Yeni söhbət" showBack><View className="px-4 pt-4"><ListSkeleton count={6} /></View></Screen>;
  if (isError) return <Screen title="Yeni söhbət" showBack><ErrorState onRetry={refetch} /></Screen>;

  return (
    <Screen title="Yeni söhbət" showBack scroll={false}>
      {!users || users.length === 0 ? (
        <EmptyState icon={<Users size={48} color={C.sub} strokeWidth={1.5} />} title="Əməkdaş yoxdur" subtitle="Web-də işçi əlavə edin" />
      ) : (
        <FlatList<TeamUser>
          data={users}
          keyExtractor={(u) => u.id}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => start(item)}
              style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1, flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, paddingHorizontal: 16, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: C.line })}
            >
              <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: C.brand + "1a", alignItems: "center", justifyContent: "center" }}>
                <Text style={{ color: C.brand, fontWeight: "700", fontSize: 17 }}>{item.ad_soyad?.trim()?.charAt(0)?.toUpperCase() || "?"}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: C.ink, fontWeight: "600", fontSize: 15 }} numberOfLines={1}>{item.ad_soyad}</Text>
                {item.vezife ? <Text style={{ color: C.sub, fontSize: 12, marginTop: 1 }} numberOfLines={1}>{item.vezife}</Text> : null}
              </View>
              {busyId === item.id ? <ActivityIndicator color={C.brand} /> : null}
            </Pressable>
          )}
        />
      )}
    </Screen>
  );
}
