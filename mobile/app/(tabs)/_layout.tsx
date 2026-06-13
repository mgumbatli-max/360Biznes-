import React from "react";
import { Pressable, View } from "react-native";
import { Tabs, useRouter } from "expo-router";
import {
  Home,
  ShoppingCart,
  Plus,
  Bell,
  Menu,
} from "lucide-react-native";
import { C } from "../../src/theme";

function CenterFAB() {
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.push("/mehsul/form")}
      style={({ pressed }) => ({
        opacity: pressed ? 0.85 : 1,
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
      })}
      accessibilityRole="button"
      accessibilityLabel="Yeni məhsul"
    >
      <View
        style={{
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: C.brand,
          alignItems: "center",
          justifyContent: "center",
          marginTop: -20,
          shadowColor: C.brandDark,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.35,
          shadowRadius: 6,
          elevation: 6,
        }}
      >
        <Plus color="#fff" size={26} strokeWidth={2.5} />
      </View>
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
        tabBarStyle: {
          borderTopColor: C.line,
          height: 60,
          paddingBottom: 8,
          paddingTop: 6,
        },
        tabBarLabelStyle: { fontSize: 11 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Ana",
          tabBarIcon: ({ color, size }) => (
            <Home color={color} size={size} strokeWidth={2} />
          ),
        }}
      />
      <Tabs.Screen
        name="satis"
        options={{
          title: "Satış",
          tabBarIcon: ({ color, size }) => (
            <ShoppingCart color={color} size={size} strokeWidth={2} />
          ),
        }}
      />
      <Tabs.Screen
        name="yeni"
        options={{
          title: "",
          tabBarIcon: () => null,
          tabBarButton: () => <CenterFAB />,
        }}
      />
      <Tabs.Screen
        name="bildiris"
        options={{
          title: "Bildiriş",
          tabBarIcon: ({ color, size }) => (
            <Bell color={color} size={size} strokeWidth={2} />
          ),
        }}
      />
      <Tabs.Screen
        name="menyu"
        options={{
          title: "Menyu",
          tabBarIcon: ({ color, size }) => (
            <Menu color={color} size={size} strokeWidth={2} />
          ),
        }}
      />
      {/* mehsullar — tab bar-da görünməsin, yalnız naviqasiya üçün */}
      <Tabs.Screen
        name="mehsullar"
        options={{ href: null }}
      />
    </Tabs>
  );
}
