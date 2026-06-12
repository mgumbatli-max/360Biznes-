import React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import { C } from "../theme";

type ScreenProps = {
  children: React.ReactNode;
  title?: string;
  showBack?: boolean;
  right?: React.ReactNode;
  scroll?: boolean;
  className?: string;
};

export function Screen({
  children,
  title,
  showBack = false,
  right,
  scroll = false,
  className = "",
}: ScreenProps) {
  const router = useRouter();
  const showHeader = title != null || showBack || right != null;

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-bg">
      {showHeader && (
        <View className="px-4 py-3 flex-row items-center">
          {showBack && (
            <Pressable
              onPress={() => router.back()}
              style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
              className="mr-2 p-1"
              accessibilityRole="button"
              accessibilityLabel="Geri"
            >
              <ChevronLeft size={24} color={C.ink} strokeWidth={2} />
            </Pressable>
          )}
          {title != null && (
            <Text className="text-ink text-lg font-bold flex-1">{title}</Text>
          )}
          {right != null && <View className="ml-auto">{right}</View>}
        </View>
      )}
      {scroll ? (
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ padding: 16 }}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      ) : (
        <View className={`flex-1 ${className}`}>{children}</View>
      )}
    </SafeAreaView>
  );
}
