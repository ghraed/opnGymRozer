ALTER TABLE member_subscriptions
  MODIFY cycle ENUM('monthly','quarterly','yearly','plan') NOT NULL,
  ADD COLUMN duration_count INT UNSIGNED NULL,
  ADD COLUMN duration_unit ENUM('day','week','month','year') NULL;

UPDATE member_subscriptions SET
  duration_count = CASE cycle WHEN 'monthly' THEN 1 WHEN 'quarterly' THEN 3 WHEN 'yearly' THEN 12 END,
  duration_unit = 'month';
