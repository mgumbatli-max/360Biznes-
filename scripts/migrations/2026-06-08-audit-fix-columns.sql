-- Audit düzəlişləri #3 (offline idempotency) və #24 (webhook) üçün
-- satis_sifarisleri-yə əlavə sütunlar + partial unique indekslər.
--
-- ⚠️ PRODUCTION DB-yə kod deploy olunmazdan ƏVVƏL tətbiq edilməlidir.
-- Əks halda POS satış (client_op_id) və webhook (external_id) runtime-da sınar
-- (sütun mövcud deyil). Sütunlar additivdir (nullable) — mövcud datanı pozmaz.
--
-- Lokal dev DB-də (biznes_360_next) artıq tətbiq olunub.

ALTER TABLE satis_sifarisleri ADD COLUMN IF NOT EXISTS client_op_id varchar(80);
ALTER TABLE satis_sifarisleri ADD COLUMN IF NOT EXISTS external_id  varchar(120);

-- Partial unique: NULL dəyərlər çoxlu ola bilər; yalnız dolu dəyərlər unikaldır.
-- client_op_id → offline növbə təkrar göndərişində dublikat satışın qarşısını alır.
CREATE UNIQUE INDEX IF NOT EXISTS satis_client_op_uniq
  ON satis_sifarisleri (sahibkar_id, client_op_id)
  WHERE client_op_id IS NOT NULL;

-- external_id → marketplace webhook eyni sifarişi təkrar göndərəndə idempotentlik.
CREATE UNIQUE INDEX IF NOT EXISTS satis_external_id_uniq
  ON satis_sifarisleri (sahibkar_id, external_id)
  WHERE external_id IS NOT NULL;
