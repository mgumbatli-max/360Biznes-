-- ============================================================================
-- M: Multi-tenant rollar — hər sahibkar üçün öz redaktə oluna bilən kopyaları
-- ============================================================================
-- Əvvəl: bütün 12 rol `sistem=true` qlobal olur. Sahibkar onları redaktə edə
-- bilmir. Multi-tenant arxitekturada bu yanlışdır: hər sahibkar öz rolunun
-- icazələrini özünə uyğun tənzimləməlidir.
--
-- Bu migration:
--   1. Hər mövcud sahibkar üçün 12 sistem rolunun custom kopyasını yaradır
--      (sistem=false, sahibkar_id=<o sahibkarın id-si>, eyni ad/aciqlamaq/reng).
--   2. Orijinal sistem rolunun icazələrini hər yeni kopyaya köçürür.
--   3. İstifadəçilərin rol_id-sini yeni-yaradılmış öz sahibkarına aid rola map edir.
--   4. Sistem rolları DB-də qalır — TEMPLATE kataloqu kimi xidmət edir
--      (yeni sahibkar qeydiyyatdan keçəndə kopya buradan götürülür).
--
-- Idempotent: təkrar işlədilsə də artıq mövcud kopyaları yenidən yaratmır.
-- ============================================================================

BEGIN;

DO $$
DECLARE
  s RECORD;
  src_rol RECORD;
  new_rol_id INT;
BEGIN
  -- Hər sahibkar üçün
  FOR s IN SELECT id FROM sahibkarlar LOOP
    -- Hər sistem rolu üçün
    FOR src_rol IN SELECT id, ad, aciqlamaq, reng, ikon FROM roles WHERE sistem = true LOOP
      -- Bu sahibkar üçün artıq mövcud rol varsa atla
      SELECT id INTO new_rol_id FROM roles
        WHERE sahibkar_id = s.id AND ad = src_rol.ad AND sistem = false
        LIMIT 1;

      IF new_rol_id IS NULL THEN
        -- Custom kopya yarat
        INSERT INTO roles (ad, aciqlamaq, reng, ikon, sahibkar_id, sistem)
        VALUES (src_rol.ad, src_rol.aciqlamaq, src_rol.reng, src_rol.ikon, s.id, false)
        RETURNING id INTO new_rol_id;

        -- İcazələrini kopyala
        INSERT INTO rol_icazeleri (rol_id, icaze_id)
        SELECT new_rol_id, icaze_id FROM rol_icazeleri WHERE rol_id = src_rol.id
        ON CONFLICT DO NOTHING;
      END IF;
    END LOOP;
  END LOOP;

  -- İstifadəçilərin rol_id-sini onların sahibkarına aid kopya rola yönəlt.
  -- İndi hər istifadəçi öz sahibkarının custom rolunu daşıyır.
  UPDATE istifadeciler u
  SET rol_id = (
    SELECT new_r.id FROM roles new_r
    INNER JOIN roles old_r ON old_r.ad = new_r.ad AND old_r.sistem = true
    WHERE new_r.sahibkar_id = u.sahibkar_id
      AND new_r.sistem = false
      AND old_r.id = u.rol_id
    LIMIT 1
  )
  WHERE u.rol_id IN (SELECT id FROM roles WHERE sistem = true)
    AND u.sahibkar_id IS NOT NULL;
END$$;

COMMIT;
