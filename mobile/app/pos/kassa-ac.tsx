import React, { useState } from "react";
import { Alert, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { Button, Input, Screen } from "../../src/components";
import { useOpenKassa } from "../../src/features/pos/hooks";
import { C } from "../../src/theme";

export default function KassaAcScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const open = useOpenKassa();
  const [ad, setAd] = useState("Mobil kassa");
  const [qaliq, setQaliq] = useState("0");

  async function onOpen() {
    if (open.isPending) return;
    try {
      const res = await open.mutateAsync({ ad: ad.trim() || "Mobil kassa", acilis_qaligi: Number(qaliq.replace(",", ".")) || 0 });
      if (res?.ok) {
        await qc.invalidateQueries({ queryKey: ["pos-context"] });
        router.back();
      } else {
        Alert.alert("Alınmadı", res?.error ?? "Kassa açıla bilmədi");
      }
    } catch {
      Alert.alert("Xəta", "Şəbəkə xətası — yenidən cəhd edin");
    }
  }

  return (
    <Screen title="Kassa aç" showBack scroll>
      <Text style={{ color: C.sub, fontSize: 13, marginBottom: 16, lineHeight: 19 }}>
        Satışa başlamaq üçün kassa sessiyası açın. Bütün satışlar bu kassaya yazılacaq.
        Gün sonunda kassanı bağlayıb hesabatı görə bilərsiniz.
      </Text>
      <View style={{ gap: 14 }}>
        <Input label="Kassa adı" value={ad} onChangeText={setAd} placeholder="Mobil kassa" />
        <Input
          label="Açılış qalığı (nağd)"
          value={qaliq}
          onChangeText={setQaliq}
          keyboardType="decimal-pad"
          placeholder="0"
        />
        <Button title="Kassanı aç" onPress={onOpen} loading={open.isPending} />
      </View>
    </Screen>
  );
}
