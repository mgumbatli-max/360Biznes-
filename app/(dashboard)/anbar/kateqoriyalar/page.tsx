import type { Metadata } from "next";
import { Layers, Package, Lock } from "lucide-react";
import { AnbarSubNav } from "@/components/anbar-subnav";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { CategoryTree, type CategoryNode } from "@/features/anbar/components/category-tree";
import { NewCategorySheet } from "@/features/anbar/components/new-category-sheet";
import { formatCompactNumber } from "@/lib/utils";

export const metadata: Metadata = { title: "Kateqoriyalar — Anbar" };
export const dynamic = "force-dynamic";

async function loadKateqoriyalar(): Promise<CategoryNode[]> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();

    const rows = await prisma.kateqoriyalar.findMany({
      where: { sahibkar_id: sahibkarId },
      orderBy: { ad: "asc" },
      select: { id: true, ad: true, ust_id: true, _count: { select: { mehsullar: true } } },
    });

    const map = new Map<number, CategoryNode>();
    for (const r of rows) {
      map.set(r.id, { id: r.id, ad: r.ad, ust_id: r.ust_id, product_count: r._count.mehsullar, children: [] });
    }
    const roots: CategoryNode[] = [];
    for (const n of map.values()) {
      if (n.ust_id && map.has(n.ust_id)) {
        map.get(n.ust_id)!.children.push(n);
      } else {
        roots.push(n);
      }
    }
    return roots;
  });
}

async function loadFlat(): Promise<{ id: number; ad: string }[]> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    return prisma.kateqoriyalar.findMany({
      where: { sahibkar_id: sahibkarId },
      orderBy: { ad: "asc" },
      select: { id: true, ad: true },
    });
  });
}

async function getCanEdit(): Promise<boolean> {
  return withTenant(async () => {
    const { rolId, icazeler } = requireTenant();
    return rolId === 1 || rolId === 9 || icazeler.includes("anbar.kateqoriya_idare");
  });
}

export default async function KateqoriyalarPage() {
  const [tree, flat, canEdit] = await Promise.all([loadKateqoriyalar(), loadFlat(), getCanEdit()]);

  const totalCategories = flat.length;
  const totalProducts = (function sum(nodes: CategoryNode[]): number {
    let s = 0;
    for (const n of nodes) s += n.product_count + sum(n.children);
    return s;
  })(tree);
  const empty = (function emptyCount(nodes: CategoryNode[]): number {
    let s = 0;
    for (const n of nodes) {
      if (n.product_count === 0 && n.children.length === 0) s += 1;
      s += emptyCount(n.children);
    }
    return s;
  })(tree);

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <AnbarSubNav active="/anbar/kateqoriyalar" />

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-500">
            <Layers className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Kateqoriyalar</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Məhsul kateqoriyaları — iyerarxik ağac. {canEdit ? "İkiqat klik ilə adı dəyişdirin, + düyməsi ilə alt-kateqoriya əlavə edin." : "Yalnız sahibkar və admin redaktə edə bilər."}
            </p>
            {!canEdit && (
              <div className="mt-1.5 inline-flex items-center gap-1 rounded-md bg-amber-500/10 px-2 py-0.5 text-[10.5px] font-semibold text-amber-700 dark:text-amber-400">
                <Lock className="h-3 w-3" /> Yalnız oxuma rejimi
              </div>
            )}
          </div>
        </div>
        {canEdit && <NewCategorySheet flat={flat} />}
      </header>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Cəmi kateqoriya" value={totalCategories} icon={Layers} color="primary" />
        <Stat label="Kök kateqoriya" value={tree.length} icon={Layers} color="amber" />
        <Stat label="Cəmi məhsul" value={totalProducts} icon={Package} color="emerald" />
        <Stat label="Boş kateqoriya" value={empty} icon={Layers} color={empty > 0 ? "amber" : "muted"} />
      </section>

      <CategoryTree tree={tree} canEdit={canEdit} />

      <div className="rounded-lg border border-dashed border-border/40 bg-card/20 p-3 text-[10.5px] text-muted-foreground">
        <strong className="text-foreground">İpucu:</strong> Məhsulu və ya alt-kateqoriyası olan kateqoriya silinə bilməz. Əvvəl başqa kateqoriyaya köçürün.
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  color: "primary" | "emerald" | "amber" | "muted";
}) {
  const cls = {
    primary: "border-primary/30 bg-primary/5 text-primary",
    emerald: "border-emerald-500/30 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400",
    amber:   "border-amber-500/30 bg-amber-500/5 text-amber-600 dark:text-amber-400",
    muted:   "border-border bg-card text-muted-foreground",
  }[color];
  return (
    <div className={`rounded-xl border p-3 ${cls}`}>
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider opacity-75">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <div className="mt-1 text-2xl font-bold tabular-nums" title={String(value)}>
        {formatCompactNumber(value)}
      </div>
    </div>
  );
}
