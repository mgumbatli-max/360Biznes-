import Link from "next/link";
import { LayoutGrid, List } from "lucide-react";
import { cn } from "@/lib/utils";

export type ViewMode = "cedvel" | "kerpic";

/**
 * URL-state view toggle. Reads ?gorunus=cedvel|kerpic (or namespaced via `param`).
 * Preserves all other searchParams when switching.
 */
export function ViewToggle({
  base,
  current,
  searchParams,
  param = "gorunus",
  label,
}: {
  base: string;
  current: ViewMode;
  searchParams: Record<string, string | undefined>;
  param?: string;
  label?: string;
}) {
  const build = (mode: ViewMode) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(searchParams)) {
      if (v && k !== param) params.set(k, String(v));
    }
    params.set(param, mode);
    return `${base}?${params.toString()}`;
  };

  return (
    <div className="inline-flex items-center gap-1 rounded-lg border border-border/60 bg-card/40 p-0.5">
      {label && (
        <span className="px-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
      )}
      <Link
        href={build("cedvel")}
        className={cn(
          "inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs font-medium transition",
          current === "cedvel"
            ? "bg-primary/15 text-primary"
            : "text-muted-foreground hover:bg-secondary/40 hover:text-foreground"
        )}
        title="Cədvəl görünüşü"
      >
        <List className="h-3.5 w-3.5" />
        Cədvəl
      </Link>
      <Link
        href={build("kerpic")}
        className={cn(
          "inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs font-medium transition",
          current === "kerpic"
            ? "bg-primary/15 text-primary"
            : "text-muted-foreground hover:bg-secondary/40 hover:text-foreground"
        )}
        title="Kərpic görünüşü"
      >
        <LayoutGrid className="h-3.5 w-3.5" />
        Kərpic
      </Link>
    </div>
  );
}

/** Helper to parse the current view mode from searchParams. */
export function parseView(sp: Record<string, string | undefined>, param = "gorunus", defaultMode: ViewMode = "cedvel"): ViewMode {
  return sp[param] === "kerpic" ? "kerpic" : sp[param] === "cedvel" ? "cedvel" : defaultMode;
}

/** Sort link helper — header cell with up/down arrow. */
export function SortLink({
  base,
  searchParams,
  field,
  currentField,
  currentDir,
  param = "sort",
  dirParam = "dir",
  children,
  className,
}: {
  base: string;
  searchParams: Record<string, string | undefined>;
  field: string;
  currentField?: string;
  currentDir?: "asc" | "desc";
  param?: string;
  dirParam?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const isActive = currentField === field;
  const nextDir: "asc" | "desc" = isActive && currentDir === "desc" ? "asc" : "desc";
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(searchParams)) {
    if (v && k !== param && k !== dirParam) params.set(k, String(v));
  }
  params.set(param, field);
  params.set(dirParam, nextDir);

  return (
    <Link
      href={`${base}?${params.toString()}`}
      className={cn(
        "inline-flex items-center gap-1 transition",
        isActive ? "text-primary" : "hover:text-foreground",
        className
      )}
    >
      {children}
      <span className="text-[8px] leading-none opacity-70">
        {isActive ? (currentDir === "desc" ? "▼" : "▲") : "↕"}
      </span>
    </Link>
  );
}
