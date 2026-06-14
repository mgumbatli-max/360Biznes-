import React from "react";
import { ScrollView, Text, View } from "react-native";
import { Wallet, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight, Clock } from "lucide-react-native";
import { useFinance } from "../../src/features/maliyye/hooks";
import type { TopRow } from "../../src/features/maliyye/hooks";
import { Card, ErrorState, ListSkeleton, Screen } from "../../src/components";
import { formatMoney } from "../../src/lib/format";
import { C } from "../../src/theme";

function Kpi({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone?: "pos" | "neg" }) {
  return (
    <View style={{ flex: 1 }} className="bg-card dark:bg-cardDark rounded-2xl border border-line dark:border-lineDark p-3">
      <View className="flex-row items-center gap-1.5">
        {icon}
        <Text className="text-sub dark:text-subDark text-[11px]" numberOfLines={1}>{label}</Text>
      </View>
      <Text className={`font-extrabold text-base mt-1.5 ${tone === "neg" ? "text-neg" : tone === "pos" ? "text-pos" : "text-ink dark:text-inkDark"}`} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function PartyList({ title, rows, tone }: { title: string; rows: TopRow[]; tone: "neg" | "pos" }) {
  if (!rows.length) return null;
  return (
    <View className="mt-1">
      <Text className="text-ink dark:text-inkDark font-semibold text-sm mb-2">{title}</Text>
      {rows.map((r, i) => (
        <Card key={`${r.ad}-${i}`} className="flex-row items-center justify-between mb-2">
          <Text className="text-ink dark:text-inkDark text-sm flex-1" numberOfLines={1}>{r.ad}</Text>
          <Text className={`font-bold text-sm ${tone === "neg" ? "text-neg" : "text-pos"}`}>
            {formatMoney(r.mebleg)}
          </Text>
        </Card>
      ))}
    </View>
  );
}

export default function MaliyyeScreen() {
  const { data, isLoading, isError, refetch } = useFinance();

  if (isLoading) {
    return (
      <Screen title="Maliyyə" showBack>
        <View className="px-4 pt-4"><ListSkeleton count={5} /></View>
      </Screen>
    );
  }
  if (isError) {
    return <Screen title="Maliyyə" showBack><ErrorState onRetry={refetch} /></Screen>;
  }
  if (!data?.kpis) {
    return (
      <Screen title="Maliyyə" showBack>
        <View className="px-4 pt-8 items-center">
          <Text className="text-sub dark:text-subDark text-sm text-center">Maliyyə məlumatlarına icazəniz yoxdur.</Text>
        </View>
      </Screen>
    );
  }

  const k = data.kpis;

  return (
    <Screen title="Maliyyə" showBack>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>
        {/* Balans (böyük) */}
        <Card className="mb-3 items-center py-5">
          <View className="flex-row items-center gap-2">
            <Wallet size={18} color={C.brand} />
            <Text className="text-sub dark:text-subDark text-xs">Cari balans (kassa + hesablar)</Text>
          </View>
          <Text className="text-ink dark:text-inkDark font-extrabold text-3xl mt-2">{formatMoney(k.hesab_balans)}</Text>
        </Card>

        {/* KPI grid */}
        <View className="gap-2.5">
          <View className="flex-row gap-2.5">
            <Kpi icon={<TrendingUp size={14} color={C.pos} />} label="Bugün gəlir" value={formatMoney(k.bugun_gelir)} tone="pos" />
            <Kpi icon={<TrendingDown size={14} color={C.neg} />} label="Bugün xərc" value={formatMoney(k.bugun_xerc)} tone="neg" />
          </View>
          <View className="flex-row gap-2.5">
            <Kpi icon={<TrendingUp size={14} color={C.brand} />} label="Ay gəlir" value={formatMoney(k.ay_gelir)} />
            <Kpi icon={<TrendingDown size={14} color={C.sub} />} label="Ay xərc" value={formatMoney(k.ay_xerc)} />
          </View>
          <View className="flex-row gap-2.5">
            <Kpi icon={<Wallet size={14} color={C.brand} />} label="Ay mənfəət" value={formatMoney(k.ay_menfeet)} tone={k.ay_menfeet >= 0 ? "pos" : "neg"} />
            <Kpi icon={<Clock size={14} color={C.sub} />} label="Gözləyən ödəniş" value={String(k.gozleyen_odenis)} />
          </View>
          <View className="flex-row gap-2.5">
            <Kpi icon={<ArrowDownRight size={14} color={C.pos} />} label="Debitor (alacaq)" value={formatMoney(k.debitor_cem)} tone="pos" />
            <Kpi icon={<ArrowUpRight size={14} color={C.neg} />} label="Kreditor (borc)" value={formatMoney(k.kreditor_cem)} tone="neg" />
          </View>
        </View>

        <View className="mt-4">
          <PartyList title="Ən böyük borclular (müştəri)" rows={data.debtors ?? []} tone="pos" />
          <PartyList title="Ən böyük kreditorlar (təchizatçı)" rows={data.creditors ?? []} tone="neg" />
        </View>
      </ScrollView>
    </Screen>
  );
}
