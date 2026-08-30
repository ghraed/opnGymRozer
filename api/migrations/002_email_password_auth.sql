ALTER TABLE users
  ADD COLUMN email VARCHAR(254) NULL AFTER name,
  ADD COLUMN password_hash VARCHAR(255) NULL AFTER email,
  ADD UNIQUE KEY uq_users_email (email);
