import React, { useState, useRef, useEffect, useMemo } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { Send, Sparkles, Trash2, ShieldCheck } from "lucide-react-native";
import { useAiHistory, useAiSend, useAiClear } from "../../src/features/ai/hooks";
import type { AiBubble } from "../../src/features/ai/types";
import { ErrorState, ListSkeleton, Screen } from "../../src/components";
import { C } from "../../src/theme";

function msgTime(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

const SUGGEST_OWNER = [
  "Bu günkü satış nə qədərdir?",
  "Kim mənə borcludur?",
  "Kritik stokda nə var?",
  "Bu ayın TOP məhsulları",
];
const SUGGEST_EMP = [
  "Mənim bu ayki satışım?",
  "Açıq tapşırıqlarım hansılardır?",
  "Anbarda kritik stok varmı?",
  "Satış texnikası məsləhəti ver",
];

function Bubble({ item }: { item: AiBubble }) {
  const mine = item.role === "user";
  return (
    <View style={{ paddingHorizontal: 12, marginBottom: 7, alignItems: mine ? "flex-end" : "flex-start" }}>
      {!mine ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 3, marginLeft: 4 }}>
          <Sparkles size={12} color={C.brand} />
          <Text style={{ color: C.brand, fontSize: 11, fontWeight: "700" }}>AI köməkçi</Text>
        </View>
      ) : null}
      <View
        style={{
          maxWidth: "86%",
          backgroundColor: mine ? C.brand : "#fff",
          borderRadius: 16,
          borderBottomRightRadius: mine ? 4 : 16,
          borderBottomLeftRadius: mine ? 16 : 4,
          paddingHorizontal: 13,
          paddingVertical: 9,
          borderWidth: mine ? 0 : 1,
          borderColor: C.line,
        }}
      >
        {item.pending ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 2 }}>
            <ActivityIndicator size="small" color={C.brand} />
            <Text style={{ color: C.sub, fontSize: 14 }}>düşünür…</Text>
          </View>
        ) : (
          <Text style={{ color: mine ? "#fff" : C.ink, fontSize: 14.5, lineHeight: 21 }}>{item.text}</Text>
        )}
        {!item.pending ? (
          <Text style={{ color: mine ? "rgba(255,255,255,0.7)" : C.sub, fontSize: 10, marginTop: 4, alignSelf: "flex-end" }}>
            {msgTime(item.yaradildi)}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

export default function AiScreen() {
  const qc = useQueryClient();
  const { data, isLoading, isError, refetch } = useAiHistory();
  const send = useAiSend();
  const clear = useAiClear();
  const [text, setText] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const listRef = useRef<FlatList<AiBubble>>(null);

  const turns = data?.messages ?? [];
  const isOwner = data?.canOwner ?? false;
  const isMock = data?.is_mock ?? false;

  const bubbles = useMemo<AiBubble[]>(() => {
    const out: AiBubble[] = [];
    for (const t of turns) {
      out.push({ key: `t${t.id}u`, role: "user", text: t.prompt, yaradildi: t.yaradildi });
      out.push({ key: `t${t.id}a`, role: "assistant", text: t.cavab, yaradildi: t.yaradildi, is_mock: t.is_mock });
    }
    if (pending != null) {
      out.push({ key: "pu", role: "user", text: pending, yaradildi: null });
      out.push({ key: "pa", role: "assistant", text: "", yaradildi: null, pending: true });
    }
    return out;
  }, [turns, pending]);

  useEffect(() => {
    if (bubbles.length) {
      const t = setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
      return () => clearTimeout(t);
    }
  }, [bubbles.length]);

  async function onSend(override?: string) {
    const m = (override ?? text).trim();
    if (!m || send.isPending) return;
    setErr(null);
    setText("");
    setPending(m);
    try {
      const res = await send.mutateAsync(m);
      if (!res.ok) {
        setErr(res.error);
        setText(m);
      }
      await qc.invalidateQueries({ queryKey: ["ai-history"] });
    } catch {
      setErr("Şəbəkə xətası — yenidən cəhd edin");
      setText(m);
    } finally {
      setPending(null);
    }
  }

  async function onClear() {
    if (clear.isPending || turns.length === 0) return;
    try {
      await clear.mutateAsync();
      await qc.invalidateQueries({ queryKey: ["ai-history"] });
    } catch {
      /* non-fatal */
    }
  }

  if (isLoading) {
    return <Screen title="AI köməkçi" showBack><View className="px-4 pt-4"><ListSkeleton count={5} /></View></Screen>;
  }
  if (isError) {
    return <Screen title="AI köməkçi" showBack><ErrorState onRetry={refetch} /></Screen>;
  }

  const suggestions = isOwner ? SUGGEST_OWNER : SUGGEST_EMP;
  const empty = turns.length === 0 && pending == null;

  return (
    <Screen
      title="AI köməkçi"
      showBack
      scroll={false}
      right={
        turns.length > 0 ? (
          <Pressable onPress={onClear} hitSlop={8} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, padding: 4 })} accessibilityLabel="Söhbəti sil">
            <Trash2 size={20} color={C.sub} />
          </Pressable>
        ) : null
      }
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
      >
        <View style={{ flex: 1, backgroundColor: C.bg }}>
          {/* Rejim zolağı */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 7, backgroundColor: isOwner ? C.brand50 : "#fff", borderBottomWidth: 1, borderBottomColor: C.line }}>
            <ShieldCheck size={14} color={isOwner ? C.brand : C.sub} />
            <Text style={{ color: isOwner ? C.brandDark : C.sub, fontSize: 12, fontWeight: "600" }}>
              {isOwner ? "Sahibkar rejimi — tam giriş + əməliyyatlar" : "Əməkdaş rejimi — şəxsi performans"}
            </Text>
            {isMock ? (
              <Text style={{ marginLeft: "auto", color: C.warn, fontSize: 10, fontWeight: "700" }}>DEMO</Text>
            ) : null}
          </View>

          {empty ? (
            <View style={{ flex: 1, justifyContent: "center", paddingHorizontal: 24 }}>
              <View style={{ alignItems: "center", marginBottom: 24 }}>
                <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: C.brand + "1a", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
                  <Sparkles size={30} color={C.brand} />
                </View>
                <Text style={{ color: C.ink, fontSize: 17, fontWeight: "700" }}>AI köməkçiniz hazırdır</Text>
                <Text style={{ color: C.sub, fontSize: 13, textAlign: "center", marginTop: 5, lineHeight: 19 }}>
                  {isOwner
                    ? "Biznesiniz haqqında istənilən sual verin — satış, borc, stok, hətta əməliyyat (qiymət dəyiş, tapşırıq yarat)."
                    : "Şəxsi performans, tapşırıqlar və anbar üzrə sual verin."}
                </Text>
              </View>
              <View style={{ gap: 8 }}>
                {suggestions.map((s) => (
                  <Pressable
                    key={s}
                    onPress={() => onSend(s)}
                    style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, flexDirection: "row", alignItems: "center", gap: 8 })}
                  >
                    <Sparkles size={15} color={C.brand} />
                    <Text style={{ color: C.ink, fontSize: 14, flex: 1 }}>{s}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : (
            <FlatList<AiBubble>
              ref={listRef}
              data={bubbles}
              keyExtractor={(b) => b.key}
              renderItem={({ item }) => <Bubble item={item} />}
              contentContainerStyle={{ paddingVertical: 12 }}
              onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
              keyboardShouldPersistTaps="handled"
            />
          )}

          {err ? (
            <Text style={{ color: C.neg, fontSize: 12, paddingHorizontal: 14, paddingBottom: 4 }}>{err}</Text>
          ) : null}

          {/* Input bar */}
          <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8, paddingHorizontal: 10, paddingVertical: 8, paddingBottom: Platform.OS === "ios" ? 8 : 10, backgroundColor: C.card, borderTopWidth: 1, borderTopColor: C.line }}>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder="AI-ya sual verin…"
              placeholderTextColor={C.sub}
              multiline
              editable={!send.isPending}
              style={{ flex: 1, maxHeight: 120, minHeight: 42, backgroundColor: C.bg, borderRadius: 22, paddingHorizontal: 16, paddingVertical: 10, fontSize: 15, color: C.ink }}
            />
            <Pressable
              onPress={() => onSend()}
              disabled={!text.trim() || send.isPending}
              style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: text.trim() && !send.isPending ? C.brand : C.line, alignItems: "center", justifyContent: "center" }}
              accessibilityRole="button"
              accessibilityLabel="Göndər"
            >
              {send.isPending ? <ActivityIndicator size="small" color="#fff" /> : <Send size={20} color="#fff" />}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}
