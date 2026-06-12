import React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Package, Plus, ScanLine } from "lucide-react-native";
import { Screen } from "../../src/components";
import { useAuth } from "../../src/lib/auth-store";
import { C } from "../../src/theme";

type Tile = {
  label: string;
  icon: React.ReactNode;
  onPress: () => void;
};

export default function HomeScreen() {
  const router = useRouter();
  const user = useAuth((s) => s.user);

  const tiles: Tile[] = [
    {
      label: "Məhsullar",
      icon: <Package size={28} color={C.brand} strokeWidth={1.8} />,
      onPress: () => router.push("/(tabs)/mehsullar"),
    },
    {
      label: "Yeni məhsul",
      icon: <Plus size={28} color={C.brand} strokeWidth={1.8} />,
      onPress: () => router.push("/mehsul/form"),
    },
    {
      label: "Skan",
      icon: <ScanLine size={28} color={C.brand} strokeWidth={1.8} />,
      onPress: () => router.push("/mehsul/form?scan=1"),
    },
  ];

  return (
    <Screen>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Greeting card with gradient */}
        <LinearGradient
          colors={[C.brand, C.brandDark]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            marginHorizontal: 16,
            marginTop: 16,
            borderRadius: 20,
            padding: 20,
          }}
        >
          <Text
            style={{ color: "#fff", fontSize: 22, fontWeight: "700" }}
            numberOfLines={1}
          >
            Salam, {user?.ad_soyad ?? "İstifadəçi"} 👋
          </Text>
          {user?.sahibkar_ad != null && (
            <Text
              style={{ color: "rgba(255,255,255,0.8)", marginTop: 4, fontSize: 14 }}
              numberOfLines={1}
            >
              {user.sahibkar_ad}
            </Text>
          )}
        </LinearGradient>

        {/* Quick action tiles */}
        <Text
          style={{
            marginHorizontal: 16,
            marginTop: 24,
            marginBottom: 12,
            fontSize: 15,
            fontWeight: "700",
            color: C.ink,
          }}
        >
          Sürətli əməliyyat
        </Text>
        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            marginHorizontal: 12,
            gap: 10,
          }}
        >
          {tiles.map((tile) => (
            <Pressable
              key={tile.label}
              onPress={tile.onPress}
              style={({ pressed }) => ({
                opacity: pressed ? 0.8 : 1,
                backgroundColor: "#fff",
                borderRadius: 16,
                borderWidth: 1,
                borderColor: C.line,
                padding: 16,
                alignItems: "center",
                width: "45%",
                gap: 10,
              })}
            >
              <View
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 14,
                  backgroundColor: C.brand + "1a",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {tile.icon}
              </View>
              <Text
                style={{
                  color: C.ink,
                  fontWeight: "600",
                  fontSize: 13,
                  textAlign: "center",
                }}
              >
                {tile.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </Screen>
  );
}
