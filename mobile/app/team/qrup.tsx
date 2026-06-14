import React, { useState } from "react";
import { Alert, FlatList, Pressable, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { Check, Users } from "lucide-react-native";
import { useTeamUsers, useCreateGroup, type TeamUser } from "../../src/features/team/hooks";
import { Button, EmptyState, ErrorState, ListSkeleton, Screen } from "../../src/components";
import { C } from "../../src/theme";

export default function NewGroupScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const { data: users, isLoading, isError, refetch } = useTeamUsers();
  const createGroup = useCreateGroup();
  const [ad, setAd] = useState("");
  const [sel, setSel] = useState<string[]>([]);

  const toggle = (id: string) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  async function create() {
    if (createGroup.isPending) return;
    if (ad.trim().length < 2) { Alert.alert("Qrup adı", "Ən az 2 simvol olmalıdır"); return; }
    if (sel.length === 0) { Alert.alert("Üzv seçin", "Ən az 1 nəfər seçin"); return; }
    try {
      const res = await createGroup.mutateAsync({ ad: ad.trim(), uzv_ids: sel });
      if (res?.id) {
        await qc.invalidateQueries({ queryKey: ["team-channels"] });
        router.replace(`/team/${res.id}`);
      } else {
        Alert.alert("Alınmadı", res?.error ?? "Qrup yaradılmadı");
      }
    } catch {
      Alert.alert("Xəta", "Şəbəkə xətası — yenidən cəhd edin");
    }
  }

  if (isLoading) return <Screen title="Yeni qrup" showBack><View className="px-4 pt-4"><ListSkeleton count={6} /></View></Screen>;
  if (isError) return <Screen title="Yeni qrup" showBack><ErrorState onRetry={refetch} /></Screen>;

  return (
    <Screen
      title="Yeni qrup"
      showBack
      scroll={false}
      footer={<Button title={`Qrup yarat${sel.length ? ` (${sel.length})` : ""}`} onPress={create} loading={createGroup.isPending} disabled={ad.trim().length < 2 || sel.length === 0} />}
    >
      <View style={{ padding: 16, paddingBottom: 6 }}>
        <Text style={{ color: C.sub, fontSize: 12, fontWeight: "600", marginBottom: 6 }}>Qrup adı</Text>
        <TextInput
          value={ad}
          onChangeText={setAd}
          placeholder="Məs. Satış komandası"
          placeholderTextColor={C.sub}
          style={{ backgroundColor: C.card, borderRadius: 12, borderWidth: 1, borderColor: C.line, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: C.ink }}
        />
        <Text style={{ color: C.sub, fontSize: 12, fontWeight: "600", marginTop: 14 }}>Üzvlər — {sel.length} seçildi</Text>
      </View>
      {!users || users.length === 0 ? (
        <EmptyState icon={<Users size={48} color={C.sub} strokeWidth={1.5} />} title="Əməkdaş yoxdur" subtitle="Web-də işçi əlavə edin" />
      ) : (
        <FlatList<TeamUser>
          data={users}
          keyExtractor={(u) => u.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16 }}
          renderItem={({ item }) => {
            const on = sel.includes(item.id);
            return (
              <Pressable onPress={() => toggle(item.id)} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1, flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 11, paddingHorizontal: 12, backgroundColor: C.card, borderRadius: 12, borderWidth: 1, borderColor: on ? C.brand : C.line, marginBottom: 8 })}>
                <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: C.brand + "1a", alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ color: C.brand, fontWeight: "700", fontSize: 16 }}>{item.ad_soyad?.trim()?.charAt(0)?.toUpperCase() || "?"}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: C.ink, fontSize: 14, fontWeight: "600" }} numberOfLines={1}>{item.ad_soyad}</Text>
                  {item.vezife ? <Text style={{ color: C.sub, fontSize: 12 }} numberOfLines={1}>{item.vezife}</Text> : null}
                </View>
                <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: on ? C.brand : "transparent", borderWidth: on ? 0 : 1.5, borderColor: C.line, alignItems: "center", justifyContent: "center" }}>
                  {on ? <Check size={16} color="#fff" strokeWidth={3} /> : null}
                </View>
              </Pressable>
            );
          }}
        />
      )}
    </Screen>
  );
}
