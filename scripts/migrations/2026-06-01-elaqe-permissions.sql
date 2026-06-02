-- ============================================================================
-- M: Elaqə (CRM) modulu icazələri — müştəri, təchizatçı, borc, followup
-- ============================================================================
-- Rol əsaslı paylaşma:
--   Sahibkar/admin → hamısı
--   Mühasib       → bütün oxu + borc
--   Menecer       → müştəri/təchizatçı CRUD + borc + followup
--   Satıcı        → müştəri oxu/yarat/duzelt + followup
--   Kassir        → müştəri oxu/yarat (POS-da müştəri əlavə)
--   Anbardar      → təchizatçı oxu/yarat
-- ============================================================================

BEGIN;

INSERT INTO icazeler (kod, ad, qrup, aciqlamaq) VALUES
  ('elaqe.oxu',          'Elaqə səhifəsi',       'Elaqə', 'Master icazə — /elaqe səhifəsinə giriş'),
  ('musteri.oxu',        'Müştərilər',           'Elaqə', '/elaqe/musteriler — müştəri kataloqu'),
  ('musteri.yarat',      'Müştəri yarat',        'Elaqə', 'Yeni müştəri əlavə et'),
  ('musteri.duzelt',     'Müştəri redaktə',      'Elaqə', 'Müştəri kartı dəyişmək (telefon, borc limiti)'),
  ('musteri.sil',        'Müştəri sil/arxivlə',  'Elaqə', 'Müştərini sil və ya arxivlə'),
  ('musteri.gizli',      'Müştəri həssas info',  'Elaqə', 'Telefon/email/ünvan görmək (gizli mod ləğv)'),
  ('techizatci.oxu',     'Təchizatçılar',        'Elaqə', '/elaqe/techizatcilar — təchizatçı kataloqu'),
  ('techizatci.yarat',   'Təchizatçı yarat',     'Elaqə', 'Yeni təchizatçı əlavə et'),
  ('techizatci.duzelt',  'Təchizatçı redaktə',   'Elaqə', 'Təchizatçı kartı dəyişmək'),
  ('elaqe.borc',         'Borc analizi',         'Elaqə', '/elaqe/borclar — borclu müştəri/təchizatçı + bulk xatırlatma'),
  ('elaqe.followup',     'CRM follow-up',        'Elaqə', '/elaqe/followup — müştəri ilə əlaqə izi'),
  ('elaqe.inaktiv',      'İnaktiv analiz',       'Elaqə', '/elaqe/inaktiv — uzun müddət alış etməyən'),
  ('elaqe.dublikat',     'Dublikat aşkarı',      'Elaqə', '/elaqe/dublikat — eyni müştəri/təchizatçı təkrar'),
  ('elaqe.hesabat',      'CRM hesabatları',      'Elaqə', '/elaqe/hesabat — RFM, tier paylanışı'),
  ('elaqe.bulk_mesaj',   'Bulk SMS/Telegram',    'Elaqə', 'Müştərilərə kütləvi mesaj göndərmək')
ON CONFLICT (kod) DO NOTHING;

-- Sahibkar / admin / direktor → hamısı
INSERT INTO rol_icazeleri (rol_id, icaze_id)
SELECT r.id, i.id
  FROM rollar r
  CROSS JOIN icazeler i
 WHERE r.kod IN ('sahibkar', 'admin', 'direktor')
   AND (i.kod = 'elaqe.oxu' OR i.kod LIKE 'musteri.%' OR i.kod LIKE 'techizatci.%' OR i.kod LIKE 'elaqe.%')
ON CONFLICT (rol_id, icaze_id) DO NOTHING;

-- Mühasib → oxu + borc
INSERT INTO rol_icazeleri (rol_id, icaze_id)
SELECT r.id, i.id
  FROM rollar r
  CROSS JOIN icazeler i
 WHERE r.kod = 'muhasib'
   AND i.kod IN (
     'elaqe.oxu', 'musteri.oxu', 'techizatci.oxu',
     'elaqe.borc', 'elaqe.inaktiv', 'elaqe.hesabat'
   )
ON CONFLICT (rol_id, icaze_id) DO NOTHING;

-- Menecer → tam CRUD + analiz + bulk mesaj
INSERT INTO rol_icazeleri (rol_id, icaze_id)
SELECT r.id, i.id
  FROM rollar r
  CROSS JOIN icazeler i
 WHERE r.kod = 'menecer'
   AND i.kod IN (
     'elaqe.oxu',
     'musteri.oxu', 'musteri.yarat', 'musteri.duzelt', 'musteri.gizli',
     'techizatci.oxu', 'techizatci.yarat', 'techizatci.duzelt',
     'elaqe.borc', 'elaqe.followup', 'elaqe.inaktiv', 'elaqe.dublikat',
     'elaqe.hesabat', 'elaqe.bulk_mesaj'
   )
ON CONFLICT (rol_id, icaze_id) DO NOTHING;

-- Satıcı → müştəri tam + followup (öz müştəriləri)
INSERT INTO rol_icazeleri (rol_id, icaze_id)
SELECT r.id, i.id
  FROM rollar r
  CROSS JOIN icazeler i
 WHERE r.kod = 'satici'
   AND i.kod IN (
     'elaqe.oxu', 'musteri.oxu', 'musteri.yarat', 'musteri.duzelt',
     'elaqe.followup'
   )
ON CONFLICT (rol_id, icaze_id) DO NOTHING;

-- Kassir → müştəri oxu/yarat (POS-da müştəri əlavə)
INSERT INTO rol_icazeleri (rol_id, icaze_id)
SELECT r.id, i.id
  FROM rollar r
  CROSS JOIN icazeler i
 WHERE r.kod = 'kassir'
   AND i.kod IN ('elaqe.oxu', 'musteri.oxu', 'musteri.yarat')
ON CONFLICT (rol_id, icaze_id) DO NOTHING;

-- Anbardar → təchizatçı oxu/yarat (alış zamanı təchizatçı əlavə)
INSERT INTO rol_icazeleri (rol_id, icaze_id)
SELECT r.id, i.id
  FROM rollar r
  CROSS JOIN icazeler i
 WHERE r.kod = 'anbardar'
   AND i.kod IN ('elaqe.oxu', 'techizatci.oxu', 'techizatci.yarat')
ON CONFLICT (rol_id, icaze_id) DO NOTHING;

COMMIT;
