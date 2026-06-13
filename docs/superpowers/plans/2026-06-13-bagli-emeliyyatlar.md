# Bağlı əməliyyatlar (Linked Operations) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use `- [ ]`. Branch: `main` (lokal commit-lər; push/merge yox icazəsiz). Verification = `npx tsc --noEmit -p tsconfig.json` (kök, yalnız əlaqəli faylları yoxla — əvvəlcədən mövcud FormData/Timeout xətaları YOX, onlar artıq düzəldilib) + canlı `:3500` curl. RN test yox.

**Goal:** İstənilən əməliyyatda (satış/alış/maliyyə/qaytarma/transfer/servis) ona bağlı əməliyyatları yerindəcə görmək və lazım olduqda səhifədən çıxmadan yerindəcə ləğv etmək (hər ləğv ayrıca təsdiq+səbəb; reverse-order zənciri).

**Architecture:** Mövcud blocker infra üzərində. Yeni ortaq `getLinkedOperations({type,id})` (bütün tiplərin bağlarını qaytarır, `blocks` bayrağı ilə). Təkrar-istifadəli `LinkedOperationsPanel` (view/resolve) — ləğv dialoqlarında (BlockerList əvəzinə) və OperationQuickView "Bağlı əməliyyatlar" tab-ında. Yerindəcə ləğv `cancelLinkedOperation` ilə düzgün mövcud action-a marşrutlaşır.

**Tech Stack:** Next.js 16 server actions/components, Prisma, TanStack Query (client), mövcud `components/ui/{dialog,sheet}`, `lib/blockers/*`.

**Spec:** `docs/superpowers/specs/2026-06-13-bagli-emeliyyatlar-design.md`.

---

## File Structure
| Fayl | Məsuliyyət | Əməliyyat |
|---|---|---|
| `features/emeliyyat/linked-operations.ts` | `LinkedOp` tip + `getLinkedOperations({type,id})` server query (bütün tiplər) | Create |
| `features/emeliyyat/components/linked-operations-panel.tsx` | Təkrar-istifadəli panel (view/resolve, inline Bax + yerindəcə Ləğv) | Create |
| `features/emeliyyat/cancel-linked.ts` | `cancelLinkedOperation(op, reason)` — tipə görə mövcud cancel action-a marşrut | Create |
| `features/ticaret/components/cancel-sale-dialog.tsx` | BlockerList → `<LinkedOperationsPanel mode=resolve>` | Modify |
| `features/ticaret/components/alis-row-actions.tsx` | (CancelDialog) eyni inteqrasiya | Modify |
| `features/ticaret/components/operation-quick-view.tsx` | "Bağlı əməliyyatlar" tab + panel | Modify |
| `features/maliyye/components/...cancel dialog` | (varsa) maliyyə ləğv dialoquna panel | Modify |

---

## Task 1: Backend — `getLinkedOperations` (bütün tiplər)

**Files:** Create `features/emeliyyat/linked-operations.ts`

**Kontekst (oxu):** `features/maliyye/operations-queries.ts` (OperationRow select-i: finance op-un display sahələri — `tarix`, `meblegh`/`azn_meblegh`, `qeyd`, `type_kod`, `status`, `satis_id`, `alish_id`, `satis_sifarisleri.nomre`, `alis_sifarisleri.nomre`), `lib/blockers/find-purchase-blockers.ts` (`findSalesUsingProducts`), `lib/blockers/find-sale-blockers.ts`, `lib/blockers/types.ts`. Schema link sahələri: `finance_operations.{satis_id,alish_id,servis_id}`, `finance_payment_allocations.{payment_op_id,satis_id,alish_id,mebleg}`, `anbar_hereketleri.{ref_nov,ref_id}`, `qaytarma_sifarisleri.{original_id,nov}`, `servis_qeydleri.{satis_id}`.

