"use client";

import { useEffect, useState } from "react";
import { Check, Columns3, RotateCcw, ChevronUp, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

export type ColumnDef = {
  key: string;
  label: string;
  required?: boolean;
};

/**
 * Stateful column visibility + order controller. State persisted in localStorage.
 * If `defaultVisible` is omitted, all columns are visible by default.
 */
export function useColumnToggle(
  storageKey: string,
  definitions: ColumnDef[],
  defaultOrder: string[],
  defaultVisible?: string[],
) {
  function initialVisible(): Record<string, boolean> {
    const map: Record<string, boolean> = {};
    if (defaultVisible && defaultVisible.length > 0) {
      const onSet = new Set(defaultVisible);
      for (const d of definitions) map[d.key] = onSet.has(d.key) || !!d.required;
    } else {
      for (const d of definitions) map[d.key] = true;
    }
    return map;
  }

  const [visible, setVisible] = useState<Record<string, boolean>>(initialVisible);
  const [order, setOrder] = useState<string[]>(defaultOrder);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as { visible: Record<string, boolean>; order: string[] };
        if (parsed.visible) setVisible((v) => ({ ...v, ...parsed.visible }));
        if (parsed.order) {
          // Merge: keep saved order, append new keys that aren't in it,
          // drop keys that no longer exist in definitions.
          const allKeys = new Set(definitions.map((d) => d.key));
          const savedFiltered = parsed.order.filter((k) => allKeys.has(k));
          const missingFromSaved = defaultOrder.filter((k) => !savedFiltered.includes(k));
          setOrder([...savedFiltered, ...missingFromSaved]);
        }
      }
    } catch {}
    setLoaded(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify({ visible, order }));
    } catch {}
  }, [storageKey, visible, order, loaded]);

  function toggle(key: string) {
    setVisible((v) => ({ ...v, [key]: !v[key] }));
  }
  function move(key: string, dir: -1 | 1) {
    setOrder((curr) => {
      const idx = curr.indexOf(key);
      if (idx < 0) return curr;
      const newIdx = idx + dir;
      if (newIdx < 0 || newIdx >= curr.length) return curr;
      const next = [...curr];
      [next[idx], next[newIdx]] = [next[newIdx], next[idx]];
      return next;
    });
  }
  function resetAll() {
    setVisible(initialVisible());
    setOrder(defaultOrder);
  }
  function showAll() {
    const v: Record<string, boolean> = {};
    for (const d of definitions) v[d.key] = true;
    setVisible(v);
  }

  function render() {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="outline" className="gap-1.5">
            <Columns3 className="h-3.5 w-3.5" />
            Sütunlar
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-72 p-2" align="end">
          <div className="mb-2 flex items-center justify-between border-b border-border/40 pb-2">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Görünüş və sıra
            </div>
            <div className="text-[10.5px] text-muted-foreground">
              {Object.values(visible).filter(Boolean).length} / {definitions.length} göstərilir
            </div>
          </div>
          <div className="space-y-0.5 max-h-[60vh] overflow-y-auto">
            {order.map((key, idx) => {
              const def = definitions.find((d) => d.key === key);
              if (!def) return null;
              const isOn = visible[key];
              const isFirst = idx === 0;
              const isLast = idx === order.length - 1;
              const isDisabled = def.required;
              return (
                <div
                  key={key}
                  className={`flex items-center gap-1.5 rounded-md px-2 py-1.5 ${isOn ? "bg-secondary/30" : ""}`}
                >
                  <button
                    type="button"
                    onClick={() => !isDisabled && toggle(key)}
                    disabled={isDisabled}
                    className={`grid h-4 w-4 place-items-center rounded border ${
                      isOn ? "bg-primary border-primary text-primary-foreground" : "border-border"
                    } ${isDisabled ? "opacity-50" : ""}`}
                    title={isDisabled ? "Bu sütun məcburidir" : isOn ? "Gizlət" : "Göstər"}
                  >
                    {isOn && <Check className="h-3 w-3" />}
                  </button>
                  <span className={`flex-1 text-sm ${isOn ? "" : "text-muted-foreground"}`}>{def.label}</span>
                  <button
                    type="button"
                    onClick={() => move(key, -1)}
                    disabled={isFirst}
                    className="grid h-5 w-5 place-items-center rounded text-muted-foreground hover:bg-secondary disabled:opacity-30"
                    title="Yuxarı"
                  >
                    <ChevronUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(key, 1)}
                    disabled={isLast}
                    className="grid h-5 w-5 place-items-center rounded text-muted-foreground hover:bg-secondary disabled:opacity-30"
                    title="Aşağı"
                  >
                    <ChevronDown className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
          <div className="mt-2 flex gap-1 border-t border-border/40 pt-2">
            <Button size="sm" variant="ghost" className="flex-1 h-7 text-xs" onClick={showAll}>
              <Check className="h-3 w-3" /> Hamısını göstər
            </Button>
            <Button size="sm" variant="ghost" className="flex-1 h-7 text-xs" onClick={resetAll}>
              <RotateCcw className="h-3 w-3" /> Sıfırla
            </Button>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return {
    isVisible: (key: string) => !!visible[key],
    order,
    render,
  };
}
