-- Remove retired invitation data without changing accounts or membership coverage.
DROP TABLE IF EXISTS invites;

-- MySQL DDL commits independently. Keep retries safe if startup stops mid-migration.
SET @drop_invitation_column = IF(
  EXISTS(SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'users' AND column_name = 'invited_by'),
  'ALTER TABLE users DROP COLUMN invited_by',
  'SELECT 1'
);
PREPARE remove_invitation_column FROM @drop_invitation_column;
EXECUTE remove_invitation_column;
DEALLOCATE PREPARE remove_invitation_column;
