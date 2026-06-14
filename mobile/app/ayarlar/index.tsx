import React from "react";
import { Alert, Linking, Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import Constants from "expo-constants";
import { Info, Server, Globe, ChevronRight, LogOut } from "lucide-react-native";
import { Card, Screen } from "../../src/components";
import { useAppModeStore } from "../../src/lib/app-mode-store";
import { useAuth } from "../../src/lib/auth-store";
import { api } from "../../src/lib/api";
import { C } from "../../src/theme";

const API_BASE =
  process.env.EXPO_PUBLIC_API_BASE ||
  (Constants.expoConfig?.extra?.apiBase as string) ||
  "—";

function Row({ icon, label, value, onPress, last }: { icon: React.ReactNode; label: string; value?: string; onPress?: () => void; last?: boolean }) {
  const inner = (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 13, paddingHorizontal: 14, borderBottomWidth: last ? 0 : 1, borderBottomColor: C.line, backgroundColor: "#fff" }}>
      <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: C.brand + "1a", alignItems: "center", justifyContent: "center" }}>{icon}</View>
      <Text style={{ flex: 1, color: C.ink, fontSize: 15, fontWeight: "500" }}>{label}</Text>
      {value ? <Text style={{ color: C.sub, fontSize: 13 }} numberOfLines={1}>{value}</Text> : null}
      {onPress ? <ChevronRight size={18} color={C.sub} /> : null}
    </View>
  );
  return onPress ? (
    <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>{inner}</Pressable>
  ) : inner;
}

export default function AyarlarScreen() {
  const router = useRouter();
  const mode = useAppModeStore((s) => s.mode);
  const setMode = useAppModeStore((s) => s.setMode);
  const version = Constants.expoConfig?.version ?? "1.0.0";

  const onLogout = async () => {
    const rt = useAuth.getState().refresh;
    try { if (rt) await api.post("/auth/logout", { refreshToken: rt }); } catch {}
    await useAuth.getState().clear();
    router.replace("/(auth)/login");
  };
  const confirmLogout = () => {
    Alert.alert("Çıxış", "Hesabdan çıxmaq istəyirsiniz?", [
      { text: "Xeyr", style: "cancel" },
      { text: "Bəli, çıxış", style: "destructive", onPress: onLogout },
    ]);
  };

  return (
    <Screen title="Ayarlar" showBack scroll>
      {/* Rejim */}
      <Card>
        <Text style={{ color: C.sub, fontSize: 12, fontWeight: "600", marginBottom: 8 }}>Rejim</Text>
        <View style={{ flexDirection: "row", backgroundColor: C.bg, borderRadius: 12, padding: 4 }}>
          {(["lite", "pro"] as const).map((m) => (
            <Pressable key={m} onPress={() => setMode(m)} style={{ flex: 1, borderRadius: 8, paddingVertical: 8, alignItems: "center", backgroundColor: mode === m ? C.brand : "transparent" }}>
              <Text style={{ fontSize: 14, fontWeight: "600", color: mode === m ? "#fff" : C.sub }}>{m === "lite" ? "Lite (sadə)" : "Pro (tam)"}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={{ color: C.sub, fontSize: 12, marginTop: 8 }}>
          Lite — yalnız vacib funksiyalar. Pro — hər şey aktiv.
        </Text>
      </Card>

      {/* Tətbiq */}
      <Text style={{ marginTop: 18, marginBottom: 10, fontSize: 15, fontWeight: "800", color: C.ink }}>Tətbiq</Text>
      <View style={{ borderRadius: 16, overflow: "hidden", borderWidth: 1, borderColor: C.line }}>
        <Row icon={<Info size={18} color={C.brand} />} label="Versiya" value={version} />
        <Row icon={<Server size={18} color={C.brand} />} label="Server" value={API_BASE.replace(/^https?:\/\//, "")} />
        <Row icon={<Globe size={18} color={C.brand} />} label="Sayt" value="360biznes.az" onPress={() => Linking.openURL("https://www.360biznes.az")} last />
      </View>

      {/* Hesab */}
      <Text style={{ marginTop: 18, marginBottom: 10, fontSize: 15, fontWeight: "800", color: C.ink }}>Hesab</Text>
      <View style={{ borderRadius: 16, overflow: "hidden", borderWidth: 1, borderColor: C.line }}>
        <Pressable onPress={confirmLogout} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 13, paddingHorizontal: 14, backgroundColor: "#fff" }}>
            <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: C.neg + "1a", alignItems: "center", justifyContent: "center" }}><LogOut size={18} color={C.neg} /></View>
            <Text style={{ flex: 1, color: C.neg, fontSize: 15, fontWeight: "600" }}>Hesabdan çıx</Text>
          </View>
        </Pressable>
      </View>
    </Screen>
  );
}
