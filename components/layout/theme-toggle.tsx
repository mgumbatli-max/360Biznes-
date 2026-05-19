"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Sun, Moon, Monitor, Check } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const OPTIONS = [
  { value: "light",  label: "Açıq",  Icon: Sun },
  { value: "dark",   label: "Tünd",  Icon: Moon },
  { value: "system", label: "Sistem", Icon: Monitor },
] as const;

export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  // Avoid hydration mismatch
  if (!mounted) {
    return (
      <button
        type="button"
        aria-label="Tema"
        className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground"
      >
        <Sun className="h-4 w-4" />
      </button>
    );
  }

  const active = resolvedTheme === "dark" ? "dark" : "light";
  const ActiveIcon = active === "dark" ? Moon : Sun;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Tema dəyişdir"
          title="Tema dəyişdir"
          className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground transition"
        >
          <ActiveIcon className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        {OPTIONS.map((opt) => {
          const Icon = opt.Icon;
          const isOn = theme === opt.value;
          return (
            <DropdownMenuItem
              key={opt.value}
              onSelect={() => setTheme(opt.value)}
              className="gap-2"
            >
              <Icon className="h-4 w-4" />
              <span className="flex-1">{opt.label}</span>
              {isOn && <Check className="h-3.5 w-3.5 text-primary" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
