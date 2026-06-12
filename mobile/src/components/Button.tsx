import React from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { C } from "../theme";

type ButtonVariant = "primary" | "outline" | "ghost";

type ButtonProps = {
  title: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  className?: string;
};

export function Button({
  title,
  onPress,
  variant = "primary",
  loading = false,
  disabled = false,
  icon,
  className = "",
}: ButtonProps) {
  const isDisabled = disabled || loading;

  const variantClass =
    variant === "primary"
      ? "bg-brand"
      : variant === "outline"
      ? "border border-brand bg-transparent"
      : "bg-transparent";

  const textClass =
    variant === "primary" ? "text-white" : "text-brand";

  return (
    <Pressable
      onPress={isDisabled ? undefined : onPress}
      style={({ pressed }) => ({
        opacity: isDisabled ? 0.5 : pressed ? 0.85 : 1,
      })}
      className={`rounded-2xl py-3 px-4 flex-row items-center justify-center gap-2 ${variantClass} ${className}`}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === "primary" ? "#fff" : C.brand}
          size="small"
        />
      ) : (
        <>
          {icon != null && <View>{icon}</View>}
          <Text className={`text-sm font-semibold ${textClass}`}>{title}</Text>
        </>
      )}
    </Pressable>
  );
}
