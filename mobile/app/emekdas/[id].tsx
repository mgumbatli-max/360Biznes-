import React from "react";
import { ScrollView, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { UserCog, Phone, Building2, Wallet } from "lucide-react-native";
import { useEmekdas } from "../../src/features/emekdas/hooks";
import { Card, ErrorState, Screen, Skeleton } from "../../src/components";
import { formatMoney } from "../../src/lib/format";
import { C } from "../../src/theme";

function fmtDate(s?: string | null): string {
  if (!s) return "—";
  const d = new Date(s);
  if (isNaN(d.getTime())) return "—";
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
}
function Field({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row justify-between py-1.5">
      <Text className="text-sub dark:text-subDark text-xs">{label}</Text>
      <Text className="text-ink dark:text-inkDark text-xs font-medium" style={{ maxWidth: "60%", textAlign: "right" }}>{value}</Text>
    </View>
  );
}

export default function EmekdasDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, isLoading, isError, refetch } = useEmekdas(String(id));

  if (isLoading) {
    return (
      <Screen title="Əməkdaş" showBack>
        <View className="px-4 pt-4 gap-3">
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-40 rounded-2xl" />
        </View>
      </Screen>
    );
  }
  if (isError || !data?.emekdas) {
    return (
      <Screen title="Əməkdaş" showBack>
        <ErrorState onRetry={refetch} />
      </Screen>
    );
  }

  const e = data.emekdas;
  const vezife = e.vezife || e.roles?.ad || "Əməkdaş";

  return (
    <Screen title={e.ad_soyad} showBack>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 12 }}>
        <Card>
          <View className="flex-row items-center gap-3">
            <View style={{ width: 52, height: 52, borderRadius: 26 }} className="bg-brand/10 items-center justify-center">
              <Text className="text-brand font-bold text-lg">{e.ad_soyad?.trim()?.charAt(0)?.toUpperCase() || "?"}</Text>
            </View>
            <View className="flex-1">
              <Text className="text-ink dark:text-inkDark font-bold text-base">{e.ad_soyad}</Text>
              <Text className="text-sub dark:text-subDark text-sm mt-0.5">{vezife}</Text>
            </View>
          </View>
        </Card>

        <Card>
          <View className="flex-row items-center gap-2 mb-1"><Phone size={16} color={C.sub} /><Text className="text-ink dark:text-inkDark font-semibold text-sm">Əlaqə</Text></View>
          <Field label="Telefon" value={e.telefon ?? "—"} />
          <Field label="Email" value={e.email ?? "—"} />
          <Field label="Ünvan" value={e.unvan ?? "—"} />
        </Card>

        <Card>
          <View className="flex-row items-center gap-2 mb-1"><Building2 size={16} color={C.sub} /><Text className="text-ink dark:text-inkDark font-semibold text-sm">İş məlumatı</Text></View>
          <Field label="Filial" value={e.filiallar_istifadeciler_default_filial_idTofiliallar?.ad ?? "—"} />
          <Field label="İşə başlama" value={fmtDate(e.ise_baslama)} />
          <Field label="Doğum tarixi" value={fmtDate(e.dogum_tarixi)} />
          <Field label="Son giriş" value={fmtDate(e.son_giris)} />
        </Card>

        <Card>
          <View className="flex-row items-center gap-2 mb-1"><Wallet size={16} color={C.sub} /><Text className="text-ink dark:text-inkDark font-semibold text-sm">Maliyyə</Text></View>
          <Field label="Aylıq maaş" value={formatMoney(Number(e.aylik_maas ?? 0))} />
          <Field label="Bank hesabı" value={e.bank_hesab ?? "—"} />
          <Field label="Bank" value={e.bank_ad ?? "—"} />
          <Field label="FİN" value={e.fin_kod ?? "—"} />
        </Card>
      </ScrollView>
    </Screen>
  );
}