- [ ] **Step 1: Tip + skeleton.** Faylın başına:
```ts
import "server-only";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";

export type LinkedOpType = "satis" | "alis" | "maliyye" | "qaytarma" | "transfer" | "servis";
export type LinkedOp = {
  type: LinkedOpType;
  id: string;
  nomre: string;
  tarix: string | null;   // ISO
  mebleg: number;
  status: string;
  rol: string;            // "Ödəniş", "Bu malı satan satış", "Qaytarma", "Servis geliri", ...
  blocks: boolean;        // əsas op-un ləğvini bloklayır (reverse-order)
  href: string;           // deep-link (Bax fallback / yeni tab)
};

export async function getLinkedOperations(target: { type: LinkedOpType; id: string }): Promise<LinkedOp[]> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const out: LinkedOp[] = [];
    // tip üzrə doldurulur (aşağıdakı step-lər)
    // dedupe: type+id
    const seen = new Set<string>();
    const push = (op: LinkedOp) => { const k = op.type + ":" + op.id; if (!seen.has(k)) { seen.add(k); out.push(op); } };
    // ... (Step 2-7)
    return out;
  });
}
```

- [ ] **Step 2: target=satis.** Bağlılar: maliyyə ödənişləri (`finance_operations.satis_id`) → `blocks:true`; qaytarmalar (`qaytarma_sifarisleri original_id=id, nov="satis"`); (opsional) stok hərəkəti. Maliyyə ödənişləri:
```ts
if (target.type === "satis") {
  const pays = await prisma.finance_operations.findMany({
    where: { sahibkar_id: sahibkarId, satis_id: target.id, deleted_at: null, status: { not: "legv" } },
    select: { id: true, tarix: true, meblegh: true, azn_meblegh: true, qeyd: true, status: true },
    orderBy: { tarix: "desc" }, take: 30,
  });
  for (const p of pays) push({ type:"maliyye", id:p.id, nomre: p.qeyd?.slice(0,40) || "Ödəniş",
    tarix: p.tarix?.toISOString() ?? null, mebleg: Number(p.azn_meblegh ?? p.meblegh ?? 0),
    status: p.status, rol: "Ödəniş", blocks: true, href: `/maliyye/emeliyyat?op=${p.id}` });
  const rets = await prisma.qaytarma_sifarisleri.findMany({
    where: { sahibkar_id: sahibkarId, original_id: target.id, nov: "satis", deleted_at: null, status: { not: "legv" } },
    select: { id: true, nomre: true, tarix: true, son_mebleg: true, status: true }, take: 20,
  });
  for (const r of rets) push({ type:"qaytarma", id:r.id, nomre:r.nomre, tarix:r.tarix?.toISOString() ?? null,
    mebleg: Number(r.son_mebleg ?? 0), status: r.status ?? "", rol:"Qaytarma", blocks:false, href:`/ticaret/qaytarma?q=${r.id}` });
}
```
*(Qeyd: `qaytarma_sifarisleri` sahə adlarını oxuyub dəqiqləşdir — `son_mebleg`/`umumi_mebleg`/`mebleg`. operations-queries.ts qaytarma select-inə bax.)*

