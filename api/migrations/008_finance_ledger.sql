-- Independent cash ledger; historical subscription statuses do not imply receipts.
CREATE TABLE finance_entries (
  id VARCHAR(64) PRIMARY KEY,
  kind ENUM('revenue','expense') NOT NULL,
  entry_date DATE NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  currency ENUM('USD','LBP') NOT NULL,
  category VARCHAR(80) NOT NULL,
  description VARCHAR(500) NOT NULL,
  reference VARCHAR(120) NOT NULL DEFAULT '',
  method ENUM('cash','card','transfer','other') NOT NULL,
  created_by VARCHAR(64) NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  voided_at TIMESTAMP(3) NULL,
  voided_by VARCHAR(64) NULL,
  void_reason VARCHAR(500) NULL,
  CONSTRAINT chk_finance_amount CHECK (amount > 0),
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (voided_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_finance_period (entry_date,kind,currency),
  INDEX idx_finance_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
