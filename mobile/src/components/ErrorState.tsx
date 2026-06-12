import React from "react";
import { Text, View } from "react-native";
import { TriangleAlert } from "lucide-react-native";
import { C } from "../theme";
import { Button } from "./Button";

type ErrorStateProps = {
  title?: string;
  message?: string;
  onRetry?: () => void;
};

export function ErrorState({
  title = "Xəta baş verdi",
  message,
  onRetry,
}: ErrorStateProps) {
  return (
    <View className="flex-1 items-center justify-center px-8 py-12">
      <TriangleAlert size={44} color={C.neg} strokeWidth={1.5} />
      <Text className="text-ink font-semibold mt-3 text-base text-center">
        {title}
      </Text>
      {message != null && (
        <Text className="text-sub text-sm text-center mt-1">{message}</Text>
      )}
      {onRetry != null && (
        <View className="mt-5 w-full">
          <Button
            title="Yenidən cəhd et"
            onPress={onRetry}
            variant="outline"
          />
        </View>
      )}
    </View>
  );
}
