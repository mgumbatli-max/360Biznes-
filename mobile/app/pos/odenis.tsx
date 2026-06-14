import React, { useRef, useState } from "react";
import { Alert, FlatList, Modal, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { Check, ChevronRight, Printer, Share2, User, UserX, X } from "lucide-react-native";
import { Button, Screen } from "../../src/components";
import { usePosContext, useCreateSale } from "../../src/features/pos/hooks";
import { usePosStore, cartSubtotal } from "../../src/features/pos/store";
import { useCustomers } from "../../src/features/musteri/hooks";
import type { Customer } from "../../src/features/musteri/types";
import { ODENIS_LABEL, type OdenisNov } from "../../src/features/pos/types";
import { printReceipt, shareReceiptPdf, type ReceiptData } from "../../src/lib/print";
import { formatMoney } from "../../src/lib/format";
import { C } from "../../src/theme";

function genOpId(): string {
  // v4-bənzər idempotentlik açarı (offline retry-də eyni qalır)
  let s = "";
  for (let i = 0; i < 32; i++) s += Math.floor(Math.random() * 16).toString(16);
  return `pos-${Date.now().toString(36)}-${s.slice(0, 16)}`;
}

const ODENIS_LIST: OdenisNov[] = ["negd", "kart", "kecirme", "nisye"];

export default function OdenisScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const { data: ctx } = usePosContext();
  const create = useCreateSale();
  const { lines, anbarId, musteri, odenisNov, endirimMebleg, setMusteri, setOdenis, setEndirim, clear } = usePosStore();

  const [pickerOpen, setPickerOpen] = useState(false);
  const [done, setDone] = useState<ReceiptData | null>(null);
  const opId = useRef<string | null>(null);

  const valyuta = ctx?.valyuta ?? "AZN";
  const subtotal = cartSubtotal(lines);
  const endirim = Math.min(endirimMebleg, subtotal);
  const yekun = Math.max(0, subtotal - endirim);

  async function onComplete() {
    if (create.isPending) return;
    if (lines.length === 0) {
      Alert.alert("Səbət boşdur");
      return;
    }
    if (!ctx?.kassa?.id) {
      Alert.alert("Açıq kassa yoxdur");
      return;
    }
    if (anbarId == null) {
      Alert.alert("Anbar seçilməyib");
      return;
    }
    if (odenisNov === "nisye" && !musteri) {
      Alert.alert("Müştəri lazımdır", "Nisyə (borc) satış üçün müştəri seçməlisiniz.");
      return;
    }
    if (!opId.current) opId.current = genOpId();

    try {
      const res = await create.mutateAsync({
        kassa_id: ctx.kassa.id,
        anbar_id: anbarId,
        musteri_id: musteri?.id ?? null,
        odenis_nov: odenisNov,
        endirim_mebleg: endirim,
        client_op_id: opId.current,
        lines: lines.map((l) => ({
          mehsul_id: l.mehsul_id,
          miqdar: l.miqdar,
          qiymet: l.qiymet,
          endirim_faiz: l.endirim_faiz,
        })),
      });

      if (!res.ok) {
        Alert.alert("Satış alınmadı", res.error);
        return; // opId saxlanır → retry idempotentdir
      }

      // Uğur — çek məlumatını qur
      const receipt: ReceiptData = {
        sirket: ctx.sirket_ad,
        nomre: res.nomre,
        cek: res.pos_cek_nomresi,
        tarix: new Date().toLocaleString("az-AZ", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }),
        kassir: ctx.kassa.acan_ad,
        musteri: musteri?.ad ?? null,
        lines: lines.map((l) => ({ ad: l.ad, miqdar: l.miqdar, qiymet: l.qiymet, cemi: l.miqdar * l.qiymet * (1 - l.endirim_faiz / 100) })),
        ara_cemi: subtotal,
        endirim,
        yekun: res.son_mebleg,
        odenis: ODENIS_LABEL[odenisNov],
        valyuta,
      };
      opId.current = null;
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["pos-context"] }),
        qc.invalidateQueries({ queryKey: ["satislar"] }),
        qc.invalidateQueries({ queryKey: ["musteriler"] }),
      ]);
      setDone(receipt);
    } catch {
      Alert.alert("Xəta", "Şəbəkə xətası — yenidən cəhd edin (təkrar satış yaranmayacaq).");
    }
  }

  function newSale() {
    clear();
    setDone(null);
    router.replace("/pos");
  }

  return (
    <Screen
      title="Ödəniş"
      showBack
      scroll={false}
      footer={
        <Button title={`Satışı tamamla · ${formatMoney(yekun, valyuta)}`} onPress={onComplete} loading={create.isPending} disabled={lines.length === 0} />
      }
    >
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }} keyboardShouldPersistTaps="handled">
        {/* Müştəri */}
        <View>
          <Text style={{ color: C.sub, fontSize: 12, fontWeight: "600", marginBottom: 6 }}>Müştəri</Text>
          {musteri ? (
            <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: C.card, borderRadius: 12, borderWidth: 1, borderColor: C.line, padding: 12, gap: 10 }}>
              <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: C.brand + "1a", alignItems: "center", justifyContent: "center" }}>
                <Text style={{ color: C.brand, fontWeight: "700" }}>{musteri.ad.charAt(0).toUpperCase()}</Text>
              </View>
              <Text style={{ flex: 1, color: C.ink, fontSize: 14, fontWeight: "600" }} numberOfLines={1}>{musteri.ad}</Text>
              <Pressable onPress={() => setMusteri(null)} hitSlop={8}><X size={18} color={C.sub} /></Pressable>
            </View>
          ) : (
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Pressable onPress={() => setPickerOpen(true)} style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: C.card, borderRadius: 12, borderWidth: 1, borderColor: C.line, padding: 12 }}>
                <User size={18} color={C.brand} />
                <Text style={{ flex: 1, color: C.ink, fontSize: 14 }}>Müştəri seç</Text>
                <ChevronRight size={18} color={C.sub} />
              </Pressable>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: C.bg, borderRadius: 12, paddingHorizontal: 12 }}>
                <UserX size={16} color={C.sub} />
                <Text style={{ color: C.sub, fontSize: 13 }}>Anonim</Text>
              </View>
            </View>
          )}
        </View>

        {/* Ödəniş növü */}
        <View>
          <Text style={{ color: C.sub, fontSize: 12, fontWeight: "600", marginBottom: 6 }}>Ödəniş növü</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {ODENIS_LIST.map((o) => {
              const active = o === odenisNov;
              return (
                <Pressable
                  key={o}
                  onPress={() => setOdenis(o)}
                  style={{ paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, backgroundColor: active ? C.brand : "#fff", borderWidth: 1, borderColor: active ? C.brand : C.line }}
                >
                  <Text style={{ color: active ? "#fff" : C.ink, fontSize: 14, fontWeight: "600" }}>{ODENIS_LABEL[o]}</Text>
                </Pressable>
              );
            })}
          </View>
          {odenisNov === "nisye" ? (
            <Text style={{ color: C.warn, fontSize: 12, marginTop: 6 }}>
              Nisyə satış müştərinin borcuna yazılacaq — müştəri seçimi məcburidir.
            </Text>
          ) : null}
        </View>

        {/* Endirim */}
        <View>
          <Text style={{ color: C.sub, fontSize: 12, fontWeight: "600", marginBottom: 6 }}>Endirim (məbləğ)</Text>
          <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: C.card, borderRadius: 12, borderWidth: 1, borderColor: C.line, paddingHorizontal: 12 }}>
            <TextInput
              value={endirimMebleg ? String(endirimMebleg) : ""}
              onChangeText={(t) => setEndirim(Number(t.replace(",", ".")) || 0)}
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor={C.sub}
              style={{ flex: 1, paddingVertical: 12, fontSize: 15, color: C.ink }}
            />
            <Text style={{ color: C.sub, fontSize: 14 }}>{valyuta === "AZN" ? "₼" : valyuta}</Text>
          </View>
        </View>

        {/* Xülasə */}
        <View style={{ backgroundColor: C.card, borderRadius: 12, borderWidth: 1, borderColor: C.line, padding: 14, gap: 8 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={{ color: C.sub, fontSize: 14 }}>Ara cəmi</Text>
            <Text style={{ color: C.ink, fontSize: 14 }}>{formatMoney(subtotal, valyuta)}</Text>
          </View>
          {endirim > 0 ? (
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ color: C.sub, fontSize: 14 }}>Endirim</Text>
              <Text style={{ color: C.neg, fontSize: 14 }}>−{formatMoney(endirim, valyuta)}</Text>
            </View>
          ) : null}
          <View style={{ height: 1, backgroundColor: C.line }} />
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={{ color: C.ink, fontSize: 16, fontWeight: "800" }}>Yekun</Text>
            <Text style={{ color: C.brandDark, fontSize: 18, fontWeight: "800" }}>{formatMoney(yekun, valyuta)}</Text>
          </View>
        </View>
      </ScrollView>

      <CustomerPicker visible={pickerOpen} onClose={() => setPickerOpen(false)} onSelect={(c) => { setMusteri({ id: c.id, ad: c.ad }); setPickerOpen(false); }} />
      <SuccessModal data={done} valyuta={valyuta} onNew={newSale} onClose={() => { clear(); setDone(null); router.back(); }} />
    </Screen>
  );
}

