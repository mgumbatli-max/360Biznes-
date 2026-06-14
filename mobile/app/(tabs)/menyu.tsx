import React from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { ChevronRight, LogOut, Settings, User, Users, Package, Wallet, ShoppingCart, ListTodo, MessageSquare } from "lucide-react-native";
import { Screen, Card } from "../../src/components";
import { useAuth } from "../../src/lib/auth-store";
import { useAppModeStore } from "../../src/lib/app-mode-store";
import { api } from "../../src/lib/api";
import { C } from "../../src/theme";

function getInitials(name?: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(" ").filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

type MenuRowProps = {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
  danger?: boolean;
};

function MenuRow({ icon, label, onPress, danger = false }: MenuRowProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        opacity: pressed ? 0.7 : 1,
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: C.line,
        backgroundColor: "#fff",
      })}
      accessibilityRole="button"
    >
      <View style={{ marginRight: 14 }}>{icon}</View>
      <Text
        style={{
          flex: 1,
          fontSize: 15,
          fontWeight: "500",
          color: danger ? C.neg : C.ink,
        }}
      >
        {label}
      </Text>
      <ChevronRight size={18} color={C.sub} strokeWidth={2} />
    </Pressable>
  );
}

export default function MenyuScreen() {
  const router = useRouter();
  const user = useAuth((s) => s.user);
  const mode = useAppModeStore((s) => s.mode);
  const setMode = useAppModeStore((s) => s.setMode);

  const onLogout = async () => {
    const rt = useAuth.getState().refresh;
    try {
      if (rt) await api.post("/auth/logout", { refreshToken: rt });
    } catch {}
    await useAuth.getState().clear();
    router.replace("/(auth)/login");
  };

  const confirmLogout = () => {
    Alert.alert(
      "Çıxış",
      "Hesabdan çıxmaq istəyirsiniz?",
      [
        { text: "Xeyr", style: "cancel" },
        { text: "Bəli, çıxış", style: "destructive", onPress: onLogout },
      ],
      { cancelable: true }
    );
  };

  const initials = getInitials(user?.ad_soyad);

  return (
    <Screen title="Menyu" scroll={false}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Profile card */}
        <View style={{ margin: 16 }}>
          <Card>
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 14 }}
            >
              {/* Avatar circle */}
              <View
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 28,
                  backgroundColor: C.brand,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text
                  style={{
                    color: "#fff",
                    fontSize: 20,
                    fontWeight: "700",
                  }}
                >
                  {initials}
                </Text>
              </View>
              {/* Info */}
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    color: C.ink,
                    fontSize: 16,
                    fontWeight: "700",
                  }}
                  numberOfLines={1}
                >
                  {user?.ad_soyad ?? "İstifadəçi"}
                </Text>
                {user?.email != null && (
                  <Text
                    style={{ color: C.sub, fontSize: 13, marginTop: 2 }}
                    numberOfLines={1}
                  >
                    {user.email}
                  </Text>
                )}
                {user?.rol_ad != null && (
                  <View
                    style={{
                      marginTop: 6,
                      backgroundColor: C.brand + "1a",
                      borderRadius: 20,
                      paddingVertical: 2,
                      paddingHorizontal: 10,
                      alignSelf: "flex-start",
                    }}
                  >
                    <Text
                      style={{
                        color: C.brand,
                        fontSize: 11,
                        fontWeight: "600",
                      }}
                    >
                      {user.rol_ad}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </Card>
        </View>

        {/* Rejim — Lite / Pro */}
        <View style={{ marginHorizontal: 16, marginBottom: 16 }}>
          <Card>
            <Text style={{ color: C.sub, fontSize: 12, fontWeight: "600", marginBottom: 8 }}>
              Rejim
            </Text>
            <View
              style={{
                flexDirection: "row",
                backgroundColor: C.bg,
                borderRadius: 12,
                padding: 4,
              }}
            >
              {(["lite", "pro"] as const).map((m) => (
                <Pressable
                  key={m}
                  onPress={() => setMode(m)}
                  style={{
                    flex: 1,
                    borderRadius: 8,
                    paddingVertical: 8,
                    alignItems: "center",
                    backgroundColor: mode === m ? C.brand : "transparent",
                  }}
                  accessibilityRole="button"
                >
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: "600",
                      color: mode === m ? "#fff" : C.sub,
                    }}
                  >
                    {m === "lite" ? "Lite (sadə)" : "Pro (tam)"}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Text style={{ color: C.sub, fontSize: 12, marginTop: 8 }}>
              Lite — yalnız vacib funksiyalar (web ayarlarına görə). Pro — hər şey aktiv.
            </Text>
          </Card>
        </View>

        {/* Modullar */}
        <View
          style={{
            marginHorizontal: 16,
            marginBottom: 16,
            borderRadius: 16,
            overflow: "hidden",
            borderWidth: 1,
            borderColor: C.line,
          }}
        >
          <MenuRow
            icon={<Users size={20} color={C.brand} strokeWidth={2} />}
            label="Müştərilər"
            onPress={() => router.push("/musteri")}
          />
          <MenuRow
            icon={<Package size={20} color={C.brand} strokeWidth={2} />}
            label="Məhsullar"
            onPress={() => router.push("/mehsullar")}
          />
          <MenuRow
            icon={<ShoppingCart size={20} color={C.brand} strokeWidth={2} />}
            label="Satış"
            onPress={() => router.push("/(tabs)/satis")}
          />
          <MenuRow
            icon={<Wallet size={20} color={C.brand} strokeWidth={2} />}
            label="Maliyyə"
            onPress={() => router.push("/maliyye")}
          />
          <MenuRow
            icon={<ListTodo size={20} color={C.brand} strokeWidth={2} />}
            label="Tapşırıqlar"
            onPress={() => router.push("/tapshiriq")}
          />
          <MenuRow
            icon={<MessageSquare size={20} color={C.brand} strokeWidth={2} />}
            label="Söhbətlər (Team)"
            onPress={() => router.push("/team")}
          />
        </View>

        {/* Menu rows */}
        <View
          style={{
            marginHorizontal: 16,
            borderRadius: 16,
            overflow: "hidden",
            borderWidth: 1,
            borderColor: C.line,
          }}
        >
          <MenuRow
            icon={<User size={20} color={C.sub} strokeWidth={2} />}
            label="Profil"
            onPress={() =>
              Alert.alert("Tezliklə", "Bu bölmə hazırlanır.")
            }
          />
          <MenuRow
            icon={<Settings size={20} color={C.sub} strokeWidth={2} />}
            label="Ayarlar"
            onPress={() =>
              Alert.alert("Tezliklə", "Bu bölmə hazırlanır.")
            }
          />
          <Pressable
            onPress={confirmLogout}
            style={({ pressed }) => ({
              opacity: pressed ? 0.7 : 1,
              flexDirection: "row",
              alignItems: "center",
              paddingVertical: 14,
              paddingHorizontal: 16,
              backgroundColor: "#fff",
            })}
            accessibilityRole="button"
          >
            <View style={{ marginRight: 14 }}>
              <LogOut size={20} color={C.neg} strokeWidth={2} />
            </View>
            <Text
              style={{
                flex: 1,
                fontSize: 15,
                fontWeight: "500",
                color: C.neg,
              }}
            >
              Çıxış
            </Text>
            <ChevronRight size={18} color={C.neg} strokeWidth={2} />
          </Pressable>
        </View>
      </ScrollView>
    </Screen>
  );
}
