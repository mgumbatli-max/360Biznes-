import React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import {
  Plus, ScanLine, TrendingUp, Wallet, AlertTriangle, Boxes,
  Sparkles, Bell, Search, Settings, ShoppingCart, Users, ListTodo, FileBarChart,
} from "lucide-react-native";
import { Screen } from "../../src/components";
import { useAuth } from "../../src/lib/auth-store";
import { useOzet } from "../../src/features/ozet/hooks";
import { formatMoney } from "../../src/lib/format";
import { C, TONE, AI_GRADIENT, type ToneKey } from "../../src/theme";

type LucideIcon = React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
const NUM = { fontVariant: ["tabular-nums" as const] };

function getInitials(name?: string | null): string {
  if (!name) return "?";
  const p = name.trim().split(" ").filter(Boolean);
  if (p.length === 0) return "?";
  if (p.length === 1) return p[0].charAt(0).toUpperCase();
  return (p[0].charAt(0) + p[p.length - 1].charAt(0)).toUpperCase();
}
function greeting(): { label: string; emoji: string } {
  const h = new Date().getHours();
  if (h < 6) return { label: "Sakit gecələr", emoji: "🌙" };
  if (h < 12) return { label: "Sabahın xeyir", emoji: "☀️" };
  if (h < 17) return { label: "Gününüz xeyir", emoji: "🌤️" };
  if (h < 22) return { label: "Axşamın xeyir", emoji: "🌆" };
  return { label: "Gecəniz xeyirə qalsın", emoji: "🌙" };
}

function IconBtn({ children, onPress, filled = false, danger = false, badge }: { children: React.ReactNode; onPress: () => void; filled?: boolean; danger?: boolean; badge?: number }) {
  const bg = danger ? TONE.danger.bg : filled ? C.brand : C.card;
  const border = danger ? "#fecaca" : filled ? C.brand : C.line;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, width: 38, height: 38, borderRadius: 19, backgroundColor: bg, borderWidth: 1, borderColor: border, alignItems: "center", justifyContent: "center" })}>
      {children}
      {badge != null && badge > 0 ? (
        <View style={{ position: "absolute", top: -3, right: -3, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: C.neg, alignItems: "center", justifyContent: "center", paddingHorizontal: 3, borderWidth: 1.5, borderColor: C.bg }}>
          <Text style={{ color: "#fff", fontSize: 9, fontWeight: "800" }}>{badge > 99 ? "99" : badge}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

function MetricCard({ Icon, label, value, sub, tone = "neutral", onPress }: { Icon: LucideIcon; label: string; value: string; sub?: string; tone?: ToneKey; onPress?: () => void }) {
  const t = TONE[tone];
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1, flex: 1, backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: C.line, paddingHorizontal: 13, paddingVertical: 12, shadowColor: "#141820", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 })}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Text style={{ color: C.sub, fontSize: 11, fontWeight: "600" }} numberOfLines={1}>{label}</Text>
        <View style={{ width: 30, height: 30, borderRadius: 9, backgroundColor: t.bg, alignItems: "center", justifyContent: "center" }}>
          <Icon size={16} color={t.fg} strokeWidth={2.2} />
        </View>
      </View>
      <Text style={{ color: tone === "neutral" ? C.ink : t.fg, fontSize: 20, fontWeight: "800", marginTop: 8, ...NUM }} numberOfLines={1}>{value}</Text>
      {sub ? <Text style={{ color: C.sub, fontSize: 11, marginTop: 1 }} numberOfLines={1}>{sub}</Text> : null}
    </Pressable>
  );
}

