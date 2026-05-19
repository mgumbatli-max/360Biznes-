import "server-only";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { EMPTY_TREE, type SenedTree } from "./types";

const QRUP = "sahibkar_senedler";
const ACAR_TREE = "tree";

/**
 * Sahibkar sənədlər ağacını oxuyur. JSON formatda `ayarlar` cədvəlində saxlanır.
 * Schema migration tələb olunmur — yalnız sahibkar PIN ilə qorunan səhifədən
 * istifadə olunur.
 */
export async function getSenedTree(): Promise<SenedTree> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const row = await prisma.ayarlar.findFirst({
      where: { sahibkar_id: sahibkarId, qrup: QRUP, acar: ACAR_TREE },
      select: { deyer: true },
    });
    if (!row?.deyer) return { ...EMPTY_TREE };
    try {
      const parsed = JSON.parse(row.deyer) as SenedTree;
      return {
        folders: Array.isArray(parsed.folders) ? parsed.folders : [],
        files: Array.isArray(parsed.files) ? parsed.files : [],
      };
    } catch {
      return { ...EMPTY_TREE };
    }
  });
}

export async function saveSenedTree(tree: SenedTree): Promise<void> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    await prisma.ayarlar.upsert({
      where: {
        sahibkar_id_qrup_acar: {
          sahibkar_id: sahibkarId,
          qrup: QRUP,
          acar: ACAR_TREE,
        },
      },
      create: {
        sahibkar_id: sahibkarId,
        qrup: QRUP,
        acar: ACAR_TREE,
        deyer: JSON.stringify(tree),
        nov: "string",
      },
      update: {
        deyer: JSON.stringify(tree),
        yenilendi: new Date(),
      },
    });
  });
}

/**
 * Cari qovluğun ata-axını (breadcrumb).
 */
export function getBreadcrumb(tree: SenedTree, folderId: string | null): Array<{ id: string | null; name: string }> {
  const out: Array<{ id: string | null; name: string }> = [{ id: null, name: "Sənədlər" }];
  if (!folderId) return out;
  const chain: Array<{ id: string; name: string }> = [];
  let cur: string | null = folderId;
  const seen = new Set<string>();
  while (cur) {
    if (seen.has(cur)) break; // dövrü qoru
    seen.add(cur);
    const f = tree.folders.find((x) => x.id === cur);
    if (!f) break;
    chain.unshift({ id: f.id, name: f.name });
    cur = f.parent_id;
  }
  return [...out, ...chain];
}
