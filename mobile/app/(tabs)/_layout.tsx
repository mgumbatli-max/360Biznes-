import React from "react";
import { Pressable } from "react-native";
import { Tabs, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { LayoutDashboard, ShoppingCart, Sparkles, Package, LayoutGrid } from "lucide-react-native";
import { C, AI_GRADIENT } from "../../src/theme";

/** Mərkəzi AI — qabarıq bənövşəyi dairə (web Lite nav ilə uyğun). */
function CenterAI() {
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.push("/ai")}
      style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1, flex: 1, alignItems: "center", justifyContent: "center" })}
      accessibilityRole="button"
      accessibilityLabel="Süni İntellekt"
    >
      <LinearGradient
        colors={AI_GRADIENT}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ width: 54, height: 54, borderRadius: 27, marginTop: -20, alignItems: "center", justifyContent: "center", borderWidth: 3, borderColor: C.bg, shadowColor: C.aiDark, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 6, elevation: 8 }}
      >
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
      <Tabs.Screen
        name="index"
        options={{ title: "Əsas", tabBarIcon: ({ color, size }) => <LayoutDashboard color={color} size={size} strokeWidth={2} /> }}
      />
      <Tabs.Screen
        name="satis"
        options={{ title: "Satış", tabBarIcon: ({ color, size }) => <ShoppingCart color={color} size={size} strokeWidth={2} /> }}
      />
      <Tabs.Screen
        name="yeni"
        options={{ title: "", tabBarIcon: () => null, tabBarButton: () => <CenterAI /> }}
      />
      <Tabs.Screen
        name="mehsullar"
        options={{ title: "Anbar", tabBarIcon: ({ color, size }) => <Package color={color} size={size} strokeWidth={2} /> }}
      />
      <Tabs.Screen
        name="menyu"
        options={{ title: "Modullar", tabBarIcon: ({ color, size }) => <LayoutGrid color={color} size={size} strokeWidth={2} /> }}
      />
    </Tabs>
  );
}
