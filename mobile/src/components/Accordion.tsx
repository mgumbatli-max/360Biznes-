import React, { useState } from "react";
import { LayoutAnimation, Platform, Pressable, Text, UIManager, View } from "react-native";
import { ChevronDown, ChevronUp } from "lucide-react-native";
import { C } from "../theme";

// Enable LayoutAnimation on Android
if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type AccordionProps = {
  title: string;
  icon?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
};

export function Accordion({
  title,
  icon,
  defaultOpen = false,
  children,
}: AccordionProps) {
  const [open, setOpen] = useState(defaultOpen);

  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpen((prev) => !prev);
  };

  return (
    <View>
      <Pressable
        onPress={toggle}
        style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
        className="py-3 border-b border-line flex-row items-center gap-2"
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
      >
        {icon != null && <View>{icon}</View>}
        <Text className="text-ink font-semibold flex-1 text-sm">{title}</Text>
        {open ? (
          <ChevronUp size={18} color={C.sub} strokeWidth={2} />
        ) : (
          <ChevronDown size={18} color={C.sub} strokeWidth={2} />
        )}
      </Pressable>
      {open && <View className="pt-2">{children}</View>}
    </View>
  );
}
