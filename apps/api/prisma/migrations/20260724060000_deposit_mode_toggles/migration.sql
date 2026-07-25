-- Admin toggles: which deposit paths members may use.
ALTER TABLE "platform_settings" ADD COLUMN IF NOT EXISTS "deposit_manual_enabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "platform_settings" ADD COLUMN IF NOT EXISTS "deposit_online_enabled" BOOLEAN NOT NULL DEFAULT true;
