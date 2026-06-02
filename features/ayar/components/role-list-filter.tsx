"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, Lock, UserPlus, CheckSquare, ChevronRight, X, Sparkles, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Role = {
  id: number;
  ad: string;
  aciqlamaq: string | null;
  reng: string | null;
  sistem: boolean | null;
  _count: { istifadeciler: number; rol_icazeleri: number };
};

type FilterMode = "all" | "active" | "empty";

export function RoleListFilter({ roles }: { roles: Role[] }) {
  const [q, setQ] = useState("");
  const [mode, setMode] = useState<FilterMode>("all");

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return roles.filter((r) => {
      // Mode
      if (mode === "active" && r._count.istifadeciler === 0) return false;
      if (mode === "empty" && r._count.istifadeciler > 0) return false;
      // Text
      if (!term) return true;
      return (
        r.ad.toLowerCase().includes(term) ||
        (r.aciqlamaq ?? "").toLowerCase().includes(term)
      );
    });
  }, [roles, q, mode]);

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Rol adı / təsvirə görə axtar..."
            className="h-9 pl-8 pr-8"
          />
          {q && (
            <button
              type="button"
              onClick={() => setQ("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-muted-foreground hover:bg-secondary"
              aria-label="Təmizlə"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        <div className="inline-flex rounded-md border border-border bg-secondary/40 p-0.5 text-xs">
          {([
            { v: "all", label: "Hər ikisi" },
            { v: "active", label: "Əməkdaşlı" },
            { v: "empty", label: "Boş" },
          ] as const).map((b) => (
            <button
              key={b.v}
              type="button"
              onClick={() => setMode(b.v)}
              className={cn(
                "rounded-sm px-2.5 py-1 transition",
                mode === b.v ? "bg-background font-semibold text-foreground shadow-sm" : "text-muted-foreground",
              )}
            >
              {b.label}
            </button>
          ))}
        </div>

        <span className="ml-auto text-[11px] text-muted-foreground">
          <b className="text-foreground">{filtered.length}</b> / {roles.length} rol göstərilir
        </span>
      </div>

      {/* Empty filter */}
      {filtered.length === 0 && (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border py-12 text-center">
          <Search className="h-5 w-5 text-muted-foreground/50" />
          <p className="font-medium">Filtrlərə uyğun rol tapılmadı</p>
          <button
            type="button"
            onClick={() => {
              setQ("");
              setMode("all");
            }}
            className="text-xs font-semibold text-primary hover:underline"
          >
            Filtrləri sıfırla
          </button>
        </div>
      )}

      {/* Sənin rolların */}
      {filtered.length > 0 && (
        <RoleSection
          icon={Sparkles}
          title="Sənin rolların"
          desc="Bütün rolların tam redaktə olunan — adını, rəngini, icazələrini sərbəst dəyiş"
          roles={filtered}
        />
      )}
    </div>
  );
}

function RoleSection({
  icon: Icon,
  title,
  desc,
  roles,
  locked,
}: {
  icon: typeof Lock;
  title: string;
  desc: string;
  roles: Role[];
  locked?: boolean;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-bold tracking-tight">{title}</h2>
        <Badge variant="outline" className="ml-1 h-5 text-[10px]">{roles.length}</Badge>
      </div>
      <p className="-mt-2 text-[11.5px] text-muted-foreground">{desc}</p>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {roles.map((r) => (
          <Link key={r.id} href={`/ayarlar/rollar/${r.id}`} className="group block">
            <Card className="glass relative h-full overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg hover:shadow-foreground/5">
              <div
                aria-hidden
                className="absolute inset-y-0 left-0 w-1 transition-all group-hover:w-1.5"
                style={{ background: r.reng ?? "#6366F1" }}
              />
              <CardContent className="space-y-3 py-4 pl-5">
                <div className="flex items-start gap-3">
                  <div
                    className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-sm font-bold text-white shadow-sm transition-transform group-hover:scale-105"
                    style={{ background: r.reng ?? "#6366F1" }}
                  >
                    {r.ad.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="truncate font-semibold capitalize">{r.ad}</h3>
                      {locked && <Lock className="h-3 w-3 text-muted-foreground" aria-label="sistem rolu" />}
                    </div>
                    <p className="mt-0.5 line-clamp-2 min-h-[2lh] text-[11.5px] leading-snug text-muted-foreground">
                      {r.aciqlamaq ?? <span className="italic">Təsvir yoxdur</span>}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 flex-shrink-0 text-muted-foreground/40 transition group-hover:translate-x-0.5 group-hover:text-primary" />
                </div>
                <div className="flex items-center gap-4 border-t border-border/40 pt-2.5">
                  <Metric icon={UserPlus} value={r._count.istifadeciler} label="əməkdaş" highlight={r._count.istifadeciler > 0} />
                  <Metric icon={CheckSquare} value={r._count.rol_icazeleri} label="icazə" />
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </section>
  );
}

function Metric({ icon: Icon, value, label, highlight }: { icon: typeof Users; value: number; label: string; highlight?: boolean }) {
  return (
    <div className={cn("flex items-center gap-1.5 text-xs", highlight && "text-emerald-600 dark:text-emerald-400")}>
      <Icon className={cn("h-3 w-3", highlight ? "text-emerald-500" : "text-muted-foreground")} />
      <span className="font-bold tabular-nums">{value}</span>
      <span className={cn(!highlight && "text-muted-foreground")}>{label}</span>
    </div>
  );
}
