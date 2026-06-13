# Bağlı əməliyyatlar: yerindəcə görmə + həll (Linked Operations) — Dizayn

**Tarix:** 2026-06-13

## Məqsəd
İstənilən əməliyyatda (satış · alış · maliyyə · qaytarma · transfer · servis) ona **bağlı əməliyyatları yerindəcə görmək** və lazım olduqda **səhifədən çıxmadan yerindəcə həll etmək** (ləğv/sil). Xüsusən: bir əməliyyatı silmək/ləğv etmək asılılığa görə bloklananda, sistem bağlı əməliyyatları **elə oradaca göstərməli** və istifadəçi onları **operativ** həll edə bilməlidir (reverse-order: maliyyə → satış → alış). Hazırda blocker-lər yalnız "yeni tabda açılan link" kimi göstərilir → çox vaxt aparır.

## Qərarlar (təsdiqlənmiş)
- **Scope: bütün modullar** — satış, alış, maliyyə əməliyyatı, qaytarma, transfer, servis.
- **Yerindəcə ləğv: hər dəfə ayrıca təsdiq + səbəb** (avtomatik zəncir YOX; hər ləğv açıq təsdiq+səbəb tələb edir; zəncir ardıcıl, hər səviyyə öz blokunu göstərir).

## Mövcud infrastruktur (təkrar istifadə)
- `lib/blockers/types.ts` — `Blocker { type, id, label, href, amount?, tarix?, badge? }`.
- `lib/blockers/find-sale-blockers.ts` (`findSaleBlockers`), `lib/blockers/find-purchase-blockers.ts` (`findPurchaseBlockers`, `findSalesUsingProducts`).
- Ləğv action-ları strukturlaşmış qaytarır: `{ ok:false, error, blockers: Blocker[], hint }` — `cancelSale` (`features/ticaret/satis-actions.ts`), `cancelPurchase` (`features/ticaret/alis-actions.ts`), `cancelFinanceOperation` (`features/maliyye/cancel-operation-action.ts`).
- UI: `components/ui/action-error-toast.tsx` → `BlockerList` (hazırda `target="_blank"` link). Ləğv dialoqları: `features/ticaret/components/{cancel-sale-dialog,alis-row-actions,sale-row-actions}.tsx`. Zəngin baxış: `features/ticaret/components/operation-quick-view.tsx` (Sheet + tablar).
- **Bağ sahələri (tək həqiqət mənbəyi):**
  - `finance_operations.satis_id` → satış · `.alish_id` → alış · `.servis_id` → servis · `.kontragent_id`.
  - `finance_payment_allocations { payment_op_id, satis_id, alish_id, mebleg }` (bölünmüş ödəniş).
  - `anbar_hereketleri { ref_nov, ref_id }` (ref_nov ∈ satis/alis/transfer/qaytarma…; ref_id = mənbə əməliyyatın id-si).
  - `qaytarma_sifarisleri { original_id, nov }` → orijinal satış/alış.
  - `servis_qeydleri { satis_id, xidmet_geliri_op_id }`.

## Arxitektura

### 1. Backend — `getLinkedOperations` (tək query, bütün tiplər)
Fayl: `features/emeliyyat/linked-operations.ts` (yeni, ortaq).
```ts
type OpType = "satis" | "alis" | "maliyye" | "qaytarma" | "transfer" | "servis";
type LinkedOp = {
  type: OpType;
  id: string;
  nomre: string;
  tarix: string | null;
  mebleg: number;
  status: string;        // badge üçün
  rol: string;           // "Ödəniş" | "Bu satışı yaradan alış" | "Qaytarma" | ...
  blocks: boolean;       // bu op əsas əməliyyatın ləğvini bloklayırmı (reverse-order)
  cancellable: boolean;  // istifadəçinin icazəsi + statusuna görə ləğv oluna bilərmi
};
export async function getLinkedOperations(target: { type: OpType; id: string }): Promise<LinkedOp[]>;
```
Tip üzrə bağ məntiqi (tenant-scoped, `withTenant`/`getLiteConfigForTenant` pattern-i deyil — adi `prisma`):
- **satis:** maliyyə ops (`satis_id`) + allocations (`satis_id`) → `blocks:true`; qaytarma (`original_id=id, nov=satis`); stok hərəkəti (`ref_nov=satis, ref_id=id`).
- **alis:** maliyyə ops (`alish_id`) `blocks:true`; bu alışın malını satan satışlar (`findSalesUsingProducts`) `blocks:true`; qaytarma; stok hərəkəti (`ref_nov=alis`).
- **maliyye:** öz hədəfi (`satis_id`→satış, `alish_id`→alış, `servis_id`→servis) + allocations hədəfləri. (Maliyyə ləğvi bloklamır — reverse-order-də ən əvvəl.)
- **qaytarma:** orijinal (`original_id`) + maliyyə əksetmələri.
- **transfer:** stok hərəkətləri (`ref_nov=transfer, ref_id=id`) — mənbə/hədəf anbar.
- **servis:** maliyyə ops (`servis_id`) + orijinal satış (`satis_id`).

`blocks` = reverse-order qaydası: hədəf X-i ləğv etmək üçün əvvəl həll olunmalı bağlı op. (Satışı bloklayan = ödəniş; alışı bloklayan = onu satan satışlar + onun ödənişləri.)

