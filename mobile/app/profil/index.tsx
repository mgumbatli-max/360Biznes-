import React from "react";
import { Alert, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Mail, Building2, Shield, LogOut } from "lucide-react-native";
import { Button, Card, Screen } from "../../src/components";
import { useAuth } from "../../src/lib/auth-store";
import { api } from "../../src/lib/api";
import { C } from "../../src/theme";

function getInitials(name?: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(" ").filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.line }}>
      <View style={{ width: 38, height: 38, borderRadius: 10, backgroundColor: C.brand + "1a", alignItems: "center", justifyContent: "center" }}>{icon}</View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: C.sub, fontSize: 12 }}>{label}</Text>
        <Text style={{ color: C.ink, fontSize: 15, fontWeight: "600", marginTop: 1 }} numberOfLines={1}>{value}</Text>
      </View>
    </View>
  );
}

export default function ProfilScreen() {
  const router = useRouter();
  const user = useAuth((s) => s.user);
  const initials = getInitials(user?.ad_soyad);

  const onLogout = async () => {
    const rt = useAuth.getState().refresh;
    try { if (rt) await api.post("/auth/logout", { refreshToken: rt }); } catch {}
    await useAuth.getState().clear();
    router.replace("/(auth)/login");
  };
  const confirmLogout = () => {
    Alert.alert("Çıxış", "Hesabdan çıxmaq istəyirsiniz?", [
      { text: "Xeyr", style: "cancel" },
      { text: "Bəli, çıxış", style: "destructive", onPress: onLogout },
    ]);
  };

  return (
    <Screen title="Profil" showBack scroll>
      {/* Avatar + ad */}
      <View style={{ alignItems: "center", marginBottom: 18 }}>
        <View style={{ width: 88, height: 88, borderRadius: 44, backgroundColor: C.brand, alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
          <Text style={{ color: "#fff", fontSize: 32, fontWeight: "800" }}>{initials}</Text>
        </View>
        <Text style={{ color: C.ink, fontSize: 20, fontWeight: "800" }}>{user?.ad_soyad ?? "İstifadəçi"}</Text>
        {user?.rol_ad != null && (
          <View style={{ marginTop: 8, backgroundColor: C.brand + "1a", borderRadius: 20, paddingVertical: 3, paddingHorizontal: 12 }}>
            <Text style={{ color: C.brand, fontSize: 12, fontWeight: "700" }}>{user.rol_ad}</Text>
          </View>
        )}
      </View>

      <Card>
        {user?.email != null && <InfoRow icon={<Mail size={18} color={C.brand} />} label="E-poçt" value={user.email} />}
        {user?.sahibkar_ad != null && <InfoRow icon={<Building2 size={18} color={C.brand} />} label="Şirkət" value={user.sahibkar_ad} />}
        {user?.rol_ad != null && <InfoRow icon={<Shield size={18} color={C.brand} />} label="Rol" value={user.rol_ad} />}
      </Card>

      <View style={{ marginTop: 20 }}>
        <Button title="Hesabdan çıx" variant="outline" icon={<LogOut size={18} color={C.brand} />} onPress={confirmLogout} />
      </View>
    </Screen>
  );
}
