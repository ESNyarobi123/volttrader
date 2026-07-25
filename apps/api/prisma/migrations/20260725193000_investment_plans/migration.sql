-- Landing investment pricing plans (admin-managed marketing cards)
CREATE TABLE "investment_plans" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subtitle" TEXT NOT NULL,
    "min_amount" BIGINT NOT NULL,
    "currency" "Currency" NOT NULL DEFAULT 'TZS',
    "duration_days" INTEGER NOT NULL DEFAULT 30,
    "projection_label" "ProjectionLabel" NOT NULL DEFAULT 'TARGET_PERFORMANCE',
    "projection_highlight" TEXT NOT NULL,
    "risk_category" "RiskCategory" NOT NULL DEFAULT 'MEDIUM',
    "features" TEXT[],
    "cta_label" TEXT NOT NULL DEFAULT 'Explore floor',
    "cta_href" TEXT NOT NULL DEFAULT '/trading-floor',
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "investment_plans_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "investment_plans_published_sort_order_idx" ON "investment_plans"("published", "sort_order");
