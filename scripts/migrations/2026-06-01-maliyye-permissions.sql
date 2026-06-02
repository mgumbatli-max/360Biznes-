-- ============================================================================
-- M: Maliyyə modulu icazələri — kassa, bank, xərc, ödəniş, gün sonu, hesabat
-- ============================================================================
-- Maliyyə ən həssas moduldur. Pul axını və hesabat görmək rol əsaslı:
--   Sahibkar/admin → hamısı
--   Mühasib       → hamısı oxu + xərc / ödəniş yarat / gün sonu
--   Menecer       → kassa/bank oxu + xərc/ödəniş yarat + hesabat
--   Kassir        → kassa oxu (öz sessiyası) + ödəniş qəbul
--   Anbardar      → görmür
-- ============================================================================

BEGIN;

INSERT INTO icazeler (kod, ad, qrup, aciqlamaq) VALUES
  ('maliyye.oxu',         'Maliyyə səhifəsi',     'Maliyyə', 'Master icazə — /maliyye səhifəsinə giriş'),
  ('kassa.oxu',           'Kassalar',             'Maliyyə', '/maliyye/kassalar — kassa qalıqları'),
  ('kassa.emeliyyat',     'Kassa idarə',          'Maliyyə', 'Yeni kassa yarat / sil / qalıq düzəliş'),
  ('bank.oxu',            'Bank hesabları',       'Maliyyə', '/maliyye/bank — bank hesabları və əməliyyatları'),
  ('bank.emeliyyat',      'Bank idarə',           'Maliyyə', 'Bank hesabı əlavə / sil / sinxron'),
  ('xerc.oxu',            'Xərclər',              'Maliyyə', '/maliyye/xercler — xərc tarixçəsi'),
  ('xerc.yarat',          'Yeni xərc',            'Maliyyə', 'Xərc əlavə et'),
  ('xerc.idare',          'Xərc idarə',           'Maliyyə', 'Xərc redaktə / sil'),
  ('odenis.qebul',        'Ödəniş qəbul',         'Maliyyə', 'Müştəri borcuna qarşı ödəniş qəbul et'),
  ('odenis.yarat',        'Yeni ödəniş',          'Maliyyə', 'Manual ödəniş (təchizatçı/işçi)'),
  ('debitor.oxu',         'Debitor (alacaq)',     'Maliyyə', '/maliyye/debitor — müştəri borc analizi'),
  ('kreditor.oxu',        'Kreditor (borc)',      'Maliyyə', '/maliyye/kreditor — təchizatçı borc analizi'),
  ('maliyye.gun_sonu',    'Gün sonu',             'Maliyyə', '/maliyye/gun-sonu — yığma və kassa bağlanış'),
  ('maliyye.hesabat',     'Maliyyə hesabatları',  'Maliyyə', 'P/L, balans, pul axını, hesabat'),
  ('edv.idare',           'ƏDV / vergilər',       'Maliyyə', '/maliyye/edv + /yol-vergisi'),
  ('maliyye.recurring',   'Təkrarlanan ödəniş',   'Maliyyə', '/maliyye/recurring — kirayə, abunə')
ON CONFLICT (kod) DO NOTHING;

-- Sahibkar / admin / direktor → hamısı
INSERT INTO rol_icazeleri (rol_id, icaze_id)
SELECT r.id, i.id
  FROM rollar r
  CROSS JOIN icazeler i
 WHERE r.kod IN ('sahibkar', 'admin', 'direktor')
   AND (i.kod = 'maliyye.oxu' OR i.kod LIKE 'kassa.%' OR i.kod LIKE 'bank.%'
        OR i.kod LIKE 'xerc.%' OR i.kod LIKE 'odenis.%' OR i.kod LIKE 'maliyye.%'
        OR i.kod IN ('debitor.oxu', 'kreditor.oxu', 'edv.idare'))
ON CONFLICT (rol_id, icaze_id) DO NOTHING;

-- Mühasib → hamısı (bank.emeliyyat və kassa.emeliyyat istisna - sahibkar tələb edir)
INSERT INTO rol_icazeleri (rol_id, icaze_id)
SELECT r.id, i.id
  FROM rollar r
  CROSS JOIN icazeler i
 WHERE r.kod = 'muhasib'
   AND i.kod IN (
     'maliyye.oxu', 'kassa.oxu', 'bank.oxu',
     'xerc.oxu', 'xerc.yarat', 'xerc.idare',
     'odenis.qebul', 'odenis.yarat',
     'debitor.oxu', 'kreditor.oxu',
     'maliyye.gun_sonu', 'maliyye.hesabat', 'edv.idare',
     'maliyye.recurring'
   )
ON CONFLICT (rol_id, icaze_id) DO NOTHING;

-- Menecer → kassa/bank oxu + xərc/ödəniş yarat + hesabat
INSERT INTO rol_icazeleri (rol_id, icaze_id)
SELECT r.id, i.id
  FROM rollar r
  CROSS JOIN icazeler i
 WHERE r.kod = 'menecer'
   AND i.kod IN (
     'maliyye.oxu', 'kassa.oxu', 'bank.oxu',
     'xerc.oxu', 'xerc.yarat',
     'odenis.qebul', 'odenis.yarat',
     'debitor.oxu', 'kreditor.oxu',
     'maliyye.hesabat'
   )
ON CONFLICT (rol_id, icaze_id) DO NOTHING;

-- Kassir → kassa oxu + ödəniş qəbul (POS-da işləsin deyə)
INSERT INTO rol_icazeleri (rol_id, icaze_id)
SELECT r.id, i.id
  FROM rollar r
  CROSS JOIN icazeler i
 WHERE r.kod = 'kassir'
   AND i.kod IN ('maliyye.oxu', 'kassa.oxu', 'odenis.qebul')
ON CONFLICT (rol_id, icaze_id) DO NOTHING;

COMMIT;
