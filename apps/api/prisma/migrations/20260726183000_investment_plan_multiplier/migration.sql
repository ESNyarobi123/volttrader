-- AlterTable
ALTER TABLE "investment_plans" ADD COLUMN "projection_multiplier" DECIMAL(10,4) NOT NULL DEFAULT 1;

-- Backfill common seeded multipliers from prior highlight text (best-effort).
UPDATE "investment_plans" SET "projection_multiplier" = 2 WHERE "name" = 'Spark';
UPDATE "investment_plans" SET "projection_multiplier" = 3 WHERE "name" = 'Momentum';
UPDATE "investment_plans" SET "projection_multiplier" = 4 WHERE "name" = 'Velocity';
UPDATE "investment_plans" SET "projection_multiplier" = 5 WHERE "name" = 'Summit';
