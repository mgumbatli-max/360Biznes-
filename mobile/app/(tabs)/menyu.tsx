import React from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import {
  ChevronRight, LogOut, Settings, User,
  Sparkles, ScanLine, ShoppingCart, Users, Package, Wallet, ListTodo, MessageSquare,
} from "lucide-react-native";
import { Screen, Card, ModuleGrid, type Modul } from "../../src/components";
import { useAuth } from "../../src/lib/auth-store";
import { useAppModeStore } from "../../src/lib/app-mode-store";
import { api } from "../../src/lib/api";
import { C } from "../../src/theme";

function getInitials(name?: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(" ").filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

function AccountRow({ icon, label, onPress, danger = false, last = false }: {
  icon: React.ReactNode; label: string; onPress: () => void; danger?: boolean; last?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={`flex-row items-center px-4 py-3.5 bg-white ${last ? "" : "border-b border-line"}`}
      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
      accessibilityRole="button"
    >
      <View className="mr-3">{icon}</View>
      <Text className={`flex-1 text-[15px] font-medium ${danger ? "text-neg" : "text-ink"}`}>{label}</Text>
      <ChevronRight size={18} color={danger ? C.neg : C.sub} strokeWidth={2} />
    </Pressable>
  );
}

export default function MenyuScreen() {
  const router = useRouter();
  const user = useAuth((s) => s.user);
  const mode = useAppModeStore((s) => s.mode);
  const setMode = useAppModeStore((s) => s.setMode);

  const onLogout = async () => {
    const rt = useAuth.getState().refresh;
    try {
      if (rt) await api.post("/auth/logout", { refreshToken: rt });
    } catch {}
    await useAuth.getState().clear();
    router.replace("/(auth)/login");
  };

  const confirmLogout = () => {
    Alert.alert("Çıxış", "Hesabdan çıxmaq istəyirsiniz?", [
      { text: "Xeyr", style: "cancel" },
      { text: "Bəli, çıxış", style: "destructive", onPress: onLogout },
    ], { cancelable: true });
  };

  const initials = getInitials(user?.ad_soyad);

  const modullar: Modul[] = [
    { label: "AI köməkçi", icon: <Sparkles size={22} color="#0d9488" />, bg: "#ccfbf1", onPress: () => router.push("/ai") },
    { label: "Yeni satış", icon: <ScanLine size={22} color="#16a34a" />, bg: "#dcfce7", onPress: () => router.push("/pos") },
    { label: "Satışlar", icon: <ShoppingCart size={22} color="#2563eb" />, bg: "#dbeafe", onPress: () => router.push("/(tabs)/satis") },
    { label: "Müştərilər", icon: <Users size={22} color="#7c3aed" />, bg: "#ede9fe", onPress: () => router.push("/musteri") },
    { label: "Məhsullar", icon: <Package size={22} color="#0891b2" />, bg: "#cffafe", onPress: () => router.push("/mehsullar") },
    { label: "Maliyyə", icon: <Wallet size={22} color="#d97706" />, bg: "#fef3c7", onPress: () => router.push("/maliyye") },
    { label: "Tapşırıqlar", icon: <ListTodo size={22} color="#db2777" />, bg: "#fce7f3", onPress: () => router.push("/tapshiriq") },
    { label: "Söhbətlər", icon: <MessageSquare size={22} color="#4f46e5" />, bg: "#e0e7ff", onPress: () => router.push("/team") },
  ];

  return (
    <Screen title="Menyu" scroll={false}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
        {/* Profil */}
        <View style={{ marginHorizontal: 16, marginTop: 4 }}>
          <Card>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
              <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: C.brand, alignItems: "center", justifyContent: "center" }}>
                <Text style={{ color: "#fff", fontSize: 20, fontWeight: "700" }}>{initials}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: C.ink, fontSize: 16, fontWeight: "700" }} numberOfLines={1}>{user?.ad_soyad ?? "İstifadəçi"}</Text>
                {user?.email != null && <Text style={{ color: C.sub, fontSize: 13, marginTop: 2 }} numberOfLines={1}>{user.email}</Text>}
                {user?.rol_ad != null && (
                  <View style={{ marginTop: 6, backgroundColor: C.brand + "1a", borderRadius: 20, paddingVertical: 2, paddingHorizontal: 10, alignSelf: "flex-start" }}>
                    <Text style={{ color: C.brand, fontSize: 11, fontWeight: "600" }}>{user.rol_ad}</Text>
                  </View>
                )}
              </View>
            </View>
          </Card>
        </View>

        {/* Rejim */}
        <View style={{ marginHorizontal: 16, marginTop: 14 }}>
          <Card>
            <Text style={{ color: C.sub, fontSize: 12, fontWeight: "600", marginBottom: 8 }}>Rejim</Text>
            <View style={{ flexDirection: "row", backgroundColor: C.bg, borderRadius: 12, padding: 4 }}>
              {(["lite", "pro"] as const).map((m) => (
                <Pressable
                  key={m}
                  onPress={() => setMode(m)}
                  style={{ flex: 1, borderRadius: 8, paddingVertical: 8, alignItems: "center", backgroundColor: mode === m ? C.brand : "transparent" }}
                  accessibilityRole="button"
                >
                  <Text style={{ fontSize: 14, fontWeight: "600", color: mode === m ? "#fff" : C.sub }}>{m === "lite" ? "Lite (sadə)" : "Pro (tam)"}</Text>
                </Pressable>
              ))}
            </View>
          </Card>
        </View>

        {/* Bölmələr */}
        <Text style={{ marginHorizontal: 16, marginTop: 20, marginBottom: 12, fontSize: 16, fontWeight: "800", color: C.ink }}>Bölmələr</Text>
        <ModuleGrid modules={modullar} />

        {/* Hesab */}
        <Text style={{ marginHorizontal: 16, marginTop: 12, marginBottom: 12, fontSize: 16, fontWeight: "800", color: C.ink }}>Hesab</Text>
        <View style={{ marginHorizontal: 16, borderRadius: 16, overflow: "hidden", borderWidth: 1, borderColor: C.line }}>
          <AccountRow icon={<User size={20} color={C.sub} strokeWidth={2} />} label="Profil" onPress={() => router.push("/profil")} />
          <AccountRow icon={<Settings size={20} color={C.sub} strokeWidth={2} />} label="Ayarlar" onPress={() => router.push("/ayarlar")} />
          <AccountRow icon={<LogOut size={20} color={C.neg} strokeWidth={2} />} label="Çıxış" onPress={confirmLogout} danger last />
        </View>
      </ScrollView>
    </Screen>
  );
}
