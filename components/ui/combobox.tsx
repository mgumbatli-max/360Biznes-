"use client";

import * as React from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";

export type ComboOption = {
  value: string;
  label: string;
  /** Secondary text shown smaller next to label (e.g. SKU/code) */
  hint?: string;
};

type Props = {
  options: ComboOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  /** Allow clearing with X icon */
  clearable?: boolean;
  className?: string;
  disabled?: boolean;
  /** Hide chevron */
  noChevron?: boolean;
  /** Width preset for popover content. Defaults to trigger width. */
  contentWidth?: number | string;
};

/**
 * Searchable single-select dropdown. First item in the popup is always a
 * search input — start typing to filter, or scroll and pick.
 */
export function Combobox({
  options,
  value,
  onChange,
  placeholder = "Seçin...",
  searchPlaceholder = "🔍 Axtar...",
  emptyText = "Tapılmadı",
  clearable = true,
  className,
  disabled,
  noChevron,
  contentWidth,
}: Props) {
  const [open, setOpen] = React.useState(false);
  const selected = options.find((o) => o.value === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "h-9 w-full justify-between px-3 font-normal",
            !selected && "text-muted-foreground",
            className
          )}
        >
          <span className="truncate text-left flex-1">
            {selected ? (
              <>
                {selected.label}
                {selected.hint && (
                  <span className="ml-1.5 text-[10.5px] text-muted-foreground">{selected.hint}</span>
                )}
              </>
            ) : (
              placeholder
            )}
          </span>
          {selected && clearable && !disabled ? (
            <span
              role="button"
              tabIndex={-1}
              aria-label="Sıfırla"
              onClick={(e) => {
                e.stopPropagation();
                onChange("");
              }}
              className="inline-flex h-4 w-4 items-center justify-center text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </span>
          ) : (
            !noChevron && <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="p-0"
        style={{
          width: contentWidth ?? "var(--radix-popover-trigger-width)",
          maxHeight: "min(420px, 60vh)",
        }}
      >
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {options.map((opt) => (
                <CommandItem
                  key={opt.value}
                  value={`${opt.label} ${opt.hint ?? ""}`}
                  onSelect={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                  className="flex items-center gap-2"
                >
                  <Check className={cn("h-3.5 w-3.5", value === opt.value ? "opacity-100" : "opacity-0")} />
                  <span className="flex-1 truncate">{opt.label}</span>
                  {opt.hint && <span className="text-[10.5px] text-muted-foreground">{opt.hint}</span>}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
