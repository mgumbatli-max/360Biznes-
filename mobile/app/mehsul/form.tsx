/**
 * Məhsul yarat / redaktə formu
 *
 * Qeyd (çox-şəkil): Backend yalnız tək `sekil_url` saxlayır.
 * UI 4-ə qədər şəkil göstərir, lakin yadda saxlamada yalnız birinci URL göndərilir.
 * Tam qalereya persistensiyası backend follow-up üçün saxlanılır.
 */

import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  Switch,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { ScanLine } from "lucide-react-native";

import {
  Accordion,
  BarcodeScanner,
  Button,
  Card,
  ImagePickerRow,
  Input,
  Screen,
} from "../../src/components";
import { ListSkeleton } from "../../src/components";
import {
  useProduct,
  useReferences,
  useSaveProduct,
} from "../../src/features/mehsul/hooks";
import type { SaveProductBody } from "../../src/features/mehsul/types";
import { C } from "../../src/theme";

// ─── Kiçik Select komponenti ──────────────────────────────────────────────────

type SelectOption = { id: number; ad: string };

type SelectFieldProps = {
  label: string;
  placeholder?: string;
  value: number | null;
  options: SelectOption[];
  onSelect: (id: number | null) => void;
};

function SelectField({
  label,
  placeholder = "Seç",
  value,
  options,
  onSelect,
}: SelectFieldProps) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.id === value);

  return (
    <View className="w-full mb-3">
      <Text className="text-sub dark:text-subDark text-xs font-semibold mb-1">{label}</Text>
      <Pressable
        onPress={() => setOpen(true)}
        style={({ pressed }) => ({
          opacity: pressed ? 0.8 : 1,
          flexDirection: "row",
          alignItems: "center",
          borderWidth: 1,
          borderColor: C.line,
          borderRadius: 12,
          backgroundColor: C.card,
          paddingHorizontal: 12,
          paddingVertical: 10,
        })}
      >
        <Text
          style={{ flex: 1, fontSize: 14, color: selected ? C.ink : C.sub }}
          numberOfLines={1}
        >
          {selected ? selected.ad : placeholder}
        </Text>
        <Text style={{ fontSize: 12, color: C.sub }}>▾</Text>
      </Pressable>

      <Modal
        visible={open}
        animationType="slide"
        transparent
        onRequestClose={() => setOpen(false)}
      >
        <Pressable
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.35)" }}
          onPress={() => setOpen(false)}
        >
          <View
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              backgroundColor: C.card,
              borderTopLeftRadius: 18,
              borderTopRightRadius: 18,
              paddingBottom: 34,
              maxHeight: "65%",
            }}
          >
            <View
              style={{
                padding: 16,
                borderBottomWidth: 1,
                borderColor: C.line,
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <Text style={{ fontSize: 15, fontWeight: "600", color: C.ink }}>
                {label}
              </Text>
              <Pressable
                onPress={() => setOpen(false)}
                style={{ padding: 4 }}
              >
                <Text style={{ color: C.sub, fontSize: 14 }}>Bağla</Text>
              </Pressable>
            </View>

            <FlatList
              data={[{ id: -1, ad: "— Seçilməyib —" }, ...options]}
              keyExtractor={(item) => String(item.id)}
              renderItem={({ item }) => {
                const isSelected =
                  item.id === -1 ? value === null : item.id === value;
                return (
                  <Pressable
                    onPress={() => {
                      onSelect(item.id === -1 ? null : item.id);
                      setOpen(false);
                    }}
                    style={({ pressed }) => ({
                      paddingHorizontal: 16,
                      paddingVertical: 13,
                      backgroundColor: pressed
                        ? C.brand50
                        : isSelected
                        ? C.brandLight
                        : "#fff",
                    })}
                  >
                    <Text
                      style={{
                        fontSize: 14,
                        color: isSelected ? C.brandDark : C.ink,
                        fontWeight: isSelected ? "600" : "400",
                      }}
                    >
                      {item.ad}
                    </Text>
                  </Pressable>
                );
              }}
            />
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

// ─── Switch sıra komponenti ───────────────────────────────────────────────────

type SwitchRowProps = {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
};

function SwitchRow({ label, value, onChange }: SwitchRowProps) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderColor: C.line,
      }}
    >
      <Text style={{ fontSize: 14, color: C.ink }}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: C.line, true: C.brand }}
        thumbColor="#fff"
      />
    </View>
  );
}

