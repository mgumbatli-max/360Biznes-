import React, { useState, useRef, useEffect } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { Send, Users, X } from "lucide-react-native";
import { useChannelMessages, useSendMessage } from "../../src/features/team/hooks";
import type { Message } from "../../src/features/team/types";
import { ErrorState, ListSkeleton, Screen } from "../../src/components";
import { C } from "../../src/theme";

function msgTime(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function Bubble({ item, mine, showName }: { item: Message; mine: boolean; showName: boolean }) {
  return (
    <View style={{ paddingHorizontal: 12, marginBottom: 6, alignItems: mine ? "flex-end" : "flex-start" }}>
      <View
        style={{
          maxWidth: "80%",
          backgroundColor: mine ? C.brand : "#fff",
          borderRadius: 16,
          borderBottomRightRadius: mine ? 4 : 16,
          borderBottomLeftRadius: mine ? 16 : 4,
          paddingHorizontal: 12,
          paddingVertical: 8,
          borderWidth: mine ? 0 : 1,
          borderColor: C.line,
        }}
      >
        {!mine && showName ? (
          <Text style={{ color: C.brand, fontSize: 11, fontWeight: "700", marginBottom: 2 }}>{item.gonderici_ad}</Text>
        ) : null}
        <Text style={{ color: mine ? "#fff" : C.ink, fontSize: 14.5, lineHeight: 20 }}>{item.mesaj}</Text>
        <Text style={{ color: mine ? "rgba(255,255,255,0.7)" : C.sub, fontSize: 10, marginTop: 3, alignSelf: "flex-end" }}>
          {msgTime(item.yaradildi)}
        </Text>
      </View>
    </View>
  );
}

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const qc = useQueryClient();
  const { data, isLoading, isError, refetch } = useChannelMessages(String(id));
  const send = useSendMessage(String(id));
  const [text, setText] = useState("");
  const [membersOpen, setMembersOpen] = useState(false);
  const listRef = useRef<FlatList<Message>>(null);

  const messages = data?.messages ?? [];
  const meId = data?.meId ?? "";
  const members = data?.members ?? [];
  const isGroup = (data?.channel?.novu ?? "direct") !== "direct";

  useEffect(() => {
    if (messages.length) {
      const t = setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
      return () => clearTimeout(t);
    }
  }, [messages.length]);

  async function onSend() {
    const m = text.trim();
    if (!m || send.isPending) return;
    setText("");
    try {
      await send.mutateAsync(m);
      await qc.invalidateQueries({ queryKey: ["team-messages", String(id)] });
      await qc.invalidateQueries({ queryKey: ["team-channels"] });
    } catch {
      setText(m); // uğursuz olsa mətni geri qaytar
    }
  }

  const title = data?.channel?.ad ?? "Söhbət";

  if (isLoading) {
    return <Screen title="Söhbət" showBack><View className="px-4 pt-4"><ListSkeleton count={5} /></View></Screen>;
  }
  if (isError) {
    return <Screen title="Söhbət" showBack><ErrorState onRetry={refetch} /></Screen>;
  }

  return (
    <Screen
      title={title}
      showBack
      scroll={false}
      right={isGroup ? (
        <Pressable onPress={() => setMembersOpen(true)} hitSlop={8} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 6, paddingVertical: 4 })} accessibilityLabel="Üzvlər">
          <Users size={18} color={C.brand} />
          <Text style={{ color: C.brand, fontSize: 13, fontWeight: "700" }}>{data?.channel?.uzv_say ?? members.length}</Text>
        </Pressable>
      ) : undefined}
    >
      {/* Üzvlər modalı (qrup) */}
      <Modal visible={membersOpen} animationType="slide" transparent onRequestClose={() => setMembersOpen(false)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.35)", justifyContent: "flex-end" }}>
          <View style={{ backgroundColor: C.bg, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: "75%", paddingTop: 12 }}>
            <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 10 }}>
              <Text style={{ flex: 1, color: C.ink, fontSize: 17, fontWeight: "800" }}>Üzvlər ({members.length})</Text>
              <Pressable onPress={() => setMembersOpen(false)} hitSlop={8}><X size={22} color={C.sub} /></Pressable>
            </View>
            <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}>
              {members.map((m) => (
                <View key={m.id} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.line }}>
                  <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: C.brand + "1a", alignItems: "center", justifyContent: "center" }}>
                    <Text style={{ color: C.brand, fontWeight: "700" }}>{m.ad?.trim()?.charAt(0)?.toUpperCase() || "?"}</Text>
                  </View>
                  <Text style={{ flex: 1, color: C.ink, fontSize: 14, fontWeight: "600" }} numberOfLines={1}>{m.ad}{m.id === meId ? " (siz)" : ""}</Text>
                  {m.rol === "admin" ? <Text style={{ color: C.brand, fontSize: 11, fontWeight: "700" }}>admin</Text> : null}
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
      >
        <View style={{ flex: 1, backgroundColor: C.bg }}>
          <FlatList<Message>
            ref={listRef}
            data={messages}
            keyExtractor={(m) => String(m.id)}
            renderItem={({ item, index }) => {
              const mine = item.gonderici_id === meId;
              const prev = messages[index - 1];
              const showName = !mine && (!prev || prev.gonderici_id !== item.gonderici_id);
              return <Bubble item={item} mine={mine} showName={showName} />;
            }}
            contentContainerStyle={{ paddingVertical: 12 }}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
            ListEmptyComponent={
              <View style={{ alignItems: "center", paddingTop: 60 }}>
                <Text style={{ color: C.sub, fontSize: 13 }}>Hələ mesaj yoxdur — ilk yazan siz olun 👋</Text>
              </View>
            }
          />

          {/* Input bar */}
          <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8, paddingHorizontal: 10, paddingVertical: 8, paddingBottom: Platform.OS === "ios" ? 8 : 10, backgroundColor: C.card, borderTopWidth: 1, borderTopColor: C.line }}>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder="Mesaj yazın…"
              placeholderTextColor={C.sub}
              multiline
              style={{ flex: 1, maxHeight: 120, minHeight: 42, backgroundColor: C.bg, borderRadius: 22, paddingHorizontal: 16, paddingVertical: 10, fontSize: 15, color: C.ink }}
            />
            <Pressable
              onPress={onSend}
              disabled={!text.trim() || send.isPending}
              style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: text.trim() ? C.brand : C.line, alignItems: "center", justifyContent: "center" }}
              accessibilityRole="button"
              accessibilityLabel="Göndər"
            >
              <Send size={20} color="#fff" />
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}
