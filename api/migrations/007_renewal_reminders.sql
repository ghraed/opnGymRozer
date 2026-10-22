-- Preserve existing records without assuming that historical payments are unpaid.
ALTER TABLE member_subscriptions
  ADD COLUMN payment_status ENUM('unconfirmed','unpaid','paid','waived') NOT NULL DEFAULT 'unconfirmed',
  ADD COLUMN payment_due_on DATE NULL,
  ADD COLUMN payment_updated_at TIMESTAMP(3) NULL,
  ADD COLUMN payment_updated_by VARCHAR(64) NULL,
  ADD CONSTRAINT fk_subscription_payment_editor FOREIGN KEY (payment_updated_by) REFERENCES users(id) ON DELETE SET NULL;

CREATE TABLE subscription_payment_events (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  subscription_id VARCHAR(64) NOT NULL,
  previous_status VARCHAR(20) NOT NULL,
  payment_status VARCHAR(20) NOT NULL,
  due_on DATE NULL,
  note VARCHAR(500) NOT NULL,
  actor_id VARCHAR(64) NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  FOREIGN KEY (subscription_id) REFERENCES member_subscriptions(id) ON DELETE CASCADE,
  FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_payment_event_subscription (subscription_id,id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE subscription_reminders (
  id VARCHAR(64) PRIMARY KEY,
  subscription_id VARCHAR(64) NOT NULL,
  kind ENUM('renewal','payment') NOT NULL,
  reminder_date DATE NOT NULL,
  source ENUM('manual','automatic') NOT NULL,
  delivery ENUM('pending','processing','push_sent','in_app','failed','skipped') NOT NULL DEFAULT 'pending',
  attempts TINYINT UNSIGNED NOT NULL DEFAULT 0,
  lease_token VARCHAR(64) NULL,
  lease_until TIMESTAMP(3) NULL,
  next_attempt_at TIMESTAMP(3) NULL,
  detail VARCHAR(200) NULL,
  read_at TIMESTAMP(3) NULL,
  created_by VARCHAR(64) NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_subscription_reminder_day (subscription_id,kind,reminder_date),
  FOREIGN KEY (subscription_id) REFERENCES member_subscriptions(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_subscription_reminder_delivery (delivery,next_attempt_at),
  INDEX idx_subscription_reminder_history (subscription_id,created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
