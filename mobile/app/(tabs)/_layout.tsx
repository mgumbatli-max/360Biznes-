import React from "react";
import { Pressable, Text, View } from "react-native";
import { Tabs, useRouter } from "expo-router";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LayoutDashboard, ScanLine, Sparkles, ListTodo, LayoutGrid } from "lucide-react-native";
import { C, AI_GRADIENT } from "../../src/theme";

type LucideIcon = React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

function NavItem({ Icon, label, active, onPress }: { Icon: LucideIcon; label: string; active: boolean; onPress: () => void }) {
  const color = active ? C.brand : C.sub;
  return (
    <Pressable onPress={onPress} style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 7, gap: 3 }} accessibilityRole="button" accessibilityLabel={label}>
      <Icon size={21} color={color} strokeWidth={2} />
      <Text style={{ fontSize: 10, color, fontWeight: active ? "700" : "500" }}>{label}</Text>
    </Pressable>
  );
}

/** Web Lite bottom nav ilə 1-1: Əsas · POS · [✦AI mərkəz] · Tapşırıq · Modullar. */
function LiteTabBar({ state, navigation }: BottomTabBarProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const current = state.routes[state.index]?.name;
  const pad = insets.bottom > 0 ? insets.bottom : 8;

  return (
    <View style={{ flexDirection: "row", alignItems: "flex-end", backgroundColor: C.card, borderTopWidth: 1, borderTopColor: C.line, paddingTop: 6, paddingBottom: pad }}>
      <NavItem Icon={LayoutDashboard} label="Əsas" active={current === "index"} onPress={() => navigation.navigate("index")} />
      <NavItem Icon={ScanLine} label="POS" active={false} onPress={() => router.push("/pos")} />

      {/* Mərkəzi AI — qabarıq bənövşəyi dairə (saytdakı kimi) */}
      <View style={{ flex: 1, alignItems: "center" }}>
        <Pressable onPress={() => router.push("/ai")} style={{ alignItems: "center", justifyContent: "flex-end", height: "100%", paddingBottom: 6 }} accessibilityRole="button" accessibilityLabel="Süni İntellekt">
          <LinearGradient colors={AI_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: "absolute", top: -20, width: 54, height: 54, borderRadius: 27, alignItems: "center", justifyContent: "center", shadowColor: C.aiDark, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 6, elevation: 8, borderWidth: 3, borderColor: C.bg }}>
            <Sparkles size={25} color="#fff" strokeWidth={2.2} />
          </LinearGradient>
          <Text style={{ fontSize: 10, color: C.sub, fontWeight: "500", marginTop: 36 }}>AI</Text>
        </Pressable>
      </View>

      <NavItem Icon={ListTodo} label="Tapşırıq" active={false} onPress={() => router.push("/tapshiriq")} />
      <NavItem Icon={LayoutGrid} label="Modullar" active={current === "menyu"} onPress={() => navigation.navigate("menyu")} />
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <LiteTabBar {...props} />}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="menyu" />
      {/* satis/mehsullar/yeni — bar-da deyil, push/naviqasiya ilə açılır */}
      <Tabs.Screen name="satis" options={{ href: null }} />
      <Tabs.Screen name="mehsullar" options={{ href: null }} />
      <Tabs.Screen name="yeni" options={{ href: null }} />
    </Tabs>
  );
}
