import React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Package, Plus, ScanLine, TrendingUp, Wallet, AlertTriangle, Boxes } from "lucide-react-native";
import { Screen } from "../../src/components";
import { useAuth } from "../../src/lib/auth-store";
import { useAppModeStore } from "../../src/lib/app-mode-store";
import { useAppConfig } from "../../src/features/app-config/hooks";
import { useOzet } from "../../src/features/ozet/hooks";
import { moduleVisible } from "../../src/lib/gating";
import { formatMoney } from "../../src/lib/format";
import { C } from "../../src/theme";

function KpiTile({
  icon, label, value, sub, tone, onPress,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  tone?: "neg";
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        opacity: pressed ? 0.85 : 1,
        flex: 1,
        backgroundColor: "#fff",
        borderRadius: 14,
        borderWidth: 1,
        borderColor: C.line,
        padding: 12,
      })}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        {icon}
        <Text style={{ color: C.sub, fontSize: 11 }} numberOfLines={1}>{label}</Text>
      </View>
      <Text style={{ color: tone === "neg" ? C.neg : C.ink, fontSize: 18, fontWeight: "800", marginTop: 6 }} numberOfLines={1}>
        {value}
      </Text>
      {sub ? <Text style={{ color: C.sub, fontSize: 10, marginTop: 1 }} numberOfLines={1}>{sub}</Text> : null}
    </Pressable>
  );
}

type Tile = {
  label: string;
  icon: React.ReactNode;
  onPress: () => void;
};

export default function HomeScreen() {
  const router = useRouter();
  const user = useAuth((s) => s.user);
  const mode = useAppModeStore((s) => s.mode);
  const { data: appCfg } = useAppConfig();
  const { data: ozet } = useOzet();
  // Anbar/Məhsul modulu Lite-da gizlədilibsə sürətli-əməl tile-ları göstərilmir.
  const anbarOn = moduleVisible(appCfg?.lite, mode, "anbar");

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

        {/* KPI icmal — bu gün/ay satış, açıq borc, kritik stok */}
        {(ozet?.sales || ozet?.products) && (
          <View style={{ marginHorizontal: 12, marginTop: 12, gap: 10 }}>
            {ozet?.sales && (
              <View style={{ flexDirection: "row", gap: 10 }}>
                <KpiTile
                  icon={<TrendingUp size={15} color={C.brand} />}
                  label="Bugün satış"
                  value={formatMoney(ozet.sales.bugun.mebleg)}
                  sub={`${ozet.sales.bugun.count} satış`}
                  onPress={() => router.push("/(tabs)/satis")}
                />
                <KpiTile
                  icon={<Wallet size={15} color={C.brand} />}
                  label="Bu ay"
                  value={formatMoney(ozet.sales.bu_ay.mebleg)}
                  sub={`${ozet.sales.bu_ay.count} satış`}
                  onPress={() => router.push("/(tabs)/satis")}
                />
              </View>
            )}
            <View style={{ flexDirection: "row", gap: 10 }}>
              {ozet?.sales && (
                <KpiTile
                  icon={<AlertTriangle size={15} color={ozet.sales.borc_mebleg > 0 ? C.neg : C.sub} />}
                  label="Açıq borc"
                  value={formatMoney(ozet.sales.borc_mebleg)}
                  tone={ozet.sales.borc_mebleg > 0 ? "neg" : undefined}
                  onPress={() => router.push("/musteri")}
                />
              )}
              {ozet?.products && (
                <KpiTile
                  icon={<Boxes size={15} color={ozet.products.kritik > 0 ? C.neg : C.brand} />}
                  label="Kritik stok"
                  value={String(ozet.products.kritik ?? 0)}
                  sub={`${ozet.products.toplam_aktiv ?? 0} aktiv məhsul`}
                  tone={ozet.products.kritik > 0 ? "neg" : undefined}
                  onPress={() => router.push("/(tabs)/mehsullar")}
                />
              )}
            </View>
          </View>
        )}

        {/* Quick action tiles — Lite-da anbar gizlidirsə göstərilmir */}
        {!anbarOn ? (
          <Text
            style={{
              marginHorizontal: 16,
              marginTop: 24,
              color: C.sub,
              fontSize: 14,
            }}
          >
            Lite rejimində modullar gizlədilib. Menyu → Pro ilə hamısını aça
            bilərsiniz.
          </Text>
        ) : (
          <>
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
          </>
        )}
      </ScrollView>
    </Screen>
  );
}
