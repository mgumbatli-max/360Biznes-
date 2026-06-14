import React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import {
  Sparkles, LayoutDashboard, ScanLine, ShoppingCart, Package, Wallet,
  Users, ListTodo, MessageSquare, User, Settings,
} from "lucide-react-native";
import { Screen } from "../../src/components";
import { C, AI_GRADIENT } from "../../src/theme";

type LucideIcon = React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
type Tile = { label: string; Icon: LucideIcon; bg: string; fg: string; onPress: () => void };

export default function ModullarScreen() {
  const router = useRouter();

  // Web lite-menu tonları (bg tint + fg rəng) ilə uyğun
  const tiles: Tile[] = [
    { label: "Əsas səhifə", Icon: LayoutDashboard, bg: "#eff6ff", fg: "#2563eb", onPress: () => router.push("/(tabs)") },
    { label: "POS Satış", Icon: ScanLine, bg: "#fff1f2", fg: "#e11d48", onPress: () => router.push("/pos") },
    { label: "Satışlar", Icon: ShoppingCart, bg: "#ecfdf5", fg: "#059669", onPress: () => router.push("/(tabs)/satis") },
    { label: "Anbar", Icon: Package, bg: "#fffbeb", fg: "#d97706", onPress: () => router.push("/mehsullar") },
    { label: "Maliyyə", Icon: Wallet, bg: "#f5f3ff", fg: "#7c3aed", onPress: () => router.push("/maliyye") },
    { label: "Müştərilər", Icon: Users, bg: "#ecfeff", fg: "#0891b2", onPress: () => router.push("/musteri") },
    { label: "Tapşırıqlar", Icon: ListTodo, bg: "#eef2ff", fg: "#4f46e5", onPress: () => router.push("/tapshiriq") },
    { label: "Söhbətlər", Icon: MessageSquare, bg: "#fdf2f8", fg: "#db2777", onPress: () => router.push("/team") },
    { label: "Profil", Icon: User, bg: "#f0fdfa", fg: "#0d9488", onPress: () => router.push("/profil") },
    { label: "Ayarlar", Icon: Settings, bg: "#f1f5f9", fg: "#64748b", onPress: () => router.push("/ayarlar") },
  ];

  const rows: Tile[][] = [];
  for (let i = 0; i < tiles.length; i += 2) rows.push(tiles.slice(i, i + 2));

  return (
    <Screen title="Modullar" scroll={false}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: 28 }}>
        {/* AI — ən üstdə, tam en, qabarıq (saytdakı kimi) */}
        <Pressable
          onPress={() => router.push("/ai")}
          style={({ pressed }) => ({ opacity: pressed ? 0.92 : 1, marginBottom: 16 })}
          accessibilityRole="button"
          accessibilityLabel="Süni İntellekt"
        >
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

        {/* Modul grid — 2 sütun, böyük kartlar */}
        {rows.map((pair, ri) => (
          <View key={ri} style={{ flexDirection: "row", gap: 12, marginBottom: 12 }}>
            {pair.map((t) => (
              <Pressable
                key={t.label}
                onPress={t.onPress}
                style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1, flex: 1, minHeight: 96, justifyContent: "space-between", backgroundColor: C.card, borderRadius: 18, borderWidth: 1, borderColor: C.line, padding: 14, shadowColor: "#141820", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 })}
                accessibilityRole="button"
                accessibilityLabel={t.label}
              >
                <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: t.bg, alignItems: "center", justifyContent: "center" }}>
                  <t.Icon size={21} color={t.fg} strokeWidth={2.1} />
                </View>
                <Text style={{ color: C.ink, fontSize: 13.5, fontWeight: "700", marginTop: 10 }}>{t.label}</Text>
              </Pressable>
            ))}
            {pair.length === 1 ? <View style={{ flex: 1 }} /> : null}
          </View>
        ))}
      </ScrollView>
    </Screen>
  );
}