### 2. Backend — dry-run blocker yoxlaması (opsional, panel üçün)
Ləğv dialoqu blocker-ləri **cəhddən əvvəl** göstərə bilsin deyə: `getLinkedOperations` `blocks:true` olanları verir. Ləğvə cəhd yenə də server-də yoxlanır (həqiqi qoruma). Beləcə ayrıca "dry-run" action lazım deyil — panel `getLinkedOperations`-dan oxuyur.

### 3. Frontend — `LinkedOperationsPanel` (təkrar-istifadəli)
Fayl: `features/emeliyyat/components/linked-operations-panel.tsx` (yeni).
- Props: `{ target: {type,id}, mode: "view" | "resolve" }`. `useQuery(getLinkedOperations(target))`.
- Qruplaşmış sətirlər (Ödənişlər · Satışlar · Alışlar · Qaytarma · Stok · Servis). Hər sətir: ikon + tip + nömrə + məbləğ + tarix + status badge + düymələr:
  - **👁 Bax** → həmin op-u inline `OperationQuickView` (Sheet) ilə açır (səhifədən çıxmadan).
  - **✕ Ləğv et** (yalnız `cancellable` + `mode=resolve` və ya istifadəçi istəsə) → **ayrıca təsdiq + səbəb** mini-dialoqu → düzgün cancel action.
- `mode=resolve` (ləğv dialoqu daxilində): yalnız `blocks:true` olanları vurğulayır; biri həll olunanda **canlı yenidən yoxlanır** (`refetch`); hamısı təmizlənəndə əsas "Ləğv et" aktivləşir.
- `mode=view` (QuickView tab): bütün bağlı ops + Bax (+ icazə varsa Ləğv).

### 4. Frontend — yerindəcə ləğv marşrutlaşdırması
`cancelLinkedOperation(op: LinkedOp, reason: string)` (client helper) → tipə görə düzgün server action:
| tip | action |
|---|---|
| satis | `cancelSale(id, reason)` |
| alis | `cancelPurchase(id, reason)` |
| maliyye | `cancelFinanceOperation({ id, reason })` |
| qaytarma | qaytarma ləğv action (`features/ticaret/...` — planda dəqiqləşir) |
| transfer | transfer ləğv action |
| servis | servis ləğv/bağlama action |
Hər biri öz blocker-ini qaytara bilər → panel onu növbəti səviyyə kimi göstərir (zəncir, hər dəfə təsdiq+səbəb).

### 5. İnteqrasiya nöqtələri
- **Ləğv dialoqları** (`cancel-sale-dialog`, `alis-row-actions`/CancelDialog, və maliyyə ləğvi): bloklananda `BlockerList` (link) əvəzinə `<LinkedOperationsPanel mode="resolve" target={...} />`.
- **OperationQuickView**: yeni **"Bağlı əməliyyatlar"** tab → `<LinkedOperationsPanel mode="view" />`.
- **Genişlənmə:** servis detalı + maliyyə əməliyyat detalı eyni paneldən istifadə edir.

## Data axını (bloklanan ləğv)
1. İstifadəçi "Ləğv et" → server blocklayır (`{blockers}`).
2. Dialoq `LinkedOperationsPanel mode=resolve` göstərir (blocks:true sətirlər + Bax/Ləğv).
3. İstifadəçi bir bağlı op-da "Ləğv et" → təsdiq+səbəb → cancel action → uğur → panel `refetch`.
4. Həmin op-un öz bloku varsa → panel onu göstərir (növbəti səviyyə) → təkrar.
5. Bütün `blocks:true` təmizlənəndə → əsas "Ləğv et" aktiv → orijinal ləğv.

## Error/edge
- İcazə: hər yerindəcə ləğv server-də öz `requirePerm`-ini yoxlayır (panel `cancellable`-ı icazəyə görə hesablayır; əsl qoruma server-də).
- Audit: hər ləğv mövcud audit log-a düşür (dəyişməz).
- Boş hal: bağlı op yoxdursa panel "Bağlı əməliyyat yoxdur" göstərir.
- Tenant izolyasiyası: bütün query-lər `sahibkar_id` ilə (mövcud pattern).
- Çoxlu allocation/split ödəniş düzgün qruplaşır (dedupe by type+id).

## Verification
- Backend: `getLinkedOperations` hər tip üçün düzgün bağları qaytarır (satış→ödəniş, alış→satan satışlar, maliyyə→hədəf); `blocks` bayrağı reverse-order-ə uyğun; tenant-scoped.
- Frontend: tsc təmiz; ləğv dialoqunda bloklanan satış/alış üçün panel görünür, Bax inline açır, yerindəcə Ləğv (təsdiq+səbəb) işləyir, canlı refetch, zəncir; QuickView "Bağlı əməliyyatlar" tab.
- Manual (dev :3500): alışı ləğv et → satışlar görünür → yerindəcə satışı ləğv et (ödənişi varsa onu da) → alış ləğv olur, səhifədən çıxmadan.

## Out of scope (sonra)
- Bağlı op-ların toplu (bulk) yerindəcə ləğvi (hələ bir-bir).
- "Bu satışı təmin edən konkret alış" (məhsul-partiya səviyyəsində dəqiq izləmə) — alış üçün stok-based ümumi siyahı kifayətdir.
- Mobil app-da bu panel (web əvvəl).