- [ ] **Step 3: target=alis.** Bağlılar: bu alışın malını satan satışlar (`findSalesUsingProducts` — alış sətirlərindən mehsul_id-lər + anbar) → `blocks:true`; maliyyə ödənişləri (`finance_operations.alish_id`) → `blocks:true`; qaytarmalar (`nov="alis"`).
```ts
if (target.type === "alis") {
  const lines = await prisma.alis_sifaris_satirlari.findMany({ where: { sifaris_id: target.id }, select: { mehsul_id: true } });
  const purchase = await prisma.alis_sifarisleri.findUnique({ where: { id: target.id }, select: { anbar_id: true } });
  const { findSalesUsingProducts } = await import("@/lib/blockers/find-purchase-blockers");
  const saleBlockers = await findSalesUsingProducts(lines.map(l=>l.mehsul_id).filter(Boolean) as string[], purchase?.anbar_id, prisma);
  for (const b of saleBlockers) push({ type:"satis", id:b.id, nomre: b.label.split(" — ")[0] || b.id.slice(0,8),
    tarix: (b.tarix as Date | undefined)?.toISOString?.() ?? (typeof b.tarix==="string"?b.tarix:null), mebleg: b.amount ?? 0,
    status: b.badge ?? "", rol:"Bu malı satan satış", blocks:true, href:b.href });
  const pays = await prisma.finance_operations.findMany({
    where: { sahibkar_id: sahibkarId, alish_id: target.id, deleted_at: null, status: { not: "legv" } },
    select: { id:true, tarix:true, meblegh:true, azn_meblegh:true, qeyd:true, status:true }, orderBy:{tarix:"desc"}, take:30 });
  for (const p of pays) push({ type:"maliyye", id:p.id, nomre:p.qeyd?.slice(0,40)||"Ödəniş", tarix:p.tarix?.toISOString()??null,
    mebleg:Number(p.azn_meblegh??p.meblegh??0), status:p.status, rol:"Ödəniş", blocks:true, href:`/maliyye/emeliyyat?op=${p.id}` });
}
```
*(Qeyd: `alis_sifaris_satirlari` adını schema-dan təsdiqlə.)*

- [ ] **Step 4: target=maliyye.** Bağlılar: hədəf satış (`satis_id`), alış (`alish_id`), servis (`servis_id`) + allocation hədəfləri. Maliyyə ləğvi bloklamır → hamısı `blocks:false`.
```ts
if (target.type === "maliyye") {
  const op = await prisma.finance_operations.findUnique({ where: { id: target.id },
    select: { satis_id:true, alish_id:true, servis_id:true } });
  if (op?.satis_id) { const s = await prisma.satis_sifarisleri.findUnique({ where:{id:op.satis_id}, select:{id:true,nomre:true,tarix:true,son_mebleg:true,status:true} });
    if (s) push({ type:"satis", id:s.id, nomre:s.nomre, tarix:s.tarix?.toISOString()??null, mebleg:Number(s.son_mebleg??0), status:s.status??"", rol:"Bağlı satış", blocks:false, href:`/ticaret/satislar/${s.id}` }); }
  if (op?.alish_id) { const a = await prisma.alis_sifarisleri.findUnique({ where:{id:op.alish_id}, select:{id:true,nomre:true,tarix:true,umumi_mebleg:true,status:true} });
    if (a) push({ type:"alis", id:a.id, nomre:a.nomre, tarix:a.tarix?.toISOString()??null, mebleg:Number(a.umumi_mebleg??0), status:a.status??"", rol:"Bağlı alış", blocks:false, href:`/ticaret/alislar/${a.id}` }); }
  // servis: schema-dan servis_qeydleri display sahələrini oxuyub əlavə et (nomre, tarix, status)
}
```

- [ ] **Step 5: target=qaytarma / transfer / servis (view).** 
  - qaytarma: orijinal (`original_id` → satis/alis) + əksetmə maliyyə ops.
  - transfer: stok hərəkətləri (`anbar_hereketleri ref_nov="transfer", ref_id=id`) — mənbə/hədəf anbar (rol kimi).
  - servis: maliyyə ops (`finance_operations.servis_id`) + orijinal satış (`servis_qeydleri.satis_id`).
  Hər biri üçün uyğun `findMany` + `push(...)`, `blocks:false` (bunlar əsasən view; ləğv-blok zənciri əsasən satış/alış/maliyyədir). Schema sahə adlarını oxuyub dəqiqləşdir.

- [ ] **Step 6: Verify** — `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "linked-operations|error TS" | grep -vE "FormData|Timeout"` təmiz.

- [ ] **Step 7: Commit** — `git add features/emeliyyat/linked-operations.ts && git commit -m "feat(emeliyyat): getLinkedOperations — bağlı əməliyyatlar query (bütün tiplər)"`

---

## Task 2: Yerindəcə ləğv marşrutu — `cancelLinkedOperation`

**Files:** Create `features/emeliyyat/cancel-linked.ts`

