-- ============================================================================
-- M3: Audit log outbox pattern
-- ============================================================================
-- Audit: 22 yerdə audit_log.create catch(e) console.warn silent fail edirdi.
-- Kritik əməliyyatlar (pin_lockout, gizli_giris, finance approvals) bu yolla
-- itmir, amma izlənmir də. Outbox cədvəli — fail olunan log-lar burada
-- gözləyir, sonra cron retry edə bilər.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS audit_log_outbox (
  id            BIGSERIAL PRIMARY KEY,
  sahibkar_id   UUID,
  istifadeci_id UUID,
  payload       JSONB NOT NULL,        -- audit_log.create args
  error_message TEXT,                  -- ilk fail səbəbi
  retry_count   INTEGER NOT NULL DEFAULT 0,
  next_retry_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status        VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending / success / abandoned
  yaradildi     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  yenilendi     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Cron worker yalnız pending + retry vaxtı keçmiş sətirləri çəkir
CREATE INDEX IF NOT EXISTS idx_audit_outbox_pending
  ON audit_log_outbox (status, next_retry_at)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_audit_outbox_sahibkar
  ON audit_log_outbox (sahibkar_id, yaradildi DESC);

COMMIT;
