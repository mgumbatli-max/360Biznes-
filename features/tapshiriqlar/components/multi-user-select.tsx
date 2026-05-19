"use client";

import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, X, Users } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";

type UserOpt = { id: string; ad_soyad: string; vezife?: string | null };

type Props = {
  users: UserOpt[];
  value: string[];
  onChange: (v: string[]) => void;
  excludeId?: string;
  placeholder?: string;
  disabled?: boolean;
};

function initials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function MultiUserSelect({ users, value, onChange, excludeId, placeholder = "İşçi seç...", disabled }: Props) {
  const [open, setOpen] = useState(false);
  const filtered = useMemo(() => users.filter((u) => u.id !== excludeId), [users, excludeId]);
  const selected = filtered.filter((u) => value.includes(u.id));

  function toggle(id: string) {
    if (value.includes(id)) onChange(value.filter((v) => v !== id));
    else onChange([...value, id]);
  }

  function removeOne(id: string, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    onChange(value.filter((v) => v !== id));
  }

  return (
    <div className="space-y-1.5">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            className={cn(
              "flex min-h-9 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-1 text-left text-sm shadow-sm transition hover:bg-secondary/40 disabled:opacity-50"
            )}
          >
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Users className="h-3.5 w-3.5" />
              <span className="text-xs">
                {selected.length === 0 ? placeholder : `${selected.length} icraçı seçildi`}
              </span>
            </span>
            <ChevronsUpDown className="h-3.5 w-3.5 opacity-50" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command>
            <CommandInput placeholder="🔍 İşçi axtar..." />
            <CommandList>
              <CommandEmpty>Tapılmadı</CommandEmpty>
              <CommandGroup>
                {filtered.map((u) => {
                  const isSelected = value.includes(u.id);
                  return (
                    <CommandItem
                      key={u.id}
                      value={`${u.ad_soyad} ${u.vezife ?? ""}`}
                      onSelect={() => toggle(u.id)}
                      className="flex items-center gap-2"
                    >
                      <div className="grid h-6 w-6 place-items-center rounded-full bg-secondary text-[10px] font-semibold">
                        {initials(u.ad_soyad)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{u.ad_soyad}</div>
                        {u.vezife && <div className="text-[10px] text-muted-foreground truncate">{u.vezife}</div>}
                      </div>
                      {isSelected && <Check className="h-3.5 w-3.5 text-primary" />}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selected.map((u) => (
            <span
              key={u.id}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary/50 px-2 py-0.5 text-[10.5px]"
            >
              <span className="font-medium">{u.ad_soyad}</span>
              <button
                type="button"
                onClick={(e) => removeOne(u.id, e)}
                className="text-muted-foreground hover:text-danger"
                aria-label="Çıxar"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
