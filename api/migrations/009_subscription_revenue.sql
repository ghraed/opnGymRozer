ALTER TABLE finance_entries
  ADD COLUMN source_subscription_id VARCHAR(64) NULL,
  ADD INDEX idx_ledger_subscription (source_subscription_id);
