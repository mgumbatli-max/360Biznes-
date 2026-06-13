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

export type { LinkedOp, LinkedOpType };
