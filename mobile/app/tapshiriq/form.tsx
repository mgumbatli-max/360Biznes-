import React, { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { useCreateTask, useAssignableUsers } from "../../src/features/tapshiriq/hooks";
import type { CreateTaskBody, TaskPriority } from "../../src/features/tapshiriq/types";
import { Button, Input, Screen } from "../../src/components";
import { C } from "../../src/theme";

const PRIO: { v: TaskPriority; label: string; color: string }[] = [
  { v: "asagi", label: "Aşağı", color: C.sub },
  { v: "normal", label: "Normal", color: C.brand },
  { v: "yuksek", label: "Yüksək", color: C.warn },
  { v: "tecili", label: "Təcili", color: C.neg },
];

function endOfDay(d: Date) { d.setHours(23, 59, 0, 0); return d; }
function isoIn(opt: string): string {
  const now = new Date();
  switch (opt) {
    case "today": return endOfDay(new Date()).toISOString();
    case "tomorrow": { const d = new Date(); d.setDate(d.getDate() + 1); return endOfDay(d).toISOString(); }
    case "3days": { const d = new Date(); d.setDate(d.getDate() + 3); return endOfDay(d).toISOString(); }
    case "1h": { now.setHours(now.getHours() + 1); return now.toISOString(); }
    case "eve": { const d = new Date(); d.setHours(19, 0, 0, 0); return d.toISOString(); }
    case "morn": { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0); return d.toISOString(); }
    default: return "";
  }
}

function Chips<T extends string>({ options, value, onChange }: { options: { v: T; label: string; color?: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <View className="flex-row flex-wrap gap-2">
      {options.map((o) => {
        const on = value === o.v;
        return (
          <Pressable key={o.v} onPress={() => onChange(o.v)} className="rounded-full px-3.5 py-1.5" style={{ backgroundColor: on ? (o.color ?? C.brand) : C.bg, borderWidth: 1, borderColor: on ? (o.color ?? C.brand) : C.line }}>
            <Text className="text-xs font-medium" style={{ color: on ? "#fff" : C.sub }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function TapshiriqFormScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const create = useCreateTask();
  const { data: users } = useAssignableUsers();

  const [basliq, setBasliq] = useState("");
  const [tesvir, setTesvir] = useState("");
  const [prioritet, setPrioritet] = useState<TaskPriority>("normal");
  const [mesulId, setMesulId] = useState<string>("");
  const [deadline, setDeadline] = useState("");
  const [remind, setRemind] = useState("");
  const [error, setError] = useState<string | null>(null);

  const canSave = basliq.trim().length >= 2 && !create.isPending;

  async function onSubmit() {
    setError(null);
    if (basliq.trim().length < 2) { setError("Başlıq ən az 2 simvol"); return; }
    const body: CreateTaskBody = {
      basliq: basliq.trim(),
      tesvir: tesvir.trim() || undefined,
      prioritet,
      mesul_id: mesulId || undefined,
      deadline: deadline ? isoIn(deadline) : undefined,
      xatirlatma: remind ? isoIn(remind) : undefined,
    };
    try {
      const res = await create.mutateAsync(body);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const r = res as any;
      if (r?.error) { setError(String(r.error)); return; }
      await qc.invalidateQueries({ queryKey: ["tapshiriqlar"] });
      router.back();
    } catch {
      setError("Tapşırıq yaradılmadı. Yenidən cəhd edin.");
    }
  }

  return (
    <Screen title="Yeni tapşırıq" showBack>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
        {error ? <View className="bg-neg/10 rounded-xl px-3 py-2 mb-3"><Text className="text-neg text-sm">{error}</Text></View> : null}

        <View className="gap-4">
          <Input label="Başlıq *" placeholder="Tapşırıq başlığı" value={basliq} onChangeText={setBasliq} autoFocus />
          <Input label="Təsvir" placeholder="Ətraflı (istəyə görə)" value={tesvir} onChangeText={setTesvir} multiline numberOfLines={3} style={{ minHeight: 72, textAlignVertical: "top" }} />

          <View>
            <Text className="text-sub text-xs font-semibold mb-1.5">Prioritet</Text>
            <Chips options={PRIO} value={prioritet} onChange={setPrioritet} />
          </View>

          <View>
            <Text className="text-sub text-xs font-semibold mb-1.5">Kimə tapşırılsın</Text>
            <View className="flex-row flex-wrap gap-2">
              <Pressable onPress={() => setMesulId("")} className="rounded-full px-3.5 py-1.5" style={{ backgroundColor: mesulId === "" ? C.brand : C.bg, borderWidth: 1, borderColor: mesulId === "" ? C.brand : C.line }}>
                <Text className="text-xs font-medium" style={{ color: mesulId === "" ? "#fff" : C.sub }}>Özümə</Text>
              </Pressable>
              {(users ?? []).map((u) => {
                const on = mesulId === u.id;
                return (
                  <Pressable key={u.id} onPress={() => setMesulId(u.id)} className="rounded-full px-3.5 py-1.5" style={{ backgroundColor: on ? C.brand : C.bg, borderWidth: 1, borderColor: on ? C.brand : C.line }}>
                    <Text className="text-xs font-medium" style={{ color: on ? "#fff" : C.sub }}>{u.ad_soyad}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View>
            <Text className="text-sub text-xs font-semibold mb-1.5">Son tarix</Text>
            <Chips options={[{ v: "", label: "Yox" }, { v: "today", label: "Bu gün" }, { v: "tomorrow", label: "Sabah" }, { v: "3days", label: "+3 gün" }]} value={deadline} onChange={setDeadline} />
          </View>

          <View>
            <Text className="text-sub text-xs font-semibold mb-1.5">Xatırlatma</Text>
            <Chips options={[{ v: "", label: "Yox" }, { v: "1h", label: "1 saat sonra" }, { v: "eve", label: "Bu gün axşam" }, { v: "morn", label: "Sabah səhər" }]} value={remind} onChange={setRemind} />
          </View>
        </View>

        <View className="mt-6">
          <Button title="Tapşırıq yarat" onPress={onSubmit} loading={create.isPending} disabled={!canSave} />
        </View>
      </ScrollView>
    </Screen>
  );
}