// ─── Müştəri seçici modal ────────────────────────────────────────────────────
function CustomerPicker({ visible, onClose, onSelect }: { visible: boolean; onClose: () => void; onSelect: (c: Customer) => void }) {
  const [q, setQ] = useState("");
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useCustomers(q);
  const items = data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.3)", justifyContent: "flex-end" }}>
        <View style={{ backgroundColor: C.bg, borderTopLeftRadius: 20, borderTopRightRadius: 20, height: "82%", paddingTop: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, marginBottom: 10 }}>
            <Text style={{ flex: 1, color: C.ink, fontSize: 17, fontWeight: "700" }}>Müştəri seç</Text>
            <Pressable onPress={onClose} hitSlop={8}><X size={22} color={C.sub} /></Pressable>
          </View>
          <View style={{ paddingHorizontal: 16, marginBottom: 8 }}>
            <TextInput
              value={q}
              onChangeText={setQ}
              placeholder="Ad və ya telefon…"
              placeholderTextColor={C.sub}
              style={{ backgroundColor: C.card, borderRadius: 12, borderWidth: 1, borderColor: C.line, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, color: C.ink }}
            />
          </View>
          <FlatList
            data={items}
            keyExtractor={(c) => c.id}
            keyboardShouldPersistTaps="handled"
            onEndReached={() => { if (hasNextPage && !isFetchingNextPage) fetchNextPage(); }}
            onEndReachedThreshold={0.4}
            ListEmptyComponent={!isLoading ? <Text style={{ color: C.sub, textAlign: "center", marginTop: 30 }}>Müştəri tapılmadı</Text> : null}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => onSelect(item)}
                style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1, flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 11, paddingHorizontal: 16, backgroundColor: C.card, borderBottomWidth: 1, borderBottomColor: C.line })}
              >
                <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: C.brand + "1a", alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ color: C.brand, fontWeight: "700" }}>{item.ad.charAt(0).toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: C.ink, fontSize: 14, fontWeight: "600" }} numberOfLines={1}>{item.ad}</Text>
                  {item.telefon ? <Text style={{ color: C.sub, fontSize: 12 }}>{item.telefon}</Text> : null}
                </View>
                {item.borc > 0 ? <Text style={{ color: C.neg, fontSize: 12 }}>borc: {item.borc.toFixed(0)}</Text> : null}
              </Pressable>
            )}
          />
        </View>
      </View>
    </Modal>
  );
}

