import React from "react";
import { Pressable, Text, View } from "react-native";
import { C } from "../theme";

export type Modul = {
  label: string;
  icon: React.ReactNode;
  bg: string;
  onPress: () => void;
};

function ModuleCard({ m }: { m: Modul }) {
  return (
    <Pressable
      onPress={m.onPress}
      style={({ pressed }) => ({
        opacity: pressed ? 0.85 : 1,
        flex: 1,
        backgroundColor: "#fff",
        borderRadius: 18,
        borderWidth: 1,
        borderColor: C.line,
        padding: 16,
      })}
      accessibilityRole="button"
      accessibilityLabel={m.label}
    >
      <View style={{ width: 46, height: 46, borderRadius: 13, backgroundColor: m.bg, alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
        {m.icon}
      </View>
      <Text style={{ color: C.ink, fontSize: 14.5, fontWeight: "700" }}>{m.label}</Text>
    </Pressable>
  );
}

/** 2-sütunlu rahat modul grid (360tibb üslubu). flex-row + flex:1 — sınanmış. */
export function ModuleGrid({ modules }: { modules: Modul[] }) {
  const rows: Modul[][] = [];
  for (let i = 0; i < modules.length; i += 2) rows.push(modules.slice(i, i + 2));
  return (
    <View style={{ paddingHorizontal: 16 }}>
      {rows.map((pair, i) => (
        <View key={i} style={{ flexDirection: "row", gap: 12, marginBottom: 12 }}>
          <ModuleCard m={pair[0]} />
          {pair[1] ? <ModuleCard m={pair[1]} /> : <View style={{ flex: 1 }} />}
        </View>
      ))}
    </View>
  );
}
