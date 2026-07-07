import React from "react";
import { ScrollView, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Wrench, User, Package, Clock } from "lucide-react-native";
import { useServis } from "../../src/features/servis/hooks";
import { Card, ErrorState, Screen, Skeleton, Accordion } from "../../src/components";
import { formatMoney } from "../../src/lib/format";
import { C } from "../../src/theme";

const STATUS_LABEL: Record<string, string> = {
  teklif_gozleyir: "Təklif gözləyir", temir_olunur: "Təmir olunur", diaqnostika: "Diaqnostika",
  hazir: "Hazır", musteriye_tehvil: "Təhvil verildi", redd_edildi: "Rədd edildi", qaytarildi: "Qaytarıldı",
};
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

export default function ServisDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, isLoading, isError, refetch } = useServis(String(id));

  if (isLoading) {
    return (
      <Screen title="Servis detalı" showBack>
        <View className="px-4 pt-4 gap-3">
          <Skeleton className="h-20 rounded-2xl" />
          <Skeleton className="h-32 rounded-2xl" />
        </View>
      </Screen>
    );
  }
  if (isError || !data?.servis) {
    return (
      <Screen title="Servis detalı" showBack>
        <ErrorState onRetry={refetch} />
      </Screen>
    );
  }

  const s = data.servis;
  const statusLabel = STATUS_LABEL[s.status] ?? s.status.replace(/_/g, " ");
  const tarixce = Array.isArray(s.servis_status_tarixce) ? s.servis_status_tarixce : [];

  return (
    <Screen title={s.nomre} showBack>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 12 }}>
        <Card>
          <View className="flex-row items-center gap-2">
            <Wrench size={18} color={C.brand} />
            <Text className="text-ink dark:text-inkDark font-bold text-base flex-1">{s.nomre}</Text>
            <View style={{ backgroundColor: C.brand + "1A", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 }}>
              <Text style={{ color: C.brand, fontSize: 12, fontWeight: "700" }}>{statusLabel}</Text>
            </View>
          </View>
          {s.problem_tesviri ? (
            <Text className="text-sub dark:text-subDark text-sm mt-2">{s.problem_tesviri}</Text>
          ) : null}
        </Card>

        <Card>
          <View className="flex-row items-center gap-2 mb-1">
            <User size={16} color={C.sub} />
            <Text className="text-ink dark:text-inkDark font-semibold text-sm">Müştəri</Text>
          </View>
          <Field label="Ad" value={s.kontragentler?.ad ?? "—"} />
          <Field label="Telefon" value={s.kontragentler?.telefon ?? "—"} />
        </Card>

        <Card>
          <View className="flex-row items-center gap-2 mb-1">
            <Package size={16} color={C.sub} />
            <Text className="text-ink dark:text-inkDark font-semibold text-sm">Məhsul</Text>
          </View>
          <Field label="Ad" value={s.mehsullar?.ad ?? "—"} />
          <Field label="Kod" value={s.mehsullar?.kod ?? "—"} />
          <Field label="Barkod" value={s.mehsullar?.barkod ?? "—"} />
        </Card>

        <Card>
          <Field label="Yaradıldı" value={fmtDate(s.yaradildi)} />
          <Field label="Təxmini təhvil" value={fmtDate(s.texmini_tehvil)} />
          <Field label="Qapanma" value={fmtDate(s.qapanma_tarixi)} />
          <Field label="Təmir xərci" value={formatMoney(Number(s.temir_xerci ?? 0))} />
          <Field label="Müştəridən alınan" value={formatMoney(Number(s.musteriden_alinan ?? 0))} />
        </Card>

        {tarixce.length > 0 ? (
          <Accordion title="Status tarixçəsi" icon={<Clock size={16} color={C.sub} />}>
            <View className="gap-2">
              {tarixce.map((t) => (
                <View key={t.id} className="flex-row justify-between">
                  <Text className="text-ink dark:text-inkDark text-xs">{STATUS_LABEL[t.yeni_status] ?? t.yeni_status.replace(/_/g, " ")}</Text>
                  <Text className="text-sub dark:text-subDark text-xs">{fmtDate(t.yaradildi)}</Text>
                </View>
              ))}
            </View>
          </Accordion>
        ) : null}
      </ScrollView>
    </Screen>
  );
}
