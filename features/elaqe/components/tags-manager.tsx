"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, Loader2, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { addContactTag, removeContactTag } from "../actions";

type TagItem = { id: number; tagId: number; ad: string; reng: string | null; emoji: string | null };

export function TagsManager({ kontragentId, tags }: { kontragentId: string; tags: TagItem[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");

  function onAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!name.trim()) return;
    startTransition(async () => {
      const res = await addContactTag(kontragentId, name.trim());
      if (res.ok) {
        toast.success("Tag əlavə edildi");
        setName("");
        router.refresh();
      } else toast.error(res.error);
    });
  }

  function onRemove(tagId: number) {
    startTransition(async () => {
      const res = await removeContactTag(kontragentId, tagId);
      if (res.ok) {
        toast.success("Tag silindi");
        router.refresh();
      } else toast.error(res.error);
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {tags.length === 0 ? (
          <p className="text-xs text-muted-foreground">Tag yoxdur</p>
        ) : (
          tags.map((t) => (
            <span
              key={t.id}
              className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-xs"
            >
              <Tag className="h-3 w-3" />
              {t.emoji ? `${t.emoji} ` : ""}{t.ad}
              <button
                type="button"
                onClick={() => onRemove(t.tagId)}
                disabled={pending}
                className="ml-0.5 rounded-full hover:bg-danger/15 hover:text-danger"
                title="Sil"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))
        )}
      </div>

      <form onSubmit={onAdd} className="flex gap-2">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="məs. VIP, gözləyir, problem..."
          maxLength={60}
          className="max-w-xs"
          disabled={pending}
        />
        <Button type="submit" size="sm" disabled={pending || !name.trim()}>
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
          Əlavə et
        </Button>
      </form>
    </div>
  );
}