**Kontekst (oxu+təsdiqlə):** `cancelSale(saleId,reason)` (`features/ticaret/satis-actions.ts`), `cancelPurchase(purchaseId,reason)` (`features/ticaret/alis-actions.ts`), `cancelFinanceOperation({id,reason})` (`features/maliyye/cancel-operation-action.ts`). qaytarma/transfer/servis ləğv action-larını grep ilə tap (`cancelQaytarma`/`legv`...); varsa marşruta əlavə et, yoxdursa o tip üçün yalnız Bax (deep-link).

- [ ] **Step 1:** 
```ts
"use server";
import type { LinkedOpType } from "./linked-operations";
import { cancelSale } from "@/features/ticaret/satis-actions";
import { cancelPurchase } from "@/features/ticaret/alis-actions";
import { cancelFinanceOperation } from "@/features/maliyye/cancel-operation-action";

export type CancelLinkedResult =
  | { ok: true }
  | { ok: false; error: string; blockers?: import("@/lib/blockers/types").Blocker[]; hint?: string };

export async function cancelLinkedOperation(
  op: { type: LinkedOpType; id: string }, reason: string,
): Promise<CancelLinkedResult> {
  switch (op.type) {
    case "satis":   return cancelSale(op.id, reason);
    case "alis":    return cancelPurchase(op.id, reason);
    case "maliyye": return cancelFinanceOperation({ id: op.id, reason }) as Promise<CancelLinkedResult>;
    default:        return { ok: false, error: "Bu növ əməliyyat yerindəcə ləğv edilə bilmir — detala keçin." };
  }
}
```
*(qaytarma/transfer/servis cancel action-ları varsa case-lər əlavə et; cancelFinanceOperation-ın input/return formasını oxuyub uyğunlaşdır.)*

- [ ] **Step 2: Verify** tsc təmiz (əlaqəli).
- [ ] **Step 3: Commit** — `git commit -m "feat(emeliyyat): cancelLinkedOperation marşrutu (satis/alis/maliyye)"`

---

## Task 3: `LinkedOperationsPanel` komponenti

**Files:** Create `features/emeliyyat/components/linked-operations-panel.tsx`

**Kontekst (oxu):** `components/ui/action-error-toast.tsx` (BlockerList stili — ikon/label/badge), `features/ticaret/components/operation-quick-view.tsx` (inline Bax üçün Sheet açma pattern-i + InfoRow/mini-table), `components/ui/dialog.tsx`, `components/ui/button.tsx`. TanStack Query mövcud (client).

- [ ] **Step 1:** `"use client"` komponent. Props: `{ target: {type,id}, mode: "view"|"resolve", onResolved?: () => void }`. Daxili:
  - `getLinkedOperations`-ı server-dən almaq üçün: ya server action wrapper (`async function loadLinked(target)` "use server" `features/emeliyyat/linked-operations-action.ts`), ya da target ekranı server-component-dirsə props ilə ötür. Burada **client** olduğu üçün kiçik server action `getLinkedOperationsAction(target)` yarat (Task 3a) və `useQuery(["linked", target], () => getLinkedOperationsAction(target))`.
  - Sətirlər: ikon (tip), `rol` etiketi, `nomre`, `mebleg` (`formatMoney`), `tarix`, status badge. `mode=resolve`-də `blocks:true` olanlar vurğulanır (qırmızı border).
  - Hər sətirdə düymələr: **Bax** (inline `OperationQuickView` aç — mövcud komponent), **Ləğv et** (yalnız `type∈{satis,alis,maliyye}`).
  - "Ləğv et" → kiçik nested confirm dialoqu (Səbəb* textarea + Təsdiq/İmtina) → `cancelLinkedOperation(op, reason)`:
    - `ok` → toast.success, `refetch()` (panel yenilənir), `onResolved?.()`.
    - `ok:false` + `blockers` → həmin op-un öz blocker-lərini göstər (növbəti səviyyə) — eyni panel pattern və ya inline alt-siyahı; sadəlik üçün: toast + həmin op üçün `getLinkedOperations` ilə alt-panel aç.
  - `mode=resolve`-də: `blocks:true` sayını izlə; 0 olanda `onResolved` (əsas dialoq əsas Ləğv-i aktiv edir).