// ─── Əsas forma ───────────────────────────────────────────────────────────────

export default function MehsulForm() {
  const { id, scan } = useLocalSearchParams<{ id?: string; scan?: string }>();
  const editing = !!id;
  const router = useRouter();
  const queryClient = useQueryClient();
  const saveMutation = useSaveProduct();

  // Edit üçün mövcud məhsul
  const { data: detail, isLoading: detailLoading } = useProduct(
    editing ? (id as string) : ""
  );

  // Referanslar
  const { data: refs } = useReferences();

  // ─── Form state ──────────────────────────────────────────────────────────
  const [images, setImages] = useState<string[]>([]);
  const [ad, setAd] = useState("");
  const [satisQiymeti, setSatisQiymeti] = useState("");
  const [kateqoriyaId, setKateqoriyaId] = useState<number | null>(null);

  // Ətraflı sahələr
  const [barkod, setBarkod] = useState("");
  const [kod, setKod] = useState("");
  const [markaId, setMarkaId] = useState<number | null>(null);
  const [olcuId, setOlcuId] = useState<number | null>(null);
  const [rang, setRang] = useState("");
  const [model, setModel] = useState("");
  const [qisacaTesvir, setQisacaTesvir] = useState("");
  const [aciqlamaq, setAciqlamaq] = useState("");
  const [kritikStok, setKritikStok] = useState("");
  const [minStok, setMinStok] = useState("");

  // Qiymət pillələri
  const [endirimli, setEndirimli] = useState("");
  const [topdan, setTopdan] = useState("");
  const [vip, setVip] = useState("");
  const [partnyor, setPartnyor] = useState("");

  // Switches
  const [serialLazim, setSerialLazim] = useState(false);
  const [imeiLazim, setImeiLazim] = useState(false);
  const [servisLazim, setServisLazim] = useState(false);

  // Barkod scanner
  const [scannerVisible, setScannerVisible] = useState(false);

  // Home "Skan" kafelindən gəlibsə (?scan=1) skaneri avtomatik aç
  useEffect(() => {
    if (scan === "1") setScannerVisible(true);
  }, [scan]);

  // ─── Edit prefill (yalnız BİR dəfə — arxa plan refetch istifadəçi dəyişikliyini silməsin) ──
  const prefilled = useRef(false);
  useEffect(() => {
    if (!detail?.item || prefilled.current) return;
    prefilled.current = true;
    const it = detail.item;
    if (it.ad) setAd(it.ad);
    if (it.satis_qiymeti != null) setSatisQiymeti(String(it.satis_qiymeti));
    if (it.kateqoriya_id != null) setKateqoriyaId(it.kateqoriya_id);
    if (it.barkod) setBarkod(it.barkod);
    if (it.kod) setKod(it.kod);
    if (it.marka_id != null) setMarkaId(it.marka_id);
    if (it.olcu_id != null) setOlcuId(it.olcu_id);
    if (it.rang) setRang(it.rang);
    if (it.model) setModel(it.model);
    if (it.qisaca_tesvir) setQisacaTesvir(it.qisaca_tesvir);
    if (it.aciqlamaq) setAciqlamaq(it.aciqlamaq);
    if (it.kritik_stok != null) setKritikStok(String(it.kritik_stok));
    if (it.min_stok != null) setMinStok(String(it.min_stok));
    if (it.endirimli_qiymet != null) setEndirimli(String(it.endirimli_qiymet));
    if (it.topdan_qiymeti != null) setTopdan(String(it.topdan_qiymeti));
    if (it.vip_qiymeti != null) setVip(String(it.vip_qiymeti));
    if (it.partnyor_qiymeti != null) setPartnyor(String(it.partnyor_qiymeti));
    if (it.serial_lazim != null) setSerialLazim(Boolean(it.serial_lazim));
    if (it.imei_lazim != null) setImeiLazim(Boolean(it.imei_lazim));
    if (it.servis_lazim != null) setServisLazim(Boolean(it.servis_lazim));
    // Birinci şəkil — qalereya persistensiyası backend follow-up üçün
    setImages(it.sekil_url ? [it.sekil_url] : []);
  }, [detail]);

  // ─── Save ─────────────────────────────────────────────────────────────────
  const onSave = async () => {
    if (!ad.trim()) {
      Alert.alert("Diqqət", "Məhsul adı tələb olunur");
      return;
    }

    const body: SaveProductBody = {
      id: editing ? (id as string) : undefined,
      ad: ad.trim(),
      satis_qiymeti: Number(satisQiymeti) || 0,
      kateqoriya_id: kateqoriyaId ?? undefined,
      marka_id: markaId ?? undefined,
      olcu_id: olcuId ?? undefined,
      barkod: barkod.trim() || undefined,
      kod: kod.trim() || undefined,
      rang: rang.trim() || undefined,
      model: model.trim() || undefined,
      qisaca_tesvir: qisacaTesvir.trim() || undefined,
      aciqlamaq: aciqlamaq.trim() || undefined,
      // Yalnız birinci şəkil saxlanılır; tam qalereya backend follow-up üçün
      sekil_url: images[0] || undefined,
      kritik_stok: kritikStok ? Number(kritikStok) : undefined,
      min_stok: minStok ? Number(minStok) : undefined,
      endirimli_qiymet: endirimli ? Number(endirimli) : undefined,
      topdan_qiymeti: topdan ? Number(topdan) : undefined,
      vip_qiymeti: vip ? Number(vip) : undefined,
      partnyor_qiymeti: partnyor ? Number(partnyor) : undefined,
      serial_lazim: serialLazim,
      imei_lazim: imeiLazim,
      servis_lazim: servisLazim,
    };

    try {
      const res = await saveMutation.mutateAsync(body);
      if (res?.error) {
        Alert.alert("Xəta", res.error);
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["mehsullar"] });
      if (editing) queryClient.invalidateQueries({ queryKey: ["mehsul", id] });
      if (res?.pending_approval) {
        Alert.alert(
          "Təsdiq gözləyir",
          "Məhsul təsdiqdən sonra aktivləşəcək."
        );
      }
      router.back();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      Alert.alert(
        "Xəta",
        err?.response?.data?.error ?? "Yadda saxlanmadı"
      );
    }
  };

  // ─── Skeleton ─────────────────────────────────────────────────────────────
  if (editing && detailLoading) {
    return (
      <Screen
        title="Məhsulu redaktə et"
        showBack
        scroll
      >
        <ListSkeleton count={6} />
      </Screen>
    );
  }

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <Screen
      title={editing ? "Məhsulu redaktə et" : "Yeni məhsul"}
      showBack
      scroll
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        {/* Şəkillər */}
        <Card className="mb-3">
          <Text className="text-sub dark:text-subDark text-xs font-semibold mb-2">
            Şəkillər (maks. 4)
          </Text>
          <ImagePickerRow images={images} onChange={setImages} max={4} />
        </Card>

        {/* Əsas sahələr */}
        <Card className="mb-3 gap-3">
          <Input
            label="Məhsul adı *"
            placeholder="Məhsulun adını yazın"
            value={ad}
            onChangeText={setAd}
            returnKeyType="next"
          />

          <Input
            label="Satış qiyməti"
            placeholder="0.00"
            value={satisQiymeti}
            onChangeText={setSatisQiymeti}
            keyboardType="decimal-pad"
            returnKeyType="done"
          />

          <SelectField
            label="Kateqoriya"
            placeholder="Kateqoriya seç"
            value={kateqoriyaId}
            options={refs?.kateqoriyalar ?? []}
            onSelect={setKateqoriyaId}
          />
        </Card>

        {/* Ətraflı akkordeon */}
        <Card className="mb-3">
          <Accordion title="Ətraflı">
            {/* Barkod + skan */}
            <View className="mb-3">
              <Input
                label="Barkod"
                placeholder="Barkod daxil edin"
                value={barkod}
                onChangeText={setBarkod}
                returnKeyType="next"
                rightSlot={
                  <Pressable
                    onPress={() => setScannerVisible(true)}
                    style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1, padding: 4 })}
                    accessibilityLabel="Barkod skan et"
                  >
                    <ScanLine size={20} color={C.brand} strokeWidth={2} />
                  </Pressable>
                }
              />
            </View>

            <View className="mb-3">
              <Input
                label="Daxili kod"
                placeholder="Daxili kod"
                value={kod}
                onChangeText={setKod}
                returnKeyType="next"
              />
            </View>

            <SelectField
              label="Marka"
              placeholder="Marka seç"
              value={markaId}
              options={refs?.markalar ?? []}
              onSelect={setMarkaId}
            />

            <SelectField
              label="Ölçü vahidi"
              placeholder="Vahid seç"
              value={olcuId}
              options={(refs?.vahidler ?? []).map((v) => ({
                id: v.id,
                ad: v.qisa_ad ? `${v.ad} (${v.qisa_ad})` : v.ad,
              }))}
              onSelect={setOlcuId}
            />

            <View className="mb-3">
              <Input
                label="Rəng"
                placeholder="Məhsulun rəngi"
                value={rang}
                onChangeText={setRang}
                returnKeyType="next"
              />
            </View>

            <View className="mb-3">
              <Input
                label="Model"
                placeholder="Model"
                value={model}
                onChangeText={setModel}
                returnKeyType="next"
              />
            </View>

            <View className="mb-3">
              <Input
                label="Qısaca təsvir"
                placeholder="Qısa açıqlama"
                value={qisacaTesvir}
                onChangeText={setQisacaTesvir}
                multiline
                numberOfLines={3}
                style={{ minHeight: 70, textAlignVertical: "top" }}
              />
            </View>

            <View className="mb-3">
              <Input
                label="Açıqlama"
                placeholder="Ətraflı açıqlama"
                value={aciqlamaq}
                onChangeText={setAciqlamaq}
                multiline
                numberOfLines={4}
                style={{ minHeight: 90, textAlignVertical: "top" }}
              />
            </View>

            <View className="mb-3 flex-row gap-3">
              <View style={{ flex: 1 }}>
                <Input
                  label="Kritik stok"
                  placeholder="0"
                  value={kritikStok}
                  onChangeText={setKritikStok}
                  keyboardType="numeric"
                  returnKeyType="next"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Input
                  label="Min. stok"
                  placeholder="0"
                  value={minStok}
                  onChangeText={setMinStok}
                  keyboardType="numeric"
                  returnKeyType="done"
                />
              </View>
            </View>

            {/* Qiymət pillələri */}
            <View style={{ marginTop: 8, marginBottom: 4 }}>
              <Text style={{ fontSize: 13, fontWeight: "600", color: C.ink, marginBottom: 10 }}>
                Qiymət pillələri
              </Text>

              <View className="mb-3 flex-row gap-3">
                <View style={{ flex: 1 }}>
                  <Input
                    label="Endirimli"
                    placeholder="0.00"
                    value={endirimli}
                    onChangeText={setEndirimli}
                    keyboardType="decimal-pad"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Input
                    label="Topdan"
                    placeholder="0.00"
                    value={topdan}
                    onChangeText={setTopdan}
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>

              <View className="mb-3 flex-row gap-3">
                <View style={{ flex: 1 }}>
                  <Input
                    label="VIP"
                    placeholder="0.00"
                    value={vip}
                    onChangeText={setVip}
                    keyboardType="decimal-pad"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Input
                    label="Tərəfdaş"
                    placeholder="0.00"
                    value={partnyor}
                    onChangeText={setPartnyor}
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>

              <Text style={{ fontSize: 11, color: C.sub, marginBottom: 12 }}>
                Boş qalan qiymət pillələrini sistem avtomatik hesablayır.
              </Text>
            </View>

            {/* Switches */}
            <SwitchRow
              label="Seriya nömrəsi tələb olunur"
              value={serialLazim}
              onChange={setSerialLazim}
            />
            <SwitchRow
              label="IMEI tələb olunur"
              value={imeiLazim}
              onChange={setImeiLazim}
            />
            <SwitchRow
              label="Servis tələb olunur"
              value={servisLazim}
              onChange={setServisLazim}
            />
          </Accordion>
        </Card>

        {/* Yadda saxla düyməsi (sticky-style alt bölmə) */}
        <View style={{ paddingBottom: 24, paddingTop: 4 }}>
          <Button
            title={editing ? "Yadda saxla" : "Əlavə et"}
            onPress={onSave}
            loading={saveMutation.isPending}
          />
        </View>
      </KeyboardAvoidingView>

      {/* Barkod skaneri */}
      <BarcodeScanner
        visible={scannerVisible}
        onClose={() => setScannerVisible(false)}
        onScanned={(code) => {
          setBarkod(code);
          setScannerVisible(false);
        }}
      />
    </Screen>
  );
}
