import React from "react";
import { Pressable, View } from "react-native";

type CardProps = {
  children: React.ReactNode;
  className?: string;
  onPress?: () => void;
};

export function Card({ children, className = "", onPress }: CardProps) {
  const baseClass = `bg-white border border-line rounded-2xl p-3 ${className}`;

  if (onPress != null) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
        className={baseClass}
      >
        {children}
      </Pressable>
    );
  }

  return <View className={baseClass}>{children}</View>;
}
