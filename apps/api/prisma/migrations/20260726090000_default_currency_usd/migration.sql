-- Platform default currency: USD (cents as minor units)
ALTER TABLE "courses" ALTER COLUMN "price_currency" SET DEFAULT 'USD';
ALTER TABLE "course_plans" ALTER COLUMN "price_currency" SET DEFAULT 'USD';
ALTER TABLE "investment_plans" ALTER COLUMN "currency" SET DEFAULT 'USD';
ALTER TABLE "opportunities" ALTER COLUMN "currency" SET DEFAULT 'USD';
ALTER TABLE "wallets" ALTER COLUMN "currency" SET DEFAULT 'USD';

ALTER TABLE "platform_settings" ALTER COLUMN "min_deposit_minor" SET DEFAULT 1000;
ALTER TABLE "platform_settings" ALTER COLUMN "min_withdrawal_minor" SET DEFAULT 2500;

UPDATE "wallets" SET "currency" = 'USD';
UPDATE "courses" SET "price_currency" = 'USD';
UPDATE "course_plans" SET "price_currency" = 'USD';
UPDATE "investment_plans" SET "currency" = 'USD';
UPDATE "opportunities" SET "currency" = 'USD';
UPDATE "investments" SET "currency" = 'USD';
UPDATE "payments" SET "currency" = 'USD';
UPDATE "withdrawals" SET "currency" = 'USD';
-- ledger_entries is append-only (trigger blocks UPDATE) — new credits use USD via app/seed.
UPDATE "coupons" SET "currency" = 'USD' WHERE "currency" IS NOT NULL;

UPDATE "platform_settings"
SET
  "min_deposit_minor" = 1000,
  "min_withdrawal_minor" = 2500
WHERE "id" = 'default';
