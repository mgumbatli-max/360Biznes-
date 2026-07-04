"use server";

import {
  getLinkedOperations,
  type LinkedOp,
  type LinkedOpType,
} from "./linked-operations";

/**
 * `getLinkedOperations` client-component-lərdən (LinkedOperationsPanel) çağırıla
 * bilsin deyə nazik server action sarğısı. İcazə/tenant izolyasiyası
 * `getLinkedOperations` (→ `withTenant`/`requireTenant`) içində baş verir.
 */
export async function getLinkedOperationsAction(target: {
  type: LinkedOpType;
  id: string;
}): Promise<LinkedOp[]> {
  return getLinkedOperations(target);
}

// QEYD: "use server" faylı YALNIZ async funksiya export etməlidir. Əvvəl burada
// `export type { LinkedOp, LinkedOpType }` var idi → Turbopack server-action transform-u
// onu runtime dəyər referansına çevirib `ReferenceError: LinkedOp is not defined` atırdı
// (modul eval çökürdü → getSatisOptions və digər axınlar 500 → modallar açılmırdı).
// Tiplər indi birbaşa `./linked-operations`-dan import olunur.
