import React from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import {
  Sparkles, LayoutDashboard, ScanLine, ShoppingCart, Package, Wallet,
  Users, Wrench, UserCog, ListTodo, Megaphone, BarChart3, ShieldAlert,
  Settings, MessageSquare, Contact, Store, FlaskConical,
} from "lucide-react-native";
import { Screen } from "../../src/components";
import { C, AI_GRADIENT } from "../../src/theme";

type LucideIcon = React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
type Tile = { label: string; Icon: LucideIcon; fg: string; onPress: () => void };

export default function ModullarScreen() {
  const router = useRouter();
  const soon = (ad: string) => Alert.alert(ad, "Bu modul tezliklə əlavə olunacaq.");

  // Web naviqasiyasındakı BÜTÜN modullar (lib/navigation.ts ilə 1-1)
  const tiles: Tile[] = [
    { label: "Əsas səhifə", Icon: LayoutDashboard, fg: "#2563eb", onPress: () => router.push("/(tabs)") },
    { label: "POS / İsti satış", Icon: ScanLine, fg: "#e11d48", onPress: () => router.push("/pos") },
    { label: "Ticarət", Icon: ShoppingCart, fg: "#059669", onPress: () => router.push("/(tabs)/satis") },
    { label: "Anbar", Icon: Package, fg: "#d97706", onPress: () => router.push("/mehsullar") },
    { label: "Maliyyə", Icon: Wallet, fg: "#7c3aed", onPress: () => router.push("/maliyye") },
    { label: "Əlaqələr", Icon: Users, fg: "#0891b2", onPress: () => router.push("/musteri") },
    { label: "Tapşırıqlar", Icon: ListTodo, fg: "#4f46e5", onPress: () => router.push("/tapshiriq") },
    { label: "Team / Söhbət", Icon: MessageSquare, fg: "#4f46e5", onPress: () => router.push("/team") },
    { label: "Servis", Icon: Wrench, fg: "#ea580c", onPress: () => soon("Servis") },
    { label: "Əməkdaşlar", Icon: UserCog, fg: "#0d9488", onPress: () => soon("Əməkdaşlar") },
    { label: "Kampaniyalar", Icon: Megaphone, fg: "#db2777", onPress: () => soon("Kampaniyalar") },
    { label: "CRM / Mesaj", Icon: Contact, fg: "#0284c7", onPress: () => soon("CRM / Mesaj Mərkəzi") },
    { label: "Marketplace", Icon: Store, fg: "#64748b", onPress: () => soon("Marketplace & Webhook") },
    { label: "360 LAB", Icon: FlaskConical, fg: "#c026d3", onPress: () => soon("360 LAB") },
    { label: "Hesabatlar", Icon: BarChart3, fg: "#0284c7", onPress: () => router.push("/maliyye") },
    { label: "Nəzarət Mərkəzi", Icon: ShieldAlert, fg: "#dc2626", onPress: () => router.push("/mehsullar") },
    { label: "Ayarlar", Icon: Settings, fg: "#475569", onPress: () => router.push("/ayarlar") },
  ];

  const rows: Tile[][] = [];
  for (let i = 0; i < tiles.length; i += 2) rows.push(tiles.slice(i, i + 2));

  return (
    <Screen title="Modullar" scroll={false}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: 28 }}>
        {/* AI banner */}
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

        {/* Modul kartları — 2 sütun */}
        {rows.map((pair, ri) => (
          <View key={ri} style={{ flexDirection: "row", gap: 12, marginBottom: 12 }}>
            {pair.map((t) => (
              <Pressable
                key={t.label}
                onPress={t.onPress}
                style={({ pressed }) => ({ opacity: pressed ? 0.92 : 1, flex: 1, minHeight: 102, justifyContent: "flex-start", backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: C.line, padding: 14, shadowColor: "#0b1220", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 6, elevation: 2 })}
                accessibilityRole="button"
                accessibilityLabel={t.label}
              >
                <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: t.fg + "26", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
                  <t.Icon size={22} color={t.fg} strokeWidth={2.1} />
                </View>
                <Text style={{ color: C.ink, fontSize: 13.5, fontWeight: "700" }} numberOfLines={2}>{t.label}</Text>
              </Pressable>
            ))}
            {pair.length === 1 ? <View style={{ flex: 1 }} /> : null}
          </View>
        ))}
      </ScrollView>
    </Screen>
  );
}
