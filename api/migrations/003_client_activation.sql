-- Preserve access for existing accounts; future clients need trainer approval.
ALTER TABLE users ADD COLUMN activated BOOLEAN NOT NULL DEFAULT TRUE AFTER disabled;
ALTER TABLE users ALTER COLUMN activated SET DEFAULT FALSE;
