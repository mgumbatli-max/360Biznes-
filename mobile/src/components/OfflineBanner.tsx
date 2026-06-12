import React from "react";
import { Text, View } from "react-native";
import { WifiOff } from "lucide-react-native";
import { C } from "../theme";

type OfflineBannerProps = {
  visible?: boolean;
};

export function OfflineBanner({ visible = false }: OfflineBannerProps) {
  if (!visible) return null;

  return (
    <View
      className="flex-row items-center gap-2 px-4 py-2"
      style={{ backgroundColor: "#fef3c7" }}
    >
      <WifiOff size={14} color={C.warn} strokeWidth={2} />
      <Text className="text-warn text-xs font-medium">
        İnternet bağlantısı yoxdur
      </Text>
    </View>
  );
}