function ActionCard({ Icon, title, desc, colors, onPress, full = false }: { Icon: LucideIcon; title: string; desc: string; colors: [string, string]; onPress: () => void; full?: boolean }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1, flex: full ? undefined : 1, width: full ? "100%" : undefined, backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: C.line, padding: 14, shadowColor: "#141820", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 })}>
      <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: 42, height: 42, borderRadius: 12, alignItems: "center", justifyContent: "center", marginBottom: 10 }}>
        <Icon size={21} color="#fff" strokeWidth={2.2} />
      </LinearGradient>
      <Text style={{ color: C.ink, fontSize: 14.5, fontWeight: "700" }}>{title}</Text>
      <Text style={{ color: C.sub, fontSize: 11.5, marginTop: 2 }} numberOfLines={1}>{desc}</Text>
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
  const g = greeting();
  const firstName = (user?.ad_soyad ?? "İstifadəçi").split(" ")[0];
  let today = "";
  try {
    today = new Date().toLocaleDateString("az-AZ", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  } catch {
    const d = new Date();
    today = `${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()}`;
  }

  return (
    <Screen>
      {/* Yuxarı toolbar */}
      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: 4, paddingBottom: 6, gap: 7 }}>
        <Pressable onPress={() => router.push("/profil")} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: C.brand, alignItems: "center", justifyContent: "center", marginRight: "auto" }} accessibilityLabel="Profil">
          <Text style={{ color: "#fff", fontWeight: "800", fontSize: 14 }}>{initials}</Text>
        </Pressable>
        <IconBtn onPress={() => router.push("/mehsullar")}><Search size={18} color={C.ink} /></IconBtn>
        <IconBtn onPress={() => router.push("/ai")} filled><Sparkles size={18} color="#fff" /></IconBtn>
        {kritik > 0 ? <IconBtn onPress={() => router.push("/mehsullar")} danger badge={kritik}><AlertTriangle size={18} color={C.neg} /></IconBtn> : null}
        <IconBtn onPress={() => router.push("/bildiris")}><Bell size={18} color={C.ink} /></IconBtn>
        <IconBtn onPress={() => router.push("/ayarlar")}><Settings size={18} color={C.ink} /></IconBtn>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 28 }} showsVerticalScrollIndicator={false}>
        {/* Salamlama kartı (web dashboard-header üslubu) */}
        <View style={{ marginHorizontal: 16, marginTop: 6, backgroundColor: C.card, borderRadius: 18, borderWidth: 1, borderColor: C.line, padding: 18, shadowColor: "#141820", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", alignSelf: "flex-start", gap: 5, borderWidth: 1, borderColor: C.line, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: C.bg }}>
            <Text style={{ fontSize: 11 }}>{g.emoji}</Text>
            <Text style={{ color: C.sub, fontSize: 10.5, fontWeight: "700", letterSpacing: 0.8, textTransform: "uppercase" }}>{g.label}</Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "flex-end", flexWrap: "wrap", marginTop: 8 }}>
            <Text style={{ color: C.ai, fontSize: 26, fontWeight: "900", letterSpacing: -0.5 }}>{firstName}</Text>
            <Text style={{ fontSize: 22, marginLeft: 4 }}>👋</Text>
            <Text style={{ color: C.sub, fontSize: 13, fontWeight: "500", marginLeft: 8, marginBottom: 4 }}>biznesiniz hazırdır</Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 }}>
            <Text style={{ color: C.sub, fontSize: 12.5, textTransform: "capitalize" }} numberOfLines={1}>{today}</Text>
            {user?.sahibkar_ad ? (
              <>
                <Text style={{ color: C.sub, fontSize: 12 }}>·</Text>
                <Sparkles size={12} color={C.brand} />
                <Text style={{ color: C.ink, fontSize: 12.5, fontWeight: "600" }} numberOfLines={1}>{user.sahibkar_ad}</Text>
              </>
            ) : null}
          </View>
        </View>

        {/* KPI MetricCards */}
        {(ozet?.sales || ozet?.products) && (
          <View style={{ marginHorizontal: 16, marginTop: 14, gap: 10 }}>
            {ozet?.sales && (
              <View style={{ flexDirection: "row", gap: 10 }}>
                <MetricCard Icon={TrendingUp} label="Bugün" value={formatMoney(ozet.sales.bugun.mebleg)} sub={`${ozet.sales.bugun.count} satış`} tone="success" onPress={() => router.push("/(tabs)/satis")} />
                <MetricCard Icon={Wallet} label="Bu ay" value={formatMoney(ozet.sales.bu_ay.mebleg)} sub={`${ozet.sales.bu_ay.count} satış`} tone="info" onPress={() => router.push("/(tabs)/satis")} />
              </View>
            )}
            <View style={{ flexDirection: "row", gap: 10 }}>
              {ozet?.sales && (
                <MetricCard Icon={AlertTriangle} label="Açıq borc" value={formatMoney(borc)} tone={borc > 0 ? "danger" : "neutral"} onPress={() => router.push("/musteri")} />
              )}
              {ozet?.products && (
                <MetricCard Icon={Boxes} label="Kritik stok" value={String(kritik)} sub={`${ozet.products.toplam_aktiv ?? 0} məhsul`} tone={kritik > 0 ? "danger" : "success"} onPress={() => router.push("/mehsullar")} />
              )}
            </View>
          </View>
        )}

        {/* Sürətli əməliyyat */}
        <Text style={{ marginHorizontal: 16, marginTop: 22, marginBottom: 12, fontSize: 16, fontWeight: "800", color: C.ink }}>Sürətli əməliyyat</Text>
        <View style={{ paddingHorizontal: 16, gap: 10 }}>
          <ActionCard full Icon={ScanLine} title="POS aç — Yeni satış" desc="Skan + səbət + çek" colors={[C.brand, C.brandDark]} onPress={() => router.push("/pos")} />
          <View style={{ flexDirection: "row", gap: 10 }}>
            <ActionCard Icon={ShoppingCart} title="Satışlar" desc="Sifariş tarixçəsi" colors={["#2563eb", "#1d4ed8"]} onPress={() => router.push("/(tabs)/satis")} />
            <ActionCard Icon={Users} title="Müştərilər" desc="CRM + borclar" colors={["#7c3aed", "#6d28d9"]} onPress={() => router.push("/musteri")} />
          </View>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <ActionCard Icon={ListTodo} title="Tapşırıqlar" desc="Təyinat + xatırlatma" colors={["#db2777", "#be185d"]} onPress={() => router.push("/tapshiriq")} />
            <ActionCard Icon={FileBarChart} title="Maliyyə" desc="Kassa + hesabat" colors={["#d97706", "#b45309"]} onPress={() => router.push("/maliyye")} />
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}