- [ ] **Step 1a (server action):** `features/emeliyyat/linked-operations-action.ts`: `"use server"; export async function getLinkedOperationsAction(target){ return getLinkedOperations(target); }` (icazə: oxu — mövcud requireTenant kifayətdir; istəyə görə `requirePerm`).
- [ ] **Step 2: Verify** tsc təmiz.
- [ ] **Step 3: Commit** — `git commit -m "feat(emeliyyat): LinkedOperationsPanel (view/resolve, inline Bax + yerindəcə Ləğv)"`

---

## Task 4: Ləğv dialoqlarına inteqrasiya (satış/alış/maliyyə)

**Files:** Modify `features/ticaret/components/cancel-sale-dialog.tsx`, `features/ticaret/components/alis-row-actions.tsx`, (varsa) maliyyə ləğv dialoqu.

- [ ] **Step 1:** Hər ləğv dialoqunda, bloklanma baş verəndə (`res.blockers?.length`), mövcud `<BlockerList>` (link) əvəzinə `<LinkedOperationsPanel mode="resolve" target={{type:"satis"|"alis"|"maliyye", id}} onResolved={() => retry()} />` göstər. `error` + `hint` mətnləri qalır (başlıq kimi).
- [ ] **Step 2:** "Ləğv et" əsas düyməsi: `blocks:true` qalan varsa disabled / xəbərdarlıq; panel `onResolved`-da hamısı təmizlənəndə aktiv. (Və ya istifadəçi yenidən "Ləğv et" basır, server yenə yoxlayır — sadə variant.)
- [ ] **Step 3: Verify** tsc təmiz.
- [ ] **Step 4: Commit** — `git commit -m "feat(ticaret): ləğv dialoqlarında yerindəcə bağlı-əməliyyat həlli (BlockerList əvəzinə panel)"`

---

## Task 5: OperationQuickView — "Bağlı əməliyyatlar" tab

**Files:** Modify `features/ticaret/components/operation-quick-view.tsx`

- [ ] **Step 1:** Mövcud tab-lara (Ümumi/Sətirlər/Ödənişlər/Tarixçə) **"Bağlı əməliyyatlar"** tab əlavə et → `<LinkedOperationsPanel mode="view" target={{type: row.nov, id: row.id}} />`. (row.nov satis/alis/qaytarma/transfer; maliyyə üçün maliyyə detal/QuickView-da eyni panel.)
- [ ] **Step 2: Verify** tsc təmiz.
- [ ] **Step 3: Commit** — `git commit -m "feat(ticaret): QuickView-da Bağlı əməliyyatlar tab"`

---

## Task 6: Yekun yoxlama

- [ ] **Step 1:** `npx tsc --noEmit -p tsconfig.json` — yeni fayllarda xəta yox (FormData/Timeout yox — düzəldilib).
- [ ] **Step 2:** `npm run build` keçir.
- [ ] **Step 3: Canlı (:3500)** — login → bir alışı ləğv et (malı satılmış) → panel satışları göstərir → Bax inline → yerindəcə satışı ləğv et (ödənişi varsa onu da, hər dəfə təsdiq+səbəb) → alış ləğv olur. QuickView-da Bağlı əməliyyatlar tab görünür.
- [ ] **Step 4: Adversarial** — yerindəcə ləğv marşrutu düzgün action çağırır, icazə server-də yoxlanır, tenant izolyasiyası, dedupe; pul-axını pozulmur.

---

## Out of scope (sonra)
- Toplu (bulk) yerindəcə ləğv.
- qaytarma/transfer/servis üçün yerindəcə ləğv (cancel action-ları yoxdursa) — view+deep-link; action varsa Task 2-də əlavə.
- Mobil app-da panel.
- Məhsul-partiya səviyyəsində dəqiq alış→satış izləmə (stok-based ümumi siyahı kifayətdir).
