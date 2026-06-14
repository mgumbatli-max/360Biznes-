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
import { C, TONE, type ToneKey } from "../../src/theme";

type LucideIcon = React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

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
const NUM = { fontVariant: ["tabular-nums" as const] };

function IconBtn({ children, onPress, filled = false, danger = false, badge }: { children: React.ReactNode; onPress: () => void; filled?: boolean; danger?: boolean; badge?: number }) {
  const bg = danger ? TONE.danger.bg : filled ? C.brand : "#fff";
  const border = danger ? "#fecaca" : filled ? C.brand : C.line;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, width: 38, height: 38, borderRadius: 19, backgroundColor: bg, borderWidth: 1, borderColor: border, alignItems: "center", justifyContent: "center" })}>
      {children}
      {badge != null && badge > 0 ? (
        <View style={{ position: "absolute", top: -3, right: -3, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: C.neg, alignItems: "center", justifyContent: "center", paddingHorizontal: 3, borderWidth: 1.5, borderColor: "#fff" }}>
          <Text style={{ color: "#fff", fontSize: 9, fontWeight: "800" }}>{badge > 99 ? "99" : badge}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

// ─── Web MetricCard üslubu KPI ───────────────────────────────────────────────
function MetricCard({ Icon, label, value, sub, tone = "neutral", onPress }: {
  Icon: LucideIcon; label: string; value: string; sub?: string; tone?: ToneKey; onPress?: () => void;
}) {
  const t = TONE[tone];
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1, flex: 1, backgroundColor: "#fff", borderRadius: 16, borderWidth: 1, borderColor: C.line, paddingHorizontal: 14, paddingVertical: 12, shadowColor: "#141820", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 })}>
      <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" }}>
        <Text style={{ color: C.sub, fontSize: 10.5, fontWeight: "600", letterSpacing: 0.6, textTransform: "uppercase", flex: 1, marginRight: 6 }} numberOfLines={1}>{label}</Text>
        <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: t.bg, alignItems: "center", justifyContent: "center" }}>
          <Icon size={17} color={t.fg} strokeWidth={2.2} />
        </View>
      </View>
      <Text style={{ color: tone === "neutral" ? C.ink : t.fg, fontSize: 21, fontWeight: "800", marginTop: 8, ...NUM }} numberOfLines={1}>{value}</Text>
      {sub ? <Text style={{ color: C.sub, fontSize: 11, marginTop: 1 }} numberOfLines={1}>{sub}</Text> : null}
    </Pressable>
  );
}

