import React from "react";
import { ShoppingCart } from "lucide-react-native";
import { Screen, EmptyState } from "../../src/components";
import { C } from "../../src/theme";

export default function SatisScreen() {
  return (
    <Screen title="Satış">
      <EmptyState
        icon={<ShoppingCart size={48} color={C.sub} strokeWidth={1.5} />}
        title="Satış tezliklə"
        subtitle="POS modulu növbəti fazada əlçatan olacaq."
      />
    </Screen>
  );
}
