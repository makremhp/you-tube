CREATE TABLE IF NOT EXISTS task_completions (
  id BIGSERIAL PRIMARY KEY,
  telegram_id BIGINT NOT NULL REFERENCES users(telegram_id) ON DELETE CASCADE,
  campaign_id BIGINT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending'
    CONSTRAINT task_completions_status_check CHECK (status IN ('pending', 'approved', 'rejected')),
  proof_text TEXT,
  proof_url TEXT,
  review_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  CONSTRAINT task_completions_telegram_campaign_unique UNIQUE (telegram_id, campaign_id)
);

CREATE INDEX IF NOT EXISTS task_completions_status_created_idx
  ON task_completions (status, created_at);

CREATE TABLE IF NOT EXISTS wallet_transactions (
  id BIGSERIAL PRIMARY KEY,
  telegram_id BIGINT NOT NULL REFERENCES users(telegram_id) ON DELETE CASCADE,
  task_completion_id BIGINT NOT NULL UNIQUE
    REFERENCES task_completions(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  reason TEXT NOT NULL DEFAULT 'task_reward',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS wallet_transactions_telegram_created_idx
  ON wallet_transactions (telegram_id, created_at);
