-- ============================================================================
-- M: Kampaniyalar moduku — endirim, loyalty, kupon, hədiyyə kartı
-- ============================================================================
-- Sahibkarın hər cür satış kampaniyası yaratması üçün vahid sistem:
--   1) campaigns           — əsas kampaniya (endirim/BOGO/loyalty/coupon/giftcard tipləri)
--   2) campaign_usage      — istifadə tarixçəsi (satışa bağlı)
--   3) loyalty_cards       — sadiqlik kartları (kontragentə)
--   4) loyalty_tx          — bonus qazanc/sərf əməliyyatları
--   5) coupons             — kupon kodları (bir kampaniyada N kod)
--   6) gift_cards          — hədiyyə kartı / store credit
-- ============================================================================

BEGIN;

-- ── 1. CAMPAIGNS — əsas kampaniya cədvəli ──
CREATE TABLE IF NOT EXISTS campaigns (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sahibkar_id     UUID NOT NULL REFERENCES sahibkarlar(id) ON DELETE CASCADE,
  ad              VARCHAR(200) NOT NULL,
  aciqlamaq       TEXT,
  tip             VARCHAR(30) NOT NULL CHECK (tip IN (
    'percent_endirim', 'sabit_endirim', 'bogo',
    'pillevari',       'sebet_endirim', 'pulsuz_catdirilma',
    'loyalty',         'coupon',         'gift_card',
    'flash_sale',      'doğum_gunu',    'welcome',          'reaktivlesdir'
  )),
  status          VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'expired', 'archived')),
  -- Şərtlər (JSON): səbət dəyəri, müştəri seqmenti, məhsul/kateqoriya, kanal və s.
  rules_json      JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Action JSON: endirim növü (faiz/sabit), məbləğ, bonus faizi və s.
  action_json     JSONB NOT NULL DEFAULT '{}'::jsonb,
  baslama         TIMESTAMP NOT NULL DEFAULT NOW(),
  bitme           TIMESTAMP,
  prioritet       INTEGER NOT NULL DEFAULT 50,
  -- Maksimum istifadə limitləri
  max_uses        INTEGER,           -- bütöv kampaniya
  max_per_user    INTEGER,           -- müştəri başına
  current_uses    INTEGER NOT NULL DEFAULT 0,
  -- Vizual
  reng            VARCHAR(20),
  ikon            VARCHAR(50),
  -- Stacking icazəsi
  stackable       BOOLEAN NOT NULL DEFAULT false,
  -- Hədəf
  hedef_filial_ids INTEGER[] DEFAULT NULL,  -- NULL = bütün filiallar
  hedef_kanal     VARCHAR(40)[] DEFAULT NULL,  -- NULL = bütün kanallar (POS/online/marketplace)
  yaradan_id      UUID REFERENCES istifadeciler(id),
  yaradildi       TIMESTAMP NOT NULL DEFAULT NOW(),
  yenilendi       TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_campaigns_sahibkar_active ON campaigns(sahibkar_id, status, baslama, bitme);
CREATE INDEX IF NOT EXISTS idx_campaigns_tip ON campaigns(sahibkar_id, tip);

