import React from "react";
import { ScrollView, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { User, Warehouse, Package } from "lucide-react-native";
import { useSale } from "../../src/features/satis/hooks";
import { Card, ErrorState, ListSkeleton, Screen } from "../../src/components";
import { formatMoney, formatNumber } from "../../src/lib/format";
import { C } from "../../src/theme";

const STATUS_LABEL: Record<string, string> = {
  tamamlandi: "Tamamlandı", qaralama: "Qaralama", legv: "Ləğv",
  qaytarildi: "Qaytarıldı", kreditde: "Kreditdə",
};

function Row({ label, value, tone }: { label: string; value: string; tone?: "neg" | "pos" }) {
  return (
    <View className="flex-row justify-between py-1.5">
      <Text className="text-sub dark:text-subDark text-sm">{label}</Text>
      <Text className={`text-sm font-semibold ${tone === "neg" ? "text-neg" : "text-ink dark:text-inkDark"}`}>{value}</Text>
    </View>
  );
}

export default function SatisDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, isLoading, isError, refetch } = useSale(String(id));

  if (isLoading) {
    return (
      <Screen title="Satış" showBack>
        <View className="px-4 pt-4"><ListSkeleton count={5} /></View>
      </Screen>
    );
  }
  if (isError || !data?.sale) {
    return <Screen title="Satış" showBack><ErrorState onRetry={refetch} /></Screen>;
  }

  const s = data.sale;
  const lines = s.satis_sifaris_satirlari ?? [];
  const odenilmis = Number(s.odenilmis ?? 0);
  const son = Number(s.son_mebleg ?? 0);
  const borc = son - odenilmis;

  return (
    <Screen title={`Satış № ${s.nomre ?? ""}`} showBack>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>
        {/* Başlıq */}
        <View className="items-center mb-4">
          <Text className="text-ink dark:text-inkDark font-bold text-2xl">{formatMoney(son)}</Text>
          <Text className="text-sub dark:text-subDark text-xs mt-1">
            {s.tarix ? String(s.tarix).slice(0, 16).replace("T", " ") : ""} · {STATUS_LABEL[s.status ?? ""] ?? s.status}
          </Text>
        </View>

        {/* Müştəri / anbar */}
        <Card className="mb-3">
          <View className="flex-row items-center gap-3 py-1">
            <User size={16} color={C.sub} />
            <Text className="text-ink dark:text-inkDark text-sm flex-1">{s.kontragentler?.ad ?? "Pərakəndə müştəri"}</Text>
            {s.kontragentler?.telefon ? <Text className="text-sub dark:text-subDark text-xs">{s.kontragentler.telefon}</Text> : null}
          </View>
          {s.anbarlar?.ad ? (
            <View className="flex-row items-center gap-3 py-1">
              <Warehouse size={16} color={C.sub} />
              <Text className="text-ink dark:text-inkDark text-sm flex-1">{s.anbarlar.ad}</Text>
            </View>
          ) : null}
        </Card>

        {/* Ödəniş xülasəsi */}
        <Card className="mb-3">
          <Row label="Ümumi" value={formatMoney(Number(s.umumi_mebleg ?? 0))} />
          {Number(s.endirim_mebleg ?? 0) > 0 ? (
            <Row label="Endirim" value={`− ${formatMoney(Number(s.endirim_mebleg))}`} />
          ) : null}
          <Row label="Yekun" value={formatMoney(son)} />
          <Row label="Ödənilmiş" value={formatMoney(odenilmis)} tone="pos" />
          {borc > 0.005 ? <Row label="Qalıq borc" value={formatMoney(borc)} tone="neg" /> : null}
          {s.odenis_nov ? <Row label="Ödəniş növü" value={String(s.odenis_nov)} /> : null}
        </Card>

        {/* Məhsul sətirləri */}
        {lines.length > 0 ? (
          <View>
            <Text className="text-ink dark:text-inkDark font-semibold text-sm mb-2">Məhsullar ({lines.length})</Text>
            {lines.map((ln, i) => (
              <Card key={String(ln.id ?? i)} className="flex-row items-center gap-3 mb-2">
                <Package size={18} color={C.sub} />
                <View className="flex-1">
                  <Text className="text-ink dark:text-inkDark text-sm" numberOfLines={1}>{ln.mehsullar?.ad ?? "Məhsul"}</Text>
                  <Text className="text-sub dark:text-subDark text-xs mt-0.5">
                    {formatNumber(Number(ln.miqdar ?? 0))} × {formatMoney(Number(ln.vahid_qiymet ?? 0))}
                  </Text>
                </View>
                <Text className="text-ink dark:text-inkDark font-semibold text-sm">{formatMoney(Number(ln.cemi ?? 0))}</Text>
              </Card>
            ))}
          </View>
        ) : null}

        {s.qeyd ? (
          <Card className="mt-1">
            <Text className="text-sub dark:text-subDark text-xs">{String(s.qeyd)}</Text>
          </Card>
        ) : null}
      </ScrollView>
    </Screen>
  );
}
