import Link from "next/link";
import { List, LayoutGrid, FolderTree } from "lucide-react";
import { cn } from "@/lib/utils";

export type AlertView = "list" | "card" | "group";

export function AlertViewToggle({
  current,
  searchParams,
}: {
  current: AlertView;
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const build = (view: AlertView) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(searchParams)) {
      if (k === "view") continue;
      if (Array.isArray(v)) {
        for (const x of v) if (x) p.append(k, x);
      } else if (typeof v === "string" && v) {
        p.set(k, v);
      }
    }
    if (view !== "list") p.set("view", view);
    const qs = p.toString();
    return qs ? `/xeberdarliqlar?${qs}` : "/xeberdarliqlar";
  };

  const items: { id: AlertView; label: string; icon: typeof List }[] = [
    { id: "list", label: "Cədvəl", icon: List },
    { id: "card", label: "Kart", icon: LayoutGrid },
    { id: "group", label: "Qruplaşdırılmış", icon: FolderTree },
  ];

  return (
    <div className="inline-flex items-center gap-0.5 rounded-lg border border-border/60 bg-card/40 p-0.5">
      {items.map((it) => {
        const Icon = it.icon;
        const active = current === it.id;
        return (
          <Link
            key={it.id}
            href={build(it.id)}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition",
              active ? "bg-foreground text-background" : "text-muted-foreground hover:bg-secondary/40 hover:text-foreground"
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{it.label}</span>
          </Link>
        );
      })}
    </div>
  );
}
