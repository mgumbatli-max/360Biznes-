/**
 * ImagePickerRow — çox-şəkil seçici sıra komponenti
 *
 * Qeyd: Backend hazırda yalnız tək `sekil_url` saxlayır.
 * Bütün qalereyann persistensiyası backend follow-up üçün saxlanılır.
 * UI 4-ə qədər slot göstərir, lakin yadda saxlamada yalnız birinci URL istifadə olunur.
 */

import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  View,
} from "react-native";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { ImagePlus, X } from "lucide-react-native";
import { C } from "../theme";
import { uploadImage } from "../features/mehsul/hooks";

type Props = {
  images: string[];
  onChange: (urls: string[]) => void;
  max?: number;
};

export function ImagePickerRow({ images, onChange, max = 4 }: Props) {
  // uploadingIdx: hansı slot-un upload prosesindədir
  const [uploading, setUploading] = useState(false);

  const removeImage = (idx: number) => {
    const next = [...images];
    next.splice(idx, 1);
    onChange(next);
  };

  const pickImage = () => {
    Alert.alert("Şəkil əlavə et", undefined, [
      {
        text: "Kamera",
        onPress: openCamera,
      },
      {
        text: "Qalereya",
        onPress: openGallery,
      },
      {
        text: "İmtina",
        style: "cancel",
      },
    ]);
  };

  const handleAsset = async (uri: string) => {
    setUploading(true);
    try {
      const url = await uploadImage(uri);
      onChange([...images, url]);
    } catch {
      Alert.alert("Xəta", "Şəkil yüklənmədi");
    } finally {
      setUploading(false);
    }
  };

  const openCamera = async () => {
    const { granted } = await ImagePicker.requestCameraPermissionsAsync();
    if (!granted) {
      Alert.alert("İcazə yoxdur", "Kameraya giriş icazəsi verilməyib.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      // SDK 56: mediaTypes string array formatı ('images' | 'videos' | 'livePhotos')
      mediaTypes: ["images"],
      quality: 0.7,
    });
    if (!result.canceled && result.assets?.[0]?.uri) {
      await handleAsset(result.assets[0].uri);
    }
  };

  const openGallery = async () => {
    const { granted } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!granted) {
      Alert.alert("İcazə yoxdur", "Qalereya giriş icazəsi verilməyib.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      // SDK 56: mediaTypes string array formatı
      mediaTypes: ["images"],
      quality: 0.7,
    });
    if (!result.canceled && result.assets?.[0]?.uri) {
      await handleAsset(result.assets[0].uri);
    }
  };

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ flexDirection: "row", gap: 10, paddingVertical: 4 }}
    >
      {/* Mövcud şəkillər */}
      {images.map((uri, idx) => (
        <View key={`${uri}-${idx}`} style={{ position: "relative" }}>
          <Image
            source={{ uri }}
            style={{ width: 80, height: 80, borderRadius: 10 }}
            contentFit="cover"
          />
          <Pressable
            onPress={() => removeImage(idx)}
            style={{
              position: "absolute",
              top: -6,
              right: -6,
              backgroundColor: C.neg,
              borderRadius: 10,
              width: 20,
              height: 20,
              alignItems: "center",
              justifyContent: "center",
            }}
            accessibilityLabel="Şəkili sil"
          >
            <X size={12} color="#fff" strokeWidth={2.5} />
          </Pressable>
        </View>
      ))}

      {/* Əlavə et slotu */}
      {images.length < max && (
        <Pressable
          onPress={uploading ? undefined : pickImage}
          style={({ pressed }) => ({
            width: 80,
            height: 80,
            borderRadius: 10,
            borderWidth: 1.5,
            borderStyle: "dashed",
            borderColor: C.line,
            backgroundColor: C.bg,
            alignItems: "center",
            justifyContent: "center",
            opacity: pressed || uploading ? 0.6 : 1,
          })}
          accessibilityLabel="Şəkil əlavə et"
        >
          {uploading ? (
            <ActivityIndicator color={C.brand} size="small" />
          ) : (
            <ImagePlus size={24} color={C.sub} strokeWidth={1.8} />
          )}
        </Pressable>
      )}
    </ScrollView>
  );
}