-- ── 2. CAMPAIGN_USAGE — istifadə tarixçəsi ──
CREATE TABLE IF NOT EXISTS campaign_usage (
  id              BIGSERIAL PRIMARY KEY,
  sahibkar_id     UUID NOT NULL REFERENCES sahibkarlar(id) ON DELETE CASCADE,
  campaign_id     UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  satis_id        UUID REFERENCES satis_sifarisleri(id) ON DELETE SET NULL,
  kontragent_id   UUID REFERENCES kontragentler(id) ON DELETE SET NULL,
  endirim_mebleg  NUMERIC(12, 2) NOT NULL DEFAULT 0,
  bonus_qazanildi NUMERIC(12, 2) NOT NULL DEFAULT 0,
  bonus_serf      NUMERIC(12, 2) NOT NULL DEFAULT 0,
  kupon_kod       VARCHAR(50),
  istifade_de     TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_camp_usage_sah ON campaign_usage(sahibkar_id, campaign_id, istifade_de DESC);
CREATE INDEX IF NOT EXISTS idx_camp_usage_sale ON campaign_usage(satis_id);
CREATE INDEX IF NOT EXISTS idx_camp_usage_musteri ON campaign_usage(kontragent_id, istifade_de DESC);

-- ── 3. LOYALTY_CARDS — sadiqlik kartı (per müştəri) ──
CREATE TABLE IF NOT EXISTS loyalty_cards (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sahibkar_id     UUID NOT NULL REFERENCES sahibkarlar(id) ON DELETE CASCADE,
  kontragent_id   UUID NOT NULL REFERENCES kontragentler(id) ON DELETE CASCADE,
  kart_kod        VARCHAR(60) NOT NULL,                -- barcode/QR kod
  balans          NUMERIC(12, 2) NOT NULL DEFAULT 0,
  tier            VARCHAR(20) NOT NULL DEFAULT 'bronze' CHECK (tier IN ('bronze', 'silver', 'gold', 'platinum')),
  total_qazanc    NUMERIC(12, 2) NOT NULL DEFAULT 0,  -- həyat müddətli toplam
  total_serf      NUMERIC(12, 2) NOT NULL DEFAULT 0,
  son_alish_de    TIMESTAMP,
  aktiv           BOOLEAN NOT NULL DEFAULT true,
  yaradildi       TIMESTAMP NOT NULL DEFAULT NOW(),
  yenilendi       TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (sahibkar_id, kart_kod),
  UNIQUE (sahibkar_id, kontragent_id)
);
CREATE INDEX IF NOT EXISTS idx_loyalty_sah_tier ON loyalty_cards(sahibkar_id, tier, aktiv);

-- ── 4. LOYALTY_TX — bonus qazanc/sərf əməliyyatları ──
CREATE TABLE IF NOT EXISTS loyalty_tx (
  id              BIGSERIAL PRIMARY KEY,
  sahibkar_id     UUID NOT NULL REFERENCES sahibkarlar(id) ON DELETE CASCADE,
  kart_id         UUID NOT NULL REFERENCES loyalty_cards(id) ON DELETE CASCADE,
  satis_id        UUID REFERENCES satis_sifarisleri(id) ON DELETE SET NULL,
  nov             VARCHAR(20) NOT NULL CHECK (nov IN ('qazandi', 'serf', 'expire', 'manual_artir', 'manual_azalt', 'refund')),
  mebleg          NUMERIC(12, 2) NOT NULL,             -- + qazanc, - sərf
  qaliq           NUMERIC(12, 2) NOT NULL,             -- bu əməliyyatdan sonra balans
  qeyd            TEXT,
  expire_at       TIMESTAMP,                          -- bonus müddət (məs. 6 ay sonra silinir)
  yaradan_id      UUID REFERENCES istifadeciler(id),
  yaradildi       TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_loyalty_tx_kart ON loyalty_tx(kart_id, yaradildi DESC);
CREATE INDEX IF NOT EXISTS idx_loyalty_tx_sah ON loyalty_tx(sahibkar_id, yaradildi DESC);

-- ── 5. COUPONS — kupon kodları ──
CREATE TABLE IF NOT EXISTS coupons (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sahibkar_id     UUID NOT NULL REFERENCES sahibkarlar(id) ON DELETE CASCADE,
  campaign_id     UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  kod             VARCHAR(50) NOT NULL,
  -- Spesifik müştəriyə bağlı kupon (NULL = istənilən müştəri istifadə edir)
  kontragent_id   UUID REFERENCES kontragentler(id) ON DELETE SET NULL,
  max_uses        INTEGER NOT NULL DEFAULT 1,
  current_uses    INTEGER NOT NULL DEFAULT 0,
  bitme_tarixi    TIMESTAMP,
  aktiv           BOOLEAN NOT NULL DEFAULT true,
  yaradildi       TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (sahibkar_id, kod)
);
CREATE INDEX IF NOT EXISTS idx_coupons_sah_aktiv ON coupons(sahibkar_id, aktiv, bitme_tarixi);
CREATE INDEX IF NOT EXISTS idx_coupons_camp ON coupons(campaign_id);
CREATE INDEX IF NOT EXISTS idx_coupons_kontragent ON coupons(kontragent_id) WHERE kontragent_id IS NOT NULL;

-- ── 6. GIFT_CARDS — hədiyyə kartı / store credit ──
CREATE TABLE IF NOT EXISTS gift_cards (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sahibkar_id     UUID NOT NULL REFERENCES sahibkarlar(id) ON DELETE CASCADE,
  kart_kod        VARCHAR(50) NOT NULL,
  nominal         NUMERIC(12, 2) NOT NULL,           -- üzərində yazılan dəyər
  qaliq           NUMERIC(12, 2) NOT NULL,           -- istifadə olunmamış qalıq
  -- Bu kartı kim aldı (müştəri kontragenti)
  alici_kontragent_id   UUID REFERENCES kontragentler(id),
  -- Bu kart store-credit kimi qaytarmadan yaranıbsa, hansı satışdan
  qaytaran_satis_id     UUID REFERENCES satis_sifarisleri(id) ON DELETE SET NULL,
  bitme_tarixi    TIMESTAMP,
  aktiv           BOOLEAN NOT NULL DEFAULT true,
  yaradildi       TIMESTAMP NOT NULL DEFAULT NOW(),
  yenilendi       TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (sahibkar_id, kart_kod)
);
CREATE INDEX IF NOT EXISTS idx_gift_sah ON gift_cards(sahibkar_id, aktiv);

-- ── 7. ICAZƏLƏR — Yeni icazə qrupu "Kampaniya" ──
INSERT INTO icazeler (kod, ad, qrup, aciqlamaq) VALUES
  ('kampaniya.oxu',     'Kampaniyaları gör',     'Kampaniya', 'Kampaniya siyahısı və detallarına baxış'),
  ('kampaniya.idare',   'Kampaniya idarəetməsi', 'Kampaniya', 'Yarat / Redaktə / Sil / Aktivləşdir-Söndür'),
  ('kampaniya.tetbiq',  'Kampaniya tətbiq et',   'Kampaniya', 'POS-da əl ilə kupon/endirim tətbiq etmək'),
  ('loyalty.idare',     'Loyalty proqram idarə', 'Kampaniya', 'Tier ayarları, bonus qaydaları'),
  ('loyalty.kart_yarad','Kart yaratmaq',         'Kampaniya', 'Müştəriyə yeni loyalty kart vermək'),
  ('giftcard.satis',    'Hədiyyə kartı satışı',  'Kampaniya', 'Yeni gift card yaratmaq və satmaq')
ON CONFLICT (kod) DO NOTHING;

-- Master icazə bütün sahibkar və admin rollarına avtomatik
INSERT INTO rol_icazeleri (rol_id, icaze_id)
SELECT r.id, i.id FROM roles r CROSS JOIN icazeler i
WHERE r.ad IN ('sahibkar', 'admin', 'director') AND i.kod LIKE 'kampaniya.%'
ON CONFLICT DO NOTHING;
INSERT INTO rol_icazeleri (rol_id, icaze_id)
SELECT r.id, i.id FROM roles r CROSS JOIN icazeler i
WHERE r.ad IN ('sahibkar', 'admin', 'director') AND i.kod LIKE 'loyalty.%'
ON CONFLICT DO NOTHING;
INSERT INTO rol_icazeleri (rol_id, icaze_id)
SELECT r.id, i.id FROM roles r CROSS JOIN icazeler i
WHERE r.ad IN ('sahibkar', 'admin', 'director') AND i.kod LIKE 'giftcard.%'
ON CONFLICT DO NOTHING;

-- Kassir/satıcı yalnız tətbiq edə bilər
INSERT INTO rol_icazeleri (rol_id, icaze_id)
SELECT r.id, i.id FROM roles r CROSS JOIN icazeler i
WHERE r.ad IN ('kassir', 'satici') AND i.kod IN ('kampaniya.oxu', 'kampaniya.tetbiq', 'loyalty.kart_yarad')
ON CONFLICT DO NOTHING;

-- Menecer / mühasib hər şeyi görür
INSERT INTO rol_icazeleri (rol_id, icaze_id)
SELECT r.id, i.id FROM roles r CROSS JOIN icazeler i
WHERE r.ad IN ('manecer', 'muhasib', 'baxan') AND i.kod IN ('kampaniya.oxu', 'kampaniya.tetbiq')
ON CONFLICT DO NOTHING;

COMMIT;
