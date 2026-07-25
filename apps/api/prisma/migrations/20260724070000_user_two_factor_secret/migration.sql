-- TOTP 2FA secret storage (encrypted at app layer).
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "two_factor_secret" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "two_factor_enabled_at" TIMESTAMP(3);