// ─── Uğur + çap modalı ───────────────────────────────────────────────────────
function SuccessModal({ data, valyuta, onNew, onClose }: { data: ReceiptData | null; valyuta: string; onNew: () => void; onClose: () => void }) {
  const [busy, setBusy] = useState<"print" | "share" | null>(null);
  if (!data) return null;

  async function doPrint() {
    setBusy("print");
    try { await printReceipt(data!); } catch { Alert.alert("Çap alınmadı", "Printer/PDF mövcud deyil."); } finally { setBusy(null); }
  }
  async function doShare() {
    setBusy("share");
    try { await shareReceiptPdf(data!); } catch { Alert.alert("Paylaşma alınmadı"); } finally { setBusy(null); }
  }

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", padding: 24 }}>
        <View style={{ backgroundColor: C.card, borderRadius: 20, padding: 22 }}>
          <View style={{ alignItems: "center", marginBottom: 14 }}>
            <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: C.pos + "1a", alignItems: "center", justifyContent: "center", marginBottom: 10 }}>
              <Check size={32} color={C.pos} strokeWidth={3} />
            </View>
            <Text style={{ color: C.ink, fontSize: 18, fontWeight: "800" }}>Satış tamamlandı</Text>
            <Text style={{ color: C.brandDark, fontSize: 22, fontWeight: "800", marginTop: 4 }}>{formatMoney(data.yekun, valyuta)}</Text>
            <Text style={{ color: C.sub, fontSize: 12, marginTop: 4 }}>Çek: {data.cek}</Text>
          </View>

          <View style={{ flexDirection: "row", gap: 10, marginBottom: 10 }}>
            <View style={{ flex: 1 }}>
              <Button title="Çap et" icon={<Printer size={18} color="#fff" />} onPress={doPrint} loading={busy === "print"} />
            </View>
            <View style={{ flex: 1 }}>
              <Button title="PDF paylaş" variant="outline" icon={<Share2 size={18} color={C.brand} />} onPress={doShare} loading={busy === "share"} />
            </View>
          </View>
          <Button title="Yeni satış" onPress={onNew} />
          <Pressable onPress={onClose} style={{ paddingVertical: 12, alignItems: "center" }}>
            <Text style={{ color: C.sub, fontSize: 14 }}>Bağla</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
