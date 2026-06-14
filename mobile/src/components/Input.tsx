import React from "react";
import { Text, TextInput, TextInputProps, View } from "react-native";
import { C } from "../theme";

type InputProps = TextInputProps & {
  label?: string;
  error?: string;
  rightSlot?: React.ReactNode;
};

export function Input({
  label,
  error,
  rightSlot,
  style,
  ...rest
}: InputProps) {
  const borderClass = error ? "border-neg" : "border-line dark:border-lineDark";

  return (
    <View className="w-full">
      {label != null && (
        <Text className="text-sub dark:text-subDark text-xs font-semibold mb-1">{label}</Text>
      )}
      <View
        className={`flex-row items-center border ${borderClass} rounded-xl bg-card dark:bg-cardDark px-3`}
      >
        <TextInput
          className="flex-1 py-2.5 text-ink dark:text-inkDark text-sm"
          placeholderTextColor={C.sub}
          style={style}
          {...rest}
        />
        {rightSlot != null && (
          <View className="ml-2">{rightSlot}</View>
        )}
      </View>
      {error != null && (
        <Text className="text-neg text-xs mt-1">{error}</Text>
      )}
    </View>
  );
}
