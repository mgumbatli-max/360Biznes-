import React, { useEffect, useState } from "react";
import { Alert, FlatList, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { ScanLine, Search, Plus, Minus, Trash2, ShoppingCart, X } from "lucide-react-native";
import { Button, Screen, ListSkeleton, ErrorState } from "../../src/components";
import { BarcodeScanner } from "../../src/components/BarcodeScanner";
import { usePosContext, usePosSearch, useScanLookup } from "../../src/features/pos/hooks";
import { usePosStore, cartSubtotal, cartCount } from "../../src/features/pos/store";
import type { PosProduct } from "../../src/features/pos/types";
import { formatMoney } from "../../src/lib/format";
import { C } from "../../src/theme";

export default function PosScreen() {
  const router = useRouter();
  const { data: ctx, isLoading, isError, refetch } = usePosContext();
  const { anbarId, lines, setAnbar, addProduct, incQty, removeLine, setPrice } = usePosStore();
  const [q, setQ] = useState("");
  const [scanOpen, setScanOpen] = useState(false);
  const scan = useScanLookup();
  const search = usePosSearch(q, anbarId);

  // Default anbarı qur
  useEffect(() => {
    if (anbarId == null && ctx?.default_anbar_id != null) setAnbar(ctx.default_anbar_id);
  }, [anbarId, ctx?.default_anbar_id, setAnbar]);

  const valyuta = ctx?.valyuta ?? "AZN";
  const subtotal = cartSubtotal(lines);
  const count = cartCount(lines);

  function onAdd(p: PosProduct) {
    if (p.stok != null && p.stok <= 0) {
      Alert.alert("Stok yoxdur", `${p.ad} anbarda yoxdur (${p.stok}). Yenə də əlavə edilsin?`, [
        { text: "Xeyr", style: "cancel" },
        { text: "Bəli", onPress: () => addProduct(p) },
      ]);
      return;
    }
    addProduct(p);
    setQ("");
  }

  async function onScanned(code: string) {
    setScanOpen(false);
    try {
      const res = await scan.mutateAsync({ code, anbarId });
      const found = res.items?.[0];
      if (found) onAdd(found);
      else Alert.alert("Tapılmadı", `Bu barkoda uyğun məhsul yoxdur: ${code}`);
    } catch {
      Alert.alert("Xəta", "Axtarış alınmadı, yenidən cəhd edin.");
    }
  }

  if (isLoading) return <Screen title="Yeni satış" showBack><View className="px-4 pt-4"><ListSkeleton count={6} /></View></Screen>;
  if (isError) return <Screen title="Yeni satış" showBack><ErrorState onRetry={refetch} /></Screen>;

  // Açıq kassa yoxdursa
  if (!ctx?.kassa) {
    return (
      <Screen title="Yeni satış" showBack>
        <View style={{ flex: 1, justifyContent: "center", paddingHorizontal: 24 }}>
          <View style={{ alignItems: "center", marginBottom: 20 }}>
            <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: C.brand + "1a", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
              <ShoppingCart size={30} color={C.brand} />
            </View>
            <Text style={{ color: C.ink, fontSize: 17, fontWeight: "700" }}>Açıq kassa yoxdur</Text>
            <Text style={{ color: C.sub, fontSize: 13, textAlign: "center", marginTop: 5, lineHeight: 19 }}>
              Satışa başlamaq üçün kassanı açın. Gün sonunda bağlaya bilərsiniz.
            </Text>
          </View>
          {ctx?.can_open_kassa ? (
            <Button title="Kassanı aç" onPress={() => router.push("/pos/kassa-ac")} />
          ) : (
            <Text style={{ color: C.sub, fontSize: 13, textAlign: "center" }}>
              Kassa açmaq üçün icazəniz yoxdur. Sahibkar/menecerlə əlaqə saxlayın.
            </Text>
          )}
        </View>
      </Screen>
    );
  }

  const results = q.trim().length >= 2 ? (search.data?.items ?? []) : [];

  return (
    <Screen
      title="Yeni satış"
      showBack
      scroll={false}
      footer={
        <View style={{ gap: 8 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={{ color: C.sub, fontSize: 13 }}>{count} məhsul</Text>
            <Text style={{ color: C.ink, fontSize: 18, fontWeight: "800" }}>{formatMoney(subtotal, valyuta)}</Text>
          </View>
          <Button
            title="Ödənişə keç →"
            onPress={() => router.push("/pos/odenis")}
            disabled={lines.length === 0}
          />
        </View>
      }
    >
      {/* Kassa + anbar zolağı */}
      <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: C.pos }} />
          <Text style={{ color: C.sub, fontSize: 12 }} numberOfLines={1}>
            Kassa: {ctx.kassa.ad} · {ctx.sirket_ad}
          </Text>
        </View>
        {ctx.anbarlar.length > 1 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
            <View style={{ flexDirection: "row", gap: 6 }}>
              {ctx.anbarlar.map((a) => {
                const active = a.id === anbarId;
                return (
                  <Pressable
                    key={a.id}
                    onPress={() => setAnbar(a.id)}
                    style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: active ? C.brand : "#fff", borderWidth: 1, borderColor: active ? C.brand : C.line }}
                  >
                    <Text style={{ color: active ? "#fff" : C.sub, fontSize: 12, fontWeight: "600" }}>{a.ad}</Text>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>
        ) : null}

        {/* Axtarış + skan */}
        <View style={{ flexDirection: "row", gap: 8, marginBottom: 6 }}>
          <View style={{ flex: 1, flexDirection: "row", alignItems: "center", backgroundColor: C.card, borderRadius: 12, borderWidth: 1, borderColor: C.line, paddingHorizontal: 10 }}>
            <Search size={16} color={C.sub} />
            <TextInput
              value={q}
              onChangeText={setQ}
              placeholder="Məhsul adı və ya kod…"
              placeholderTextColor={C.sub}
              style={{ flex: 1, paddingVertical: 10, paddingHorizontal: 8, fontSize: 14, color: C.ink }}
            />
            {q ? (
              <Pressable onPress={() => setQ("")} hitSlop={8}><X size={16} color={C.sub} /></Pressable>
            ) : null}
          </View>
          <Pressable
            onPress={() => setScanOpen(true)}
            style={{ width: 46, height: 46, borderRadius: 12, backgroundColor: C.brand, alignItems: "center", justifyContent: "center" }}
            accessibilityLabel="Barkod skan et"
          >
            <ScanLine size={22} color="#fff" />
          </Pressable>
        </View>

        {/* Axtarış nəticələri */}
        {results.length > 0 ? (
          <View style={{ backgroundColor: C.card, borderRadius: 12, borderWidth: 1, borderColor: C.line, marginBottom: 8, maxHeight: 220 }}>
            <ScrollView keyboardShouldPersistTaps="handled">
              {results.map((p) => (
                <Pressable
                  key={p.id}
                  onPress={() => onAdd(p)}
                  style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1, flexDirection: "row", alignItems: "center", paddingVertical: 10, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: C.line })}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: C.ink, fontSize: 14, fontWeight: "600" }} numberOfLines={1}>{p.ad}</Text>
                    <Text style={{ color: C.sub, fontSize: 12 }}>
                      {formatMoney(p.qiymet, p.valyuta)}{p.stok != null ? ` · stok: ${p.stok}` : ""}
                    </Text>
                  </View>
                  <Plus size={20} color={C.brand} />
                </Pressable>
              ))}
            </ScrollView>
          </View>
        ) : null}
      </View>

      {/* Səbət */}
      {lines.length === 0 ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24 }}>
          <ScanLine size={44} color={C.line} strokeWidth={1.5} />
          <Text style={{ color: C.sub, fontSize: 14, textAlign: "center", marginTop: 10 }}>
            Barkod skan edin və ya məhsul axtarıb səbətə əlavə edin
          </Text>
        </View>
      ) : (
        <FlatList
          data={lines}
          keyExtractor={(l) => l.mehsul_id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 12 }}
          renderItem={({ item }) => (
            <View style={{ backgroundColor: C.card, borderRadius: 12, borderWidth: 1, borderColor: C.line, padding: 12, marginBottom: 8 }}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Text style={{ flex: 1, color: C.ink, fontSize: 14, fontWeight: "600" }} numberOfLines={2}>{item.ad}</Text>
                <Pressable onPress={() => removeLine(item.mehsul_id)} hitSlop={8} style={{ padding: 4 }}>
                  <Trash2 size={18} color={C.neg} />
                </Pressable>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", marginTop: 8, gap: 10 }}>
                {/* Qiymət */}
                <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: C.bg, borderRadius: 8, paddingHorizontal: 8 }}>
                  <TextInput
                    value={String(item.qiymet)}
                    onChangeText={(t) => setPrice(item.mehsul_id, Number(t.replace(",", ".")) || 0)}
                    keyboardType="decimal-pad"
                    style={{ minWidth: 56, paddingVertical: 6, fontSize: 14, color: C.ink, textAlign: "center" }}
                  />
                  <Text style={{ color: C.sub, fontSize: 12 }}>{valyuta === "AZN" ? "₼" : valyuta}</Text>
                </View>
                {/* Stepper */}
                <View style={{ flexDirection: "row", alignItems: "center", gap: 0, marginLeft: "auto" }}>
                  <Pressable onPress={() => incQty(item.mehsul_id, -1)} style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: C.bg, alignItems: "center", justifyContent: "center" }}>
                    <Minus size={16} color={C.ink} />
                  </Pressable>
                  <Text style={{ minWidth: 36, textAlign: "center", color: C.ink, fontSize: 15, fontWeight: "700" }}>{item.miqdar}</Text>
                  <Pressable onPress={() => incQty(item.mehsul_id, 1)} style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: C.brand, alignItems: "center", justifyContent: "center" }}>
                    <Plus size={16} color="#fff" />
                  </Pressable>
                </View>
              </View>
              <View style={{ flexDirection: "row", justifyContent: "flex-end", marginTop: 6 }}>
                <Text style={{ color: C.brandDark, fontSize: 13, fontWeight: "700" }}>
                  {formatMoney(item.miqdar * item.qiymet, valyuta)}
                </Text>
              </View>
            </View>
          )}
        />
      )}

      <BarcodeScanner visible={scanOpen} onClose={() => setScanOpen(false)} onScanned={onScanned} />
    </Screen>
  );
}
