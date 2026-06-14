import React from "react";
import { Linking, ScrollView, Text, View, Pressable } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Phone, MessageCircle, Mail, MapPin, Building2, Receipt } from "lucide-react-native";
import { useCustomer } from "../../src/features/musteri/hooks";
import {
  Card,
  ErrorState,
  ListSkeleton,
  Screen,
} from "../../src/components";
import { formatMoney } from "../../src/lib/format";
import { C } from "../../src/theme";

const QIYMET_LABEL: Record<string, string> = {
  adi: "Adi", perakende: "Pərakəndə", topdan: "Topdan", partnyor: "Partnyor", vip: "VIP",
};

function InfoRow({ icon, value }: { icon: React.ReactNode; value: string }) {
  return (
    <View className="flex-row items-center gap-3 py-2">
      {icon}
      <Text className="text-ink text-sm flex-1">{value}</Text>
    </View>
  );
}

export default function MusteriDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, isLoading, isError, refetch } = useCustomer(String(id));

  if (isLoading) {
    return (
      <Screen title="Müştəri" showBack>
        <View className="px-4 pt-4">
          <ListSkeleton count={5} />
        </View>
      </Screen>
    );
  }
  if (isError || !data?.customer) {
    return (
      <Screen title="Müştəri" showBack>
        <ErrorState onRetry={refetch} />
      </Screen>
    );
  }

  const c = data.customer;
  const sales = data.sales ?? [];
  const tel = c.telefon?.replace(/[^\d+]/g, "");

  return (
    <Screen title="Müştəri" showBack>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>
        {/* Başlıq */}
        <View className="items-center mb-4">
          <View
            style={{ width: 72, height: 72, borderRadius: 36 }}
            className="bg-brand/10 items-center justify-center mb-2"
          >
            <Text className="text-brand font-bold text-2xl">
              {c.ad?.trim()?.charAt(0)?.toUpperCase() || "?"}
            </Text>
          </View>
          <Text className="text-ink font-bold text-lg text-center">{c.ad}</Text>
          {c.qiymet_tipi ? (
            <Text className="text-sub text-xs mt-0.5">
              {QIYMET_LABEL[c.qiymet_tipi] ?? c.qiymet_tipi} qiymət
            </Text>
          ) : null}
        </View>

        {/* Borc / Alacaq */}
        <Card className="flex-row mb-3">
          <View className="flex-1 items-center">
            <Text className={`font-bold text-lg ${c.borc > 0 ? "text-neg" : "text-ink"}`}>
              {formatMoney(c.borc)}
            </Text>
            <Text className="text-sub text-[11px] mt-0.5">Borc</Text>
          </View>
          <View style={{ width: 1 }} className="bg-line" />
          <View className="flex-1 items-center">
            <Text className="text-ink font-bold text-lg">{formatMoney(c.avans)}</Text>
            <Text className="text-sub text-[11px] mt-0.5">Avans</Text>
          </View>
        </Card>

        {/* Əlaqə düymələri */}
        {tel ? (
          <View className="flex-row gap-2 mb-3">
            <Pressable
              onPress={() => Linking.openURL(`tel:${tel}`)}
              className="flex-1 flex-row items-center justify-center gap-2 rounded-xl py-3"
              style={{ backgroundColor: C.brand }}
            >
              <Phone size={18} color="#fff" />
              <Text className="text-white font-semibold text-sm">Zəng et</Text>
            </Pressable>
            <Pressable
              onPress={() => Linking.openURL(`https://wa.me/${tel.replace("+", "")}`)}
              className="flex-1 flex-row items-center justify-center gap-2 rounded-xl py-3"
              style={{ backgroundColor: "#25D366" }}
            >
              <MessageCircle size={18} color="#fff" />
              <Text className="text-white font-semibold text-sm">WhatsApp</Text>
            </Pressable>
          </View>
        ) : null}

        {/* Məlumat */}
        <Card className="mb-3">
          {c.telefon ? <InfoRow icon={<Phone size={16} color={C.sub} />} value={c.telefon} /> : null}
          {c.email ? <InfoRow icon={<Mail size={16} color={C.sub} />} value={c.email} /> : null}
          {c.unvan || c.sheher ? (
            <InfoRow icon={<MapPin size={16} color={C.sub} />} value={[c.unvan, c.sheher].filter(Boolean).join(", ")} />
          ) : null}
          {c.voen ? <InfoRow icon={<Building2 size={16} color={C.sub} />} value={`VÖEN: ${c.voen}`} /> : null}
          {c.qeyd ? (
            <View className="pt-2 mt-1 border-t border-line">
              <Text className="text-sub text-xs">{c.qeyd}</Text>
            </View>
          ) : null}
        </Card>

        {/* Son satışlar */}
        {sales.length > 0 ? (
          <View>
            <Text className="text-ink font-semibold text-sm mb-2">Son satışlar</Text>
            {sales.slice(0, 15).map((s, i) => (
              <Card key={String(s.sale_id ?? i)} className="flex-row items-center gap-3 mb-2">
                <Receipt size={18} color={C.sub} />
                <View className="flex-1">
                  <Text className="text-ink text-sm" numberOfLines={1}>
                    {s.nomre ? `№ ${s.nomre}` : "Satış"}
                  </Text>
                  {s.tarix ? (
                    <Text className="text-sub text-xs mt-0.5">
                      {String(s.tarix).slice(0, 10)}
                    </Text>
                  ) : null}
                </View>
                {typeof s.cemi === "number" ? (
                  <Text className="text-ink font-semibold text-sm">{formatMoney(s.cemi)}</Text>
                ) : null}
              </Card>
            ))}
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}
