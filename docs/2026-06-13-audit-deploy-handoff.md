# Audit + Deploy — Yekun təlimat (2026-06-13)

## 1. Nə deploy olundu (commit `8f21078`)

Hərtərəfli audit (41 təsdiqlənmiş, adversarial doğrulanmış bug). Kök problem:
kod bir çox modulda DB CHECK constraint-in qəbul etmədiyi `status`/`nov`/`odenis_nov`
dəyəri yazırdı → Postgres **23514** → əməliyyat çökürdü. Bildirilən 2 problem
(satış silinmir, Excel import xəta verir) bu sinifin nümunələri idi.

**Kod düzəlişləri (artıq prod-da, deploy olunub):** cancelSale kassa odenis_nov;
maliyyə gozleyen_tesdiq/redd; inbox out/in; qaytarma nov; zəmanət/servis/importer
status; transfer & marketplace stok guard; tesdiq bulk propagate; maas rollback;
cancelFinanceOp odenilmis; importer per-row tx; KPI/lead/bron/import düzəlişləri.

---

## 2. ⚠️ MÜTLƏQ ET: Constraint migration (prod DB-də)

Bəzi modullar (4-eyes təsdiq satış/alış, tez/tam qaytarma, inventarizasiya,
konsiqnasiya, servis qiymət təklifi, pərakəndə qiymət tipi, lead silmə, sosial
kanallar) **kodun legitim istifadə etdiyi dəyərlərlə** işləyir, amma köhnə DB
CHECK constraint-lər onları bloklayır. Bu düzəliş **kodla deyil, DB-də** olmalıdır
(Prisma `db push` CHECK constraint idarə etmir). **Bu migration işlədilməyincə o
modullar işləməyəcək** (onlar onsuz da hazırda sınıqdır — regres yoxdur).

```bash
# Prod DATABASE_URL ilə (Vercel → Storage/Settings-dən və ya `vercel env pull`):
psql "<PROD_DATABASE_URL>" -f scripts/migrations/2026-06-13-constraint-sync-audit.sql

# (Opsional, izləmə tarixçəsini tam bərpa üçün — import onsuz da işləyir:)
psql "<PROD_DATABASE_URL>" -f scripts/migrations/2026-06-13-import-partiyalari-constraint-fix.sql
```

Lokal bazaya da eyni faylları tətbiq et (dev mühitdə test üçün).

---

## 3. Məhsul importu (Məhsullar.xlsx → 3476 məhsul + 2577 şəkil)

Skript hazır və dry-run təsdiqlidir: `scripts/import-products.mjs`. İdempotent
(kod `XL-<№>`), resume-dəstəkli (manifest). Tələblər: prod `DATABASE_URL`,
işlək Vercel **Blob** (hazırda **suspend** — Vercel dashboard → Storage-dan
reaktiv et), və hədəf `sahibkar_id`.

```bash
# Əvvəlcə yoxla (təhlükəsiz, DB/Blob YOX):
node --max-old-space-size=4096 scripts/import-products.mjs --dry-run

# Canlı (prod-a yazır):
DATABASE_URL="<PROD_DATABASE_URL>" \
BLOB_READ_WRITE_TOKEN="<PROD_BLOB_TOKEN>" \
node --max-old-space-size=4096 scripts/import-products.mjs --live "Məhsullar.xlsx" "<SAHIBKAR_ID>"
```

> Qeyd: `vercel env pull` (prod sirləri) və DB DDL avtomatik təhlükəsizlik
> filtrindən keçmədiyi üçün bu addımları mən icra edə bilmədim — sənin
> işlətməyin lazımdır (və ya filtri açıb mənə tapşır).

---

## 4. Sonraya saxlanan düzəlişlər (kritik deyil — crash yox, robustluq/dəqiqlik)

- **#29** cancelSale "ödəniş" açar sözü ilə blocker bypass çox aqressiv → açıq
  `acknowledgePayment` checkbox-a keçmək (səssiz ləğv riski).
- **#31** applyExpenseToInvoice əsas transaction-dan kənarda (qismən yazı riski) →
  tx-ə köçürmək.
- **#36** servis/satış nömrə generasiyası race (P2002) → `nextDocNumber` atomik
  sayğacına keçmək.
- **#41** marketplace komissiya tapılmasa səssiz 0% → per-kanal komissiya oxuyub
  tapılmayanı "bilinmir" kimi flag etmək.

Bunlar deploy olunan düzəlişlərə daxil DEYİL; istəsən növbəti mərhələdə edərəm.
