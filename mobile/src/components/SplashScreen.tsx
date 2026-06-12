import { ActivityIndicator, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { C } from "../theme";

export function SplashScreen() {
  return (
    <LinearGradient
      colors={[C.brand, C.brandDark]}
      style={{ flex: 1 }}
    >
      <View className="flex-1 items-center justify-center gap-3">
        <Text className="text-white text-4xl font-bold tracking-tight">
          360Biznes
        </Text>
        <Text className="text-white/80 text-sm">
          Biznesin idarəetmə mərkəzi
        </Text>
        <ActivityIndicator color="#fff" style={{ marginTop: 24 }} />
      </View>
    </LinearGradient>
  );
}
