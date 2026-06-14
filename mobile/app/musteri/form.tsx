import React, { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { useCreateCustomer } from "../../src/features/musteri/hooks";
import type { SaveCustomerBody } from "../../src/features/musteri/types";
import { Button, Input, Screen } from "../../src/components";
import { C } from "../../src/theme";

const QIYMET_OPTIONS: { value: NonNullable<SaveCustomerBody["qiymet_tipi"]>; label: string }[] = [
  { value: "adi", label: "Adi" },
  { value: "perakende", label: "Pərakəndə" },
  { value: "topdan", label: "Topdan" },
  { value: "partnyor", label: "Partnyor" },
  { value: "vip", label: "VIP" },
];

export default function MusteriFormScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const create = useCreateCustomer();

  const [ad, setAd] = useState("");
  const [telefon, setTelefon] = useState("");
  const [email, setEmail] = useState("");
  const [voen, setVoen] = useState("");
  const [qiymetTipi, setQiymetTipi] = useState<SaveCustomerBody["qiymet_tipi"]>("adi");
  const [qeyd, setQeyd] = useState("");
  const [error, setError] = useState<string | null>(null);

  const canSave = ad.trim().length >= 2 && !create.isPending;

  async function onSubmit() {
    setError(null);
    if (ad.trim().length < 2) {
      setError("Ad ən az 2 simvol olmalıdır");
      return;
    }
    const body: SaveCustomerBody = {
      ad: ad.trim(),
      telefon: telefon.trim() || undefined,
      email: email.trim() || undefined,
      voen: voen.trim() || undefined,
      qiymet_tipi: qiymetTipi,
      qeyd: qeyd.trim() || undefined,
    };
    try {
      const res = await create.mutateAsync(body);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const r = res as any;
      if (r?.error) {
        setError(String(r.error));
        return;
      }
      await qc.invalidateQueries({ queryKey: ["musteriler"] });
      const newId = r?.customer?.id;
      if (newId) router.replace(`/musteri/${newId}`);
      else router.back();
    } catch {
      setError("Müştəri yaradılmadı. Yenidən cəhd edin.");
    }
  }

  return (
    <Screen title="Yeni müştəri" showBack>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
        {error ? (
          <View className="bg-neg/10 rounded-xl px-3 py-2 mb-3">
            <Text className="text-neg text-sm">{error}</Text>
          </View>
        ) : null}

        <View className="gap-3">
          <Input label="Ad *" placeholder="Müştərinin adı" value={ad} onChangeText={setAd} autoFocus />
          <Input label="Telefon" placeholder="+994 50 123 45 67" value={telefon} onChangeText={setTelefon} keyboardType="phone-pad" />
          <Input label="Email" placeholder="ad@nümunə.az" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
          <Input label="VÖEN" placeholder="VÖEN (istəyə görə)" value={voen} onChangeText={setVoen} keyboardType="numeric" />

          <View>
            <Text className="text-sub text-xs font-semibold mb-1">Qiymət tipi</Text>
            <View className="flex-row flex-wrap gap-2">
              {QIYMET_OPTIONS.map((opt) => {
                const on = qiymetTipi === opt.value;
                return (
                  <Pressable
                    key={opt.value}
                    onPress={() => setQiymetTipi(opt.value)}
                    className="rounded-full px-3.5 py-1.5"
                    style={{ backgroundColor: on ? C.brand : C.bg, borderWidth: 1, borderColor: on ? C.brand : C.line }}
                  >
                    <Text style={{ color: on ? "#fff" : C.sub }} className="text-xs font-medium">
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <Input label="Qeyd" placeholder="Əlavə qeyd (istəyə görə)" value={qeyd} onChangeText={setQeyd} multiline numberOfLines={3} style={{ minHeight: 72, textAlignVertical: "top" }} />
        </View>

        <View className="mt-5">
          <Button title="Müştəri yarat" onPress={onSubmit} loading={create.isPending} disabled={!canSave} />
        </View>
      </ScrollView>
    </Screen>
  );
}
