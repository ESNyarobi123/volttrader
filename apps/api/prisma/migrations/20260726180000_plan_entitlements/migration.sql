-- Plan entitlement enums
CREATE TYPE "PlanSubscriptionStatus" AS ENUM ('ACTIVE', 'CANCELLED', 'EXPIRED');

ALTER TYPE "LedgerEntryType" ADD VALUE IF NOT EXISTS 'COURSE_PLAN_PURCHASE';
ALTER TYPE "PaymentType" ADD VALUE IF NOT EXISTS 'COURSE_PLAN_PURCHASE';

-- Course → CoursePlan
ALTER TABLE "courses" ADD COLUMN "course_plan_id" TEXT;
ALTER TABLE "courses" ADD CONSTRAINT "courses_course_plan_id_fkey" FOREIGN KEY ("course_plan_id") REFERENCES "course_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "courses_course_plan_id_idx" ON "courses"("course_plan_id");

-- Opportunity → InvestmentPlan
ALTER TABLE "opportunities" ADD COLUMN "investment_plan_id" TEXT;
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_investment_plan_id_fkey" FOREIGN KEY ("investment_plan_id") REFERENCES "investment_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "opportunities_investment_plan_id_idx" ON "opportunities"("investment_plan_id");

-- Payment.coursePlanId
ALTER TABLE "payments" ADD COLUMN "course_plan_id" TEXT;

-- Course plan subscriptions
CREATE TABLE "course_plan_subscriptions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "course_plan_id" TEXT NOT NULL,
    "status" "PlanSubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "payment_id" TEXT,
    "starts_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ends_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "course_plan_subscriptions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "course_plan_subscriptions_user_id_status_idx" ON "course_plan_subscriptions"("user_id", "status");
CREATE INDEX "course_plan_subscriptions_course_plan_id_idx" ON "course_plan_subscriptions"("course_plan_id");

ALTER TABLE "course_plan_subscriptions" ADD CONSTRAINT "course_plan_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "course_plan_subscriptions" ADD CONSTRAINT "course_plan_subscriptions_course_plan_id_fkey" FOREIGN KEY ("course_plan_id") REFERENCES "course_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Investment plan subscriptions
CREATE TABLE "investment_plan_subscriptions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "investment_plan_id" TEXT NOT NULL,
    "status" "PlanSubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "starts_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ends_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "investment_plan_subscriptions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "investment_plan_subscriptions_user_id_status_idx" ON "investment_plan_subscriptions"("user_id", "status");
CREATE INDEX "investment_plan_subscriptions_investment_plan_id_idx" ON "investment_plan_subscriptions"("investment_plan_id");

ALTER TABLE "investment_plan_subscriptions" ADD CONSTRAINT "investment_plan_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "investment_plan_subscriptions" ADD CONSTRAINT "investment_plan_subscriptions_investment_plan_id_fkey" FOREIGN KEY ("investment_plan_id") REFERENCES "investment_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
