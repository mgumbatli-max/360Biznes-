import React from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import {
  Sparkles, LayoutDashboard, ScanLine, ShoppingCart, Package, Wallet,
  Users, Wrench, UserCog, ListTodo, Megaphone, BarChart3, ShieldAlert,
  Settings, MessageSquare,
} from "lucide-react-native";
import { Screen } from "../../src/components";
import { C, AI_GRADIENT } from "../../src/theme";

type LucideIcon = React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
type Tile = { label: string; Icon: LucideIcon; bg: string; fg: string; onPress: () => void };

export default function ModullarScreen() {
  const router = useRouter();
  const soon = (ad: string) => Alert.alert(ad, "Bu modul tezliklə əlavə olunacaq.");

  // Web lite-menu ilə 1-1 (eyni sıra, rəng tonu, etiket) + Söhbətlər (native)
  const tiles: Tile[] = [
    { label: "Əsas səhifə", Icon: LayoutDashboard, bg: "#eff6ff", fg: "#2563eb", onPress: () => router.push("/(tabs)") },
    { label: "POS Satış", Icon: ScanLine, bg: "#fff1f2", fg: "#e11d48", onPress: () => router.push("/pos") },
    { label: "Ticarət", Icon: ShoppingCart, bg: "#ecfdf5", fg: "#059669", onPress: () => router.push("/(tabs)/satis") },
    { label: "Anbar", Icon: Package, bg: "#fffbeb", fg: "#d97706", onPress: () => router.push("/mehsullar") },
    { label: "Maliyyə", Icon: Wallet, bg: "#f5f3ff", fg: "#7c3aed", onPress: () => router.push("/maliyye") },
    { label: "Müştərilər", Icon: Users, bg: "#ecfeff", fg: "#0891b2", onPress: () => router.push("/musteri") },
    { label: "Servis", Icon: Wrench, bg: "#fff7ed", fg: "#ea580c", onPress: () => soon("Servis") },
    { label: "Əməkdaşlar", Icon: UserCog, bg: "#f0fdfa", fg: "#0d9488", onPress: () => soon("Əməkdaşlar") },
    { label: "Tapşırıqlar", Icon: ListTodo, bg: "#eef2ff", fg: "#4f46e5", onPress: () => router.push("/tapshiriq") },
    { label: "Kampaniyalar", Icon: Megaphone, bg: "#fdf2f8", fg: "#db2777", onPress: () => soon("Kampaniyalar") },
    { label: "Hesabatlar", Icon: BarChart3, bg: "#f0f9ff", fg: "#0284c7", onPress: () => router.push("/maliyye") },
    { label: "Nəzarət", Icon: ShieldAlert, bg: "#fef2f2", fg: "#dc2626", onPress: () => router.push("/mehsullar") },
    { label: "Söhbətlər", Icon: MessageSquare, bg: "#eef2ff", fg: "#4f46e5", onPress: () => router.push("/team") },
    { label: "Ayarlar", Icon: Settings, bg: "#f1f5f9", fg: "#475569", onPress: () => router.push("/ayarlar") },
  ];

  const rows: Tile[][] = [];
  for (let i = 0; i < tiles.length; i += 2) rows.push(tiles.slice(i, i + 2));

  return (
    <Screen title="Modullar" scroll={false}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: 28 }}>
        {/* AI banner (web ilə eyni) */}
        <Pressable onPress={() => router.push("/ai")} style={({ pressed }) => ({ opacity: pressed ? 0.92 : 1, marginBottom: 16 })} accessibilityLabel="Süni İntellekt">
          <LinearGradient colors={AI_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 18, padding: 16, shadowColor: C.aiDark, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5 }}>
            <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.22)", alignItems: "center", justifyContent: "center" }}>
              <Sparkles size={26} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: "#fff", fontSize: 16, fontWeight: "800" }}>Süni İntellekt</Text>
              <Text style={{ color: "rgba(255,255,255,0.88)", fontSize: 12, marginTop: 2 }}>Soruş, hesabat al, satış yarat — hər şey burada</Text>
            </View>
          </LinearGradient>
        </Pressable>

        {/* Modul kartları — 2 sütun, aydın görünən (web kimi) */}
        {rows.map((pair, ri) => (
          <View key={ri} style={{ flexDirection: "row", gap: 12, marginBottom: 12 }}>
            {pair.map((t) => (
              <Pressable
                key={t.label}
                onPress={t.onPress}
                style={({ pressed }) => ({
                  opacity: pressed ? 0.92 : 1,
                  flex: 1,
                  minHeight: 102,
                  justifyContent: "flex-start",
                  backgroundColor: C.card,
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: C.line,
                  padding: 14,
                  shadowColor: "#0b1220",
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.07,
                  shadowRadius: 6,
                  elevation: 2,
                })}
                accessibilityRole="button"
                accessibilityLabel={t.label}
              >
                <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: t.fg + "26", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
                  <t.Icon size={22} color={t.fg} strokeWidth={2.1} />
                </View>
                <Text style={{ color: C.ink, fontSize: 14, fontWeight: "700" }}>{t.label}</Text>
              </Pressable>
            ))}
            {pair.length === 1 ? <View style={{ flex: 1 }} /> : null}
          </View>
        ))}
      </ScrollView>
    </Screen>
  );
}
