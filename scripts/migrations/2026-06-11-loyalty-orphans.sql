-- QA-CANLI-1: Yetim loyalty kartları (kontragent silinib, kart qalıb — köhnə
-- restore-dan). Required relation include /kampaniyalar/loyalty səhifəsini
-- 500-ə salırdı. Yetim tx-lər CASCADE ilə kartla birgə silinir.
--
-- İcra (prod): psql "$DATABASE_URL" -f scripts/migrations/2026-06-11-loyalty-orphans.sql

BEGIN;

-- Hesabat: neçə yetim var
SELECT count(*) AS yetim_kart_sayi
  FROM loyalty_cards lc
 WHERE NOT EXISTS (SELECT 1 FROM kontragentler k WHERE k.id = lc.kontragent_id);

DELETE FROM loyalty_cards lc
 WHERE NOT EXISTS (SELECT 1 FROM kontragentler k WHERE k.id = lc.kontragent_id);

COMMIT;
