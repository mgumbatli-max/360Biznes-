"use client";

import { useMemo, useState, useTransition } from "react";
import { ChevronDown, ChevronRight, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { saveRolePerms } from "@/features/ayar/actions";

type Perm = { id: number; kod: string; ad: string; aciqlamaq: string | null };
type Group = { qrup: string; items: Perm[] };

export function RolePermissionsMatrix({
  rolId,
  isSystem,
  initialIds,
  groups,
}: {
  rolId: number;
  isSystem: boolean;
  initialIds: number[];
  groups: Group[];
}) {
  const [ids, setIds] = useState<Set<number>>(new Set(initialIds));
  const [openGroups, setOpenGroups] = useState<Set<string>>(
    () => new Set(groups.map((g) => g.qrup))
  );
  const [filter, setFilter] = useState("");
  const [isPending, start] = useTransition();

  const initialSet = useMemo(() => new Set(initialIds), [initialIds]);
  const isDirty = useMemo(() => {
    if (ids.size !== initialSet.size) return true;
    for (const id of ids) if (!initialSet.has(id)) return true;
    return false;
  }, [ids, initialSet]);

  const filtered: Group[] = useMemo(() => {
    const term = filter.trim().toLowerCase();
    if (!term) return groups;
    return groups
      .map((g) => ({
        ...g,
        items: g.items.filter(
          (i) =>
            i.ad.toLowerCase().includes(term) ||
            i.kod.toLowerCase().includes(term) ||
            (i.aciqlamaq ?? "").toLowerCase().includes(term)
        ),
      }))
      .filter((g) => g.items.length > 0);
  }, [groups, filter]);

  function toggle(id: number) {
    if (isSystem) return;
    setIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll(selectAll: boolean) {
    if (isSystem) return;
    if (selectAll) {
      const all = new Set<number>();
      for (const g of groups) for (const i of g.items) all.add(i.id);
      setIds(all);
    } else {
      setIds(new Set());
    }
  }

  function toggleGroup(qrup: string, selectAll: boolean) {
    if (isSystem) return;
    const group = groups.find((g) => g.qrup === qrup);
    if (!group) return;
    setIds((prev) => {
      const next = new Set(prev);
      if (selectAll) for (const i of group.items) next.add(i.id);
      else for (const i of group.items) next.delete(i.id);
      return next;
    });
  }

  function save() {
    if (isSystem) return;
    const fd = new FormData();
    fd.set("rol_id", String(rolId));
    fd.set("icaze_ids", Array.from(ids).join(","));
    start(async () => {
      const r = await saveRolePerms(fd);
      if (r.ok) toast.success("Yadda saxlandı");
      else toast.error(r.error);
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card/40 p-2">
        <Input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="İcazə adında axtar..."
          className="h-8 w-[260px]"
        />
        <div className="ml-auto flex items-center gap-2 text-xs">
          <span className="text-muted-foreground">
            Seçilmiş: <b>{ids.size}</b>
          </span>
          {!isSystem && (
            <>
              <button
                type="button"
                className="rounded-md border px-2 py-1"
                onClick={() => toggleAll(true)}
              >
                Hamısı
              </button>
              <button
                type="button"
                className="rounded-md border px-2 py-1"
                onClick={() => toggleAll(false)}
              >
                Heç biri
              </button>
              <Button size="sm" disabled={!isDirty || isPending} onClick={save}>
                {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                Saxla
              </Button>
            </>
          )}
        </div>
      </div>

      {isSystem && (
        <div className="rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
          Sistem rolunun icazələri sabitdir və redaktə edilə bilməz.
        </div>
      )}

      <div className="space-y-2">
        {filtered.map((g) => {
          const sel = g.items.filter((i) => ids.has(i.id)).length;
          const open = openGroups.has(g.qrup);
          return (
            <div key={g.qrup} className="rounded-lg border border-border bg-card/40 overflow-hidden">
              <button
                type="button"
                className="flex w-full items-center gap-2 bg-secondary/40 px-3 py-2 text-left text-sm font-semibold"
                onClick={() => {
                  setOpenGroups((p) => {
                    const next = new Set(p);
                    if (next.has(g.qrup)) next.delete(g.qrup);
                    else next.add(g.qrup);
                    return next;
                  });
                }}
              >
                {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                <span className="flex-1 capitalize">{g.qrup}</span>
                <Badge
                  variant="outline"
                  className={`text-[10px] ${sel > 0 ? "border-success/30 text-success" : ""}`}
                >
                  {sel}/{g.items.length}
                </Badge>
                {!isSystem && (
                  <span
                    className="ml-2 flex items-center gap-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      className="rounded border px-1.5 py-0.5 text-[10px]"
                      onClick={() => toggleGroup(g.qrup, true)}
                    >
                      +
                    </button>
                    <button
                      type="button"
                      className="rounded border px-1.5 py-0.5 text-[10px]"
                      onClick={() => toggleGroup(g.qrup, false)}
                    >
                      −
                    </button>
                  </span>
                )}
              </button>
              {open && (
                <div className="divide-y divide-border/40">
                  {g.items.map((i) => {
                    const on = ids.has(i.id);
                    return (
                      <label
                        key={i.id}
                        className={`flex cursor-pointer items-center gap-3 px-3 py-2 text-sm transition hover:bg-secondary/40 ${
                          on ? "bg-success/5" : ""
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={on}
                          disabled={isSystem}
                          onChange={() => toggle(i.id)}
                          className="h-3.5 w-3.5"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="font-medium">{i.ad}</div>
                          <div className="text-[10.5px] text-muted-foreground">
                            {i.aciqlamaq ? <span>{i.aciqlamaq} · </span> : null}
                            <code>{i.kod}</code>
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
