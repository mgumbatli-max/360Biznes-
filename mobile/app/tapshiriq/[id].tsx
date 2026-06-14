import React from "react";
import { ScrollView, Text, View, Pressable } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { Clock, Bell, Flag, CheckCircle2, Play, X } from "lucide-react-native";
import { useTask, useChangeTaskStatus } from "../../src/features/tapshiriq/hooks";
import type { TaskStatus } from "../../src/features/tapshiriq/types";
import { Card, ErrorState, ListSkeleton, Screen } from "../../src/components";
import { C } from "../../src/theme";

const STATUS_LABEL: Record<string, string> = { yeni: "Yeni", icrada: "İcrada", gozlemede: "Gözləmədə", tamamlandi: "Tamamlandı", legv: "Ləğv" };
const PRIO_LABEL: Record<string, string> = { asagi: "Aşağı", normal: "Normal", yuksek: "Yüksək", tecili: "Təcili" };
const PRIO_COLOR: Record<string, string> = { tecili: C.neg, yuksek: C.warn, normal: C.brand, asagi: C.sub };

export default function TapshiriqDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const qc = useQueryClient();
  const { data, isLoading, isError, refetch } = useTask(String(id));
  const change = useChangeTaskStatus();

  async function setStatus(status: TaskStatus) {
    try {
      await change.mutateAsync({ id: String(id), status });
      await Promise.all([refetch(), qc.invalidateQueries({ queryKey: ["tapshiriqlar"] })]);
    } catch { /* ErrorState refetch düyməsi var */ }
  }

  if (isLoading) return <Screen title="Tapşırıq" showBack><View className="px-4 pt-4"><ListSkeleton count={4} /></View></Screen>;
  if (isError || !data?.task) return <Screen title="Tapşırıq" showBack><ErrorState onRetry={refetch} /></Screen>;

  const t = data.task as Record<string, unknown>;
  const status = String(t.status ?? "yeni");
  const prioritet = String(t.prioritet ?? "normal");
  const deadline = t.deadline ? String(t.deadline) : null;
  const xatirlatma = t.xatirlatma ? String(t.xatirlatma) : null;
  const tesvir = t.tesvir ? String(t.tesvir) : null;
  const done = status === "tamamlandi";

  return (
    <Screen title="Tapşırıq" showBack>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>
        <Card className="mb-3">
          <View className="flex-row items-start gap-2.5">
            <View style={{ width: 10, height: 10, borderRadius: 5, marginTop: 5, backgroundColor: PRIO_COLOR[prioritet] ?? C.sub }} />
            <Text className="text-ink font-bold text-lg flex-1">{String(t.basliq ?? "")}</Text>
          </View>
          <View className="flex-row items-center gap-3 mt-2 flex-wrap">
            <View className="flex-row items-center gap-1"><Flag size={13} color={PRIO_COLOR[prioritet]} /><Text className="text-sub text-xs">{PRIO_LABEL[prioritet] ?? prioritet}</Text></View>
            <Text className={`text-xs font-medium ${done ? "text-pos" : "text-brand"}`}>{STATUS_LABEL[status] ?? status}</Text>
          </View>
          {tesvir ? <Text className="text-sub text-sm mt-3 leading-relaxed">{tesvir}</Text> : null}
        </Card>

        {(deadline || xatirlatma) && (
          <Card className="mb-3">
            {deadline ? (
              <View className="flex-row items-center gap-3 py-1.5"><Clock size={16} color={C.sub} /><Text className="text-ink text-sm flex-1">Son tarix</Text><Text className="text-ink text-sm">{deadline.slice(0, 16).replace("T", " ")}</Text></View>
            ) : null}
            {xatirlatma ? (
              <View className="flex-row items-center gap-3 py-1.5"><Bell size={16} color={C.sub} /><Text className="text-ink text-sm flex-1">Xatırlatma</Text><Text className="text-ink text-sm">{xatirlatma.slice(0, 16).replace("T", " ")}</Text></View>
            ) : null}
          </Card>
        )}

        {/* Status əməliyyatları */}
        <View className="gap-2 mt-1">
          {status !== "icrada" && !done ? (
            <Pressable onPress={() => setStatus("icrada")} disabled={change.isPending} className="flex-row items-center justify-center gap-2 rounded-xl py-3" style={{ backgroundColor: C.brand, opacity: change.isPending ? 0.6 : 1 }}>
              <Play size={18} color="#fff" /><Text className="text-white font-semibold text-sm">İcraya başla</Text>
            </Pressable>
          ) : null}
          {!done ? (
            <Pressable onPress={() => setStatus("tamamlandi")} disabled={change.isPending} className="flex-row items-center justify-center gap-2 rounded-xl py-3" style={{ backgroundColor: C.pos, opacity: change.isPending ? 0.6 : 1 }}>
              <CheckCircle2 size={18} color="#fff" /><Text className="text-white font-semibold text-sm">Tamamla</Text>
            </Pressable>
          ) : (
            <Pressable onPress={() => setStatus("yeni")} disabled={change.isPending} className="flex-row items-center justify-center gap-2 rounded-xl py-3" style={{ backgroundColor: C.bg, borderWidth: 1, borderColor: C.line, opacity: change.isPending ? 0.6 : 1 }}>
              <Play size={18} color={C.sub} /><Text className="text-sub font-semibold text-sm">Yenidən aç</Text>
            </Pressable>
          )}
          {status !== "legv" ? (
            <Pressable onPress={() => setStatus("legv")} disabled={change.isPending} className="flex-row items-center justify-center gap-2 rounded-xl py-3" style={{ borderWidth: 1, borderColor: C.line, opacity: change.isPending ? 0.6 : 1 }}>
              <X size={18} color={C.neg} /><Text className="text-neg font-semibold text-sm">Ləğv et</Text>
            </Pressable>
          ) : null}
        </View>
      </ScrollView>
    </Screen>
  );
}
