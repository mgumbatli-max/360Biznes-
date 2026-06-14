import React from "react";
import { Pressable, View } from "react-native";

type CardProps = {
  children: React.ReactNode;
  className?: string;
  onPress?: () => void;
};

// Web shadow-sm ekvivalenti (0 1px 2px rgba(0,0,0,0.05)) + Android elevation.
const SHADOW = {
  shadowColor: "#141820",
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.05,
  shadowRadius: 2,
  elevation: 1,
};

export function Card({ children, className = "", onPress }: CardProps) {
  const baseClass = `bg-card border border-line rounded-2xl p-3 ${className}`;

  if (onPress != null) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [{ opacity: pressed ? 0.9 : 1, transform: [{ scale: pressed ? 0.985 : 1 }] }, SHADOW]}
        className={baseClass}
      >
        {children}
      </Pressable>
    );
  }

  return <View className={baseClass} style={SHADOW}>{children}</View>;
}
