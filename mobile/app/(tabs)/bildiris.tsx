import React from "react";
import { Bell } from "lucide-react-native";
import { Screen, EmptyState } from "../../src/components";
import { C } from "../../src/theme";

export default function BildirisScreen() {
  return (
    <Screen title="Bildirişlər">
      <EmptyState
        icon={<Bell size={48} color={C.sub} strokeWidth={1.5} />}
        title="Bildiriş yoxdur"
        subtitle="Yeni bildiriş gəldikdə burada görünəcək."
      />
    </Screen>
  );
}
