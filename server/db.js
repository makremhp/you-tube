import { neon } from '@neondatabase/serverless';

const databaseUrl = process.env.NEON_DATABASE_URL ?? process.env.DATABASE_URL;
export const sql = databaseUrl ? neon(databaseUrl) : null;

let schemaReady = null;

export function ensureSchema() {
  if (!sql) return Promise.resolve();
  if (!schemaReady) {
    schemaReady = (async () => {
      const statements = [
        `CREATE TABLE IF NOT EXISTS vr_users (
          id BIGINT PRIMARY KEY,
          first_name TEXT NOT NULL DEFAULT '',
          last_name TEXT,
          username TEXT,
          photo_url TEXT,
          advertiser_balance NUMERIC(18,6) NOT NULL DEFAULT 0,
          earned_balance NUMERIC(18,6) NOT NULL DEFAULT 0,
          status TEXT NOT NULL DEFAULT 'نشط',
          banned_by_system BOOLEAN NOT NULL DEFAULT FALSE,
          invited_by BIGINT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          last_active_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )`,
        `CREATE TABLE IF NOT EXISTS vr_campaigns (
          id BIGSERIAL PRIMARY KEY,
          owner_id BIGINT NOT NULL REFERENCES vr_users(id),
          platform TEXT NOT NULL,
          title TEXT NOT NULL,
          description TEXT,
          creator TEXT,
          link TEXT NOT NULL DEFAULT '',
          thumbnail TEXT,
          duration INTEGER,
          cpm NUMERIC(12,4),
          reward NUMERIC(18,6),
          price NUMERIC(18,6),
          target_count INTEGER,
          requested_views INTEGER,
          campaign_budget NUMERIC(18,6),
          viewer_share NUMERIC(8,4),
          platform_share NUMERIC(8,4),
          viewer_reward_per_view NUMERIC(18,9),
          platform_revenue_per_view NUMERIC(18,9),
          country TEXT,
          device TEXT,
          status TEXT NOT NULL DEFAULT 'نشط',
          views BIGINT NOT NULL DEFAULT 0,
          joined_count INTEGER NOT NULL DEFAULT 0,
          completed_count INTEGER NOT NULL DEFAULT 0,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )`,
        `ALTER TABLE vr_campaigns ADD COLUMN IF NOT EXISTS requested_views INTEGER`,
        `ALTER TABLE vr_campaigns ADD COLUMN IF NOT EXISTS campaign_budget NUMERIC(18,6)`,
        `ALTER TABLE vr_campaigns ADD COLUMN IF NOT EXISTS viewer_share NUMERIC(8,4)`,
        `ALTER TABLE vr_campaigns ADD COLUMN IF NOT EXISTS platform_share NUMERIC(8,4)`,
        `ALTER TABLE vr_campaigns ADD COLUMN IF NOT EXISTS viewer_reward_per_view NUMERIC(18,9)`,
        `ALTER TABLE vr_campaigns ADD COLUMN IF NOT EXISTS platform_revenue_per_view NUMERIC(18,9)`,
        `CREATE TABLE IF NOT EXISTS vr_campaign_requests (
          owner_id BIGINT NOT NULL REFERENCES vr_users(id),
          request_id TEXT NOT NULL,
          request_hash TEXT NOT NULL,
          campaign_id BIGINT REFERENCES vr_campaigns(id) ON DELETE SET NULL,
          status TEXT NOT NULL DEFAULT 'processing',
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          PRIMARY KEY (owner_id, request_id)
        )`,
        `CREATE TABLE IF NOT EXISTS vr_completions (
          campaign_id BIGINT NOT NULL REFERENCES vr_campaigns(id) ON DELETE CASCADE,
          user_id BIGINT NOT NULL REFERENCES vr_users(id),
          status TEXT NOT NULL,
          proof_image TEXT,
          reward NUMERIC(18,6),
          campaign_link TEXT,
          started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          completed_at TIMESTAMPTZ,
          PRIMARY KEY (campaign_id, user_id)
        )`,
        `ALTER TABLE vr_completions ADD COLUMN IF NOT EXISTS campaign_link TEXT`,
        `CREATE INDEX IF NOT EXISTS vr_completions_user_completed_idx
          ON vr_completions (user_id, completed_at DESC)
          WHERE status = 'completed'`,
        `CREATE SEQUENCE IF NOT EXISTS vr_memo_seq START 1`,
        `CREATE TABLE IF NOT EXISTS vr_deposits (
          id TEXT PRIMARY KEY,
          user_id BIGINT NOT NULL REFERENCES vr_users(id),
          amount NUMERIC(18,6) NOT NULL,
          method TEXT NOT NULL,
          destination TEXT NOT NULL,
          memo_tag TEXT NOT NULL,
          blockchain_tx_id TEXT,
          credited BOOLEAN NOT NULL DEFAULT FALSE,
          reason TEXT,
          status TEXT NOT NULL DEFAULT 'قيد المعالجة',
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )`,
        `CREATE TABLE IF NOT EXISTS vr_withdrawals (
          id TEXT PRIMARY KEY,
          user_id BIGINT NOT NULL REFERENCES vr_users(id),
          amount NUMERIC(18,6) NOT NULL,
          method TEXT NOT NULL,
          destination TEXT NOT NULL,
          memo_tag TEXT NOT NULL,
          blockchain_tx_id TEXT,
          status TEXT NOT NULL DEFAULT 'قيد المعالجة',
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )`,
        `CREATE TABLE IF NOT EXISTS vr_ad_rewards (
          user_id BIGINT NOT NULL REFERENCES vr_users(id),
          day DATE NOT NULL,
          count INTEGER NOT NULL DEFAULT 0,
          last_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          PRIMARY KEY (user_id, day)
        )`,
        `CREATE TABLE IF NOT EXISTS vr_monetag_ad_rewards (
          user_id BIGINT NOT NULL REFERENCES vr_users(id),
          day DATE NOT NULL,
          count INTEGER NOT NULL DEFAULT 0,
          last_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          PRIMARY KEY (user_id, day)
        )`,
        `CREATE TABLE IF NOT EXISTS vr_monetag_ad_sessions (
          id TEXT PRIMARY KEY,
          user_id BIGINT NOT NULL REFERENCES vr_users(id),
          day DATE NOT NULL,
          first_valued_at TIMESTAMPTZ,
          second_valued_at TIMESTAMPTZ,
          first_completed_at TIMESTAMPTZ,
          second_completed_at TIMESTAMPTZ,
          rewarded_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '1 hour')
        )`,
        `CREATE INDEX IF NOT EXISTS vr_monetag_ad_sessions_user_idx
          ON vr_monetag_ad_sessions (user_id, created_at DESC)`,
        `CREATE TABLE IF NOT EXISTS vr_monetag_reward_claims (
          session_id TEXT PRIMARY KEY REFERENCES vr_monetag_ad_sessions(id),
          user_id BIGINT NOT NULL REFERENCES vr_users(id),
          day DATE NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )`,
        `CREATE TABLE IF NOT EXISTS vr_monetag_reward_credits (
          session_id TEXT PRIMARY KEY REFERENCES vr_monetag_ad_sessions(id),
          user_id BIGINT NOT NULL REFERENCES vr_users(id),
          day DATE NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )`,
        `CREATE TABLE IF NOT EXISTS vr_suspicious_signals (
          id BIGSERIAL PRIMARY KEY,
          user_id BIGINT NOT NULL REFERENCES vr_users(id),
          attempt TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'مفتوح',
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )`,
        `CREATE TABLE IF NOT EXISTS vr_admin_audit_log (
          id BIGSERIAL PRIMARY KEY,
          admin_id BIGINT NOT NULL REFERENCES vr_users(id),
          collection TEXT NOT NULL,
          record_id TEXT NOT NULL,
          new_status TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )`,
        `CREATE TABLE IF NOT EXISTS vr_platform_settings (
          key TEXT PRIMARY KEY,
          value JSONB NOT NULL,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )`,
        `INSERT INTO vr_platform_settings (key, value)
         VALUES ('maintenance', 'false'::jsonb)
         ON CONFLICT (key) DO NOTHING`,
        `CREATE INDEX IF NOT EXISTS vr_campaigns_owner_idx ON vr_campaigns (owner_id)`,
        `CREATE INDEX IF NOT EXISTS vr_campaigns_platform_status_idx ON vr_campaigns (platform, status)`,
        `CREATE INDEX IF NOT EXISTS vr_deposits_user_idx ON vr_deposits (user_id, created_at DESC)`,
        `CREATE INDEX IF NOT EXISTS vr_withdrawals_user_idx ON vr_withdrawals (user_id, created_at DESC)`,
        `CREATE INDEX IF NOT EXISTS vr_admin_audit_log_created_idx ON vr_admin_audit_log (created_at DESC)`,
      ];
      for (const statement of statements) {
        await sql.query(statement);
      }
    })().catch((error) => {
      schemaReady = null;
      throw error;
    });
  }
  return schemaReady;
}