// ─── Web Quick-Action üslubu (gradient ikon + başlıq + təsvir) ───────────────
function QuickAction({ Icon, title, desc, colors, onPress }: {
  Icon: LucideIcon; title: string; desc: string; colors: [string, string]; onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1, flex: 1, backgroundColor: "#fff", borderRadius: 16, borderWidth: 1, borderColor: C.line, padding: 14, shadowColor: "#141820", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 })}>
      <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center", marginBottom: 10 }}>
        <Icon size={20} color="#fff" strokeWidth={2.2} />
      </LinearGradient>
      <Text style={{ color: C.ink, fontSize: 14, fontWeight: "700" }}>{title}</Text>
      <Text style={{ color: C.sub, fontSize: 11, marginTop: 2 }} numberOfLines={1}>{desc}</Text>
    </Pressable>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const user = useAuth((s) => s.user);
  const { data: ozet } = useOzet();
  const initials = getInitials(user?.ad_soyad);
  const kritik = ozet?.products?.kritik ?? 0;
  const borc = ozet?.sales?.borc_mebleg ?? 0;

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
        <Pressable onPress={() => router.push("/(tabs)/menyu")} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: C.brand, alignItems: "center", justifyContent: "center", marginRight: "auto" }} accessibilityLabel="Profil / Menyu">
          <Text style={{ color: "#fff", fontWeight: "800", fontSize: 14 }}>{initials}</Text>
        </Pressable>
        <IconBtn onPress={() => router.push("/mehsullar")}><Search size={18} color={C.ink} /></IconBtn>
        <IconBtn onPress={() => router.push("/ai")} filled><Sparkles size={18} color="#fff" /></IconBtn>
        {kritik > 0 ? <IconBtn onPress={() => router.push("/mehsullar")} danger badge={kritik}><AlertTriangle size={18} color={C.neg} /></IconBtn> : null}
        <IconBtn onPress={() => router.push("/bildiris")}><Bell size={18} color={C.ink} /></IconBtn>
        <IconBtn onPress={() => router.push("/ayarlar")}><Settings size={18} color={C.ink} /></IconBtn>
        <IconBtn onPress={() => router.push("/pos")} filled><Plus size={18} color="#fff" /></IconBtn>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
        {/* Salamlama */}
        <LinearGradient colors={[C.brand, C.brandDark]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ marginHorizontal: 16, marginTop: 6, borderRadius: 18, padding: 18 }}>
          <Text style={{ color: "rgba(255,255,255,0.85)", fontSize: 13 }}>{greeting()},</Text>
          <Text style={{ color: "#fff", fontSize: 21, fontWeight: "800", marginTop: 2 }} numberOfLines={1}>{user?.ad_soyad ?? "İstifadəçi"} 👋</Text>
          {user?.sahibkar_ad != null && <Text style={{ color: "rgba(255,255,255,0.8)", marginTop: 4, fontSize: 13 }} numberOfLines={1}>{user.sahibkar_ad}</Text>}
        </LinearGradient>

        {/* KPI MetricCards */}
        {(ozet?.sales || ozet?.products) && (
          <View style={{ marginHorizontal: 16, marginTop: 14, gap: 10 }}>
            {ozet?.sales && (
              <View style={{ flexDirection: "row", gap: 10 }}>
                <MetricCard Icon={TrendingUp} label="Bugün satış" value={formatMoney(ozet.sales.bugun.mebleg)} sub={`${ozet.sales.bugun.count} satış`} tone="success" onPress={() => router.push("/(tabs)/satis")} />
                <MetricCard Icon={Wallet} label="Bu ay" value={formatMoney(ozet.sales.bu_ay.mebleg)} sub={`${ozet.sales.bu_ay.count} satış`} tone="info" onPress={() => router.push("/(tabs)/satis")} />
              </View>
            )}
            <View style={{ flexDirection: "row", gap: 10 }}>
              {ozet?.sales && (
                <MetricCard Icon={AlertTriangle} label="Açıq borc" value={formatMoney(borc)} tone={borc > 0 ? "danger" : "neutral"} onPress={() => router.push("/musteri")} />
              )}
              {ozet?.products && (
                <MetricCard Icon={Boxes} label="Kritik stok" value={String(kritik)} sub={`${ozet.products.toplam_aktiv ?? 0} aktiv məhsul`} tone={kritik > 0 ? "danger" : "success"} onPress={() => router.push("/mehsullar")} />
              )}
            </View>
          </View>
        )}

        {/* Sürətli əməliyyat */}
        <Text style={{ marginHorizontal: 16, marginTop: 22, marginBottom: 12, fontSize: 16, fontWeight: "800", color: C.ink }}>Sürətli əməliyyat</Text>
        <View style={{ paddingHorizontal: 16, gap: 10 }}>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <QuickAction Icon={ScanLine} title="Yeni satış" desc="POS — skan + çek" colors={[C.brand, C.brandDark]} onPress={() => router.push("/pos")} />
            <QuickAction Icon={ShoppingCart} title="Satışlar" desc="Sifariş tarixçəsi" colors={["#2563eb", "#1d4ed8"]} onPress={() => router.push("/(tabs)/satis")} />
          </View>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <QuickAction Icon={Users} title="Müştərilər" desc="CRM + borclar" colors={["#7c3aed", "#6d28d9"]} onPress={() => router.push("/musteri")} />
            <QuickAction Icon={ListTodo} title="Tapşırıqlar" desc="Təyinat + xatırlatma" colors={["#db2777", "#be185d"]} onPress={() => router.push("/tapshiriq")} />
          </View>
        </View>

        {/* Bölmələr */}
        <Text style={{ marginHorizontal: 16, marginTop: 22, marginBottom: 12, fontSize: 16, fontWeight: "800", color: C.ink }}>Bölmələr</Text>
        <ModuleGrid modules={modullar} />
      </ScrollView>
    </Screen>
  );
}
