"use client";

import { useState } from "react";
import { Bookmark, Trash2, Plus, Check } from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSavedFilters, type SavedFilter } from "@/lib/hooks/use-saved-filters";

/**
 * Cədvəlin filtr-toolbar-ına yapışdırılan generik komponent.
 *
 * `storageKey` — modul üçün unikal açar (məs. "musteriler", "satislar")
 * `currentValues` — hazırkı filtr dəyərləri (yadda saxlama üçün)
 * `onApply` — saxlanmış filtr seçilərkən çağırılır (callback parent-dakı setFilters)
 * `isActive` — yığma seçim göstərmək üçün (filter id-ə əsasən)
 */
export function SavedFiltersBar<T>({
  storageKey,
  currentValues,
  onApply,
  isActive,
  size = "sm",
}: {
  storageKey: string;
  currentValues: T;
  onApply: (values: T) => void;
  isActive?: (f: SavedFilter<T>) => boolean;
  size?: "sm" | "default";
}) {
  const { filters, save, remove } = useSavedFilters<T>(storageKey);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState("");

  function handleSave() {
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      toast.error("Ad daxil edin (minimum 2 simvol)");
      return;
    }
    save(trimmed, currentValues);
    toast.success(`Filter "${trimmed}" yadda saxlandı`);
    setDialogOpen(false);
    setName("");
  }

  return (
    <>
      <div className="inline-flex items-center gap-1">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size={size}>
              <Bookmark className="h-3.5 w-3.5" />
              Yadda saxlanılan filtrlər
              {filters.length > 0 && (
                <span className="ml-1 rounded-full bg-secondary px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                  {filters.length}
                </span>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-64">
            <DropdownMenuLabel className="flex items-center justify-between">
              <span>Filtrlərim</span>
              <button
                onClick={() => setDialogOpen(true)}
                className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10.5px] text-primary hover:bg-primary/10"
              >
                <Plus className="h-3 w-3" /> Saxla
              </button>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {filters.length === 0 ? (
              <div className="px-2 py-4 text-center text-[10.5px] text-muted-foreground">
                Hələ yadda saxlanmış filtr yoxdur.
                <br />
                Filtri qur və "Saxla" düyməsi ilə əlavə et.
              </div>
            ) : (
              filters.map((f) => {
                const active = isActive?.(f) ?? false;
                return (
                  <DropdownMenuItem
                    key={f.id}
                    onClick={() => onApply(f.values)}
                    className="flex items-center gap-2 text-[11.5px]"
                  >
                    {active ? (
                      <Check className="h-3 w-3 text-primary" />
                    ) : (
                      <span className="w-3" />
                    )}
                    <span className="flex-1 truncate">{f.name}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`"${f.name}" filtri silinsin?`)) remove(f.id);
                      }}
                      className="text-muted-foreground hover:text-rose-500"
                      aria-label="Sil"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </DropdownMenuItem>
                );
              })
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Filtri yadda saxla</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="filter-name" className="text-xs">
              Filterin adı
            </Label>
            <Input
              id="filter-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Məs. Aktiv VIP müştərilər"
              autoFocus
              maxLength={50}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSave();
              }}
            />
            <p className="text-[10.5px] text-muted-foreground">
              Mövcud filtr parametrləri (axtarış, status, menecer, və s.) bu adla
              yadda saxlanacaq.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDialogOpen(false)}>
              İmtina
            </Button>
            <Button size="sm" onClick={handleSave}>
              Saxla
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
