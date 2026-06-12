import React from "react";
import { Text, View } from "react-native";
import { Inbox } from "lucide-react-native";
import { C } from "../theme";
import { Button } from "./Button";

type EmptyStateProps = {
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function EmptyState({
  icon,
  title,
  subtitle,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <View className="flex-1 items-center justify-center px-8 py-12">
      <View>
        {icon != null ? (
          icon
        ) : (
          <Inbox size={48} color={C.sub} strokeWidth={1.5} />
        )}
      </View>
      <Text className="text-ink font-semibold mt-3 text-base text-center">
        {title}
      </Text>
      {subtitle != null && (
        <Text className="text-sub text-sm text-center mt-1">{subtitle}</Text>
      )}
      {actionLabel != null && (
        <View className="mt-5 w-full">
          <Button title={actionLabel} onPress={onAction} variant="primary" />
        </View>
      )}
    </View>
  );
}
