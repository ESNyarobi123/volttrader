-- Admin-configurable deposit payment details (mobile money + bank).
ALTER TABLE "platform_settings" ADD COLUMN IF NOT EXISTS "deposit_mobile_provider" TEXT;
ALTER TABLE "platform_settings" ADD COLUMN IF NOT EXISTS "deposit_mobile_number" TEXT;
ALTER TABLE "platform_settings" ADD COLUMN IF NOT EXISTS "deposit_mobile_name" TEXT;
ALTER TABLE "platform_settings" ADD COLUMN IF NOT EXISTS "deposit_bank_name" TEXT;
ALTER TABLE "platform_settings" ADD COLUMN IF NOT EXISTS "deposit_bank_account" TEXT;
ALTER TABLE "platform_settings" ADD COLUMN IF NOT EXISTS "deposit_bank_account_name" TEXT;
ALTER TABLE "platform_settings" ADD COLUMN IF NOT EXISTS "deposit_instructions" TEXT;
