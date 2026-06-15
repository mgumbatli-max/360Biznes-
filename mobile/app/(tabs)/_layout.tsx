import React from "react";
import { Pressable, Text, View } from "react-native";
import { Tabs, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { LayoutDashboard, ScanLine, Sparkles, ListTodo, LayoutGrid } from "lucide-react-native";
import { C, BRAND_GRADIENT } from "../../src/theme";

type LucideIcon = React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

/** Tab yerinə başqa route-a aparan düymə (POS, Tapşırıq — feature ekranlarıdır). */
function NavBtn({ Icon, label, route }: { Icon: LucideIcon; label: string; route: string }) {
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.push(route as never)}
      style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 7, gap: 3 })}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Icon size={21} color={C.sub} strokeWidth={2} />
      <Text style={{ fontSize: 10, color: C.sub, fontWeight: "500" }}>{label}</Text>
    </Pressable>
  );
}

/** Mərkəzi AI — qabarıq yaşıl brend dairə (web bottom-nav ilə eyni). */
function CenterAI() {
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.push("/ai")}
      style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1, flex: 1, alignItems: "center", justifyContent: "center" })}
      accessibilityRole="button"
      accessibilityLabel="Süni İntellekt"
    >
      <LinearGradient colors={BRAND_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: 54, height: 54, borderRadius: 27, marginTop: -20, alignItems: "center", justifyContent: "center", borderWidth: 3, borderColor: C.bg, shadowColor: C.brandDark, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 6, elevation: 8 }}>
        <Sparkles color="#fff" size={25} strokeWidth={2.2} />
      </LinearGradient>
    </Pressable>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: C.brand,
        tabBarInactiveTintColor: C.sub,
        tabBarStyle: { borderTopColor: C.line, backgroundColor: C.card, height: 60, paddingBottom: 8, paddingTop: 6 },
        tabBarLabelStyle: { fontSize: 10 },
      }}
    >
      {/* 1) Əsas */}
      <Tabs.Screen name="index" options={{ title: "Əsas", tabBarIcon: ({ color, size }) => <LayoutDashboard color={color} size={size} strokeWidth={2} /> }} />
      {/* 2) POS (satis slotu — /pos-a aparır) */}
      <Tabs.Screen name="satis" options={{ title: "POS", tabBarButton: () => <NavBtn Icon={ScanLine} label="POS" route="/pos" /> }} />
      {/* 3) AI (mərkəz) */}
      <Tabs.Screen name="yeni" options={{ title: "", tabBarIcon: () => null, tabBarButton: () => <CenterAI /> }} />
      {/* 4) Tapşırıq (mehsullar slotu — /tapshiriq-ə aparır) */}
      <Tabs.Screen name="mehsullar" options={{ title: "Tapşırıq", tabBarButton: () => <NavBtn Icon={ListTodo} label="Tapşırıq" route="/tapshiriq" /> }} />
      {/* 5) Modullar */}
      <Tabs.Screen name="menyu" options={{ title: "Modullar", tabBarIcon: ({ color, size }) => <LayoutGrid color={color} size={size} strokeWidth={2} /> }} />
    </Tabs>
  );
}
