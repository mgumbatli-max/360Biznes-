import React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import {
  Package, Plus, ScanLine, TrendingUp, Wallet, AlertTriangle, Boxes,
  Sparkles, Bell, Search, Settings, ShoppingCart, Users, ListTodo, MessageSquare,
} from "lucide-react-native";
import { Screen, ModuleGrid, type Modul } from "../../src/components";
import { useAuth } from "../../src/lib/auth-store";
import { useOzet } from "../../src/features/ozet/hooks";
import { formatMoney } from "../../src/lib/format";
import { C } from "../../src/theme";

function getInitials(name?: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(" ").filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 6) return "Gecəniz xeyrə";
  if (h < 12) return "Sabahınız xeyir";
  if (h < 18) return "Günortanız xeyir";
  return "Axşamınız xeyir";
}

// ─── Yuxarı toolbar düyməsi ──────────────────────────────────────────────────
function IconBtn({ children, onPress, filled = false }: { children: React.ReactNode; onPress: () => void; filled?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        opacity: pressed ? 0.6 : 1,
        width: 38, height: 38, borderRadius: 19,
        backgroundColor: filled ? C.brand : "#fff",
        borderWidth: 1, borderColor: filled ? C.brand : C.line,
        alignItems: "center", justifyContent: "center",
      })}
    >
      {children}
    </Pressable>
  );
}

// ─── KPI tile ────────────────────────────────────────────────────────────────
function KpiTile({ icon, label, value, sub, tone, onPress }: {
  icon: React.ReactNode; label: string; value: string; sub?: string; tone?: "neg"; onPress?: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1, flex: 1, backgroundColor: "#fff", borderRadius: 14, borderWidth: 1, borderColor: C.line, padding: 12 })}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        {icon}
        <Text style={{ color: C.sub, fontSize: 11 }} numberOfLines={1}>{label}</Text>
      </View>
      <Text style={{ color: tone === "neg" ? C.neg : C.ink, fontSize: 18, fontWeight: "800", marginTop: 6 }} numberOfLines={1}>{value}</Text>
      {sub ? <Text style={{ color: C.sub, fontSize: 10, marginTop: 1 }} numberOfLines={1}>{sub}</Text> : null}
    </Pressable>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const user = useAuth((s) => s.user);
  const { data: ozet } = useOzet();
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
    <Screen>
      {/* Yuxarı toolbar */}
      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: 4, paddingBottom: 6, gap: 7 }}>
        <Pressable
          onPress={() => router.push("/(tabs)/menyu")}
          style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: C.brand, alignItems: "center", justifyContent: "center", marginRight: "auto" }}
          accessibilityLabel="Profil / Menyu"
        >
          <Text style={{ color: "#fff", fontWeight: "800", fontSize: 14 }}>{initials}</Text>
        </Pressable>
        <IconBtn onPress={() => router.push("/mehsullar")}><Search size={18} color={C.ink} /></IconBtn>
        <IconBtn onPress={() => router.push("/ai")} filled><Sparkles size={18} color="#fff" /></IconBtn>
        <IconBtn onPress={() => router.push("/bildiris")}><Bell size={18} color={C.ink} /></IconBtn>
        <IconBtn onPress={() => router.push("/(tabs)/menyu")}><Settings size={18} color={C.ink} /></IconBtn>
        <IconBtn onPress={() => router.push("/pos")} filled><Plus size={18} color="#fff" /></IconBtn>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
        {/* Salamlama kartı */}
        <LinearGradient
          colors={[C.brand, C.brandDark]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ marginHorizontal: 16, marginTop: 6, borderRadius: 20, padding: 20 }}
        >
          <Text style={{ color: "rgba(255,255,255,0.85)", fontSize: 14 }}>{greeting()},</Text>
          <Text style={{ color: "#fff", fontSize: 22, fontWeight: "800", marginTop: 2 }} numberOfLines={1}>
            {user?.ad_soyad ?? "İstifadəçi"} 👋
          </Text>
          {user?.sahibkar_ad != null && (
            <Text style={{ color: "rgba(255,255,255,0.8)", marginTop: 4, fontSize: 13 }} numberOfLines={1}>{user.sahibkar_ad}</Text>
          )}
        </LinearGradient>

        {/* KPI icmal */}
        {(ozet?.sales || ozet?.products) && (
          <View style={{ marginHorizontal: 16, marginTop: 12, gap: 10 }}>
            {ozet?.sales && (
              <View style={{ flexDirection: "row", gap: 10 }}>
                <KpiTile icon={<TrendingUp size={15} color={C.brand} />} label="Bugün satış" value={formatMoney(ozet.sales.bugun.mebleg)} sub={`${ozet.sales.bugun.count} satış`} onPress={() => router.push("/(tabs)/satis")} />
                <KpiTile icon={<Wallet size={15} color={C.brand} />} label="Bu ay" value={formatMoney(ozet.sales.bu_ay.mebleg)} sub={`${ozet.sales.bu_ay.count} satış`} onPress={() => router.push("/(tabs)/satis")} />
              </View>
            )}
            <View style={{ flexDirection: "row", gap: 10 }}>
              {ozet?.sales && (
                <KpiTile icon={<AlertTriangle size={15} color={ozet.sales.borc_mebleg > 0 ? C.neg : C.sub} />} label="Açıq borc" value={formatMoney(ozet.sales.borc_mebleg)} tone={ozet.sales.borc_mebleg > 0 ? "neg" : undefined} onPress={() => router.push("/musteri")} />
              )}
              {ozet?.products && (
                <KpiTile icon={<Boxes size={15} color={ozet.products.kritik > 0 ? C.neg : C.brand} />} label="Kritik stok" value={String(ozet.products.kritik ?? 0)} sub={`${ozet.products.toplam_aktiv ?? 0} aktiv məhsul`} tone={ozet.products.kritik > 0 ? "neg" : undefined} onPress={() => router.push("/mehsullar")} />
              )}
            </View>
          </View>
        )}

        {/* Bölmələr (modullar) */}
        <Text style={{ marginHorizontal: 16, marginTop: 22, marginBottom: 12, fontSize: 16, fontWeight: "800", color: C.ink }}>Bölmələr</Text>
        <ModuleGrid modules={modullar} />
      </ScrollView>
    </Screen>
  );
}
