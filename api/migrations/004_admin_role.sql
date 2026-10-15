ALTER TABLE users MODIFY role ENUM('client','trainer','admin') NOT NULL DEFAULT 'client';
